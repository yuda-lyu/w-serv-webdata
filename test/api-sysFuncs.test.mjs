import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


//以真WConverhpServer與WConverhpClient經HTTP驗證系統函數與輪詢之身分關卡(與unit-sysFuncs互補: 不經假通訊層, 驗證前端輪詢實際帶token、伺服端實際反查、拒絕時前端實際所見):
//  perm型: verifyConn驗標頭token、getUserIdByToken驗本體token(__sysToken__), 前端useWaitToken型態, 新前端可綁定$fapi並收到廣播; 持標頭token之匿名者與其他身分者收不到他人之廣播
//  sso型: verifyConn全放行、getUserIdByToken固定回空字串、useDbOrm:false; 設定sysFuncsPublic三者者, 未登入前端可綁定並呼叫kpFunExt; 未設定者(預設收緊)前端無法綁定, 伺服端見到拒絕之error事件
//  規則帳本: R16、R17
describe('api-sysFuncs', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/api-sysFuncs'

    //ports, 固定埠(perm型、sso型已設sysFuncsPublic、sso型預設), 避開api-servdata之9000、api-clientStop之9001、api-checkFind之9002、api-authorizeExec之8301
    let portPerm = 9003
    let portSsoPub = 9004
    let portSsoDef = 9005

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    //waitFor, 條件成立時結束, 逾時則拋錯(輪詢間隔2秒, 綁定約需2.x秒)
    let waitFor = async (fn, ms = 15000, label = '') => {
        let t = Date.now()
        while (!fn()) {
            if (Date.now() - t > ms) {
                throw new Error(`waitFor timeout ${label}`)
            }
            await sleep(50)
        }
    }

    //cleans
    let cleans = []

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(async function() {
        for (let f of cleans.reverse()) {
            await f()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //rawCall, 直接用WConverhpClient.execute(不經WServWebdataClient), hdr為標頭token, 不重試; 回傳{ ok, v }或{ ok: false, err }
    let rawCall = async (port, hdr, func, input) => {
        let cl = new WConverhpClient({ url: `http://localhost:${port}`, getToken: () => hdr, retryMain: 0 })
        cl.on('error', () => {})
        try {
            return { ok: true, v: await cl.execute(func, input) }
        }
        catch (err) {
            return { ok: false, err }
        }
    }

    //mkFront, 官方前端(WServWebdataClient於WConverhpClient之上), tokHdr為通訊層標頭token, tokBody為本體token(__sysToken__), 可於運行中改變(tk物件)
    let mkFront = ({ port, tokHdr, tokBody, clientId = null }) => {
        let tk = { hdr: tokHdr, body: tokBody }
        let log = { bound: false, fapi: null, errors: [], broadcasts: [], recv: [] }
        let cl = new WConverhpClient({ url: `http://localhost:${port}`, getToken: () => tk.hdr, retryMain: 0 })
        if (clientId !== null) {
            cl.clientId = clientId
        }
        cl.on('error', () => {})
        cl = new WServWebdataClient(cl, {
            getToken: () => tk.body,
            getServerMethods: (fapi) => {
                log.bound = true
                log.fapi = fapi
            },
            recvData: (r) => {
                log.recv.push(r)
            },
        })
        cl.on('error', (e) => {
            log.errors.push(e)
        })
        cl.on('broadcast', (data) => {
            log.broadcasts.push(data)
        })
        cleans.push(() => {
            cl.clearBroadcast()
            cl.clearSync()
        })
        return { cl, log, tk }
    }

    describe('perm型(標頭token＋本體token)', function() {

        let srv = null
        let seen = [] //伺服端所見之[sys:polling]輸入(被動觀察者)
        let calls = [] //getUserIdByToken收到之token
        let errs = [] //伺服端error事件
        let front = null
        let ev = evem()

        before(async function() {
            this.timeout(30000)
            srv = new WConverhpServer({
                port: portPerm,
                pathUploadTemp: `${fdTmp}/uploadTemp-perm`,
                verifyConn: async ({ authorization }) => {
                    return authorization === 'Bearer hdrOk'
                },
            })
            srv.on('execute', (func, input) => { //被動觀察者(不結算pm), 註冊於本套件之監聽之前
                if (func === '[sys:polling]') {
                    seen.push(JSON.parse(JSON.stringify(input)))
                }
            })
            srv = new WServWebdataServer(srv, {
                fpTableTags: `${fdTmp}/tags-perm.json`,
                getUserIdByToken: async (token) => {
                    calls.push(token)
                    if (token === 'bodyU1' || token === 'bodyU1b') {
                        return 'u1'
                    }
                    if (token === 'bodyU2') {
                        return 'u2'
                    }
                    return Promise.reject('errUserIdMissing')
                },
                useDbOrm: true,
                kpOrm: { tabA: ev },
                operOrm: async () => [{ id: 'r1' }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: async ({ userId }) => userId !== '',
                kpFunExt: {
                    who: (userId) => `who:${userId}`,
                },
            })
            srv.on('error', (e) => {
                errs.push(e)
            })
            cleans.push(async () => {
                srv.clearBroadcast()
                srv.clearSync()
                await srv.stop()
            })
            await sleep(300)

            //前端: clientId固定, 以利攻擊情境指向之
            front = mkFront({ port: portPerm, tokHdr: 'hdrOk', tokBody: 'bodyU1', clientId: 'victim-c1' })
            await waitFor(() => front.log.bound, 15000, 'bound')
        })

        //任務範圍4+完成條件1(H01): 新前端可綁定$fapi, 輪詢帶本體token(伺服端實際所見)並經getUserIdByToken反查, execFun略過輪詢後輪詢正常
        it('新前端可綁定, 輪詢帶__sysToken__且被反查, 同步表資料可取得', async function() {
            assert.strict.equal(front.log.bound, true)
            assert.strict.equal(await front.log.fapi.who(), 'who:u1')
            assert.strict.ok(seen.length >= 1, '伺服端見到輪詢')
            for (let v of seen) {
                assert.strict.equal(v.__sysToken__, 'bodyU1', '輪詢帶前端opt.getToken之值')
                assert.strict.equal(v.clientId, 'victim-c1')
            }
            assert.strict.ok(calls.filter((v) => v === 'bodyU1').length >= seen.length + 2, '每輪輪詢反查1次, 另有取函數清單與取時間戳之反查')
            await waitFor(() => front.log.recv.length >= 1, 15000, 'recv')
            assert.strict.deepEqual(front.log.recv[0].tableName, 'tabA')
            assert.strict.deepEqual(front.log.errors, [], '前端無輪詢失敗')
        })

        //任務範圍3: 輪詢經身分關卡後, 部署方broadcast仍由其所屬clientId之前端收到
        it('部署方broadcast由已驗證之前端收到', async function() {
            let n = front.log.broadcasts.length
            srv.broadcast({ note: 'hello' })
            await waitFor(() => front.log.broadcasts.length > n, 15000, 'broadcast')
            assert.strict.deepEqual(front.log.broadcasts.at(-1), { note: 'hello' })
        })

        //原則§二7: 通過verifyConn(持有標頭token)但無本體身分者, 輪詢被拒絕, 收不到廣播(修前: 輪詢不經getUserIdByToken, 匿名者可取走他人之廣播)
        it('持標頭token而無本體身分者(未帶、空、無效)輪詢被拒絕', async function() {
            for (let input of [{ clientId: 'atk-1' }, { clientId: 'atk-1', __sysToken__: '' }, { clientId: 'atk-1', __sysToken__: 'bodyBad' }]) {
                let r = await rawCall(portPerm, 'hdrOk', '[sys:polling]', input)
                assert.strict.equal(r.ok, false, JSON.stringify(input))
                assert.strict.equal(r.err, '[sys:polling] permission denied', JSON.stringify(input))
            }
            srv.broadcast('secret-for-members')
            let r2 = await rawCall(portPerm, 'hdrOk', '[sys:polling]', { clientId: 'atk-1', __sysToken__: 'bodyBad' })
            assert.strict.equal(r2.ok, false)
            assert.strict.equal(Object.prototype.hasOwnProperty.call(srv.getMessages(), 'atk-1'), false, '被拒絕者無佇列')
            assert.strict.equal(srv.getClients().some((v) => v.key === 'atk-1'), false, '被拒絕者無在線身分')
        })

        //通訊層仍先把關: 標頭token錯誤者由verifyConn拒絕(不到本套件), 不改變
        it('標頭token錯誤者由通訊層拒絕', async function() {
            let r = await rawCall(portPerm, 'hdrBad', '[sys:polling]', { clientId: 'atk-2', __sysToken__: 'bodyU1' })
            assert.strict.equal(r.ok, false)
            assert.strict.equal(r.err, 'permission denied')
        })

        //任務範圍3(clientId歸屬): 另一有效身分(u2)以他人clientId輪詢被拒絕, 且不取走該clientId之佇列
        it('另一有效身分輪詢他人之clientId被拒絕, 他人仍收到其後之廣播', async function() {
            let n = front.log.broadcasts.length
            let r = await rawCall(portPerm, 'hdrOk', '[sys:polling]', { clientId: 'victim-c1', __sysToken__: 'bodyU2' })
            assert.strict.equal(r.ok, false)
            assert.strict.equal(r.err, '[sys:polling] permission denied')
            await sleep(100) //error事件以1ms計時器派發
            assert.strict.ok(errs.some((e) => e && e.msg === '[sys:polling] permission denied' && e.err === 'clientId belongs to another userId'), '伺服端error事件記錄原因')
            srv.broadcast('after-hijack')
            await waitFor(() => front.log.broadcasts.length > n, 15000, 'broadcast after hijack')
            assert.strict.equal(front.log.broadcasts.at(-1), 'after-hijack')
            //其自己之clientId可正常輪詢
            let r2 = await rawCall(portPerm, 'hdrOk', '[sys:polling]', { clientId: 'own-u2', __sysToken__: 'bodyU2' })
            assert.strict.equal(r2.ok, true)
            assert.strict.deepEqual(r2.v, [])
        })

        //任務範圍2: 反查reject(本體token無效)時, 輪詢被拒絕, 前端所見為固定訊息
        it('反查reject之輪詢被拒絕, 伺服端error事件含原拒絕值', async function() {
            let r = await rawCall(portPerm, 'hdrOk', '[sys:polling]', { clientId: 'atk-3', __sysToken__: 'bodyBad' })
            assert.strict.equal(r.ok, false)
            assert.strict.equal(r.err, '[sys:polling] permission denied')
            await sleep(50)
            assert.strict.ok(errs.some((e) => e && e.msg === '[sys:polling] verifyPolling error' && e.err === 'errUserIdMissing'))
        })

        //任務範圍2: 其他系統函數於本體token無效時亦拒絕(反查reject, 原拒絕值成為回應)
        it('其他系統函數於本體token無效時被拒絕', async function() {
            for (let func of ['[sys:getFuncList]', '[sys:getTableTags]']) {
                let r = await rawCall(portPerm, 'hdrOk', func, { __sysToken__: 'bodyBad', __sysInputArgs__: [] })
                assert.strict.deepEqual(r, { ok: true, v: { state: 'error', msg: 'errUserIdMissing' } }, func) //資料通道以{ state: 'error', msg }回應, 官方前端再轉為reject
            }
        })
    })

    describe('sso型(固定回空字串、useDbOrm:false)', function() {

        //啟動伺服端與未登入前端, 回傳{ srv, errs, front, calls }
        let boot = async ({ port, tag, sysFuncsPublic }) => {
            let calls = []
            let errs = []
            let srv = new WConverhpServer({ port, pathUploadTemp: `${fdTmp}/uploadTemp-${tag}`, verifyConn: async () => true })
            let opt = {
                fpTableTags: `${fdTmp}/tags-${tag}.json`,
                getUserIdByToken: async (token) => {
                    calls.push(token)
                    return ''
                },
                useDbOrm: false,
                kpFunExt: {
                    getWebInfor: async (userId) => {
                        return { webName: 'sso', userId }
                    },
                },
            }
            if (sysFuncsPublic !== undefined) {
                opt.sysFuncsPublic = sysFuncsPublic
            }
            srv = new WServWebdataServer(srv, opt)
            srv.on('error', (e) => {
                errs.push(e)
            })
            cleans.push(async () => {
                srv.clearBroadcast()
                srv.clearSync()
                await srv.stop()
            })
            await sleep(300)
            let front = mkFront({ port, tokHdr: '', tokBody: '' })
            return { srv, errs, front, calls }
        }

        //完成條件1(H02): sso型設定(固定回空＋公開三者)可正常綁定與取getWebInfor
        it('sysFuncsPublic為三者: 未登入前端可綁定並呼叫getWebInfor, 無輪詢失敗', async function() {
            this.timeout(40000)
            let { front, errs, calls, srv } = await boot({
                port: portSsoPub,
                tag: 'sso-pub',
                sysFuncsPublic: ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]'],
            })
            await waitFor(() => front.log.bound, 15000, 'bound')
            assert.strict.deepEqual(await front.log.fapi.getWebInfor(), { webName: 'sso', userId: '' })
            //輪詢續行且得到廣播
            let n = front.log.broadcasts.length
            srv.broadcast('to-anonymous')
            await waitFor(() => front.log.broadcasts.length > n, 15000, 'broadcast')
            assert.strict.deepEqual(front.log.errors, [])
            assert.strict.deepEqual(errs, [])
            assert.strict.ok(calls.length >= 3, '輪詢、函數清單、getWebInfor皆經反查')
        })

        //裁示Q1(預設收緊): getUserIdByToken固定回空字串而未設sysFuncsPublic者, 輪詢被拒絕, 前端永不綁定; 伺服端見到error事件
        it('未設sysFuncsPublic(預設): 前端因輪詢被拒絕而不綁定, 伺服端見到拒絕之error事件', async function() {
            this.timeout(40000)
            let { front, errs } = await boot({ port: portSsoDef, tag: 'sso-def' })
            await waitFor(() => front.log.errors.some((e) => e && e.msg === '[sys:polling] error') && errs.length >= 1, 20000, 'errors')
            assert.strict.equal(front.log.bound, false)
            //前端之error事件含通訊物件自身之各次嘗試失敗(字串訊息)與w-serv-broadcast之輪詢失敗
            assert.strict.ok(front.log.errors.some((e) => e && e.msg === '[sys:polling] error' && e.err === '[sys:polling] permission denied'), JSON.stringify(front.log.errors))
            assert.strict.deepEqual(errs[0], { msg: '[sys:polling] permission denied', err: 'empty userId' })
        })
    })
})
