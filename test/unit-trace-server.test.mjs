import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import { genTracer, drain } from './tools/tracer.mjs'


//伺服端opt.onTrace(觀察回調): 本套件自身無計時器, 原樣轉交所包之w-serv-broadcast伺服端之opt.onTrace(1.1.14起), 事件之定義與時機見其JSDoc
//規格: C:\opensrcOper\dspec\計時器相關函數之觀察回調與測試.md P3(未傳回調時行為不變)、P4(回調不影響被測函數)
//  五種回調: 未傳、紀錄器、拋錯、回傳rejection、非函數, 同一情境結果須相同且無未處理之rejection
//  事件須為凍結之{ type, ... }、欄位為原始值、不帶接收者(this為undefined)
//以evem建構(不開網路), 模擬w-converhp派發execute事件, 同步以事件與Promise而非等待毫秒
describe('unit-trace-server', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-trace-server'

    //insts, 建構過之實體, 測完須clearBroadcast
    let insts = []

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        for (let inst of insts) {
            inst.clearBroadcast()
            inst.clearSync()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //w-serv-broadcast伺服端之事件種類(本套件原樣轉交, 不增不減; 不含w-sync-webdata之queued、flush)
    let typesBroadcast = ['alive', 'prune', 'emit', 'deliver', 'report', 'stop']

    let nInst = 0

    //mk, 建立實體(不同步); opt.onTrace由hasOpt決定是否給
    let mk = (onTrace, hasOpt = true) => {
        let opt = {
            fpTableTags: `${fdTmp}/tags-${nInst++}.json`,
            getUserIdByToken: (token) => {
                return token === 'tokU1' ? 'u1' : (token === 'tokU2' ? 'u2' : '')
            },
            useDbOrm: true,
            kpOrm: {},
            operOrm: async () => [{ id: 'r1' }],
            tableNamesExec: ['tabA'],
            methodsExec: ['select'],
            authorizeExec: () => true,
        }
        if (hasOpt) {
            opt.onTrace = onTrace
        }
        let inst = evem()
        insts.push(inst)
        new WServWebdataServer(inst, opt)
        return inst
    }

    //scenario, 同一情境: u1輪詢c1放行(clientEnter)→u2冒用c1被拒絕(error事件)→clearBroadcast(補發clientLeave); 回傳可比較之結果(不得因回調而異)
    //beforeStop為停止前要等待之事件(選用, 結果不受其影響)
    let scenario = async (onTrace, hasOpt = true, beforeStop = null) => {
        let inst = mk(onTrace, hasOpt)
        let enters = []
        let leaves = []
        let errs = []
        let pmEnter = genPm()
        let pmErr = genPm()
        let pmLeave = genPm()
        inst.on('clientEnter', (id) => {
            enters.push(id)
            pmEnter.resolve(true)
        })
        inst.on('clientLeave', (id) => {
            leaves.push(id)
            pmLeave.resolve(true)
        })
        inst.on('error', (e) => {
            errs.push(e)
            pmErr.resolve(true)
        })
        let poll = async (clientId, token) => {
            let pm = genPm()
            inst.emit('execute', '[sys:polling]', { clientId, __sysToken__: token }, pm)
            return pm.then((v) => ({ ok: true, v }), (err) => ({ ok: false, err }))
        }
        let r1 = await poll('c1', 'tokU1')
        await pmEnter
        let r2 = await poll('c1', 'tokU2')
        await pmErr
        if (beforeStop !== null) {
            await beforeStop()
        }
        inst.clearBroadcast()
        await pmLeave
        await drain()
        return { r1, r2, enters, leaves, errs }
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
        this.timeout(60000)
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
        let { r: rs, un } = await withUnhandled(() => Promise.all([scenario(undefined, false), ...kinds.map(([, onTrace]) => scenario(onTrace))]))
        let base = rs[0]
        assert.strict.deepEqual(base.r1, { ok: true, v: [] }, '情境確實放行u1')
        assert.strict.deepEqual(base.r2, { ok: false, err: '[sys:polling] permission denied' }, '情境確實拒絕u2冒用')
        assert.strict.deepEqual(base.enters, ['c1'])
        assert.strict.deepEqual(base.leaves, ['c1'])
        assert.strict.deepEqual(base.errs, [{ msg: '[sys:polling] permission denied', err: 'clientId belongs to another userId' }])
        kinds.forEach(([name], i) => {
            assert.strict.deepEqual(rs[i + 1], base, `${name}: 結果與未傳相同`)
        })
        assert.strict.deepEqual(un, [], '無未處理之rejection')
        //回調確實被呼叫過(證明上列結果相同是因為隔離, 而非回調未被轉交)
        assert.strict.equal(nCall.rec > 0, true, '紀錄器被呼叫')
        assert.strict.equal(nCall.throw > 0, true, '拋錯之回調被呼叫')
        assert.strict.equal(nCall.reject > 0, true, '回傳rejection之回調被呼叫')
    })

    //P4: 事件為凍結之原始值物件, 不帶接收者, 型別與內容
    it('紀錄器: 事件為凍結之{ type, ... }且欄位為原始值, 不帶接收者, 進出、拒絕、停止之事件內容', async function() {
        this.timeout(60000)
        let evs = []
        let thisSeen = []
        let tr = genTracer()
        let onTrace = function(e) {
            thisSeen.push(this)
            evs.push(e)
            tr.onTrace(e)
        }
        //停止前等在線偵測(每50ms)與修剪佇列之計時器(每1秒)各觸發一次
        await scenario(onTrace, true, async () => {
            await tr.wait({ type: 'alive', evType: 'tick' })
            await tr.wait({ type: 'prune' })
        })
        assert.strict.deepEqual(thisSeen.filter((v) => v !== undefined), [], '不帶接收者(this為undefined)')
        for (let e of evs) {
            assert.strict.equal(Object.isFrozen(e), true, `${e.type}: 凍結`)
            assert.strict.equal(typeof e.type, 'string')
            assert.strict.equal(Object.values(e).every((v) => v === null || (typeof v !== 'object' && typeof v !== 'function')), true, `${JSON.stringify(e)}: 欄位皆為原始值`)
        }

        //原樣轉交: 事件種類皆屬w-serv-broadcast伺服端, 不含w-sync-webdata之事件
        assert.strict.deepEqual(evs.map((e) => e.type).filter((t) => !typesBroadcast.includes(t)), [], '事件種類皆屬w-serv-broadcast伺服端')

        //alive: 在線偵測之事件, 其種類欄位為evType(不與type衝突)
        let iEnter = evs.findIndex((e) => e.type === 'alive' && e.evType === 'enter' && e.key === 'c1' && e.now === 1)
        assert.strict.equal(iEnter >= 0, true, 'alive enter')
        assert.strict.equal(evs.some((e) => e.type === 'alive' && e.evType === 'tick' && Number.isInteger(e.size)), true, 'alive tick')

        //clientEnter: emit(早於派發) → deliver
        let iEmit = evs.findIndex((e) => e.type === 'emit' && e.name === 'clientEnter' && e.final === false)
        let iDel = evs.findIndex((e) => e.type === 'deliver' && e.name === 'clientEnter' && e.final === false && e.ok === true)
        assert.strict.equal(iEmit >= 0 && iDel > iEmit, true, 'clientEnter之emit早於deliver')
        assert.strict.equal(iEnter < iEmit, true, 'alive enter早於clientEnter之排定')

        //輪詢被拒絕(clientId歸屬他人)之error事件經emit與deliver
        let iErrEmit = evs.findIndex((e) => e.type === 'emit' && e.name === 'error')
        let iErrDel = evs.findIndex((e) => e.type === 'deliver' && e.name === 'error' && e.ok === true)
        assert.strict.equal(iErrEmit >= 0 && iErrDel > iErrEmit, true, 'error之emit早於deliver')

        //stop: clearBroadcast首次呼叫完成, final為補發clientLeave之客戶端數; 補發之clientLeave為final
        let stops = evs.filter((e) => e.type === 'stop')
        assert.strict.deepEqual(stops.map((e) => ({ ...e })), [{ type: 'stop', final: 1 }])
        assert.strict.equal(evs.some((e) => e.type === 'emit' && e.name === 'clientLeave' && e.final === true), true, '停止時補發clientLeave')
        assert.strict.equal(evs.some((e) => e.type === 'deliver' && e.name === 'clientLeave' && e.final === true && e.ok === true), true)

        //prune: queues為修剪後之佇列數, removed為本次移除數(離線時已先刪佇列, 正常恆為0)
        let pr = evs.find((e) => e.type === 'prune')
        assert.strict.deepEqual({ ...pr }, { type: 'prune', queues: 1, removed: 0 })
    })

    //report: 使用端之監聽器拋錯, w-serv-broadcast改以error事件通報(本套件原樣轉交其report事件)
    it('使用端之監聽器拋錯時: 伺服端仍以error事件通報, report事件原樣轉交', async function() {
        this.timeout(60000)
        let tr = genTracer()
        let inst = mk(tr.onTrace)
        let errs = []
        inst.on('error', (e) => {
            errs.push(e)
        })
        inst.on('clientEnter', () => {
            throw new Error('listener boom')
        })
        let pm = genPm()
        inst.emit('execute', '[sys:polling]', { clientId: 'c9', __sysToken__: 'tokU1' }, pm)
        await pm
        let e = await tr.wait({ type: 'report' })
        assert.strict.deepEqual({ ...e }, { type: 'report', src: 'listener', msg: 'listener of event[clientEnter] error', via: 'event', name: 'clientEnter' })
        assert.strict.equal(errs.some((v) => v && v.msg === 'listener of event[clientEnter] error'), true)
        let d = await tr.wait({ type: 'deliver', name: 'clientEnter' })
        assert.strict.equal(d.ok, false, 'deliver之ok為監聽器是否皆未拋錯')
    })

})
