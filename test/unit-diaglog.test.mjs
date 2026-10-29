/* eslint-disable no-new-wrappers */ //測試包裝型別(new String等)被當作選項值或token時之處置, 故刻意使用
import assert from 'assert'
import fs from 'fs'
import vm from 'vm'
import { inspect } from 'util'
import evem from 'wsemi/src/evem.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import { getOptLog, getDiag, getBriefErr, genTokenBook, cpDetail } from '../src/getDiag.mjs'
import { genTracer, flush, drain } from './tools/tracer.mjs'
import { hookNames, genRun, linkCtl } from './tools/clientHarness.mjs'


//同步以事件而非等待毫秒: 等回調被呼叫(log.tr之hook事件)、等通訊物件收到請求(linkCtl之tr)、等error事件(deliver或error事件)等; 肯定事件之後以drain讓診斷輸出與已排定之微任務、1ms脫勾派發跑完, 再斷言「無額外輸出」「無unhandledRejection」
//診斷輸出(R18): 預設只輸出固定標籤與不含資料值之摘要, opt.logDetail還原完整細節, opt.funLog取代console收完整細節, token一律遮罩, 回傳與事件契約不變
//本套件實際會執行之診斷輸出共2處: 前端callHook於停止後才拋錯(console.error), 伺服端instWConverServer非有效物件(console.log, 固定文字)
describe('unit-diaglog', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-diaglog'

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

    //LABEL, 前端停止後回調拋錯之標籤(與舊版相同)
    let LABEL = '[w-serv-webdata] callback error after stop'

    //敏感值: 使用者id、資料值、token、錯誤原文
    let ID = 'u-secret-7421'
    let NAME = 'peter-secret-name'
    let TOKEN = 'tk-SECRET-8841'
    let TEXT = 'raw-error-text-5530'

    //capture, 擷取console輸出(僅測試內短暫替換, 不跨測試)
    let capture = () => {
        let logged = { log: [], error: [], warn: [] }
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

    //waitFor, 狀態條件成立時回傳true(於tr之每則事件後檢查); tr之防懸置上限內未成立則回傳false(上限只防懸置, 不表達規格)
    let waitFor = async(fn, tr) => {
        try {
            await tr.until(fn)
            return true
        }
        catch (err) {
            return false
        }
    }

    //mkErr, 內含id、資料值、token與原文之錯誤
    let mkErr = () => {
        let e = new Error(`${TEXT} for ${ID} data=${JSON.stringify({ id: ID, name: NAME })} token=${TOKEN}`)
        e.userId = ID
        e.row = { id: ID, name: NAME }
        return e
    }

    //genFunLog, 記錄呼叫之funLog
    let genFunLog = (impl = null) => {
        let f = (...args) => {
            f.calls.push(args)
            return impl ? impl(...args) : undefined
        }
        f.calls = []
        return f
    }

    //runStop, 建構前端, 回調函數(預設recvData)於自身內停止後拋錯, 等到診斷輸出(console.error或funLog)出現; 回傳{ log, entries, all }, entries為標籤符合者之console.error輸出
    let runStop = async({ hook = 'recvData', makeErr = mkErr, opt = {} } = {}) => {
        let { cl } = linkCtl()
        let c = null
        let { logged, restore } = capture()
        let log = null
        let entries = []
        try {
            log = run(cl, {
                [hook]: () => {
                    c.clearBroadcast()
                    c.clearSync()
                    throw makeErr()
                },
                ...opt,
            })
            c = log.cl
            let count = () => {
                return logged.error.filter((v) => v[0] === LABEL).length + (opt.funLog && opt.funLog.calls ? opt.funLog.calls.length : 0)
            }
            await log.tr.wait({ type: 'hook', name: hook }) //該回調被呼叫(於自身內停止後拋錯, 診斷輸出於同一呼叫堆疊內完成)
            assert.strict.equal(count() > 0, true, '診斷輸出未出現')
            await drain(3) //其後之額外輸出(若有)亦在擷取範圍
            entries = logged.error.filter((v) => v[0] === LABEL)
        }
        finally {
            restore()
        }
        return { log, entries, all: logged }
    }

    //dump, 完整傾印(含Error之message與stack等不可列舉屬性、Symbol鍵; JSON.stringify會漏掉這些; 關閉customInspect, 以免原型上的自訂格式器掩蓋內容)
    let dump = (v) => {
        return inspect(v, { depth: null, showHidden: true, customInspect: false, maxArrayLength: null, maxStringLength: null, breakLength: Infinity })
    }

    //hasSecret, 回傳v之完整傾印內出現之敏感值
    let hasSecret = (v) => {
        let s = dump(v)
        return [ID, NAME, TOKEN, TEXT].filter((x) => s.includes(x))
    }


    describe('選項檢查', function() {

        //任務3: 選項型別錯誤之處理與本套件其他選項一致(拋Error('invalid opt.xxx'), 於建構任何元件之前)
        it('前端: logDetail非布林、funLog非函數時拋錯且不擴充通訊物件, null與undefined視為未給', function() {
            let bads = [
                ['logDetail', 'true'],
                ['logDetail', 1],
                ['logDetail', 0],
                ['logDetail', {}],
                ['logDetail', []],
                ['logDetail', () => {}],
                ['logDetail', new Boolean(true)], //包裝布林不是布林(與參考實作之typeof一致), 不可被接受後靜默轉成false
                ['funLog', 'fn'],
                ['funLog', true],
                ['funLog', {}],
                ['funLog', 0],
            ]
            for (let [k, v] of bads) {
                let { cl } = linkCtl()
                assert.throws(() => {
                    new WServWebdataClient(cl, { getServerMethods: () => {}, recvData: () => {}, [k]: v })
                }, { message: `invalid opt.${k}` }, `${k}=${String(v)}`)
                assert.strict.equal(cl.eventNames().length, 0, '設定錯誤不掛監聽')
                assert.strict.equal(cl.clearBroadcast, undefined, '設定錯誤不擴充通訊物件')
            }
            for (let kp of [{ logDetail: undefined }, { logDetail: null }, { funLog: undefined }, { funLog: null }, { logDetail: true }, { logDetail: false }, { funLog: () => {} }, { funLog: async() => {} }, { logDetail: true, funLog: function() {} }]) {
                let { cl } = linkCtl()
                let c = new WServWebdataClient(cl, { getServerMethods: () => {}, recvData: () => {}, ...kp })
                c.clearBroadcast()
                c.clearSync()
            }
        })

        it('伺服端: logDetail非布林、funLog非函數時拋錯, 不擴充事件物件、不掛監聽, null與undefined視為未給', function() {
            let bads = [
                ['logDetail', 'true'],
                ['logDetail', 1],
                ['logDetail', {}],
                ['logDetail', () => {}],
                ['logDetail', new Boolean(false)],
                ['funLog', 'fn'],
                ['funLog', false],
                ['funLog', {}],
            ]
            for (let [k, v] of bads) {
                let ev = evem()
                assert.throws(() => {
                    new WServWebdataServer(ev, { fpTableTags: `${fdTmp}/tags.json`, [k]: v })
                }, { message: `invalid opt.${k}` }, `${k}=${String(v)}`)
                assert.strict.equal(ev.eventNames().length, 0, '設定錯誤不掛監聽')
                assert.strict.equal(ev.clearBroadcast, undefined, '設定錯誤不擴充事件物件')
            }
            for (let kp of [{}, { logDetail: undefined }, { logDetail: null }, { funLog: null }, { logDetail: true }, { logDetail: false }, { funLog: () => {} }, { logDetail: true, funLog: () => {} }]) {
                let ev = evem()
                let s = new WServWebdataServer(ev, { fpTableTags: `${fdTmp}/tags.json`, ...kp })
                s.clearBroadcast()
                s.clearSync()
            }
        })

        it('getOptLog: 回傳固定快照, 讀取opt一次(getter前後不同不影響)', function() {
            let n = 0
            let f = () => {}
            let opt = {
                get logDetail() {
                    n++
                    return n === 1
                },
                funLog: f,
            }
            assert.strict.deepEqual(getOptLog(opt), { logDetail: true, funLog: f })
            assert.strict.equal(n, 1)
            assert.strict.deepEqual(getOptLog(undefined), { logDetail: false, funLog: null })
            assert.strict.deepEqual(getOptLog({ logDetail: null, funLog: null }), { logDetail: false, funLog: null })
        })

    })


    describe('預設: 只輸出標籤與不含個資之摘要', function() {

        //任務2/5: 預設時擷取console不出現id、資料值、錯誤原文、token
        it('停止後回調拋錯: console.error只有固定標籤與{ hook, errType }, 不含id、資料值、原文、token', async function() {
            this.timeout(30000)
            let { log, entries, all } = await runStop({ opt: { getToken: () => TOKEN } })
            assert.strict.deepEqual(log.rawErrors, [], '停止後不發出error事件(契約不變)')
            assert.strict.equal(entries.length, 1)
            assert.strict.deepEqual(entries[0], [LABEL, { hook: 'recvData', errType: 'Error' }])
            assert.strict.deepEqual(hasSecret(all.error), [], '全部console.error輸出不含敏感值')
            assert.strict.deepEqual(hasSecret(all.log), [])
            assert.strict.deepEqual(hasSecret(all.warn), [])
        })

        //6個回調函數各自停止後拋錯, 摘要帶出回調函數名稱(固定識別字)
        it('6個回調函數各自停止後拋錯: 摘要之hook為該回調函數名稱', async function() {
            this.timeout(60000)
            let { logged, restore } = capture()
            let logs = []
            try {
                for (let hook of hookNames) {
                    let { cl } = linkCtl()
                    let c = null
                    let log = run(cl, {
                        [hook]: () => {
                            c.clearBroadcast()
                            c.clearSync()
                            throw mkErr()
                        },
                    })
                    c = log.cl
                    logs.push(log)
                }
                await Promise.all(logs.map((log, i) => log.tr.wait({ type: 'hook', name: hookNames[i] }))) //各回調被呼叫(診斷輸出於同一呼叫堆疊內完成)
                assert.strict.equal(logged.error.filter((v) => v[0] === LABEL).length >= hookNames.length, true, '診斷輸出未全部出現')
                await drain(3)
            }
            finally {
                restore()
            }
            let entries = logged.error.filter((v) => v[0] === LABEL)
            assert.strict.deepEqual(entries.map((v) => v[1].hook).sort(), [...hookNames].sort())
            for (let v of entries) {
                assert.strict.deepEqual(v, [LABEL, { hook: v[1].hook, errType: 'Error' }])
            }
            assert.strict.deepEqual(hasSecret(entries), [])
            for (let log of logs) {
                assert.strict.deepEqual(log.rawErrors, [])
            }
        })

        //拋出值之種類: 字串、數字、null、物件、自訂類別、name與code夾帶資料者
        it('拋出值之種類: 摘要只含類別與機器代碼, 不含字串、數字、物件內容與可被指定之name、code', async function() {
            this.timeout(120000)
            class MyErr extends Error {}
            let e1 = new MyErr(TEXT)
            e1.name = `name-${ID}`
            e1.code = 'ENOENT'
            let e2 = new Error(TEXT)
            e2.code = `code-${ID}`
            let e3 = new Error(TEXT)
            e3.code = 404
            let e4 = new Error(TEXT)
            e4.code = 123456789
            let e5 = new Error(TEXT)
            Object.defineProperty(e5, 'code', {
                get() {
                    throw new Error(TEXT)
                },
            })
            class WeirdName extends Error {}
            Object.defineProperty(WeirdName, 'name', { value: `user ${ID}` })
            let e6 = new WeirdName(TEXT)
            let e7 = new Error(TEXT)
            e7.code = 'ERR_INVALID_ARG_TYPE'
            let cases = [
                [() => `str-${ID}`, { errType: 'string' }],
                [() => 12345, { errType: 'number' }],
                [() => null, { errType: 'null' }],
                [() => undefined, { errType: 'undefined' }],
                [() => ({ id: ID, name: NAME }), { errType: 'object' }],
                [() => [ID], { errType: 'object' }],
                [() => e1, { errType: 'MyErr', errCode: 'ENOENT' }],
                [() => e2, { errType: 'Error' }],
                [() => e3, { errType: 'Error', errCode: 404 }],
                [() => e4, { errType: 'Error' }],
                [() => e5, { errType: 'Error' }],
                [() => e6, { errType: 'Error' }],
                [() => e7, { errType: 'Error', errCode: 'ERR_INVALID_ARG_TYPE' }],
            ]
            for (let [makeErr, safe] of cases) {
                let { entries, all } = await runStop({ makeErr })
                assert.strict.equal(entries.length, 1)
                assert.strict.deepEqual(entries[0], [LABEL, { hook: 'recvData', ...safe }])
                assert.strict.deepEqual(hasSecret(all.error), [])
            }
        })

        //機器代碼樣式矩陣: 不符者(email、含點或連字號之識別、過短、過大之整數、結尾夾帶空白、非字串非整數)不進摘要
        it('getBriefErr: code樣式矩陣(符合機器代碼樣式者才列出)', function() {
            let mk = (c) => {
                let e = new Error(TEXT)
                e.code = c
                return e
            }
            for (let c of ['alice@example.com', 'alice+private@example.test', 'a@b.c', 'user.7421', `code-${ID}`, 'E1', 'ERR_', 'ENOENT ', 'eNOENT', 'ERR_lower', 100000, -100000, 1.5, NaN, Infinity, true, {}, [], null, undefined, `E${'A'.repeat(16)}`, `ERR_${'A'.repeat(41)}`]) {
                assert.strict.deepEqual(getBriefErr(mk(c)), { errType: 'Error' }, String(c))
            }
            for (let c of [-4058, 0, 404, 99999, -99999, 'EACCES', 'ENOENT', 'ERR_INVALID_ARG_TYPE', 'E12', `E${'A'.repeat(15)}`, `ERR_${'A'.repeat(40)}`]) {
                assert.strict.deepEqual(getBriefErr(mk(c)), { errType: 'Error', errCode: c }, String(c))
            }
            //建構子名稱: 符合識別字樣式才列出, 過長或含非識別字元者取Error
            class Good extends Error {}
            assert.strict.equal(getBriefErr(new Good(TEXT)).errType, 'Good')
            for (let nm of ['has space', 'dash-name', `A${'b'.repeat(40)}`, '1abc', '', `u@${ID}`]) {
                class X extends Error {}
                Object.defineProperty(X, 'name', { value: nm })
                assert.strict.equal(getBriefErr(new X(TEXT)).errType, 'Error', nm)
            }
        })

        //已知token恰為類別名稱或代碼時, 摘要內亦遮罩(token一律不得出現)
        it('摘要內已知token亦遮罩(token恰為code)', async function() {
            this.timeout(30000)
            let SECRET_CODE = 'ERR_SECRETTOK9'
            let { entries, all } = await runStop({
                makeErr: () => {
                    let e = new Error(TEXT)
                    e.code = SECRET_CODE
                    return e
                },
                opt: { getToken: () => SECRET_CODE },
            })
            assert.strict.deepEqual(entries[0], [LABEL, { hook: 'recvData', errType: 'Error', errCode: '[token]' }])
            assert.strict.equal(dump(all).includes(SECRET_CODE), false)
            //數值之code恰等於已知token(以字串形式比對)時亦遮罩
            let r2 = await runStop({
                makeErr: () => {
                    let e = new Error(TEXT)
                    e.code = 94821
                    return e
                },
                opt: { getToken: () => '94821' },
            })
            assert.strict.deepEqual(r2.entries[0], [LABEL, { hook: 'recvData', errType: 'Error', errCode: '[token]' }])
        })

        it('getBriefErr: 全程不執行getter, 任意輸入皆不拋錯', function() {
            let e = new Error(TEXT)
            Object.defineProperty(e, 'constructor', {
                get() {
                    throw new Error('getter executed')
                },
            })
            assert.strict.deepEqual(getBriefErr(e), { errType: 'Error' })
            let trap = () => {
                throw new Error('trap')
            }
            let p = new Proxy({}, { getPrototypeOf: trap, getOwnPropertyDescriptor: trap, has: trap })
            assert.strict.deepEqual(getBriefErr(p), { errType: 'unknown' })
            assert.strict.deepEqual(getBriefErr(Symbol('s')), { errType: 'symbol' })
            assert.strict.deepEqual(getBriefErr(10n), { errType: 'bigint' })
            assert.strict.deepEqual(getBriefErr(() => {}), { errType: 'function' })
        })

    })


    describe('funLog: 取代console並收完整細節', function() {

        //任務5: 注入之funLog收到完整細節
        it('收到(label, safe, detail): detail為錯誤之拷貝, 含id、資料值與原文, 不寫console, 原錯誤不被改動', async function() {
            this.timeout(30000)
            let funLog = genFunLog()
            let err0 = null
            let { log, all } = await runStop({
                makeErr: () => {
                    err0 = mkErr()
                    return err0
                },
                opt: { funLog, getToken: () => TOKEN },
            })
            assert.strict.deepEqual(log.rawErrors, [])
            assert.strict.equal(funLog.calls.length, 1)
            assert.strict.equal(funLog.calls[0].length, 3)
            let [label, safe, detail] = funLog.calls[0]
            assert.strict.equal(label, LABEL)
            assert.strict.deepEqual(safe, { hook: 'recvData', errType: 'Error' })
            assert.strict.notEqual(detail, err0, '拷貝, 不交出原參照')
            assert.strict.equal(detail instanceof Error, true)
            assert.strict.equal(detail.message, `${TEXT} for ${ID} data=${JSON.stringify({ id: ID, name: NAME })} token=[token]`, '含原文、id與資料值, 僅token遮罩')
            assert.strict.equal(detail.userId, ID)
            assert.strict.deepEqual(detail.row, { id: ID, name: NAME })
            assert.strict.equal(typeof detail.stack, 'string')
            assert.strict.equal(detail.stack.includes(TEXT), true)
            assert.strict.equal(err0.message.includes(TOKEN), true, '原錯誤之message不被遮罩改動')
            assert.strict.equal(all.error.filter((v) => v[0] === LABEL).length, 0, '給funLog後不寫console')
            assert.strict.equal(all.log.length, 0)
        })

        it('detail內token一律遮罩(已知token、鍵名、Bearer與鍵值樣式), 其餘細節保留', async function() {
            this.timeout(30000)
            let funLog = genFunLog()
            await runStop({
                makeErr: () => {
                    let e = new Error(`${TEXT} ${ID} Authorization: Bearer abc.def.ghi {"__sysToken__":"zzz-9"} token=${TOKEN}`)
                    e.token = 'other-token-value'
                    e.accessToken = 'at-1'
                    e.headers = { Authorization: 'Bearer h-1', cookie: 'k', list: [{ __sysToken__: 'in-array' }] }
                    e.cause = new Error(`cause ${TOKEN}`)
                    return e
                },
                opt: { funLog, getToken: () => TOKEN },
            })
            let detail = funLog.calls[0][2]
            let s = dump([detail, detail.stack, detail.cause.message, detail.cause.stack])
            for (let x of [TOKEN, 'abc.def.ghi', 'zzz-9', 'other-token-value', 'at-1', 'h-1', 'in-array']) {
                assert.strict.equal(s.includes(x), false, `${x}不得出現`)
            }
            assert.strict.equal(detail.message.includes('[token]'), true)
            assert.strict.equal(detail.message.includes(ID), true, '非token之id保留')
            assert.strict.equal(detail.token, '[token]')
            assert.strict.equal(detail.headers.cookie, 'k')
            assert.strict.equal(detail.cause instanceof Error, true)
            assert.strict.equal(detail.cause.message, 'cause [token]')
        })

        it('funLog拋錯或回傳reject之promise: 吞下, 不發出error、不使流程中斷、無unhandledRejection', async function() {
            this.timeout(60000)
            let un = []
            let onUn = (r) => {
                un.push(r)
            }
            process.on('unhandledRejection', onUn)
            try {
                let base = await runStop({ opt: { funLog: genFunLog() } })
                let impls = [
                    () => {
                        throw new Error('sync throw')
                    },
                    async() => {
                        throw new Error('async reject')
                    },
                    () => Promise.reject(new Error('reject')),
                    () => ({
                        then() {
                            throw new Error('thenable throws')
                        },
                    }),
                    () => ({
                        then(a, b) {
                            b(new Error('thenable reject'))
                        },
                    }),
                    () => ({
                        then() {
                            return Promise.reject(new Error('thenable returns rejected'))
                        },
                    }),
                    () => {
                        //原生promise之then屬性被覆寫為拋錯: 須以內建then附上處理(不讀被覆寫之then屬性), 否則其reject無人處理
                        let p = Promise.reject(new Error('native with overridden then'))
                        p.then = () => {
                            throw new Error('then overridden')
                        }
                        return p
                    },
                ]
                for (let impl of impls) {
                    let funLog = genFunLog(impl)
                    let r = await runStop({ opt: { funLog } })
                    assert.strict.equal(funLog.calls.length, 1)
                    assert.strict.deepEqual(r.log.rawErrors, [])
                    assert.strict.deepEqual(r.log.hooks, base.log.hooks)
                }
                await drain(3) //funLog回傳之rejection已被吞下: 微任務與unhandledRejection之檢查皆已跑完
                assert.strict.deepEqual(un, [])
            }
            finally {
                process.off('unhandledRejection', onUn)
            }
        })

    })


    describe('logDetail: 還原舊輸出(token仍遮罩)', function() {

        it('console.error(label, 錯誤): 含id、資料值與原文, token遮罩', async function() {
            this.timeout(30000)
            let { log, entries } = await runStop({ opt: { logDetail: true, getToken: () => TOKEN } })
            assert.strict.deepEqual(log.rawErrors, [])
            assert.strict.equal(entries.length, 1)
            assert.strict.equal(entries[0].length, 2, '同舊版: (label, err)')
            let e = entries[0][1]
            assert.strict.equal(e instanceof Error, true)
            assert.strict.equal(e.message, `${TEXT} for ${ID} data=${JSON.stringify({ id: ID, name: NAME })} token=[token]`)
            assert.strict.equal(e.stack.includes(TEXT), true, '堆疊保留')
            assert.strict.equal(e.stack.includes(TOKEN), false)
            assert.strict.equal(dump(entries).includes(TOKEN), false)
            assert.strict.equal(e.userId, ID)
            assert.strict.deepEqual(e.row, { id: ID, name: NAME })
        })

        it('logDetail: false與未給相同(安全摘要); 同時給funLog時只交給funLog', async function() {
            this.timeout(30000)
            let a = await runStop({ opt: { logDetail: false } })
            assert.strict.deepEqual(a.entries[0], [LABEL, { hook: 'recvData', errType: 'Error' }])
            let funLog = genFunLog()
            let b = await runStop({ opt: { logDetail: true, funLog } })
            assert.strict.equal(b.entries.length, 0)
            assert.strict.equal(funLog.calls.length, 1)
            assert.strict.equal(funLog.calls[0][2].message.includes(TEXT), true)
        })

        //已知token: 前端取得過之token(getToken之回傳, 含輪詢所取), 錯誤內無論以何種文字夾帶皆遮罩
        //已知token之特殊形式(端到端): 很長(2049字元)、包裝字串、含遮罩字樣者
        it('已知token之特殊形式: 很長、包裝字串、含遮罩字樣', async function() {
            this.timeout(60000)
            let cases = [
                ['long', `L${'y'.repeat(2048)}`, (t) => t],
                ['boxed', 'BOXED-SECRET-77', (t) => new String(t)],
                ['foreign-realm boxed', 'FOREIGN-BOX-SECRET-78', (t) => vm.runInNewContext(`new String(${JSON.stringify(t)})`)],
                ['20000 chars', `L${'z'.repeat(20000)}`, (t) => t],
                ['marker', 'abc[token]xyz-SECRET', (t) => t],
            ]
            for (let [name, tok, wrap] of cases) {
                let { entries } = await runStop({
                    makeErr: () => new Error(`leak ${tok} end`),
                    opt: { logDetail: true, getToken: () => wrap(tok) },
                })
                assert.strict.equal(entries.length, 1, name)
                let e = entries[0][1]
                assert.strict.equal(e.message, 'leak [token] end', name)
                assert.strict.equal(e.stack.includes(tok), false, name)
            }
        })

        it('已知token涵蓋同步、非同步與每次不同之token', async function() {
            this.timeout(60000)
            let kinds = ['sync', 'async', 'rotate', 'rotate-async']
            for (let kind of kinds) {
                let n = 0
                let vals = []
                let getToken = () => {
                    n++
                    let v = kind.startsWith('rotate') ? `${TOKEN}-${n}` : TOKEN
                    vals.push(v)
                    return kind.endsWith('async') ? Promise.resolve(v) : v
                }
                let { entries } = await runStop({
                    makeErr: () => new Error(`leak ${vals.join(' | ')}`),
                    opt: { logDetail: true, getToken },
                })
                assert.strict.equal(entries.length, 1)
                let e = entries[0][1]
                assert.strict.equal(vals.length >= 2, true, `${kind}: 輪詢與請求皆取過token`)
                assert.strict.equal(e.message.includes('tk-SECRET'), false, kind)
                assert.strict.equal(e.stack.includes('tk-SECRET'), false, kind)
                assert.strict.equal(e.message.includes('[token]'), true, kind)
            }
        })

    })


    describe('回傳與事件契約不變', function() {

        //任務4: 對外之回傳值、reject內容、事件與廣播之內容與時機不變(只動診斷輸出)
        it('停止後拋錯之情境: 預設、logDetail、funLog(含拋錯者)之error事件、回調次數、$fapi結果皆相同', async function() {
            this.timeout(60000)
            let configs = [
                {},
                { logDetail: true },
                { funLog: genFunLog() },
                {
                    funLog: genFunLog(() => {
                        throw new Error('x')
                    }),
                },
            ]
            let outs = []
            for (let opt of configs) {
                let { log } = await runStop({ opt })
                let r = await log.fapi.tabA.select()
                outs.push({ rawErrors: log.rawErrors, hooks: log.hooks, r, errors: log.errors })
            }
            for (let o of outs) {
                assert.strict.deepEqual(o, outs[0])
            }
            assert.strict.deepEqual(outs[0].rawErrors, [])
            assert.strict.deepEqual(outs[0].r, [{ id: 'row-of-tabA.select' }])
        })

        it('未停止時回調拋錯: error事件為原錯誤(同一參照), 無診斷輸出, 不論選項', async function() {
            this.timeout(60000)
            let configs = [{}, { logDetail: true }, { funLog: genFunLog() }]
            for (let opt of configs) {
                let { cl } = linkCtl()
                let err0 = mkErr()
                let { logged, restore } = capture()
                let log = null
                try {
                    log = run(cl, {
                        recvData: () => {
                            throw err0
                        },
                        ...opt,
                    })
                    await log.tr.wait({ type: 'error' }) //回調拋錯改發出之error事件(同步派發, 於回調被呼叫當下)
                    await drain(3) //其後之額外輸出(若有)亦在擷取範圍
                }
                finally {
                    restore()
                }
                assert.strict.equal(log.rawErrors.length, 1)
                assert.strict.equal(log.rawErrors[0], err0, '同一參照')
                assert.strict.equal(logged.error.filter((v) => v[0] === LABEL).length, 0)
                if (opt.funLog) {
                    assert.strict.equal(opt.funLog.calls.length, 0)
                }
                log.cl.clearBroadcast()
                log.cl.clearSync()
            }
        })

        //getToken包裝只記錄token: 每次呼叫恰呼叫使用端之getToken一次, 其回傳值(含promise)照常使用, 拋錯原樣向上
        it('getToken包裝只記錄: 呼叫次數與回傳值不變, 拋錯原樣向上', async function() {
            this.timeout(30000)
            let calls = 0
            let { cl, inputs, tr } = linkCtl()
            let c = new WServWebdataClient(cl, {
                getToken: () => {
                    calls++
                    return calls === 1 ? Promise.resolve('tk-pm') : `tk-${calls}`
                },
                getServerMethods: () => {},
                recvData: () => {},
            })
            let ok = await waitFor(() => inputs.length >= 3, tr)
            assert.strict.equal(ok, true)
            c.clearBroadcast()
            c.clearSync()
            let toks = inputs.map((v) => v.__sysToken__)
            assert.strict.equal(toks.filter((v) => v === 'tk-pm').length, 1, '第1次回傳之promise照常await並使用')
            assert.strict.equal(new Set(toks).size, toks.length, '每次呼叫之回傳值各用一次')
            assert.strict.equal(calls - toks.length <= 1 && calls >= toks.length, true, '未多呼叫')

            let { cl: cl2 } = linkCtl()
            let c2 = new WServWebdataClient(cl2, {
                getToken: () => {
                    throw new Error('getToken boom')
                },
                getServerMethods: () => {},
                recvData: () => {},
            })
            c2.clearBroadcast()
            c2.clearSync()
        })

        //getToken之觀察不得多呼叫其回傳物件之then(自訂thenable每次then各給不同值, 多呼叫即改變實際送出之token): 每個回傳值之then恰被呼叫一次, 送出之token即各回傳值
        it('getToken回傳thenable(函數型): 每個thenable之then恰呼叫一次, 實際送出之token不變', async function() {
            this.timeout(30000)
            let made = []
            let { cl, inputs, sent, tr } = linkCtl()
            let c = new WServWebdataClient(cl, {
                getToken: () => {
                    let th = function() {}
                    th.n = 0
                    th.id = made.length + 1
                    th.then = (resolve) => {
                        th.n++
                        resolve(`VALUE-${th.id}-${th.n}`)
                    }
                    made.push(th)
                    return th
                },
                getServerMethods: () => {},
                recvData: () => {},
            })
            let ok = await waitFor(() => inputs.length >= 3, tr)
            assert.strict.equal(ok, true)
            c.clearBroadcast()
            c.clearSync()
            await drain(3)
            assert.strict.deepEqual(made.map((v) => v.n).filter((n) => n !== 1), [], '每個thenable之then恰一次')
            let toks = inputs.map((v) => v.__sysToken__)
            assert.strict.deepEqual(toks.filter((t) => !/^VALUE-\d+-1$/.test(t)), [], '送出者皆為各thenable第1次then之值')
            assert.strict.equal(new Set(toks).size, toks.length)
            assert.strict.equal(sent.length, toks.length)
        })

        //記錄token不得對getToken回傳值做額外的型別探測(instanceof等會觸發Proxy的getPrototypeOf陷阱, 使回傳值可據以改變實際送出之值); 修改前亦為0次
        it('getToken回傳Proxy: 記錄token不觸發getPrototypeOf陷阱', async function() {
            this.timeout(30000)
            let nProto = 0
            let px = new Proxy({}, {
                getPrototypeOf(t) {
                    nProto++
                    return Reflect.getPrototypeOf(t)
                },
            })
            let { cl, sent, tr } = linkCtl()
            let c = new WServWebdataClient(cl, { getToken: () => px, getServerMethods: () => {}, recvData: () => {} })
            let ok = await waitFor(() => sent.length >= 3, tr)
            assert.strict.equal(ok, true)
            c.clearBroadcast()
            c.clearSync()
            assert.strict.equal(nProto, 0)
        })

        //輪詢路徑不包裝getToken之回傳值(原生promise仍由呼叫端自行採納): 回傳同一個promise, 其被覆寫之then屬性被呼叫次數與修改前相同
        it('輪詢路徑: 原生promise之then屬性被呼叫次數與修改前相同(記錄用分支不經then屬性)', async function() {
            this.timeout(30000)
            let nThen = 0
            let nCall = 0
            let { cl, sent, tr } = linkCtl()
            let c = new WServWebdataClient(cl, {
                getToken: () => {
                    nCall++
                    let p = Promise.resolve(`TK-${nCall}`)
                    let org = p.then
                    p.then = function(...args) {
                        nThen++
                        return org.apply(this, args)
                    }
                    return p
                },
                getServerMethods: () => {},
                recvData: () => {},
            })
            let nPollOf = () => sent.filter((f) => f === '[sys:polling]').length
            let ok = await waitFor(() => nPollOf() >= 3, tr)
            assert.strict.equal(ok, true)
            c.clearBroadcast()
            c.clearSync()
            await drain(3)
            //輪詢經w-serv-broadcast對回傳值做resolve而每輪恰呼叫一次then屬性; 本套件請求路徑以await採納原生promise而不呼叫then屬性; 多呼叫(例如t.then(...))則約為兩倍
            let nPoll = nPollOf()
            assert.strict.equal(nThen <= nPoll + 1 && nThen >= nPoll, true, `then=${nThen} poll=${nPoll}`)
        })

        it('getToken拋錯或reject: 原樣成為error(不被包裝吞掉)、不送出請求、無unhandledRejection', async function() {
            this.timeout(60000)
            let un = []
            let onUn = (r) => {
                un.push(r)
            }
            process.on('unhandledRejection', onUn)
            try {
                for (let kind of ['throw', 'reject']) {
                    //輪詢: getToken拋錯或reject時該輪不發出輪詢, w-serv-broadcast以{ msg: '[sys:polling] error', err }通知, err為原錯誤(同一參照)
                    let thrown = new Error('GETTOKEN_BOOM')
                    let { cl, sent } = linkCtl()
                    let errs = []
                    let trErr = genTracer()
                    let c = new WServWebdataClient(cl, {
                        getToken: () => {
                            if (kind === 'throw') {
                                throw thrown
                            }
                            return Promise.reject(thrown)
                        },
                        getServerMethods: () => {},
                        recvData: () => {},
                        onTrace: trErr.onTrace,
                    })
                    c.on('error', (e) => {
                        errs.push(e)
                    })
                    await trErr.wait({ type: 'deliver', name: 'error' }) //輪詢取token失敗之error事件已派發給監聽器
                    let ok = errs.some((e) => e && e.msg === '[sys:polling] error' && e.err === thrown)
                    assert.strict.equal(ok, true, `${kind}: 輪詢之error為原錯誤`)
                    assert.strict.deepEqual(sent, [], `${kind}: 取token失敗不送出請求`)
                    c.clearBroadcast()
                    c.clearSync()
                }

                //本套件請求與使用端呼叫($fapi): 綁定後getToken改為拋錯或reject, 呼叫以原錯誤(同一參照)reject, 不送出請求
                for (let kind of ['throw', 'reject']) {
                    let thrown = new Error('GETTOKEN_BOOM')
                    let flag = { bad: false }
                    let { cl, sent } = linkCtl()
                    let log = run(cl, {
                        getToken: () => {
                            if (!flag.bad) {
                                return 'tok'
                            }
                            if (kind === 'throw') {
                                throw thrown
                            }
                            return Promise.reject(thrown)
                        },
                    })
                    await log.tr.wait({ type: 'hook', name: 'getServerMethods' }) //已綁定
                    assert.strict.equal(log.fapi !== null, true)
                    flag.bad = true
                    let n0 = sent.filter((f) => f === 'tabA.select').length
                    let err = await log.fapi.tabA.select().then(() => null, (e) => e)
                    assert.strict.equal(err, thrown, `${kind}: $fapi以原錯誤reject`)
                    assert.strict.equal(sent.filter((f) => f === 'tabA.select').length, n0, `${kind}: 不送出請求`)
                }
                await drain(3) //微任務與unhandledRejection之檢查皆已跑完
                assert.strict.deepEqual(un, [])
            }
            finally {
                process.off('unhandledRejection', onUn)
            }
        })

        //任務4: 回調函數收到之引數與呼叫順序不因診斷輸出之選項而變(不停止、不拋錯)
        it('各回調函數之引數與呼叫順序: 預設、logDetail、funLog皆相同, 且為既有形狀', async function() {
            this.timeout(60000)
            let outs = []
            for (let opt of [{}, { logDetail: true }, { funLog: genFunLog() }]) {
                let { cl } = linkCtl()
                let calls = []
                let trHook = genTracer()
                let rec = (name, pick) => {
                    return (...args) => {
                        calls.push([name, pick(...args), args.length])
                        trHook.onTrace({ type: 'hook', name })
                    }
                }
                let c = new WServWebdataClient(cl, {
                    getServerMethods: rec('getServerMethods', (r) => Object.keys(r).sort()),
                    recvData: rec('recvData', (r) => ({ tableName: r.tableName, data: r.data })),
                    getRefreshState: rec('getRefreshState', (r) => r),
                    getRefreshTable: rec('getRefreshTable', (r) => ({ tableName: r.tableName, timeTag: r.timeTag, hasPm: typeof r.pm === 'object' })),
                    getBeforeUpdateTableTags: rec('getBeforeUpdateTableTags', (r) => r),
                    getAfterUpdateTableTags: rec('getAfterUpdateTableTags', (r) => r),
                    ...opt,
                })
                await trHook.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
                c.clearBroadcast()
                c.clearSync()
                outs.push(calls)
            }
            assert.strict.deepEqual(outs[1], outs[0])
            assert.strict.deepEqual(outs[2], outs[0])
            let names = outs[0].map((v) => v[0])
            //順序與形狀為修前(HEAD)實測之既有行為(以修前src跑同一情境逐項相同)
            assert.strict.deepEqual(names, ['getServerMethods', 'getBeforeUpdateTableTags', 'getRefreshState', 'getRefreshTable', 'recvData', 'getAfterUpdateTableTags'])
            let kp = Object.fromEntries(outs[0])
            assert.strict.deepEqual(kp.getServerMethods, ['tabA'])
            assert.strict.deepEqual(kp.getBeforeUpdateTableTags, { oldTableTags: {}, newTableTags: { tabA: 't1' } })
            assert.strict.deepEqual(kp.getRefreshState, { needToRefresh: true, oldTableTags: {}, newTableTags: { tabA: 't1' } })
            assert.strict.deepEqual(kp.getRefreshTable, { tableName: 'tabA', timeTag: 't1', hasPm: true })
            assert.strict.deepEqual(kp.recvData, { tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] })
            assert.strict.deepEqual(kp.getAfterUpdateTableTags, { oldTableTags: { tabA: 't1' }, newTableTags: { tabA: 't1' } })
        })

    })


    describe('伺服端: instWConverServer非有效物件時之固定文字', function() {

        let LABEL_S = 'instWConverServer is not an effective object, and set instWConverServer to an EventEmitter'

        //build, 同步建構並擷取輸出
        let build = (inst, opt) => {
            let { logged, restore } = capture()
            let s = null
            let err = null
            try {
                s = new WServWebdataServer(inst, { fpTableTags: `${fdTmp}/tags.json`, ...opt })
            }
            catch (e) {
                err = e
            }
            finally {
                restore()
            }
            if (s) {
                cleans.push(() => {
                    s.clearBroadcast()
                    s.clearSync()
                })
            }
            return { s, err, logged }
        }

        it('預設: console.log(固定文字)一次, 與舊版相同', function() {
            for (let inst of [undefined, null, 'abc', 123]) {
                let { s, err, logged } = build(inst, {})
                assert.strict.equal(err, null)
                assert.strict.equal(typeof s.emit, 'function', '改用evem')
                assert.strict.deepEqual(logged.log, [[LABEL_S]], String(inst))
                assert.strict.deepEqual(logged.error, [])
            }
        })

        it('有效物件: 無輸出', function() {
            let { logged } = build(evem(), {})
            assert.strict.deepEqual(logged.log, [])
            assert.strict.deepEqual(logged.error, [])
        })

        it('funLog: 取代console, 收(label, undefined)', function() {
            let funLog = genFunLog()
            let { logged } = build(undefined, { funLog })
            assert.strict.deepEqual(logged.log, [])
            assert.strict.deepEqual(funLog.calls, [[LABEL_S, undefined]])
        })

        it('logDetail: 同舊版(固定文字, 無額外細節)', function() {
            let { logged } = build(undefined, { logDetail: true })
            assert.strict.deepEqual(logged.log, [[LABEL_S]])
        })

        it('診斷選項無效時拋錯且不輸出(診斷選項先於其餘檢查解析)', function() {
            let { err, logged } = build(undefined, { logDetail: 'yes' })
            assert.strict.equal(err.message, 'invalid opt.logDetail')
            assert.strict.deepEqual(logged.log, [])
            let r2 = build(undefined, { funLog: 'no' })
            assert.strict.equal(r2.err.message, 'invalid opt.funLog')
            assert.strict.deepEqual(r2.logged.log, [])
        })

        //時機與舊版相同: 提示先於其餘設定之檢查(舊版為先輸出提示再因其他設定錯誤而拋錯)
        it('提示先於其餘設定檢查: 其他設定錯誤時仍先輸出提示再拋錯(同舊版)', function() {
            for (let [opt, msg] of [[{ fpTableTags: 123 }, 'invalid opt.fpTableTags'], [{ genTag: 'x' }, 'invalid opt.genTag'], [{ useDbOrm: true }, 'invalid opt.kpOrm when useDbOrm=true']]) {
                let { err, logged } = build(undefined, opt)
                assert.strict.equal(err.message, msg)
                assert.strict.deepEqual(logged.log, [[LABEL_S]], msg)
            }
            //funLog給予時, 提示交給funLog後仍因其他設定錯誤而拋錯
            let funLog = genFunLog()
            let r = build(undefined, { funLog, fpTableTags: 123 })
            assert.strict.equal(r.err.message, 'invalid opt.fpTableTags')
            assert.strict.deepEqual(funLog.calls, [[LABEL_S, undefined]])
        })

        it('funLog或console拋錯不使建構失敗', function() {
            let r1 = build(undefined, {
                funLog: () => {
                    throw new Error('boom')
                },
            })
            assert.strict.equal(r1.err, null)
            assert.strict.equal(typeof r1.s.emit, 'function')
            let org = console.log
            console.log = () => {
                throw new Error('console boom')
            }
            let s = null
            try {
                s = new WServWebdataServer(undefined, { fpTableTags: `${fdTmp}/tags.json` })
            }
            finally {
                console.log = org
            }
            assert.strict.equal(typeof s.emit, 'function')
            s.clearBroadcast()
            s.clearSync()
        })

    })


    describe('getDiag / cpDetail', function() {

        it('cpDetail: 不改動原物件、不執行getter、循環與過大不無限展開', function() {
            let n = 0
            let o = {
                id: ID,
                token: 'tk-1',
                get g() {
                    n++
                    return 'getter-secret'
                },
                nested: {
                    list: [1, { authorization: 'Bearer x-1', ok: 'keep' }],
                    map: new Map([['k', `v ${TOKEN}`]]),
                    set: new Set([`s ${TOKEN}`]),
                    d: new Date(0),
                },
                bin: new Uint8Array(4),
                fn: () => {},
                re: /x/,
            }
            o.self = o
            let r = cpDetail(o, [TOKEN])
            assert.strict.equal(n, 0, '不執行getter')
            assert.strict.equal(r.g, '[Getter/Setter]')
            assert.strict.equal(r.token, '[token]')
            assert.strict.equal(r.id, ID)
            assert.strict.equal(r.nested.list[1].authorization, '[token]')
            assert.strict.equal(r.nested.list[1].ok, 'keep')
            assert.strict.deepEqual([...r.nested.map], [['k', 'v [token]']])
            assert.strict.deepEqual([...r.nested.set], ['s [token]'])
            assert.strict.equal(r.nested.d.getTime(), 0)
            assert.strict.equal(r.bin, '[Binary 4 bytes]')
            assert.strict.equal(r.fn, '[Function]')
            assert.strict.equal(r.re, '[RegExp]')
            assert.strict.equal(typeof r.self, 'object', '循環以有限深度展開')
            assert.strict.equal(dump(r).includes('[Truncated]'), true)
            assert.strict.equal(o.token, 'tk-1', '原物件不變')
            assert.strict.equal(o.nested.map.get('k'), `v ${TOKEN}`)
            let big = {}
            for (let i = 0; i < 7000; i++) {
                big[`k${i}`] = i
            }
            assert.strict.equal(Object.keys(cpDetail(big, [])).length <= 5000, true)
        })

        it('字串樣式: Bearer、JSON、物件字面、URL查詢字串之token值遮罩, 其餘保留, 已遮罩者不重複遮罩', function() {
            let s = cpDetail('a Bearer abc.def-1= b {"__sysToken__":"zzz"} {__sysToken__: \'yyy\'} ?token=xxx&k=1 access_token=w1 refresh_token=w2 tokens: 3 name=peter token=[token]', [])
            for (let x of ['abc.def-1', 'zzz', 'yyy', 'xxx', 'w1', 'w2']) {
                assert.strict.equal(s.includes(x), false, x)
            }
            assert.strict.equal(s.includes('&k=1'), true)
            assert.strict.equal(s.includes('name=peter'), true)
            assert.strict.equal(s.includes('tokens: 3'), true)
            assert.strict.equal(s.endsWith('token=[token]'), true)
        })

        it('已知token: 互為前綴者長者優先、短token(如tok)不破壞token=等樣式且不截入遮罩字樣、鍵名與Map鍵亦遮罩', function() {
            let s = cpDetail('x tk-long-1234 y token=abc-7 z tk', ['tk', 'tk-long-1234'])
            assert.strict.equal(s, 'x [token] y token=[token] z [token]')
            //已知token恰為字樣之一部分(如'tok'為'token'之前段)時, 鍵值樣式優先(單次掃描於同一位置先試樣式), 'token='字樣不被截壞且真正的token值不外漏; 其餘位置之相同片段仍遮罩
            assert.strict.equal(cpDetail('token=tk-9 name', ['tok']), 'token=[token] name')
            assert.strict.equal(cpDetail('a tok b stoker', ['tok']), 'a [token] b s[token]er')
            let r = cpDetail({ [TOKEN]: 1, map: new Map([['token', 'mv'], [TOKEN, 'v2'], ['k', 'keep']]) }, [TOKEN])
            assert.strict.deepEqual(Object.keys(r).sort(), ['[token]', 'map'])
            assert.strict.deepEqual([...r.map], [['token', '[token]'], ['[token]', 'v2'], ['k', 'keep']])
            //樣式特殊字元之token(正規式元字元)逐字比對
            assert.strict.equal(cpDetail('a+b(c)[d]*e?^$|\\ end', ['a+b(c)[d]*e?^$|\\']), '[token] end')
        })

        //字串樣式(外審補): 引號值含空白、無引號值含逗號、Authorization帶scheme、x-api-key、cookie中的token、未結束之引號; 一般文字中的Token/Basic等字不誤傷
        it('字串樣式: 引號值、逗號值、Authorization scheme、api-key、cookie、未結束之引號', function() {
            let cases = [
                ['token="abc def ghi" end', 'token="[token]" end'],
                ['token=\'abc def\' end', 'token=\'[token]\' end'],
                ['token=part1,part2 end', 'token=[token] end'],
                ['Authorization: Basic VERYSECRET end', 'Authorization: [token] end'],
                ['authorization=Bearer abc.def end', 'authorization=[token] end'],
                ['x-api-key=KEYSECRET&k=1', 'x-api-key=[token]&k=1'],
                ['API_KEY: K1', 'API_KEY: [token]'],
                ['cookie: a=b; token=xyz; c=d', 'cookie: a=b; token=[token]; c=d'],
                ['{"token":"a","x":1}', '{"token":"[token]","x":1}'],
                ['mytoken=zzz; accessToken: "q q"', 'mytoken=[token]; accessToken: "[token]"'],
                ['token="unterminated tail', 'token="[token]"'],
                ['Bearer abc.def-1= end', 'Bearer [token] end'],
                ['bearer lower.case end', 'bearer [token] end'],
                ['invalid token provided; Basic validation failed; Token expired', 'invalid token provided; Basic validation failed; Token expired'],
                ['token=[token] again', 'token=[token] again'],
                ['token=[token]SECRET end', 'token=[token] end'], //值只是以遮罩字樣開頭, 不視為已遮罩
                ['token="abc\\\nSECRET" end', 'token="[token]" end'], //引號值內的反斜線接換行
                ['notBearer ordinary text', 'notBearer ordinary text'], //Bearer須為獨立單字
                ['(Bearer abc.def) end', '(Bearer [token]) end'],
                ['__SYSTOKEN__=CASE_SECRET end', '__SYSTOKEN__=[token] end'], //鍵名不分大小寫
            ]
            for (let [s, expected] of cases) {
                assert.strict.equal(cpDetail(s, []), expected, s)
                assert.strict.equal(cpDetail(expected, []), expected, `冪等 ${s}`)
            }
        })

        it('已知token的特殊形式: 含遮罩字樣、很長、包裝字串、Symbol鍵、Map值', function() {
            //已知token本身含'[token]'字樣, 仍整個遮罩(單次掃描, 不以遮罩字樣切段)
            assert.strict.equal(cpDetail('value abc[token]xyz end', ['abc[token]xyz']), 'value [token] end')
            //很長之已知token(不得因長度被略過)
            for (let n of [5000, 20000, 200000]) {
                let long = `L${'x'.repeat(n)}`
                assert.strict.equal(cpDetail(`a ${long} b`, [long]), 'a [token] b', String(n))
            }
            //合計過大(100個各約1000字元)時超出比對式容量者改以切割取代, 全部仍遮罩(比對式過大會被引擎拒絕)
            let many = Array.from({ length: 100 }, (_, i) => `T${i}-${'q'.repeat(1000)}`)
            assert.strict.equal(cpDetail(`x ${many[0]} y ${many[99]} z ${many[50]}`, many), 'x [token] y [token] z [token]')
            //Bearer被判為單字之一部分時, 其中的已知token仍遮罩; 數值與bigint恰等於已知token者遮罩
            assert.strict.equal(cpDetail('notBearer abc end', ['abc']), 'notBearer [token] end')
            assert.strict.deepEqual(cpDetail({ a: 94821, b: 94822, c: 5n, d: 6n }, ['94821', '5']), { a: '[token]', b: 94822, c: '[token]', d: 6n })
            //Symbol之描述與值內若含已知token, 以遮罩後之描述另建Symbol; Map的Symbol敏感鍵之值遮罩
            let sk = Symbol('S3CR3T_SYM')
            let rs = cpDetail({ [sk]: 1, v: Symbol('has S3CR3T_SYM') }, ['S3CR3T_SYM'])
            assert.strict.deepEqual(Object.getOwnPropertySymbols(rs).map((k) => k.description), ['[token]'])
            assert.strict.equal(rs.v.description, 'has [token]')
            assert.strict.deepEqual([...cpDetail(new Map([[Symbol('accessToken'), 'MAP_VALUE_SECRET'], [Symbol('plain'), 'keep']]), []).values()], ['[token]', 'keep'])
            //跨realm的包裝字串整體遮罩(不逐字元複製)
            let fb = vm.runInNewContext('new String("REALM_SECRET")')
            assert.strict.equal(cpDetail(fb, ['REALM_SECRET']), '[token]')
            assert.strict.equal(cpDetail({ x: fb }, []).x, 'REALM_SECRET', '無已知token時取字串值')
            //二進位長度以內建getter讀取(不執行實例上自訂之byteLength)
            let u8 = new Uint8Array(4)
            let nBl = 0
            Object.defineProperty(u8, 'byteLength', {
                get() {
                    nBl++
                    return 99
                },
            })
            assert.strict.equal(cpDetail(u8, []), '[Binary 4 bytes]')
            assert.strict.equal(nBl, 0)
            //Symbol鍵之值依鍵描述遮罩; 包裝字串取其值
            let o = { [Symbol('accessToken')]: 'SYM', [Symbol('plain')]: 'keep', s: new String('BOXED'), n: new Number(5), b: new Boolean(false) }
            let r = cpDetail(o, ['BOXED'])
            let syms = Object.getOwnPropertySymbols(r)
            assert.strict.deepEqual(syms.map((k) => [k.description, r[k]]), [['accessToken', '[token]'], ['plain', 'keep']])
            assert.strict.equal(r.s, '[token]')
            assert.strict.equal(r.n, 5)
            assert.strict.equal(r.b, false)
        })

        //外審補: 複製時不執行使用端的getter與Symbol.toStringTag; Error的stack僅執行內建存取器; 跨realm的Error以一般物件複製(保留message與stack)
        it('cpDetail: 不執行使用端getter與toStringTag、跨realm的Error保留內容、深度恰8層', function() {
            let n = 0
            let e = new Error('E1')
            Object.defineProperty(e, 'stack', {
                get() {
                    n++
                    return 'custom stack'
                },
                configurable: true,
            })
            let tagged = {
                get [Symbol.toStringTag]() {
                    n++
                    return 'X'
                },
                a: 1,
            }
            let r = cpDetail([e, tagged], [])
            assert.strict.equal(n, 0, '自訂getter與toStringTag皆不執行')
            assert.strict.equal(r[0].stack, '[Getter/Setter]')
            assert.strict.equal(r[1].a, 1)
            //內建stack仍取得(含message字樣), 且為資料屬性
            let e2 = new Error(TEXT)
            let r2 = cpDetail(e2, [])
            assert.strict.equal(r2.stack.includes(TEXT), true)
            assert.strict.equal(Object.getOwnPropertyDescriptor(r2, 'stack').value, r2.stack)
            //跨realm
            let fe = vm.runInNewContext('new Error("FOREIGN")')
            let rf = cpDetail(fe, [])
            assert.strict.equal(rf.message, 'FOREIGN')
            assert.strict.equal(typeof rf.stack, 'string')
            //深度: 恰8層物件被複製, 第9層(深度8)以標記代替
            let chain = {}
            let cur = chain
            for (let i = 0; i < 12; i++) {
                cur.n = {}
                cur = cur.n
            }
            let rc = cpDetail(chain, [])
            let depth = 0
            let p = rc
            while (p !== null && typeof p === 'object') {
                p = p.n
                depth++
            }
            assert.strict.equal(depth, 8)
            assert.strict.equal(p, '[Truncated]')
        })

        it('genTokenBook: 至多記住最近128個、包裝字串取值、非字串與空字串不記錄; watch原樣交還', async function() {
            let b = genTokenBook()
            for (let i = 0; i < 200; i++) {
                b.note(`tk-${i}`)
            }
            b.note('')
            b.note(5)
            b.note(null)
            b.note(new String('boxed'))
            b.note(vm.runInNewContext('new String("realm-boxed")')) //跨realm之包裝字串
            b.note('tk-199')
            assert.strict.equal(b.tokens.length, 128)
            assert.strict.equal(b.tokens[0], 'tk-74')
            assert.strict.deepEqual(b.tokens.slice(-3), ['boxed', 'realm-boxed', 'tk-199'], '重複取得者移至尾端')
            assert.strict.equal(b.tokens.includes('tk-73'), false)
            //重複使用者視為最近使用而留存(不被較新的值擠掉)
            let b3 = genTokenBook()
            b3.note('STABLE')
            for (let i = 0; i < 127; i++) {
                b3.note(`o-${i}`)
            }
            b3.note('STABLE')
            b3.note('NEWEST')
            assert.strict.equal(b3.tokens.includes('STABLE'), true)
            assert.strict.equal(b3.tokens.includes('o-0'), false)
            assert.strict.equal(b3.tokens.at(-1), 'NEWEST')
            //watch: 一律原樣交還同一值(不包裝、不延後); 字串直接記錄, 原生promise另附記錄用之分支(解出後記錄), 其他物件不記錄也不呼叫其then
            let b2 = genTokenBook()
            assert.strict.equal(b2.watch('plain'), 'plain')
            let obj = { x: 1 }
            assert.strict.equal(b2.watch(obj), obj)
            let pm = Promise.resolve('pm')
            assert.strict.equal(b2.watch(pm), pm)
            await pm
            await flush() //記錄用分支於解出後之微任務執行
            let nThen = 0
            let th = {
                then(resolve) {
                    nThen++
                    resolve('th')
                },
            }
            assert.strict.equal(b2.watch(th), th)
            await flush() //若有額外之then呼叫, 亦於微任務內發生
            assert.strict.equal(nThen, 0, '非原生promise之thenable不被觸發then')
            assert.strict.deepEqual(b2.tokens, ['plain', 'pm'])
            let rj = Promise.reject(new Error('R'))
            assert.strict.equal(b2.watch(rj), rj)
            await assert.rejects(() => rj, { message: 'R' })
            assert.strict.deepEqual(b2.tokens, ['plain', 'pm'])
        })

        it('getDiag: funLog回傳自回傳之thenable時, then之呼叫次數有上限(不遞迴到堆疊耗盡)', function() {
            let n = 0
            let th = {
                then() {
                    n++
                    return th
                },
            }
            getDiag({ logDetail: false, funLog: () => th })('l', undefined)
            assert.strict.equal(n >= 1 && n <= 8, true, String(n))
        })

        it('getDiag: console拋錯、getDetail拋錯皆不使呼叫端拋錯', function() {
            let org = console.error
            console.error = () => {
                throw new Error('console boom')
            }
            try {
                let d = getDiag({ logDetail: true, funLog: null })
                d('l', { a: 1 }, () => ({ x: 1 }), true)
                d('l', { a: 1 }, () => {
                    throw new Error('detail boom')
                }, true)
            }
            finally {
                console.error = org
            }
            let calls = []
            let d2 = getDiag({
                logDetail: false,
                funLog: (...a) => {
                    calls.push(a)
                },
            })
            d2('l', { a: 1 }, () => {
                throw new Error('detail boom')
            })
            assert.strict.deepEqual(calls, [['l', { a: 1 }, '(unprintable)']])
        })

    })


    describe('盤點: src內除getDiag外不直接呼叫console(R18)', function() {

        //盤點指令: 見規則帳本R18
        it('src/*.mjs 之可執行程式碼只有 getDiag.mjs 呼叫 console', function() {
            let files = fs.readdirSync('./src').filter((f) => f.endsWith('.mjs'))
            let hits = []
            for (let f of files) {
                let lines = fs.readFileSync(`./src/${f}`, 'utf8').split('\n')
                lines.forEach((line, i) => {
                    let t = line.trim()
                    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
                        return
                    }
                    let code = line.replace(/\/\/.*$/, '')
                    if (/\bconsole\b/.test(code)) {
                        hits.push(`${f}:${i + 1}`)
                    }
                })
            }
            let others = hits.filter((v) => !v.startsWith('getDiag.mjs:'))
            assert.strict.deepEqual(others, [])
            assert.strict.equal(hits.length > 0, true, 'getDiag.mjs自身有console出口')
        })

    })

})
