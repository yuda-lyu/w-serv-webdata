import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataServerExec from '../src/WServWebdataServerExec.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import genPollingGate from '../src/genPollingGate.mjs'
import probeReadable from '../src/probeReadable.mjs'
import { genRun, linkCtl } from './tools/clientHarness.mjs'
import { genTracer } from './tools/tracer.mjs'
import { genBoom, genUnreadables } from './tools/unreadable.mjs'


//不可讀之值(已撤銷之Proxy、陷阱拋錯之Proxy、Symbol.toStringTag取值拋錯之物件)於判斷函數之連動(帳本R20; 主控裁定: wsemi 1.9.69第8批, 判斷函數對此類值回false而不拋錯, dspec〈輸入參數之檢測機制〉§5.3 C2)
//  修前(wsemi 1.9.68): 判斷函數(isobj、iseobj、isarr、isestr、isfun、isbol、haskey)對不可讀之值拋錯, 本套件數處防線借其拋錯而讓不可讀之值走失敗通道;
//  修後: 判斷函數回false, 須走失敗通道之站點(輪詢身分關卡之輸入、kpOrm、前端$fapi之末參數)改以src/probeReadable.mjs明確判定, 其餘站點之判斷結果(false)本即走既定之失敗或預設通道, 本檔逐站點釘住
//站點全集與處置見規則帳本R20; 敵意值集見test/tools/unreadable.mjs
describe('unit-unreadable', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-unreadable'

    //cleans, 測完須停止之輪詢與廣播
    let cleans = []

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        for (let f of cleans) {
            f()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    let run = genRun(WServWebdataClient, cleans)

    //SECRET, 夾帶於陷阱拋錯訊息之機密字樣, 失敗通道之訊息不得含之
    let SECRET = 'SECRET-trap-9d41'

    let noLeak = (v) => {
        return !String(v && v.message !== undefined ? v.message : v).includes(SECRET)
    }

    //tagKinds, 型別標籤不可讀者(wsemi判斷函數一律回false)
    let tagKinds = () => genUnreadables(SECRET).filter((u) => u.kind === 'tag')

    //fnKinds, 加上has陷阱拋錯者(isfun與isbol判型時另讀Symbol.toStringTag之in判斷, 修前對其拋錯、1.9.69回false; 供以isfun判定之站點)
    let fnKinds = () => genUnreadables(SECRET).filter((u) => u.kind === 'tag' || u.kind === 'has')

    describe('probeReadable(探針)', function() {

        it('可讀之值回空字串: 原始值、一般物件、陣列、函數、null; 任何選項皆同', function() {
            let vs = [undefined, null, 0, 'a', true, Symbol('s'), 10n, {}, { a: 1 }, [], [1], function() {}, () => {}, new Date(), new Map(), Object.create(null)]
            for (let v of vs) {
                assert.strict.equal(probeReadable(v), '')
                assert.strict.equal(probeReadable(v, { hasKeys: ['__sysToken__', Symbol.toStringTag], ownKeys: true, asFun: true }), '', String(typeof v))
            }
        })

        it('不可讀之值: 標籤不可讀者無選項即回非空原因; 標籤可讀者依選項(hasKeys: has陷阱, ownKeys: 可列舉鍵之走訪)回非空原因; 皆不拋錯', function() {
            for (let u of genUnreadables(SECRET)) {
                let note = u.name
                let r0 = probeReadable(u.value)
                let rHas = probeReadable(u.value, { hasKeys: ['k'] })
                let rKeys = probeReadable(u.value, { ownKeys: true })
                let rFun = probeReadable(u.value, { asFun: true })
                if (u.kind === 'tag') {
                    assert.strict.notEqual(r0, '', note)
                    assert.strict.notEqual(rHas, '', note)
                    assert.strict.notEqual(rKeys, '', note)
                    assert.strict.notEqual(rFun, '', note)
                }
                else if (u.kind === 'has') {
                    assert.strict.equal(r0, '', `${note}: 無選項只觸碰標籤`)
                    assert.strict.notEqual(rHas, '', note)
                    assert.strict.equal(rKeys, '', `${note}: 走訪不觸發has陷阱`)
                    assert.strict.notEqual(rFun, '', `${note}: 函數判型(lodash isFunction)讀Symbol.toStringTag之in`)
                    assert.strict.equal(rHas.includes(SECRET), true, `${note}: 原因取自陷阱拋出之錯誤`)
                }
                else {
                    assert.strict.equal(r0, '', note)
                    assert.strict.equal(rHas, '', `${note}: in判斷不觸發ownKeys等陷阱`)
                    assert.strict.equal(rFun, '', `${note}: 函數判型不走訪可列舉鍵`)
                    assert.strict.notEqual(rKeys, '', note)
                    assert.strict.equal(rKeys.includes(SECRET), true, `${note}: 原因取自陷阱拋出之錯誤`)
                }
            }
        })

        it('拋出非Error或空訊息者: 原因為非空字串(不回空字串而被當成可讀)', function() {
            let mk = (v) => {
                return {
                    get [Symbol.toStringTag]() {
                        throw v
                    },
                }
            }
            for (let thrown of [null, undefined, '', 0, {}]) {
                let r = probeReadable(mk(thrown))
                assert.strict.equal(typeof r === 'string' && r !== '', true, String(thrown))
            }
        })

    })

    describe('伺服端資料通道(站點: getUserIdByToken之回傳值)', function() {

        let insts = []

        after(function() {
            for (let inst of insts) {
                inst.clearBroadcast()
                inst.clearSync()
            }
        })

        let mk = (optExt = {}) => {
            let errs = []
            let inst = evem()
            let srv = new WServWebdataServer(inst, {
                fpTableTags: `${fdTmp}/tags-${insts.length}.json`,
                useDbOrm: true,
                kpOrm: {},
                operOrm: async() => [{ id: 'r1' }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                ...optExt,
            })
            insts.push(srv)
            srv.on('error', (e) => {
                errs.push(e)
            })
            return { inst: srv, errs }
        }

        let exec = async(inst, func, args = [], token = 'tokU1') => {
            let pm = genPm()
            inst.emit('execute', func, { __sysToken__: token, __sysInputArgs__: args }, pm)
            return await pm
        }

        //getUserIdByToken為使用端回調, 其回傳值經isestr判定: 非字串者(含物件、數字)本即視為空字串(無身分, 見JSDoc第11點), 不可讀之值為另一種非字串, 同處置
        //修前isestr對不可讀之值拋錯而落入execFun收尾之catch(回error), 修後視為無身分: 表操作交authorizeExec(收到空字串, 預設拒絕), 非公開之系統函數回permission denied; 皆為最低權限, 不放寬
        //await取回傳值時會讀其then: then取值即拋錯者(已撤銷之Proxy、get陷阱拋錯之Proxy)於await處即成為拒絕(走getUserIdByToken拒絕之既有通道, 與wsemi無關), 其餘不可讀之值(標籤取值拋錯之物件、has或ownKeys陷阱拋錯之Proxy)才到達isestr
        it('getUserIdByToken回傳不可讀之值: 到達isestr者同其他非字串視為空字串(無身分), 表操作之authorizeExec收到空字串、非公開之系統函數被拒; await即拋錯者走拒絕通道', async function() {
            this.timeout(60000)
            let nEmpty = 0
            let nReject = 0
            for (let u of genUnreadables(SECRET)) {
                let thenThrows = false
                try {
                    void u.value.then
                }
                catch (e) {
                    thenThrows = true
                }
                let seen = []
                let { inst, errs } = mk({
                    getUserIdByToken: async() => u.value,
                    authorizeExec: async({ userId }) => {
                        seen.push(userId)
                        return false
                    },
                    sysFuncsPublic: ['[sys:getFuncList]'],
                })
                let r1 = await exec(inst, 'tabA.select')
                if (thenThrows) {
                    nReject++
                    assert.strict.equal(r1.state, 'error', u.name)
                    assert.strict.deepEqual(seen, [], `${u.name}: 拒絕者不呼叫authorizeExec`)
                    assert.strict.equal(errs.length, 1, `${u.name}: getUserIdByToken拒絕發error事件`)
                    continue
                }
                nEmpty++
                assert.strict.deepEqual(r1, { state: 'error', msg: 'permission denied' }, u.name)
                assert.strict.deepEqual(seen, [''], `${u.name}: authorizeExec收到之userId為空字串`)
                let r2 = await exec(inst, '[sys:getTableTags]')
                assert.strict.deepEqual(r2, { state: 'error', msg: 'permission denied' }, u.name)
                assert.strict.deepEqual(errs, [{ msg: 'permission denied', func: '[sys:getTableTags]' }], `${u.name}: 系統函數無身分之error事件`)
            }
            assert.strict.equal(nEmpty > 0 && nReject > 0, true, `兩類皆有涵蓋(空身分${nEmpty}、拒絕${nReject})`)
        })

    })

    describe('輪詢身分關卡(站點: genPollingGate之haskey與cstr)', function() {

        //輸入不可讀但clientId可讀者(wsemi 1.9.69之haskey對其回false, 修前拋錯而使關卡拒絕):
        //  w-serv-broadcast交入者為深複製之快照, 實務上不致不可讀, 此為關卡自身之防線(不可讀者不得被當成「未帶token鍵之舊前端」而以空身分放行)
        let genInputs = () => {
            let boom = genBoom(SECRET)
            return [
                ['標籤取值拋錯之物件', {
                    clientId: 'c1',
                    get [Symbol.toStringTag]() {
                        throw new Error(SECRET)
                    },
                }],
                ['has陷阱拋錯之Proxy', new Proxy({ clientId: 'c1' }, { has: boom })],
                ['僅標籤取值拋錯之Proxy', new Proxy({ clientId: 'c1' }, {
                    get: (t, k, r) => {
                        if (k === Symbol.toStringTag) {
                            boom()
                        }
                        return Reflect.get(t, k, r)
                    },
                })],
            ]
        }

        it('輸入不可讀者(標籤、has陷阱)拒絕(reject固定訊息), 不當成未帶token鍵之舊前端放行; 不反查、不綁定', async function() {
            let calls = 0
            let uid = { v: 'u1' }
            let gate = genPollingGate({
                getUserIdByToken: async() => {
                    calls++
                    return uid.v
                },
                isPublic: true,
            })
            for (let [name, input] of genInputs()) {
                let err = await gate.verifyPolling(input).then((v) => ({ passed: v }), (e) => e)
                assert.strict.equal(err instanceof Error, true, `${name}: 應reject, 實得${JSON.stringify(err)}`)
                assert.strict.equal(err.message, 'invalid input: must be a readable object', name)
                assert.strict.equal(noLeak(err), true, name)
            }
            assert.strict.equal(calls, 0, '不反查')
            //未被綁定(修前放行時會綁定c1為空身分): 其後以帶token之正常輸入輪詢同一clientId, 綁定為u1而非「屬於另一身分」
            assert.strict.equal(await gate.verifyPolling({ clientId: 'c1', __sysToken__: 't' }), true)
            assert.strict.equal(calls, 1)
        })

        it('輸入完全不可讀(取clientId即拋錯)者reject; 可讀之輸入(帶鍵、未帶鍵之舊前端)行為不變', async function() {
            let calls = 0
            let gate = genPollingGate({
                getUserIdByToken: async(t) => {
                    calls++
                    return t === 'tk1' ? 'u1' : ''
                },
                isPublic: true,
            })
            let boom = genBoom(SECRET)
            let all = new Proxy({}, { get: boom, has: boom })
            await assert.rejects(gate.verifyPolling(all), (e) => e instanceof Error)
            assert.strict.equal(calls, 0)
            assert.strict.equal(await gate.verifyPolling({ clientId: 'c2', __sysToken__: 'tk1' }), true, '帶鍵: 反查')
            assert.strict.equal(calls, 1)
            assert.strict.equal(await gate.verifyPolling({ clientId: 'c3' }), true, '未帶鍵之舊前端(公開): 以空身分放行, 不反查')
            assert.strict.equal(calls, 1)
        })

        //__sysToken__取值為不可讀之值: cstr對函數類Proxy回空字串(同一般函數, 視為空token), 其餘照舊拋錯(關卡reject); 皆不反查出非空身分
        it('__sysToken__為標籤不可讀之值: 不放行為非空身分(空token或reject)', async function() {
            for (let u of tagKinds()) {
                let seen = []
                let gate = genPollingGate({
                    getUserIdByToken: async(t) => {
                        seen.push(t)
                        return t === '' ? '' : 'uX'
                    },
                    isPublic: true,
                })
                let r = await gate.verifyPolling({ clientId: 'c1', __sysToken__: u.value }).then((v) => ({ v }), (e) => ({ e }))
                if (r.e) {
                    assert.strict.equal(seen.length, 0, `${u.name}: reject者不反查`)
                }
                else {
                    assert.strict.deepEqual(seen, [''], `${u.name}: 以空token反查`)
                }
            }
        })

    })

    describe('kpOrm(站點: Server.parseOpt之isobj與Sync之iseobj)', function() {

        let base = (kpOrm, fp) => {
            return {
                fpTableTags: fp,
                getUserIdByToken: async() => 'u1',
                useDbOrm: true,
                kpOrm,
                operOrm: async() => [],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: async() => true,
            }
        }

        //tryBuild, 建構並於成功時停止(修前紅時不遺留計時器), 回傳拋出之錯誤(未拋錯為null)
        let tryBuild = (opt) => {
            let srv = null
            let err = null
            try {
                srv = new WServWebdataServer(evem(), opt)
            }
            catch (e) {
                err = e
            }
            if (srv) {
                srv.clearBroadcast()
                srv.clearSync()
            }
            return err
        }

        //kpOrm為可列舉鍵之走訪即拋錯者(ownKeys、getPrototypeOf、getOwnPropertyDescriptor陷阱): 標籤可讀故isobj為true, 但iseobj回false(1.9.69),
        //Sync之checkOpt會當成「空物件、不需同步」而靜默不同步(R2刻意不套之空物件語意), 使有給卻無效之設定被吞; 修前iseobj拋錯而建構失敗
        it('kpOrm之可列舉鍵走訪拋錯: 建構時拋invalid opt.kpOrm(固定訊息), 不當成空物件靜默不同步; 不留副作用', function() {
            let boom = genBoom(SECRET)
            for (let trap of ['ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor']) {
                let fp = `${fdTmp}/tags-kporm-${trap}.json`
                let kpOrm = new Proxy({ tabA: evem() }, { [trap]: boom })
                let err = tryBuild(base(kpOrm, fp))
                assert.strict.equal(err && err.message, 'invalid opt.kpOrm when useDbOrm=true', trap)
                assert.strict.equal(noLeak(err), true, trap)
                assert.strict.equal(fs.existsSync(fp), false, `${trap}: 不寫時間戳檔`)
            }
        })

        it('kpOrm標籤不可讀(已撤銷、全陷阱拋錯、Symbol.toStringTag拋錯): 拋invalid opt.kpOrm', function() {
            for (let u of tagKinds()) {
                let err = tryBuild(base(u.value, `${fdTmp}/tags-kporm-tag.json`))
                assert.strict.equal(err && err.message, 'invalid opt.kpOrm when useDbOrm=true', u.name)
            }
        })

        //無同步表名時checkSyncOpt不讀kpOrm(修前不拋): 探針與其讀取條件相同, 不因本次連動而對未使用之kpOrm多拋錯
        it('無同步表名(未給tableNamesSync或為空陣列)時不讀kpOrm: 可列舉鍵走訪拋錯者照常建構(同修前); 標籤不可讀者仍拋(isobj)', function() {
            let boom = genBoom(SECRET)
            for (let trap of ['ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor']) {
                for (let tableNamesSync of [undefined, []]) {
                    let kpOrm = new Proxy({ tabA: evem() }, { [trap]: boom })
                    let err = tryBuild({ ...base(kpOrm, `${fdTmp}/tags-kporm-nosync-${trap}.json`), tableNamesSync })
                    assert.strict.equal(err, null, `${trap} × ${JSON.stringify(tableNamesSync)}`)
                }
            }
            for (let u of tagKinds()) {
                let err = tryBuild({ ...base(u.value, `${fdTmp}/tags-kporm-nosync-tag.json`), tableNamesSync: undefined })
                assert.strict.equal(err && err.message, 'invalid opt.kpOrm when useDbOrm=true', u.name)
            }
        })

        it('可讀之kpOrm不受影響: 空物件(不同步)與含事件物件者(同步)皆照常建構', function() {
            assert.strict.equal(tryBuild({ ...base({}, `${fdTmp}/tags-kporm-empty.json`), tableNamesSync: undefined }), null, '空物件不同步')
            assert.strict.equal(tryBuild(base({ tabA: evem() }, `${fdTmp}/tags-kporm-ok.json`)), null, '同步')
        })

    })

    describe('前端$fapi(站點: executeShell之isfun(末參數)與isestr(token))', function() {

        let bound = async(log) => {
            await log.tr.wait({ type: 'hook', name: 'getServerMethods' })
        }

        //末參數: wsemi 1.9.69之isfun對不可讀之值回false, 若不檢查, 不可讀之末參數被當成一般資料參數送出(已撤銷之函數Proxy經JSON序列化成為null), 修前isfun拋錯使呼叫reject
        it('末參數不可讀: 呼叫reject(固定訊息, 不帶值), 不呼叫getToken、不送出請求', async function() {
            this.timeout(60000)
            let { cl, inputs } = linkCtl()
            let log = run(cl, { getToken: () => 'tok' })
            await bound(log)
            //userSent, 使用端呼叫帶資料參數而送出之請求數(輪詢之輸入無__sysInputArgs__, 同步之select無參數)
            let userSent = () => inputs.filter((v) => Array.isArray(v.__sysInputArgs__) && v.__sysInputArgs__.length > 0).length
            //只含isfun修前會拋錯者(標籤不可讀、has陷阱拋錯); ownKeys類陷阱拋錯者isfun修前後皆不拋錯(標籤與has皆可讀), 不在此類(其值交傳輸層序列化)
            //另加has回true者: lodash之isFunction於Symbol.toStringTag之in為true時另讀自有性(getOwnPropertyDescriptor陷阱)並暫時改寫該鍵(set、deleteProperty陷阱), 其陷阱拋錯者修前亦拋
            let boom = genBoom(SECRET)
            let extras = [
                { name: 'has-true-and-getOwnPropertyDescriptor-throws', value: new Proxy({}, { has: () => true, getOwnPropertyDescriptor: boom }) },
                { name: 'has-true-and-deleteProperty-throws', value: new Proxy({}, { has: () => true, deleteProperty: boom }) },
                { name: 'function-with-own-toStringTag-and-getOwnPropertyDescriptor-throws', value: new Proxy(Object.assign(function() {}, { [Symbol.toStringTag]: 'X' }), { getOwnPropertyDescriptor: boom }) },
            ]
            for (let u of [...fnKinds(), ...extras]) {
                let nSent = userSent()
                let nToken = log.nToken
                let e = await log.fapi.tabA.select({ id: 'a' }, u.value).then(() => null, (err) => err)
                assert.strict.equal(e instanceof Error, true, `${u.name}: 應reject`)
                assert.strict.equal(e.message, 'invalid args[1]: must be a readable value', u.name)
                assert.strict.equal(noLeak(e), true, u.name)
                assert.strict.equal(userSent(), nSent, `${u.name}: 不送出請求`)
                assert.strict.equal(log.nToken, nToken, `${u.name}: 不呼叫getToken`)
            }
        })

        it('可讀之末參數行為不變: 函數為進度回調(剔除不送)、一般值與取值拋錯之物件為資料參數(送出)', async function() {
            this.timeout(60000)
            let { cl, inputs } = linkCtl()
            let log = run(cl, { getToken: () => 'tok' })
            await bound(log)
            let sentArgs = (n) => inputs.slice(n).map((v) => v.__sysInputArgs__).filter((a) => Array.isArray(a) && a.length > 0)
            let n0 = inputs.length
            let fprog = () => {}
            await log.fapi.tabA.select({ id: 'a' }, fprog)
            assert.strict.deepEqual(sentArgs(n0), [[{ id: 'a' }]], '末參數為函數: 視為進度回調, 不送')
            let n1 = inputs.length
            await log.fapi.tabA.select({ id: 'b' }, 'x')
            assert.strict.deepEqual(sentArgs(n1), [[{ id: 'b' }, 'x']], '末參數為一般值: 資料')
            let n2 = inputs.length
            let getterThrows = {}
            Object.defineProperty(getterThrows, 'length', { get: genBoom(SECRET), enumerable: true })
            await log.fapi.tabA.select(getterThrows)
            let a = sentArgs(n2)
            assert.strict.equal(a.length, 1, '標籤可讀而取值拋錯之物件: 修前後皆非函數, 為資料參數送出')
            assert.strict.equal(a[0][0], getterThrows)
        })

        //回調: 建構時已驗為函數, 建構後才不可讀(已撤銷之函數Proxy)者, 呼叫時拋錯而走error事件(callHook之catch), 不被isfun之false靜默略過(修前isfun於callHook拋錯)
        it('建構後才不可讀之回調(已撤銷之函數Proxy): 呼叫時拋錯並發error事件, 不被靜默略過', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let rv = Proxy.revocable(function() {}, {})
            let tr = genTracer({ msCap: 20000 })
            let errs = []
            let c = new WServWebdataClient(cl, { getToken: () => 'tok', getServerMethods: () => {}, recvData: rv.proxy })
            cleans.push(() => {
                c.clearBroadcast()
                c.clearSync()
            })
            c.on('error', (e) => {
                errs.push(e)
                tr.onTrace({ type: 'error' })
            })
            rv.revoke() //建構時已通過isfun檢查, 其後才撤銷
            await tr.wait({ type: 'error' })
            assert.strict.equal(errs.length >= 1, true)
            assert.strict.equal(errs[0] instanceof TypeError && /revoked/.test(errs[0].message), true, String(errs[0]))
        })

        //token: getToken回傳不可讀之值, 非字串一律取代為空字串(JSDoc: 避免傳輸時欄位消失), 不可讀之值為另一種非字串, 同處置; 伺服端為權威(空token之處置見R9、R16)
        it('getToken回傳不可讀之值: 同其他非字串, 以空字串送出(不reject、不洩漏)', async function() {
            this.timeout(60000)
            let mode = { hostile: null }
            let { cl, inputs } = linkCtl()
            let log = run(cl, { getToken: () => (mode.hostile === null ? 'tok' : mode.hostile) })
            await bound(log)
            for (let u of tagKinds()) {
                mode.hostile = u.value
                let n = inputs.length
                let r = await log.fapi.tabA.select({ id: 'a' }).then((v) => ({ v }), (e) => ({ e }))
                mode.hostile = null
                assert.strict.equal(r.e, undefined, `${u.name}: ${r.e && r.e.message}`)
                let mine = inputs.slice(n).filter((v) => Array.isArray(v.__sysInputArgs__) && v.__sysInputArgs__.length > 0)
                assert.strict.equal(mine.length, 1, u.name)
                assert.strict.equal(mine[0].__sysToken__, '', `${u.name}: 以空字串送出`)
            }
        })

    })

    describe('設定站點之失敗通道不變(拋固定訊息之Error, 訊息不含值): 伺服端', function() {

        let tryBuild = (opt) => {
            let srv = null
            let err = null
            try {
                srv = new WServWebdataServer(evem(), opt)
            }
            catch (e) {
                err = e
            }
            if (srv) {
                srv.clearBroadcast()
                srv.clearSync()
            }
            return err
        }

        let validBase = () => {
            return {
                fpTableTags: `${fdTmp}/tags-cfg.json`,
                getUserIdByToken: async() => 'u1',
                useDbOrm: true,
                kpOrm: { tabA: evem() },
                operOrm: async() => [],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: async() => true,
                kpFunExt: { f1: async() => 1 },
                sysFuncsPublic: ['[sys:getFuncList]'],
            }
        }

        it('基準設定可建構(確認下列各案之失敗皆因被換入之不可讀值)', function() {
            assert.strict.equal(tryBuild(validBase()), null)
        })

        //各設定鍵×標籤不可讀之值: 皆於建構時以invalid opt.<鍵>拋錯, 不靜默改用預設(尤其methodsExec、sysFuncsPublic之預設較寬)
        it('設定鍵(頂層)為不可讀之值: 拋對應之invalid opt.*', function() {
            //以isfun或isbol判定者(含has陷阱拋錯之值)
            let keysFn = [
                ['genTag', 'invalid opt.genTag'],
                ['getUserIdByToken', 'invalid opt.getUserIdByToken'],
                ['operOrm', 'invalid opt.operOrm when useDbOrm=true'],
                ['authorizeExec', 'invalid opt.authorizeExec when useDbOrm=true'],
                ['useDbOrm', 'invalid opt.useDbOrm when opt.operOrm is given'],
            ]
            //以isestr、isobj、isarr判定者(標籤不可讀之值)
            let keysCt = [
                ['fpTableTags', 'invalid opt.fpTableTags'],
                ['kpOrm', 'invalid opt.kpOrm when useDbOrm=true'],
                ['tableNamesExec', 'invalid opt.tableNamesExec when useDbOrm=true'],
                ['methodsExec', 'invalid opt.methodsExec when useDbOrm=true'],
                ['tableNamesSync', 'invalid opt.tableNamesSync when useDbOrm=true'],
                ['kpFunExt', 'invalid opt.kpFunExt'],
                ['sysFuncsPublic', 'invalid opt.sysFuncsPublic'],
            ]
            for (let [keys, kinds] of [[keysFn, fnKinds()], [keysCt, tagKinds()]]) {
                for (let [key, msg] of keys) {
                    for (let u of kinds) {
                        let err = tryBuild({ ...validBase(), [key]: u.value })
                        assert.strict.equal(err && err.message, msg, `${key} × ${u.name}`)
                        assert.strict.equal(noLeak(err), true, `${key} × ${u.name}`)
                    }
                }
            }
        })

        it('設定鍵(陣列元素與kpFunExt之值)為不可讀之值: 拋對應之invalid opt.*[...]', function() {
            let cases = [
                [{ tableNamesExec: [null] }, 'invalid opt.tableNamesExec[0] when useDbOrm=true'],
                [{ methodsExec: [null] }, 'invalid opt.methodsExec[0] when useDbOrm=true'],
                [{ tableNamesSync: [null] }, 'invalid opt.tableNamesSync[0] when useDbOrm=true'],
                [{ sysFuncsPublic: [null] }, 'invalid opt.sysFuncsPublic[0]'],
                [{ kpFunExt: { f1: null } }, 'invalid opt.kpFunExt[f1]'],
            ]
            for (let [patch, msg] of cases) {
                let key = Object.keys(patch)[0]
                for (let u of (key === 'kpFunExt' ? fnKinds() : tagKinds())) {
                    let v = Array.isArray(patch[key]) ? [u.value] : { f1: u.value }
                    let err = tryBuild({ ...validBase(), [key]: v })
                    assert.strict.equal(err && err.message, msg, `${key} × ${u.name}`)
                    assert.strict.equal(noLeak(err), true, `${key} × ${u.name}`)
                }
            }
        })

        //useDbOrm為不可讀之值且未給其他資料通道設定: 同其他非布林(預設false, 資料通道關閉, 無表操作), 不開放任何函數
        it('useDbOrm為不可讀之值且未給資料通道設定: 同其他非布林視為false(資料通道關閉)', async function() {
            for (let u of fnKinds()) {
                let inst = evem()
                let srv = new WServWebdataServer(inst, { fpTableTags: `${fdTmp}/tags-cfg2.json`, useDbOrm: u.value })
                let pm = genPm()
                srv.emit('execute', 'tabA.select', { __sysToken__: 'tokU1', __sysInputArgs__: [] }, pm)
                assert.strict.deepEqual(await pm, { state: 'error', msg: 'invalid func[tabA.select]' }, u.name)
                srv.clearBroadcast()
                srv.clearSync()
            }
        })

        //instWConverServer不可讀: 標籤或可列舉鍵不可讀者同其他非有效物件(固定文字提示後改建evem, R2刻意不套); has陷阱拋錯者通過有效物件檢查, 於emit之in判斷被判無而拋not an EventEmitter
        it('instWConverServer為不可讀之值: 同非有效物件改建evem並提示, 或拋not an EventEmitter; 不洩漏', function() {
            for (let u of genUnreadables(SECRET)) {
                let logs = []
                let build = () => {
                    let srv = new WServWebdataServer(u.value, { fpTableTags: `${fdTmp}/tags-cfg3.json`, funLog: (...args) => logs.push(args) })
                    srv.clearBroadcast()
                    srv.clearSync()
                }
                if (u.name === 'has-trap-throws-proxy') {
                    assert.throws(build, (e) => e.message === 'instWConverServer is not an EventEmitter', u.name)
                }
                else {
                    build()
                    assert.strict.equal(logs.length, 1, `${u.name}: 固定文字提示一次`)
                    assert.strict.equal(logs[0][0], 'instWConverServer is not an effective object, and set instWConverServer to an EventEmitter', u.name)
                }
                assert.strict.equal(noLeak(JSON.stringify(logs)), true, u.name)
            }
        })

        it('Exec直接建構: instWConverServer為標籤不可讀之值拋invalid instWConverServer', function() {
            for (let u of tagKinds()) {
                assert.throws(() => new WServWebdataServerExec(u.value, {}), (e) => e.message === 'invalid instWConverServer', u.name)
            }
        })

    })

    describe('設定站點之失敗通道不變: 前端', function() {

        let tryBuild = (cl, opt) => {
            let c = null
            let err = null
            try {
                c = new WServWebdataClient(cl, opt)
            }
            catch (e) {
                err = e
            }
            if (c) {
                c.clearBroadcast()
                c.clearSync()
            }
            return err
        }

        let validBase = () => {
            return { getToken: () => 'tok', getServerMethods: () => {}, recvData: () => {} }
        }

        it('基準設定可建構', function() {
            assert.strict.equal(tryBuild(linkCtl().cl, validBase()), null)
        })

        it('設定鍵為不可讀之值: 拋對應之invalid opt.*', function() {
            let keys = ['getToken', 'getServerMethods', 'recvData', 'getRefreshState', 'getRefreshTable', 'getBeforeUpdateTableTags', 'getAfterUpdateTableTags']
            for (let key of keys) {
                for (let u of fnKinds()) {
                    let err = tryBuild(linkCtl().cl, { ...validBase(), [key]: u.value })
                    assert.strict.equal(err && err.message, `invalid opt.${key}`, `${key} × ${u.name}`)
                    assert.strict.equal(noLeak(err), true, `${key} × ${u.name}`)
                }
            }
        })

        it('通訊物件為不可讀之值: 拋instWConverClient is not an effective object', function() {
            for (let u of tagKinds()) {
                let err = tryBuild(u.value, validBase())
                assert.strict.equal(err && err.message, 'instWConverClient is not an effective object', u.name)
            }
        })

        it('通訊物件之emit、on、execute為不可讀之值: 拋對應訊息', function() {
            for (let u of tagKinds()) {
                let c1 = linkCtl().cl
                c1.on = u.value
                assert.strict.equal((tryBuild(c1, validBase()) || {}).message, 'instWConverClient is not an EventEmitter', `on × ${u.name}`)
                let c2 = linkCtl().cl
                c2.execute = u.value
                assert.strict.equal((tryBuild(c2, validBase()) || {}).message, 'instWConverClient.execute is not a function', `execute × ${u.name}`)
            }
        })

    })

})
