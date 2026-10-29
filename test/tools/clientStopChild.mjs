//api-clientStop之前端子行程(不帶.test., 不被runner當測試檔): 只含前端, 伺服端在測試行程, 使伺服端之延遲計時器不影響本行程結束時間之量測
//用法: node clientStopChild.mjs <scenario> <port>; 行程結束時印一行'RESULT {...}'
//  res.exitDelay: 停止至本行程自然結束之毫秒(本行程不呼叫process.exit, 只有看門狗逾時才結束), 僅供診斷, 不作斷言(牆鐘受負載影響; 「行程可立即結束」改以下列二結構指標判定, 見api-clientStop)
//  res.inFlightAfterFlush: 停止後一個macrotask(setImmediate)時仍在途之請求數(含輪詢): 停止時在途之請求若被中止, 其拒絕於微任務內完成, 此時須為0; 未中止者(伺服端延遲3秒)仍在途
//  res.activeAfterDrain: 停止後再讓兩層1ms計時器跑完並讓出一個macrotask後, process.getActiveResourcesInfo()之內容(unref之看門狗與負載試驗之預載計時器不計入): 不得殘留Timeout(殘留者行程無法立即結束)
//  res.errorsAfterStop: 停止後通訊物件上之全部error(w-converhp每次嘗試失敗為字串, w-serv-broadcast與w-sync-webdata為{msg,...})
//  res.logsAfterStop: 停止後之console.log(w-converhp之重試訊息)
//  res.pollInFlightAtStop: 停止當下在途之輪詢數(w-serv-broadcast 1.1.8之輪詢不帶signal而不被中止, 供判讀)
//停止時機以因果而非等待毫秒: 於目標請求(tags: [sys:getTableTags], select: tabA.select)已交給通訊物件後的微任務內停止; fapi情境於首次同步批次完成(getAfterUpdateTableTags)時
//通訊物件之timeout為1000ms: 伺服端對tokSlow延遲3000ms, 使本套件在途之請求於停止後(若未中止)逾時而依retryMain=3重試並逐次發出error; 伺服器本身不停止(輪詢照常成功)
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'

let [scenario, sport] = process.argv.slice(2)

//fdSrc, 本套件之src, 以本檔所在位置定位(test/tools → src)
let fdSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
let { default: WServWebdataClient } = await import(pathToFileURL(path.resolve(fdSrc, 'WServWebdataClient.mjs')).href)

let t0 = Date.now()
let now = () => Date.now() - t0
let res = { scenario, tStop: null, errorsAfterStop: [], logsAfterStop: [], hooksAfterStop: [], tokenAfterStop: 0, pollInFlightAtStop: null, inFlightAfterFlush: null, activeAfterDrain: null, fapi: null, exitDelay: null }

//w-converhp之重試訊息經console.log輸出, 停止後者記錄之
let log0 = console.log
console.log = (...args) => {
    if (res.tStop !== null) {
        res.logsAfterStop.push(args.map((v) => String(v)).join(' '))
    }
}

//conv, 記錄在途之輪詢數(轉呼叫時原樣傳遞全部參數)
let conv = new WConverhpClient({ url: `http://localhost:${sport}`, timeout: 1000 })
let pollInFlight = 0
let inFlight = 0 //全部在途之請求(含輪詢)
let stopOnSend = null //目標請求名: 該請求交給通訊物件後的微任務內停止(請求在途)
let execute0 = conv.execute
conv.execute = (...args) => {
    let isPoll = args[0] === '[sys:polling]'
    inFlight++
    if (isPoll) {
        pollInFlight++
    }
    let p = execute0(...args)
        .finally(() => {
            inFlight--
            if (isPoll) {
                pollInFlight--
            }
        })
    if (args[0] === stopOnSend) {
        stopOnSend = null
        queueMicrotask(() => {
            stop()
        })
    }
    return p
}

let token = 'tok'
let cl = null
let fapi = null
let onServerMethods = () => {}
let onRefreshTable = () => {}
let onAfter = () => {}
let stop = () => {
    res.tStop = now()
    res.pollInFlightAtStop = pollInFlight
    cl.clearBroadcast()
    cl.clearSync()

    //停止後一個macrotask: 在途之請求是否已被中止; 再讓兩層1ms計時器(已排定之派發)跑完並讓出一個macrotask後, 是否殘留計時器
    setImmediate(() => {
        res.inFlightAfterFlush = inFlight
        setTimeout(() => {
            setTimeout(() => {
                setImmediate(() => {
                    res.activeAfterDrain = process.getActiveResourcesInfo()
                })
            }, 1)
        }, 1)
    })
}
let hook = (name, fn) => {
    return (...args) => {
        if (res.tStop !== null) {
            res.hooksAfterStop.push(name)
        }
        if (fn) {
            return fn(...args)
        }
    }
}
cl = new WServWebdataClient(conv, {
    getToken: () => {
        if (res.tStop !== null) {
            res.tokenAfterStop++
        }
        return token
    },
    getServerMethods: hook('getServerMethods', (r) => {
        fapi = r
        onServerMethods()
    }),
    recvData: hook('recvData'),
    getRefreshState: hook('getRefreshState'),
    getRefreshTable: hook('getRefreshTable', () => {
        onRefreshTable()
    }),
    getBeforeUpdateTableTags: hook('getBeforeUpdateTableTags'),
    getAfterUpdateTableTags: hook('getAfterUpdateTableTags', () => {
        onAfter()
    }),
})
cl.on('error', (err) => {
    if (res.tStop !== null) {
        res.errorsAfterStop.push(typeof err === 'string' ? err : JSON.parse(JSON.stringify(err)))
    }
})

process.on('exit', () => {
    res.exitDelay = res.tStop === null ? null : now() - res.tStop
    log0('RESULT ' + JSON.stringify(res))
})

//看門狗: 不影響自然結束(unref), 逾時才強制結束並標記
setTimeout(() => {
    res.watchdog = true
    process.exit(0)
}, 25000).unref()

if (scenario === 'fnList') {
    //取得函數清單後(getServerMethods內)即停止: 此時取時間戳尚未送出
    onServerMethods = () => {
        stop()
    }
}
else if (scenario === 'tags') {
    //取時間戳在途時停止(伺服端對tokSlow延遲3秒): 取時間戳交給通訊物件後停止
    onServerMethods = () => {
        token = 'tokSlow'
        stopOnSend = '[sys:getTableTags]'
    }
}
else if (scenario === 'select') {
    //同步表之select在途時停止: select交給通訊物件後停止
    onRefreshTable = () => {
        token = 'tokSlow'
        stopOnSend = 'tabA.select'
    }
}
else if (scenario === 'fapi') {
    //首次同步批次完成後使用端呼叫函數(伺服端延遲300ms), 隨即停止: 照常結算
    onAfter = () => {
        onAfter = () => {}
        let core = async () => {
            token = 'tokMid'
            let p = fapi.tabA.select()
            stop()
            try {
                res.fapi = { state: 'resolve', r: await p }
            }
            catch (err) {
                res.fapi = { state: 'reject', err: String(err) }
            }
        }
        core()
    }
}
