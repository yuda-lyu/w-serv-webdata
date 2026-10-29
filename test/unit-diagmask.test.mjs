import assert from 'assert'
import fs from 'fs'
import { inspect } from 'util'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataServerExec from '../src/WServWebdataServerExec.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import { genTracer, drain } from './tools/tracer.mjs'
import { genRun, linkCtl, linkSig } from './tools/clientHarness.mjs'


//對外之錯誤值不含憑證與token(R-DIAG-01, 跨套件規格為主控dspec〈診斷輸出與遮罩〉D3、P2): 套件以reject、error事件、回給遠端之msg交出之外來值(後端、通訊層、使用端回調所給者)經wsemi之diag.err與diag.mask遮罩;
//  本套件以固定詞彙組成之拒絕值不經遮罩(固定字串經遮罩挖空會讓缺口反推短token, 語料R07); 進行中請求之token保留至請求結束, 不被近期128個之上限淘汰(設計X54)
//本檔為站點接線測試: 每個站點一案, 修前紅(舊版原樣交出外來值)、修後綠; 形態類案見unit-diagcorpus(共用語料)
//站點全集與處置見規則帳本R-DIAG-DEC; 結果物件之逐筆err: 本套件無此類結果物件(不適用)
describe('unit-diagmask', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-diagmask'

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

    //敏感值: token、資料庫密碼(後端reject內夾帶)
    let TOKEN = 'tk-SECRET-8841'
    let PWD = 'Pw9xQ7zK-db'
    let DBURL = `postgres://dbuser:${PWD}@db.example.com:5432/app`

    //dump, 完整傾印(含Error之message與stack等不可列舉屬性、Symbol鍵)
    let dump = (v) => {
        return inspect(v, { depth: null, showHidden: true, customInspect: false, maxArrayLength: null, maxStringLength: null, breakLength: Infinity })
    }

    let leaks = (v, list = [TOKEN, PWD]) => {
        let s = dump(v)
        return list.filter((x) => s.includes(x))
    }

    //bound, 前端已綁定可呼叫函數
    let bound = async(log) => {
        await log.tr.wait({ type: 'hook', name: 'getServerMethods' })
    }

    describe('前端: 外來值經diag.err(站點: execute回覆之error訊息、通訊層拒絕、select拒絕、回調拋錯、getToken拋錯)', function() {

        it('通訊層拒絕值(含token與資料庫網址帳密): $fapi之拒絕值與同步之error事件皆已遮罩, 仍為Error且保留類別', async function() {
            this.timeout(60000)
            class NetErr extends Error {}
            let fail = new NetErr(`connect to ${DBURL} failed, token ${TOKEN}`)
            fail.code = 'ECONNREFUSED'
            let { cl } = linkCtl({ fail: { 'tabA.select': fail } })
            let log = run(cl, { getToken: () => TOKEN })
            await bound(log)
            let e = await log.fapi.tabA.select().then(() => null, (err) => err)
            assert.strict.deepEqual(leaks(e), [], '$fapi之拒絕值不含token與密碼')
            assert.strict.equal(e instanceof NetErr, true, 'instanceof同類')
            assert.strict.equal(e.code, 'ECONNREFUSED')
            assert.strict.notEqual(e, fail, '含憑證者為副本')
            assert.strict.equal(e.message, 'connect to postgres://***@db.example.com:5432/app failed, token ***')
            assert.strict.equal(fail.message.includes(TOKEN), true, '原錯誤不被改動')
            await log.tr.wait({ type: 'error' }) //同步表之select失敗, w-sync-webdata發出帶表名之error
            assert.strict.deepEqual(leaks(log.rawErrors), [], 'error事件之err不含token與密碼')
            assert.strict.equal(log.rawErrors[0].tableName, 'tabA')
        })

        it('伺服端回覆之error訊息(字串、Error形狀之物件): reject值已遮罩', async function() {
            this.timeout(60000)
            let msgs = [`denied: password=${PWD} token=${TOKEN}`, { reason: `bad ${TOKEN}`, nested: { url: DBURL } }]
            for (let msg of msgs) {
                let { cl } = linkCtl()
                let org = cl.execute
                cl.execute = (func, ...rest) => {
                    if (func === 'tabA.select') {
                        return Promise.resolve({ state: 'error', msg })
                    }
                    return org(func, ...rest)
                }
                let log = run(cl, { getToken: () => TOKEN })
                await bound(log)
                let e = await log.fapi.tabA.select().then(() => null, (err) => err)
                assert.strict.deepEqual(leaks(e), [], dump(e))
                assert.strict.equal(dump(e).includes('***'), true)
            }
        })

        it('回調拋錯(未停止, 改發error事件): 含token與密碼者遮罩', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let log = run(cl, {
                getToken: () => TOKEN,
                recvData: () => {
                    throw new Error(`recv failed ${DBURL} token=${TOKEN} bare ${TOKEN}`)
                },
            })
            await log.tr.wait({ type: 'error' })
            log.cl.clearBroadcast()
            log.cl.clearSync()
            assert.strict.equal(log.rawErrors.length, 1)
            assert.strict.deepEqual(leaks(log.rawErrors), [])
            assert.strict.equal(log.rawErrors[0].message, 'recv failed postgres://***@db.example.com:5432/app token=*** bare ***')
        })

        it('getToken拋錯: $fapi之拒絕值已遮罩; 不含token者原樣(同一參照)', async function() {
            this.timeout(60000)
            let mode = 'ok'
            let thrown = null
            let { cl } = linkCtl()
            let log = run(cl, {
                getToken: () => {
                    if (mode === 'throw') {
                        throw thrown
                    }
                    return TOKEN
                },
            })
            await bound(log)
            thrown = new Error(`token expired: ${TOKEN}`)
            mode = 'throw'
            let e = await log.fapi.tabA.select().then(() => null, (err) => err)
            assert.strict.deepEqual(leaks(e), [])
            assert.strict.equal(e.message, 'token expired: ***')
            thrown = new Error('GETTOKEN_BOOM')
            let e2 = await log.fapi.tabA.select().then(() => null, (err) => err)
            assert.strict.equal(e2, thrown, '不含token者原樣')
            mode = 'ok'
        })

        //select取自交給使用端之物件, 使用端可替換為自己的函數(其拒絕值未經通訊層之站點), 同步表流程(refreshTable)於select拒絕時再經本套件之站點交給w-sync-webdata
        it('select被使用端替換為會拒絕之函數(同步表流程): w-sync-webdata發出之error事件的err已遮罩', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let log = run(cl, {
                getToken: () => TOKEN,
                getServerMethods: (f) => {
                    f.tabA.select = async function() {
                        throw new Error(`replaced select failed ${DBURL} bare ${TOKEN}`)
                    }
                },
            })
            await log.tr.wait({ type: 'error' })
            log.cl.clearBroadcast()
            log.cl.clearSync()
            assert.strict.equal(log.rawErrors[0].tableName, 'tabA')
            assert.strict.deepEqual(leaks(log.rawErrors), [], dump(log.rawErrors))
            assert.strict.equal(log.rawErrors[0].err.message, 'replaced select failed postgres://***@db.example.com:5432/app bare ***')
        })

        it('固定詞彙之拒絕值原樣(語料R07): token為其子字串時不被切碎(停止之reason經通訊層回到本套件者亦同)', async function() {
            this.timeout(60000)
            let msgStop = 'stopped by clearBroadcast or clearSync'
            //token='stopped'(msgStop之子字串), 只呼叫clearBroadcast: 在途之select被中止, w-sync-webdata以停止之拒絕值發出帶表名之error
            let { cl } = linkSig({ delay: { 'tabA.select': 300 } })
            let c = null
            let log = run(cl, { getToken: () => 'stopped' })
            c = log.cl
            await log.tr.wait({ type: 'exec', func: 'tabA.select' })
            c.clearBroadcast()
            await log.tr.wait({ type: 'error' })
            await drain()
            assert.strict.equal(log.rawErrors.length, 1)
            assert.strict.equal(log.rawErrors[0].err, msgStop, '固定詞彙原樣, 不得成為*** by clearBroadcast…')
            c.clearSync()
        })

        it('進行中請求之token保留至請求結束(X54): 其後128個以上之其他token擠出近期清單, 該請求之error訊息中的token仍被遮罩', async function() {
            this.timeout(60000)
            let T0 = 'INFLIGHT-tok-0001'
            let { cl } = linkCtl({ delay: { 'tabA.select': 0 } })
            let org = cl.execute
            let reply0 = null
            cl.execute = (func, input, ...rest) => {
                if (func === 'tabA.select' && input.__sysToken__ === T0) {
                    return new Promise((resolve) => {
                        reply0 = () => resolve({ state: 'error', msg: `denied for ${T0}` })
                    })
                }
                return org(func, input, ...rest)
            }
            let n = 0
            let useT0 = false
            let log = run(cl, { getToken: () => (useT0 ? T0 : `OTHER-${++n}-xxxx`) })
            await bound(log)
            useT0 = true
            let p0 = log.fapi.tabA.select().then(() => null, (err) => err) //getToken與execute同步呼叫: 此請求以T0在途
            useT0 = false
            assert.strict.equal(typeof reply0, 'function', '請求已交給通訊層而在途')
            for (let i = 0; i < 200; i++) {
                await log.fapi.tabA.select() //其他token各自完成, 近期清單(128)已不含T0
            }
            reply0()
            let e = await p0
            assert.strict.deepEqual(leaks(e, [T0]), [], dump(e))
            assert.strict.equal(e, 'denied for ***')
        })

    })


    describe('伺服端: 回給遠端之msg與error事件經diag.mask與diag.err(站點: getUserIdByToken、表操作與kpFunExt之拒絕值、execFun收尾)', function() {

        let insts = []

        after(function() {
            for (let inst of insts) {
                inst.clearBroadcast()
                inst.clearSync()
            }
        })

        //mk, 建立useDbOrm=true之實體; errs為error事件
        let mk = (optExt = {}) => {
            let errs = []
            let inst = evem()
            let srv = new WServWebdataServer(inst, {
                fpTableTags: `${fdTmp}/tags-${insts.length}.json`,
                getUserIdByToken: async() => 'u1',
                useDbOrm: true,
                kpOrm: {},
                operOrm: async() => [{ id: 'r1' }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                authorizeExec: async() => true,
                ...optExt,
            })
            insts.push(srv)
            srv.on('error', (e) => {
                errs.push(e)
            })
            return { inst: srv, errs }
        }

        //exec, 模擬w-converhp派發execute事件, 回傳回應
        let exec = async(inst, func, args = [], token = 'tokU1') => {
            let pm = genPm()
            inst.emit('execute', func, { __sysToken__: token, __sysInputArgs__: args }, pm)
            return await pm
        }

        //後端reject夾帶資料庫密碼與請求之token(裸字串)
        let mkBackendErr = (token) => new Error(`connect ${DBURL} failed; password=${PWD}; bad credential ${token}`)

        it('X62 後端函數(表操作之operOrm、kpFunExt、authorizeExec、getUserIdByToken)reject含密碼與token: 遠端收到之msg不含', async function() {
            this.timeout(60000)
            let TK = 'tokReq-8841-xx'
            let cases = [
                ['operOrm', { operOrm: async() => Promise.reject(mkBackendErr(TK)) }, 'tabA.select'],
                ['kpFunExt', { kpFunExt: { boom: async() => Promise.reject(mkBackendErr(TK)) } }, 'boom'],
                ['kpFunExt同步拋錯', {
                    kpFunExt: {
                        boom: () => {
                            throw mkBackendErr(TK)
                        },
                    },
                }, 'boom'],
                ['kpFunExt字串reject', { kpFunExt: { boom: async() => Promise.reject(`${DBURL} password=${PWD} ${TK}`) } }, 'boom'],
                ['authorizeExec', { authorizeExec: async() => Promise.reject(mkBackendErr(TK)) }, 'tabA.select'],
                ['getUserIdByToken', { getUserIdByToken: async() => Promise.reject(mkBackendErr(TK)) }, 'tabA.select'],
            ]
            for (let [name, optExt, func] of cases) {
                let { inst, errs } = mk(optExt)
                let r = await exec(inst, func, [], TK)
                assert.strict.equal(r.state, 'error', name)
                assert.strict.deepEqual(leaks(r, [TK, PWD, 'dbuser:']), [], `${name}: ${dump(r)}`)
                assert.strict.equal(dump(r.msg).includes('***'), true, name)
                if (name === 'getUserIdByToken') {
                    //error事件之錯誤引數亦遮罩
                    assert.strict.equal(errs.length, 1)
                    assert.strict.deepEqual(leaks(errs, [TK, PWD, 'dbuser:']), [], `${name}: error事件`)
                }
            }
        })

        it('Error形狀之msg: 副本保留類別與code, 遮罩message; 不含憑證者原樣(同一物件)', async function() {
            this.timeout(60000)
            class DbErr extends Error {}
            let e1 = Object.assign(new DbErr(`auth failed ${DBURL}`), { code: 'ECONNREFUSED' })
            let e2 = Object.assign(new DbErr('relation "tabA" does not exist'), { code: '42P01' })
            let { inst } = mk({ kpFunExt: { f1: async() => Promise.reject(e1), f2: async() => Promise.reject(e2) } })
            let r1 = await exec(inst, 'f1', [], 'tokReq-1111')
            assert.strict.equal(r1.msg instanceof DbErr, true)
            assert.strict.equal(r1.msg.code, 'ECONNREFUSED')
            assert.strict.equal(r1.msg.message, 'auth failed postgres://***@db.example.com:5432/app')
            assert.strict.equal(e1.message.includes(PWD), true, '原錯誤不被改動')
            let r2 = await exec(inst, 'f2', [], 'tokReq-1111')
            assert.strict.equal(r2.msg, e2, '不含憑證者原樣, 身分不變')
        })

        //防禦性收尾之catch(輸入的檢視或參數展開拋錯, 例如Proxy陷阱、自訂迭代器): 文字取自外來錯誤, 回遠端之msg經diag.mask, error事件經diag.err
        it('execFun收尾與函數呼叫之catch(輸入為Proxy陷阱拋錯、參數展開拋錯): 回遠端之msg與error事件已遮罩', async function() {
            this.timeout(60000)
            let { inst, errs } = mk({ kpFunExt: { who: () => 'x' } })
            let trap = () => {
                throw new Error(`proxy trap password=${PWD} ${DBURL}`)
            }
            let pm = genPm()
            inst.emit('execute', 'who', new Proxy({}, { has: trap, get: trap }), pm)
            let r1 = await pm
            assert.strict.equal(r1.state, 'error')
            assert.strict.equal(r1.msg, 'execFun func[who] has an error: proxy trap password=*** postgres://***@db.example.com:5432/app')
            assert.strict.equal(errs.length, 1)
            assert.strict.deepEqual(leaks(errs), [], 'error事件之錯誤已遮罩')
            let arr = []
            arr[Symbol.iterator] = () => {
                throw new Error(`iter boom password=${PWD}`)
            }
            let r2 = await exec(inst, 'who', arr, 'tokReq-4444')
            assert.strict.equal(r2.state, 'error')
            assert.strict.equal(r2.msg, 'call func[who] has an error: iter boom password=***')
        })

        it('建構失敗之catch(使用端genTag等拋錯含網址帳密): 拋出之錯誤已遮罩; 不含秘密者原樣(同一參照)', function() {
            let build = (genTag) => {
                return new WServWebdataServer(evem(), {
                    fpTableTags: `${fdTmp}/tags-gen.json`,
                    getUserIdByToken: async() => 'u1',
                    useDbOrm: true,
                    kpOrm: { tabA: evem() },
                    operOrm: async() => [],
                    tableNamesExec: ['tabA'],
                    methodsExec: ['select'],
                    tableNamesSync: ['tabA'],
                    authorizeExec: async() => true,
                    genTag,
                })
            }
            let e1 = new Error(`tag failed ${DBURL}`)
            assert.throws(() => build(() => {
                throw e1
            }), (err) => {
                return err !== e1 && err instanceof Error && err.message === 'tag failed postgres://***@db.example.com:5432/app'
            })
            let plain = new Error('tag failed')
            assert.throws(() => build(() => {
                throw plain
            }), (err) => {
                return err === plain
            })
        })

        it('輪詢之getUserIdByToken拒絕值夾帶token(genPollingGate): error事件之err已遮罩, 遠端只見固定訊息; 不含token者原樣', async function() {
            this.timeout(60000)
            let tr = genTracer()
            let plain = new Error('lookup failed (no secret)')
            let { inst, errs } = mk({
                onTrace: tr.onTrace,
                getUserIdByToken: async(t) => {
                    if (t === 'tokPlain-6666') {
                        throw plain
                    }
                    throw new Error(`lookup failed for ${t} ${DBURL}`)
                },
            })
            let poll = async(token, clientId) => {
                let pm = genPm()
                inst.emit('execute', '[sys:polling]', { clientId, __sysToken__: token }, pm)
                return await pm.then((v) => ({ ok: true, v }), (err) => ({ ok: false, err }))
            }
            let r1 = await poll('tokPoll-5555', 'c1')
            assert.strict.deepEqual(r1, { ok: false, err: '[sys:polling] permission denied' }, '遠端只見固定訊息')
            await tr.until(() => errs.length >= 1) //w-serv-broadcast以1ms脫勾派發error事件
            assert.strict.equal(errs[0].msg, '[sys:polling] verifyPolling error')
            assert.strict.deepEqual(leaks(errs, ['tokPoll-5555', PWD]), [], dump(errs))
            assert.strict.equal(errs[0].err.message, 'lookup failed for *** postgres://***@db.example.com:5432/app')
            await poll('tokPlain-6666', 'c2')
            await tr.until(() => errs.length >= 2)
            assert.strict.equal(errs[1].err, plain, '不含秘密者原樣, 身分不變')
        })

        it('成功之資料不遮罩(契約): 回傳值內含token字樣者原樣', async function() {
            this.timeout(60000)
            let data = { note: `my token is ${'tokReq-2222'}`, list: [DBURL] }
            let { inst } = mk({ kpFunExt: { ok: async() => data } })
            let r = await exec(inst, 'ok', [], 'tokReq-2222')
            assert.strict.deepEqual(r, { state: 'success', msg: data })
            assert.strict.equal(r.msg, data)
        })

        it('固定詞彙之拒絕訊息原樣(語料R07): permission denied、invalid find[…]、invalid token等不被token子字串切碎', async function() {
            this.timeout(60000)
            let { inst } = mk({ authorizeExec: async() => false })
            //token='permission'為'permission denied'之子字串
            let r1 = await exec(inst, 'tabA.select', [], 'permission')
            assert.strict.deepEqual(r1, { state: 'error', msg: 'permission denied' })
            //token='invalid'為'invalid find[badKey]'之子字串; find含不在白名單之鍵
            let r2 = await exec(inst, 'tabA.select', [{ 'bad key': 1 }], 'invalid')
            assert.strict.equal(r2.state, 'error')
            assert.strict.equal(r2.msg.startsWith('invalid find['), true, r2.msg)
            assert.strict.equal(r2.msg.includes('***'), false, r2.msg)
            //系統函數與格式錯誤之固定回應: 無token鍵、輸入非陣列
            let pm = genPm()
            inst.emit('execute', 'tabA.select', { __sysInputArgs__: [] }, pm)
            assert.strict.deepEqual(await pm, { state: 'error', msg: 'invalid token' })
        })

        it('進行中請求之token保留至請求結束(X54): 其後128個以上之其他token擠出近期清單, 該請求之msg中的token仍被遮罩', async function() {
            this.timeout(60000)
            let T0 = 'INFLIGHT-srv-0001'
            let tr = genTracer()
            let open = null
            let gate = new Promise((resolve) => {
                open = resolve
            })
            let { inst } = mk({
                kpFunExt: {
                    slow: async() => {
                        tr.onTrace({ type: 'entered' })
                        await gate
                        throw new Error(`bad credential ${T0}`)
                    },
                    ok: async() => 'fine',
                },
            })
            let p0 = exec(inst, 'slow', [], T0)
            await tr.wait({ type: 'entered' }) //該請求已進入後端函數而在途
            for (let i = 0; i < 200; i++) {
                let r = await exec(inst, 'ok', [], `OTHER-${i}-xxxx`)
                assert.strict.equal(r.state, 'success')
            }
            open()
            let r0 = await p0
            assert.strict.equal(r0.state, 'error')
            assert.strict.deepEqual(leaks(r0, [T0]), [], dump(r0))
            assert.strict.equal(r0.msg.message, 'bad credential ***')
        })

        it('WServWebdataServerExec直接建構(未經WServWebdataServer交入diag與book): 自建預設仍遮罩', async function() {
            this.timeout(60000)
            let inst = evem()
            insts.push(inst)
            inst.clearBroadcast = () => {}
            inst.clearSync = () => {}
            new WServWebdataServerExec(inst, {
                getUserIdByToken: async() => 'u1',
                kpFunExt: { boom: async() => Promise.reject(mkBackendErr('tokReq-3333')) },
            })
            let r = await exec(inst, 'boom', [], 'tokReq-3333')
            assert.strict.equal(r.state, 'error')
            assert.strict.deepEqual(leaks(r, ['tokReq-3333', PWD]), [], dump(r))
        })

    })

})
