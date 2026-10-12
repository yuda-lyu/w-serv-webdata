import assert from 'assert'
import fs from 'fs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


//以真WConverhpServer與WConverhpClient經HTTP呼叫, 驗證前端實際收到之授權結果與拒絕訊息(含w-converhp序列化後之形狀)
describe('api-authorizeExec', function() {

    //port, 固定埠, 避開api-servdata之9000
    let port = 8301

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/api-authorizeExec'

    let srv = null
    let cl = null
    let fapi = null
    let tok = 'tokOk'
    let cnt = { orm: 0, auth: 0 }

    before(async function() {
        fs.mkdirSync(fdTmp, { recursive: true })

        srv = new WConverhpServer({ port })
        srv = new WServWebdataServer(srv, {
            fpTableTags: `${fdTmp}/tableTags.json`,
            getUserIdByToken: (token) => {
                if (token === 'tokRejectStr') {
                    return Promise.reject('errUserIdMissing')
                }
                return token === 'tokOk' ? 'u1' : ''
            },
            useDbOrm: true,
            kpOrm: {},
            operOrm: async (userId, tableName, methodName, input) => {
                cnt.orm++
                return [{ id: 'r1', userId, tableName, methodName }]
            },
            tableNamesExec: ['tabA', 'tabB', 'tabKey', 'tabErr'],
            methodsExec: ['select', 'save'],
            authorizeExec: async ({ userId, tableName, methodName }) => {
                cnt.auth++
                if (tableName === 'tabKey') {
                    return Promise.reject('errNoPermission')
                }
                if (tableName === 'tabErr') {
                    throw new Error('errAuthObj')
                }
                return userId === 'u1' && tableName === 'tabA' && methodName === 'select'
            },
            kpFunExt: {
                add: (userId, a, b) => {
                    return a + b
                },
            },
        })
        srv.on('error', () => {})

        cl = new WConverhpClient({ url: `http://localhost:${port}` })
        fapi = await new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject(new Error('getServerMethods timeout'))
            }, 20000)
            cl = new WServWebdataClient(cl, {
                getToken: () => {
                    return tok
                },
                getServerMethods: (r) => {
                    clearTimeout(t)
                    resolve(r)
                },
                recvData: () => {},
            })
            cl.on('error', () => {})
        })
    })

    after(function() {
        if (cl) {
            cl.clearBroadcast()
        }
        if (srv) {
            srv.clearBroadcast()
            srv.stop()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //R01, R05
    it('授權放行時前端收到operOrm之結果', async function() {
        let r = await fapi.tabA.select({})
        assert.strict.deepEqual(r, [{ id: 'r1', userId: 'u1', tableName: 'tabA', methodName: 'select' }])
    })

    //R03, R05
    it('授權回傳false時前端收到permission denied字串, 且不呼叫operOrm', async function() {
        let n = cnt.orm
        await assert.rejects(fapi.tabB.select({}), (err) => {
            assert.strict.equal(err, 'permission denied')
            return true
        })
        await assert.rejects(fapi.tabA.save([{ id: 'x' }]), (err) => {
            assert.strict.equal(err, 'permission denied')
            return true
        })
        assert.strict.equal(cnt.orm, n)
    })

    //R04, R15: 欲回傳語系鍵須reject字串
    it('授權函數reject字串時前端收到原字串', async function() {
        await assert.rejects(fapi.tabKey.select({}), (err) => {
            assert.strict.equal(err, 'errNoPermission')
            return true
        })
    })

    //R04, R15: Error物件經w-converhp序列化後成為'Error: 訊息'字串
    it('授權函數拋Error時前端收到Error: 訊息字串', async function() {
        await assert.rejects(fapi.tabErr.select({}), (err) => {
            assert.strict.equal(err, 'Error: errAuthObj')
            return true
        })
    })

    //R06
    it('kpFunExt不經授權函數', async function() {
        let n = cnt.auth
        assert.strict.equal(await fapi.add(1, 2), 3)
        assert.strict.equal(cnt.auth, n)
    })

    //R13: 修正前前端收到'execFun func[tabA.select] has an error: undefined'
    it('getUserIdByToken reject字串時前端收到原字串', async function() {
        tok = 'tokRejectStr'
        try {
            await assert.rejects(fapi.tabA.select({}), (err) => {
                assert.strict.equal(err, 'errUserIdMissing')
                return true
            })
        }
        finally {
            tok = 'tokOk'
        }
    })

    //R16: 修正前constructor可被呼叫並回成功
    it('Object.prototype之名稱不可呼叫', async function() {
        for (let name of ['constructor', 'toString', '__proto__']) {
            let r = await cl.execute(name, { __sysInputArgs__: [], __sysToken__: 'tokOk' })
            assert.strict.deepEqual(r, { state: 'error', msg: `invalid func[${name}]` }, name)
        }
    })

    //R10相關: 函數清單只含已註冊之表操作與kpFunExt
    it('前端取得之函數清單為已註冊之表操作與kpFunExt', async function() {
        assert.strict.deepEqual(Object.keys(fapi).sort(), ['add', 'tabA', 'tabB', 'tabErr', 'tabKey'])
        assert.strict.deepEqual(Object.keys(fapi.tabA).sort(), ['save', 'select'])
    })

})
