import assert from 'assert'
import fs from 'fs'
import { inspect } from 'util'
import evem from 'wsemi/src/evem.mjs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


//以真WConverhpServer與WConverhpClient經HTTP驗證診斷輸出(與unit-diaglog互補: 整個連線過程〔取函數清單、輪詢、同步、取資料〕中, 本行程所有console輸出皆不含使用者id、資料列之值、token與錯誤原文; 回傳與同步結果不變)
//  情境: 前端同步取得資料後, recvData於自身內停止並拋出夾帶使用者id、資料值與本體token之錯誤(停止後才拋錯, 走診斷輸出)
//  三組: 預設(只輸出標籤與摘要)、funLog(收完整細節, token遮罩)、logDetail(還原舊輸出, token遮罩)
//  規則帳本: R18
describe('api-diaglog', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/api-diaglog'

    //ports, 固定埠(預設、funLog、logDetail), 避開api-servdata之9000、api-clientStop之9001、api-checkFind之9002、api-sysFuncs之9003~9007、api-authorizeExec之8301
    let portDef = 9008
    let portFun = 9009
    let portDet = 9010

    //敏感值: 標頭token、本體token、使用者id、資料列之值、錯誤原文
    let HDR = 'hdr-SECRET-token-1'
    let BODY = 'body-SECRET-token-2'
    let UID = 'u-secret-uid-3'
    let ROWS = [{ id: 'row-secret-id-4', name: 'row-secret-name-5' }]
    let TEXT = 'raw-error-text-6'

    //LABEL, 前端停止後回調拋錯之標籤
    let LABEL = '[w-serv-webdata] callback error after stop'

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    //waitFor, 條件成立時結束, 逾時則拋錯(綁定約需2.x秒)
    let waitFor = async(fn, ms = 20000, label = '') => {
        let t = Date.now()
        while (!fn()) {
            if (Date.now() - t > ms) {
                throw new Error(`waitFor timeout ${label}`)
            }
            await sleep(50)
        }
    }

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //capture, 擷取本行程console輸出(整段連線過程)
    let capture = () => {
        let logged = { log: [], error: [], warn: [], info: [], debug: [] }
        let org = {}
        for (let k of Object.keys(logged)) {
            org[k] = console[k]
            console[k] = (...args) => {
                logged[k].push(args)
            }
        }
        let restore = () => {
            for (let k of Object.keys(org)) {
                console[k] = org[k]
            }
        }
        return { logged, restore }
    }

    //session, 起真伺服端與前端, 前端recvData於首次收到資料時停止並拋錯, 等診斷輸出出現後以$fapi再取一次資料, 停止並回傳{ logged, recv, again, srvFunLog }
    let session = async({ port, optClient = {}, optServer = {} }) => {
        let { logged, restore } = capture()
        let recv = []
        let again = null
        let srv = null
        let cl = null
        try {
            let ev = evem()
            srv = new WConverhpServer({
                port,
                pathUploadTemp: `${fdTmp}/uploadTemp-${port}`,
                verifyConn: async({ authorization }) => {
                    return authorization === `Bearer ${HDR}`
                },
            })
            srv = new WServWebdataServer(srv, {
                fpTableTags: `${fdTmp}/tags-${port}.json`,
                sysFuncsPublic: ['[sys:getFuncList]'],
                getUserIdByToken: async(token) => {
                    return token === BODY ? UID : ''
                },
                useDbOrm: true,
                kpOrm: { tabA: ev },
                operOrm: async() => ROWS,
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: async({ userId }) => {
                    return userId !== ''
                },
                ...optServer,
            })
            srv.on('error', () => {})
            await sleep(300)

            let fapi = null
            let c = null
            cl = new WConverhpClient({ url: `http://localhost:${port}`, getToken: () => HDR, retryMain: 0 })
            cl.on('error', () => {})
            cl = new WServWebdataClient(cl, {
                getToken: () => BODY,
                getServerMethods: (f) => {
                    fapi = f
                },
                recvData: (r) => {
                    recv.push(r)
                    c.clearBroadcast()
                    c.clearSync()
                    throw new Error(`${TEXT} uid=${UID} data=${JSON.stringify(r.data)} token=${BODY}`)
                },
                ...optClient,
            })
            c = cl
            cl.on('error', () => {})

            let done = () => {
                return recv.length >= 1 && (logged.error.some((v) => v[0] === LABEL) || (optClient.funLog && optClient.funLog.calls.length >= 1))
            }
            await waitFor(done, 20000, 'diag')
            await sleep(500)

            //停止後使用端自行呼叫之函數照常(契約不變)
            again = await fapi.tabA.select()
        }
        finally {
            if (cl) {
                cl.clearBroadcast()
                cl.clearSync()
            }
            if (srv) {
                srv.clearBroadcast()
                srv.clearSync()
                await srv.stop()
            }
            await sleep(300)
            restore()
        }
        return { logged, recv, again }
    }

    //genFunLog, 記錄呼叫之funLog
    let genFunLog = () => {
        let f = (...args) => {
            f.calls.push(args)
        }
        f.calls = []
        return f
    }

    //dump, 完整傾印(含Error之message與stack等不可列舉屬性、Symbol鍵; JSON.stringify會漏掉這些)
    let dump = (v) => {
        return inspect(v, { depth: null, showHidden: true, customInspect: false, maxArrayLength: null, maxStringLength: null, breakLength: Infinity })
    }

    let secretsIn = (v) => {
        let s = dump(v)
        return [HDR, BODY, UID, 'row-secret-id-4', 'row-secret-name-5', TEXT].filter((x) => s.includes(x))
    }

    it('預設: 連線全程之console輸出不含id、資料值、token與錯誤原文, 只有標籤與摘要; 同步與$fapi結果不變', async function() {
        this.timeout(60000)
        let { logged, recv, again } = await session({ port: portDef })
        assert.strict.deepEqual(secretsIn(logged), [], '全部console輸出(log/error/warn/info/debug)不含敏感值')
        assert.strict.deepEqual(logged.error.filter((v) => v[0] === LABEL), [[LABEL, { hook: 'recvData', errType: 'Error' }]])
        assert.strict.equal(recv.length, 1)
        assert.strict.equal(recv[0].tableName, 'tabA')
        assert.strict.deepEqual(recv[0].data, ROWS, '同步取得之資料不變')
        assert.strict.deepEqual(again, ROWS, '停止後$fapi照常')
    })

    it('funLog: 前端與伺服端之funLog收完整細節(token遮罩), 不寫console; 伺服端有效物件時不呼叫', async function() {
        this.timeout(60000)
        let funLog = genFunLog()
        let funLogSrv = genFunLog()
        let { logged, recv, again } = await session({ port: portFun, optClient: { funLog }, optServer: { funLog: funLogSrv } })
        assert.strict.equal(logged.error.filter((v) => v[0] === LABEL).length, 0)
        assert.strict.equal(funLog.calls.length, 1)
        let [label, safe, detail] = funLog.calls[0]
        assert.strict.equal(label, LABEL)
        assert.strict.deepEqual(safe, { hook: 'recvData', errType: 'Error' })
        assert.strict.equal(detail.message, `${TEXT} uid=${UID} data=${JSON.stringify(ROWS)} token=[token]`)
        assert.strict.equal(dump([detail, detail.stack]).includes(BODY), false)
        assert.strict.equal(funLogSrv.calls.length, 0)
        assert.strict.deepEqual(secretsIn(logged), [], '本行程其餘console輸出亦不含敏感值')
        assert.strict.deepEqual(recv[0].data, ROWS)
        assert.strict.deepEqual(again, ROWS)
    })

    it('logDetail: 還原舊輸出(含id、資料值與原文), token遮罩', async function() {
        this.timeout(60000)
        let { logged, recv, again } = await session({ port: portDet, optClient: { logDetail: true } })
        let entries = logged.error.filter((v) => v[0] === LABEL)
        assert.strict.equal(entries.length, 1)
        assert.strict.equal(entries[0].length, 2)
        assert.strict.equal(entries[0][1].message, `${TEXT} uid=${UID} data=${JSON.stringify(ROWS)} token=[token]`)
        assert.strict.equal(dump(logged).includes(BODY), false, 'token不外漏')
        assert.strict.equal(dump(logged).includes(HDR), false)
        assert.strict.deepEqual(recv[0].data, ROWS)
        assert.strict.deepEqual(again, ROWS)
    })

})
