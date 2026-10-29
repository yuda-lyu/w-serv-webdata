import assert from 'assert'
import { genTracer, drain } from './tools/tracer.mjs'
import { extraHooks, genRun, linkCtl } from './tools/clientHarness.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


//前端opt.onTrace(觀察回調): 本套件自身無計時器, 原樣轉交所包之w-serv-broadcast前端之opt.onTrace(1.1.14起), 事件之定義與時機見其JSDoc
//規格: C:\opensrcOper\dspec\計時器相關函數之觀察回調與測試.md P3(未傳回調時行為不變)、P4(回調不影響被測函數)
//  五種回調: 未傳、紀錄器、拋錯、回傳rejection、非函數, 同一情境結果須相同且無未處理之rejection
//  事件須為凍結之{ type, ... }、欄位為原始值、不帶接收者(this為undefined)
//記憶體假通訊層(不開埠), 同步以事件而非等待毫秒(見./tools/clientHarness.mjs)
describe('unit-trace-client', function() {

    //cleans, 測完須停止之輪詢與廣播
    let cleans = []

    after(function() {
        for (let f of cleans) {
            f()
        }
    })

    let run = genRun(WServWebdataClient, cleans)

    //w-serv-broadcast前端之事件種類(本套件原樣轉交, 不增不減; 不含w-sync-webdata之timeout、delayStart、delayEnd)
    let typesBroadcast = ['start', 'tick', 'request', 'result', 'emit', 'deliver', 'report', 'stop']

    //scenario, 同一情境: 首輪輪詢成功→綁定→同步一次(取函數清單、時間戳、select)→停止; hasOpt為false時不給onTrace鍵(run預設會給其記錄器, 故以顯式undefined取代)
    //回傳可比較之結果(所有結果皆不得因回調而異)
    let scenario = async (onTrace, hasOpt = true, extra = {}) => {
        let { cl, sent } = linkCtl()
        let log = run(cl, { ...extraHooks(), onTrace: hasOpt ? onTrace : undefined, ...extra })
        await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
        log.cl.clearBroadcast()
        log.cl.clearSync()
        await drain()
        return { log, snap: { sent: [...sent], recv: log.recv, hooks: log.hooks, errors: log.rawErrors, nToken: log.nToken, fapi: typeof log.fapi } }
    }

    //withUnhandled, 擷取執行期間之unhandledRejection
    let withUnhandled = async (fn) => {
        let un = []
        let onUn = (r) => {
            un.push(r)
        }
        process.on('unhandledRejection', onUn)
        try {
            let r = await fn()
            await drain(3) //unhandledRejection於微任務佇列清空後檢查, 讓出數個macrotask使其必已發生
            return { r, un }
        }
        finally {
            process.off('unhandledRejection', onUn)
        }
    }

    //P3、P4: 五種回調之結果相同
    it('五種回調(未傳、紀錄器、拋錯、回傳rejection、非函數): 同一情境結果相同且無未處理之rejection', async function() {
        this.timeout(120000)
        let nCall = { rec: 0, throw: 0, reject: 0 }
        let kinds = [
            ['紀錄器', () => {
                nCall.rec++
            }],
            ['拋錯', () => {
                nCall.throw++
                throw new Error('onTrace boom')
            }],
            ['回傳rejection', () => {
                nCall.reject++
                return Promise.reject(new Error('onTrace reject'))
            }],
            ['async函數拋錯', async () => {
                nCall.reject++
                throw new Error('onTrace async boom')
            }],
            ['非函數(字串)', 'x'],
            ['非函數(數字)', 123],
            ['非函數(物件)', { a: 1 }],
            ['非函數(true)', true],
            ['null', null],
        ]
        //各情境各自獨立(各有自己的假通訊層與前端)而並行執行, 一次等同一個首輪輪詢的時間
        let { r: rs, un } = await withUnhandled(() => Promise.all([scenario(undefined, false), ...kinds.map(([, onTrace]) => scenario(onTrace))]))
        let base = rs[0].snap
        assert.strict.deepEqual(base.sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]', 'tabA.select'], '情境確實完成一次同步')
        assert.strict.deepEqual(base.errors, [])
        kinds.forEach(([name], i) => {
            assert.strict.deepEqual(rs[i + 1].snap, base, `${name}: 結果與未傳相同`)
        })
        assert.strict.deepEqual(un, [], '無未處理之rejection')
        //回調確實被呼叫過(證明上列結果相同是因為隔離, 而非回調未被轉交)
        assert.strict.equal(nCall.rec > 0, true, '紀錄器被呼叫')
        assert.strict.equal(nCall.throw > 0, true, '拋錯之回調被呼叫')
        assert.strict.equal(nCall.reject > 0, true, '回傳rejection之回調被呼叫')
    })

    //P4: 事件為凍結之原始值物件, 不帶接收者, 型別與順序
    it('紀錄器: 事件為凍結之{ type, ... }且欄位為原始值, 不帶接收者, 首輪輪詢之事件依序發生', async function() {
        this.timeout(60000)
        let evs = []
        let thisSeen = []
        let onTrace = function(e) {
            thisSeen.push(this)
            evs.push(e)
        }
        let { log } = await scenario(onTrace)
        assert.strict.equal(evs.length > 0, true)
        assert.strict.deepEqual(thisSeen.filter((v) => v !== undefined), [], '不帶接收者(this為undefined)')
        for (let e of evs) {
            assert.strict.equal(Object.isFrozen(e), true, `${e.type}: 凍結`)
            assert.strict.equal(typeof e.type, 'string')
            assert.strict.equal(Object.values(e).every((v) => v === null || (typeof v !== 'object' && typeof v !== 'function')), true, `${JSON.stringify(e)}: 欄位皆為原始值`)
        }

        //原樣轉交: 事件種類皆屬w-serv-broadcast前端, 不含w-sync-webdata之事件
        assert.strict.deepEqual(evs.map((e) => e.type).filter((t) => !typesBroadcast.includes(t)), [], '事件種類皆屬w-serv-broadcast前端')

        //首輪輪詢: start → tick → request → result → emit(openOnce) → deliver(openOnce)
        let idx = (cond) => {
            return evs.findIndex((e) => Object.keys(cond).every((k) => e[k] === cond[k]))
        }
        let iStart = idx({ type: 'start' })
        let iTick = idx({ type: 'tick', n: 1, skipped: false })
        let iReq = idx({ type: 'request', n: 1, token: true }) //本套件把getToken交給w-serv-broadcast前端, 輪詢帶token
        let iRes = idx({ type: 'result', n: 1, ok: true, reason: 'ok', msgs: 0 })
        let iEmit = idx({ type: 'emit', name: 'openOnce', final: false })
        let iDel = idx({ type: 'deliver', name: 'openOnce', final: false, ok: true })
        for (let i of [iStart, iTick, iReq, iRes, iEmit, iDel]) {
            assert.strict.equal(i >= 0, true, JSON.stringify(evs.map((e) => e.type)))
        }
        assert.strict.deepEqual([iStart, iTick, iReq, iRes, iEmit, iDel], [iStart, iTick, iReq, iRes, iEmit, iDel].slice().sort((a, b) => a - b), '依序發生')
        assert.strict.equal(Number.isInteger(evs[iStart].ms) && evs[iStart].ms > 0, true, 'start.ms為輪詢間隔')

        //停止: stop事件恰一則, 停止後不再有輪詢之事件
        assert.strict.equal(evs.filter((e) => e.type === 'stop').length, 1)
        assert.strict.equal(typeof evs.find((e) => e.type === 'stop').inflight, 'boolean')
        let n = evs.length
        await drain(3)
        assert.strict.equal(evs.length, n, '停止後不再通知')
        assert.strict.equal(log.rawErrors.length, 0)
    })

    //report: 使用端之監聽器拋錯, w-serv-broadcast改以error事件通報(本套件原樣轉交其report事件)
    it('使用端之監聽器拋錯時: 前端仍以error事件通報, report事件原樣轉交', async function() {
        this.timeout(60000)
        let tr = genTracer()
        let { cl } = linkCtl()
        let log = run(cl, { ...extraHooks(), onTrace: tr.onTrace })
        log.cl.on('openOnce', () => {
            throw new Error('listener boom')
        })
        let e = await tr.wait({ type: 'report' })
        assert.strict.deepEqual({ ...e }, { type: 'report', src: 'listener', msg: 'listener of event[openOnce] error', via: 'event', name: 'openOnce' })
        assert.strict.equal(log.rawErrors.some((v) => v && v.msg === 'listener of event[openOnce] error'), true)
        let d = await tr.wait({ type: 'deliver', name: 'openOnce' })
        assert.strict.equal(d.ok, false, 'deliver之ok為監聽器是否皆未拋錯')
        log.cl.clearBroadcast()
        log.cl.clearSync()
    })

})
