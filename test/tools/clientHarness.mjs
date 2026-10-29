import evem from 'wsemi/src/evem.mjs'
import { genTracer, flush, drain } from './tracer.mjs'


//前端測試共用之輔助(不帶.test., 不被runner當測試檔), 前端時序測試以記憶體假通訊層相連(不開埠)
//同步一律以事件而非等待毫秒(規格: dspec/計時器相關函數之觀察回調與測試.md): run所建之前端把opt.onTrace(轉交w-serv-broadcast前端)與測試輔助自身之事件記入同一個tracer(log.tr), 測試以log.tr.wait等第N個事件
//  輔助自身之事件(type與w-serv-broadcast之start、tick、request、result、stop、emit、deliver、report不重名):
//    hook(name): 使用端之回調函數(hookNames)被呼叫, 於呼叫前記錄(故回調內停止者, 等此事件之續行必見停止之結果)
//    error: 前端之error事件到達使用端監聽
//    exec(func)、execEnd(func): 假通訊層(linkCtl、linkSig)收到請求(已記入sent)、回應該請求(於其回傳之promise settle之前一刻); 假通訊層另掛__subs(訂閱者), run為所建之前端訂閱, 使log.tr收到其後之exec與execEnd(同一通訊物件重建者各有自己的log.tr)
//  不對getToken與execute回傳之promise掛任何處理(掛了即視為已處理, 會掩蓋本套件漏接rejection之缺陷), 非同步之結束由假通訊層自身或測試自己的getToken實作記錄
//假通訊層兩種並存, 代表兩類通訊物件(見CLAUDE_rulebook.md之R11、R14):
//  linkCtl: execute只取func、忽略第4參數, 代表不支援opt.signal之通訊物件(w-converhp 2.1.8之前、w-converws、w-conversi), 為停止閘門之觀察者, 既有〈停止〉各條一律用之
//  linkSig: 依w-converhp 2.1.8之契約處理opt.signal, 中止之新行為用之
//不可把linkCtl整體改為依signal: 停止前已交給通訊物件之請求改為被中止而不再晚到, executeShell於取得token後、updateSyncTable、callHook入口之閘門即無測試可觀察(2026-10-13獨立審查之變異實測)


let sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}


//hookNames, 使用端之回調函數(getToken除外), run以hooks記錄有給者之呼叫次數
let hookNames = ['getServerMethods', 'recvData', 'getRefreshState', 'getRefreshTable', 'getBeforeUpdateTableTags', 'getAfterUpdateTableTags']


//extraHooks, run預設未給之三個回調函數(空函數), 需記錄全部回調之呼叫次數者另給; run不可預設全給, 否則「回調函數未給」之路徑無測試走到
let extraHooks = () => {
    return { getRefreshState: () => {}, getRefreshTable: () => {}, getBeforeUpdateTableTags: () => {} }
}


//zeros, 各回調函數皆未被呼叫
let zeros = () => {
    let r = {}
    for (let k of hookNames) {
        r[k] = 0
    }
    return r
}


//genRun, 建立run: 建構前端並收集事件(rawErrors為error事件之原值, hooks為有給之回調函數之呼叫次數), 建構者記入cleans供測完停止
let genRun = (WServWebdataClient, cleans) => {
    return (cl, opt = {}) => {
        let log = { recv: [], errors: [], rawErrors: [], after: 0, fapi: null, cl: null, hooks: {}, tr: genTracer() }
        let hasLink = Array.isArray(cl.__subs) //假通訊層(linkCtl、linkSig)自行記錄exec與execEnd, 轉給本前端之記錄器
        if (hasLink) {
            cl.__subs.push(log.tr.onTrace)
        }
        let kp = {
            onTrace: log.tr.onTrace,
            getToken: () => 'tok',
            getServerMethods: (r) => {
                log.fapi = r
            },
            recvData: (r) => {
                log.recv.push({ tableName: r.tableName, data: r.data })
            },
            getAfterUpdateTableTags: () => {
                log.after++
            },
            ...opt,
        }
        //getToken亦記錄呼叫次數(nToken): 本套件於停止後不再呼叫使用端之函數, 停止後才開始之本套件請求連getToken亦不呼叫
        //輪詢(w-serv-broadcast前端, 1.1.11起)於每輪輪詢前亦呼叫getToken以帶token(固定鍵__sysToken__), 其生命週期依w-serv-broadcast而非本套件之停止閘門,
        //故於通訊物件見輪詢時扣回該次(getToken之呼叫緊接著execute, 兩者間無讓出事件迴圈之機會, 除非getToken本身為非同步等待), nToken只計本套件自身與使用端之請求, 各〈停止〉測試之斷言語意不變
        let getToken = kp.getToken
        log.nToken = 0
        kp.getToken = (...args) => {
            log.nToken++
            return getToken(...args)
        }
        //不對getToken與execute回傳之promise掛任何處理(掛了即視為已處理, 會掩蓋本套件漏接rejection之缺陷, 見unit-diaglog之無unhandledRejection斷言):
        //  通訊物件的exec、execEnd事件由假通訊層自身記錄(linkCtl、linkSig); 自備之假通訊層(無__tr)只記exec
        let execute = cl.execute
        cl.execute = function(func, ...rest) {
            if (func === '[sys:polling]') {
                log.nToken--
            }
            if (!hasLink) {
                log.tr.onTrace({ type: 'exec', func })
            }
            return execute.call(this, func, ...rest)
        }
        for (let k of hookNames) {
            let fn = kp[k]
            if (typeof fn !== 'function') {
                continue //未給者維持未給, 走本套件「回調函數未給」之路徑
            }
            log.hooks[k] = 0
            kp[k] = (...args) => {
                log.hooks[k]++
                log.tr.onTrace({ type: 'hook', name: k })
                return fn(...args)
            }
        }
        cl = new WServWebdataClient(cl, kp)
        cl.on('error', (err) => {
            log.rawErrors.push(err)
            log.errors.push(typeof err === 'string' ? err : String(err && err.message ? err.message : (err && err.msg) || err))
            log.tr.onTrace({ type: 'error' })
        })
        cleans.push(() => {
            cl.clearBroadcast()
            cl.clearSync()
        })
        log.cl = cl
        return log
    }
}


//genReply, 假後端之回應: fail有給者以其值拒絕(模擬伺服器已停止等傳輸失敗); 輪詢回poll()之值(預設[], 可給含mode為broadcast之訊息以製造推播); 函數清單回funcs, 時間戳回tags, 其餘回一筆資料
let genReply = ({ funcs, tags, fail, poll }) => {
    return (func) => {
        if (fail[func] !== undefined) {
            return Promise.reject(fail[func])
        }
        if (func === '[sys:polling]') {
            return poll()
        }
        if (func === '[sys:getFuncList]') {
            return { state: 'success', msg: funcs }
        }
        if (func === '[sys:getTableTags]') {
            return { state: 'success', msg: { mode: 'syncKpTable', data: tags } }
        }
        return { state: 'success', msg: [{ id: `row-of-${func}` }] }
    }
}


//linkCtl, 可控之假後端(不支援opt.signal之通訊物件): sent記錄每次送出之函數名, delay為各函數之回應延遲(毫秒, 預設5), fail為各函數之傳輸失敗(其值為拒絕值, 模擬伺服器已停止), poll為每次輪詢之回應
let linkCtl = ({ funcs = ['tabA.select'], tags = { tabA: 't1' }, delay = {}, fail = {}, poll = () => [] } = {}) => {
    let sent = []
    let inputs = [] //與sent同序, 每次送出之輸入(第2參數)
    //tr, 每次收到請求(已記入sent與inputs)記一則{ type: 'exec', func }, 回應時(回傳前一刻)記一則{ type: 'execEnd', func }, 供不經run之測試以tr.until等待sent、inputs之狀態條件;
    //另轉給訂閱者(cl.__subs, run為其所建之前端訂閱, 同一通訊物件重建者各有自己的記錄器, 不混入舊實體之事件)
    let tr = genTracer()
    let subs = []
    let emit = (e) => {
        tr.onTrace(e)
        for (let f of subs) {
            f(e)
        }
    }
    let reply = genReply({ funcs, tags, fail, poll })
    let cl = evem()
    cl.__subs = subs
    cl.execute = async (func, input) => {
        sent.push(func)
        inputs.push(input)
        emit({ type: 'exec', func })
        await sleep(delay[func] !== undefined ? delay[func] : 5)
        let r = reply(func)
        emit({ type: 'execEnd', func })
        return r
    }
    return { cl, sent, inputs, tr }
}


//linkSig, 同linkCtl但依w-converhp 2.1.8之契約處理execute之第4參數opt.signal: 呼叫時已中止者以signal.reason拒絕且不送出(不記入sent); 在途時中止者立即以signal.reason拒絕, 不再等待回應;
//sigs與sent同序, 記錄每次送出之{func, signal}(未給signal者為null)
let linkSig = ({ funcs = ['tabA.select'], tags = { tabA: 't1' }, delay = {}, fail = {}, poll = () => [] } = {}) => {
    let sent = []
    let sigs = []
    //同linkCtl: 每次送出(已記入sent與sigs)記一則{ type: 'exec', func }, 回應或被中止時(settle前一刻)記一則{ type: 'execEnd', func }
    let tr = genTracer()
    let subs = []
    let emit = (e) => {
        tr.onTrace(e)
        for (let f of subs) {
            f(e)
        }
    }
    let reply = genReply({ funcs, tags, fail, poll })
    let cl = evem()
    cl.__subs = subs
    cl.execute = (func, input, cbProgress, opt) => {
        let signal = opt && opt.signal ? opt.signal : null
        if (signal && signal.aborted) {
            return Promise.reject(signal.reason)
        }
        sent.push(func)
        sigs.push({ func, signal })
        emit({ type: 'exec', func })
        return new Promise((resolve, reject) => {
            let onAbort = () => {
                clearTimeout(t)
                emit({ type: 'execEnd', func })
                reject(signal.reason)
            }
            let t = setTimeout(() => {
                if (signal) {
                    signal.removeEventListener('abort', onAbort)
                }
                Promise.resolve()
                    .then(() => reply(func))
                    .then((v) => {
                        emit({ type: 'execEnd', func })
                        resolve(v)
                    }, (err) => {
                        emit({ type: 'execEnd', func })
                        reject(err)
                    })
            }, delay[func] !== undefined ? delay[func] : 5)
            if (signal) {
                signal.addEventListener('abort', onAbort)
            }
        })
    }
    return { cl, sent, sigs, tr }
}


export { sleep, flush, drain, hookNames, extraHooks, zeros, genRun, linkCtl, linkSig }
