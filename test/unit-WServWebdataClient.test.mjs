import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import { genTracer } from './tools/tracer.mjs'
import { sleep, drain, extraHooks, zeros, genRun, linkCtl } from './tools/clientHarness.mjs'


//前端與後端以記憶體假通訊層相連(不開埠, 以JSON複製模擬序列化), 驗證前端之設定檢查、綁定前之同步廣播、refreshTable各路徑之結束與回調函數之隔離
//停止之各條用linkCtl(不支援opt.signal之通訊物件, 守停止閘門); 中止(opt.signal)之行為見unit-WServWebdataClientAbort
//同步一律以事件(log.tr: opt.onTrace轉交w-serv-broadcast前端之事件與測試輔助之hook、error、exec、execEnd事件, 見./tools/clientHarness.mjs; 自備之getToken以tokenEnd記錄非同步之結束), 不以等待毫秒:
//  肯定部分等第N個事件(輪詢首輪結果於約2秒時, 其後鏈上各請求皆由事件接續); 否定部分(「停止後不再X」)等該鏈上最後一個肯定事件後以drain讓已排定之微任務與1ms脫勾派發跑完再斷言
//  「首輪輪詢成功前停止」一條無事件可等(停止後輪詢計時器已清除), 保留觀察窗, 窗長大於輪詢間隔2秒; 計時器依到期時間排序, 缺陷版之輪詢必早於窗結束, 與負載無關
describe('unit-WServWebdataClient', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-WServWebdataClient'

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

    let clone = (v) => {
        return v === undefined ? undefined : JSON.parse(JSON.stringify(v))
    }

    //linkServer, 前端execute → 後端execute事件
    let linkServer = (srv) => {
        let cl = evem()
        cl.execute = (func, input) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    let pm = genPm()
                    srv.emit('execute', func, clone(input), pm)
                    pm.then((r) => {
                        setTimeout(() => resolve(clone(r)), 5)
                    })
                }, 5)
            })
        }
        return cl
    }

    //linkFake, 假後端: 直接回應函數清單、時間戳與select, 用以製造伺服端已不允許之設定(例如同步表無select); fail有給時, 其回傳非null者作為該次呼叫之拒絕值(例如授權拒絕)
    let linkFake = ({ funcs, tags, called, fail = null }) => {
        let cl = evem()
        cl.execute = async (func) => {
            await sleep(5)
            if (func === '[sys:polling]') {
                return []
            }
            if (func === '[sys:getFuncList]') {
                return { state: 'success', msg: funcs }
            }
            if (func === '[sys:getTableTags]') {
                return { state: 'success', msg: { mode: 'syncKpTable', data: tags } }
            }
            called.push(func)
            let reason = fail ? fail(func) : null
            if (reason !== null) {
                return { state: 'error', msg: reason }
            }
            return { state: 'success', msg: [{ id: `row-of-${func}` }] }
        }
        return cl
    }

    //linkCtl(不支援opt.signal之通訊物件)、hookNames、extraHooks、zeros與run之定義見./tools/clientHarness.mjs(與unit-WServWebdataClientAbort共用, 只定義一次)
    let run = genRun(WServWebdataClient, cleans)

    let countTimeout = () => {
        return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
    }

    //mkEv, 通訊物件之最小形狀(具execute之事件物件), 不連線
    let mkEv = () => {
        let ev = evem()
        ev.execute = async () => {
            return { state: 'success', msg: [] }
        }
        return ev
    }

    describe('設定檢查', function() {

        //R41: 原為建構中emit而遺失, 改為建構任何元件之前拋錯
        it('必填與有給之回調函數無效時拋錯, 且未啟動輪詢', function() {
            let ok = { getServerMethods: () => {}, recvData: () => {} }
            let cases = [
                [{ recvData: () => {} }, 'invalid opt.getServerMethods'],
                [{ getServerMethods: () => {} }, 'invalid opt.recvData'],
                [{ ...ok, getToken: 'x' }, 'invalid opt.getToken'],
                [{ ...ok, getRefreshState: 1 }, 'invalid opt.getRefreshState'],
                [{ ...ok, getRefreshTable: 1 }, 'invalid opt.getRefreshTable'],
                [{ ...ok, getBeforeUpdateTableTags: 1 }, 'invalid opt.getBeforeUpdateTableTags'],
                [{ ...ok, getAfterUpdateTableTags: 1 }, 'invalid opt.getAfterUpdateTableTags'],
            ]
            for (let [opt, message] of cases) {
                let cl = mkEv()
                let n0 = countTimeout()
                assert.throws(() => {
                    new WServWebdataClient(cl, opt)
                }, { message })
                assert.strict.equal(countTimeout(), n0, message)
                assert.strict.equal(cl.clearBroadcast, undefined, message)
            }
        })

        //R48: 通訊物件於建構任何元件之前檢查(w-serv-broadcast 1.1.7起其前端於建構時檢查execute; 原於未給時改用evem建立之事件物件, 其無execute而於建構w-serv-broadcast前端時才拋錯, 此時WSyncWebdataClient已擴充傳入之物件; 無on時更於啟動輪詢後才拋錯而殘留計時器. w-serv-broadcast 1.1.8起其前端亦檢查on, 但WSyncWebdataClient仍先擴充, 故仍須前移)
        //R54: 停止時以removeListener或off移除本套件之監聽, 缺二者時移除靜默失敗而重建後舊實體之監聽仍先處理新實體之事件, 故一併於建構任何元件之前檢查(同伺服端檢查off)
        it('通訊物件未給、非事件物件或無execute時於建構任何元件之前拋錯', function() {
            let ok = { getServerMethods: () => {}, recvData: () => {} }
            let noOn = mkEv()
            noOn.on = undefined
            let noRemove = mkEv()
            noRemove.removeListener = undefined
            noRemove.off = undefined
            let cases = [
                [undefined, 'instWConverClient is not an effective object'],
                [null, 'instWConverClient is not an effective object'],
                ['abc', 'instWConverClient is not an effective object'],
                [{ a: 1 }, 'instWConverClient is not an EventEmitter'],
                [noOn, 'instWConverClient is not an EventEmitter'],
                [noRemove, 'instWConverClient is not an EventEmitter'],
                [evem(), 'instWConverClient.execute is not a function'],
            ]
            for (let [cl, message] of cases) {
                let n0 = countTimeout()
                try {
                    assert.throws(() => {
                        new WServWebdataClient(cl, ok)
                    }, { message })
                    assert.strict.equal(countTimeout(), n0, `${message}: 未啟動輪詢`)
                    if (cl && typeof cl === 'object') {
                        assert.strict.equal(cl.clearSync, undefined, `${message}: 未建構WSyncWebdataClient`)
                        assert.strict.equal(cl.clearBroadcast, undefined, `${message}: 未建構w-serv-broadcast前端`)
                    }
                }
                finally {
                    if (cl && typeof cl.clearBroadcast === 'function') {
                        cl.clearBroadcast() //舊碼會啟動輪詢, 避免殘留計時器
                    }
                }
            }
        })

    })

    describe('同步', function() {

        //R42: 綁定完成前收到之同步廣播須略過, 綁定後仍須載入資料(行為鎖定: 原方案以空資料結束pm會使該表一直是空表)
        it('綁定完成前收到同步廣播時, 綁定後仍載入資料且不發出錯誤', async function() {
            this.timeout(60000)
            let tabA = evem()
            let srv = evem()
            srv = new WServWebdataServer(srv, {
                fpTableTags: `${fdTmp}/race.json`,
                getUserIdByToken: (token) => (token === 'tok' ? 'u1' : ''),
                useDbOrm: true,
                kpOrm: { tabA },
                operOrm: async (userId, tableName) => [{ id: `${tableName}-row` }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: () => true,
            })
            cleans.push(() => {
                srv.clearBroadcast()
            })
            let nTok = 0
            let log = null
            log = run(linkServer(srv), {
                getToken: () => {
                    nTok++
                    //w-serv-broadcast 1.1.11起輪詢每輪亦呼叫getToken: 第1次為首輪輪詢(約2秒時), 第2次才是其後的取函數清單
                    if (nTok === 2) {
                        //取函數清單變慢: 其結果等到前端收到(並略過)推播才放行, 使「推播於綁定完成前送達」由因果而非時間決定(原以sleep(3500)與setTimeout 2400排序, 負載下可能顛倒)
                        return log.tr.wait({ type: 'deliver', name: 'broadcast' }).then(() => 'tok')
                    }
                    return 'tok'
                },
            })
            //首輪輪詢成功(openOnce已派發, 取函數清單正等待token)後後端資料變更, 推播經其後之輪詢送達(綁定前, 應被略過而於綁定後以時間戳同步)
            log.tr.wait({ type: 'deliver', name: 'openOnce' }).then(() => {
                tabA.emit('change')
            })
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //綁定後依當下時間戳同步一次完成
            let iBc = log.tr.events.findIndex((e) => e.type === 'deliver' && e.name === 'broadcast')
            let iBind = log.tr.events.findIndex((e) => e.type === 'hook' && e.name === 'getServerMethods')
            assert.ok(iBc >= 0 && iBc < iBind, '推播於綁定完成之前送達')
            assert.strict.deepEqual(log.recv.filter((v) => v.tableName === 'tabA').map((v) => v.data.length), [1], JSON.stringify(log.recv))
            assert.strict.deepEqual(log.errors, [])
        })

        //R43: 已綁定而同步表缺select或缺表時, 以reject結束pm: 不提交空資料、不推進時間戳(再收到同一時間戳時重試), 由w-sync-webdata發出一則帶表名與時間戳之error, 該次updateTableTags照常完成(原以空資料結束而清空該表並記下時間戳)
        it('已綁定而同步表缺select或缺表時, pm以reject結束且不推進時間戳', async function() {
            this.timeout(60000)
            let called = []
            let log1 = run(linkFake({ funcs: ['tabA.insert'], tags: { tabA: 't1' }, called }))
            let log2 = run(linkFake({ funcs: ['tabB.select'], tags: { tabX: 't1' }, called }))
            await Promise.all([log1, log2].map((v) => v.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }))) //首次同步批次完成(error事件先於其排定)
            assert.strict.deepEqual(log1.recv, [])
            assert.strict.deepEqual(log1.rawErrors, [{ msg: 'can not get table data: tabA', err: 'kpExec[tabA].select is not a function', tableName: 'tabA', timeTag: 't1' }])
            assert.strict.equal(log1.after, 1)
            assert.strict.deepEqual(log2.recv, [])
            assert.strict.deepEqual(log2.rawErrors, [{ msg: 'can not get table data: tabX', err: 'invalid kpExec[tabX]', tableName: 'tabX', timeTag: 't1' }])
            assert.strict.equal(log2.after, 1)
            await log1.cl.updateTableTags({ tabA: 't1' })
            await log1.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }, 2) //第2批次完成(error事件先於其排定)
            assert.strict.equal(log1.rawErrors.length, 2, '時間戳未推進, 再收到同一時間戳時重試')
            assert.strict.equal(log1.after, 2)
            assert.strict.deepEqual(called, [])
        })

        //R47: select失敗(例如授權拒絕)時不提交空資料、不推進時間戳並發出error, 再收到同一時間戳時重抓(原以空資料結束而清空該表, 到該表下次變動前不重抓, 且只console.log)
        it('select失敗時不清空資料且不推進時間戳, 再收到同一時間戳時重抓', async function() {
            this.timeout(60000)
            let called = []
            let nFail = 1
            let fail = () => {
                if (nFail > 0) {
                    nFail--
                    return 'permission denied'
                }
                return null
            }
            let log = run(linkFake({ funcs: ['tabA.select'], tags: { tabA: 't1' }, called, fail }))
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成(error事件先於其排定)
            assert.strict.deepEqual(log.recv, [])
            assert.strict.deepEqual(log.rawErrors, [{ msg: 'can not get table data: tabA', err: 'permission denied', tableName: 'tabA', timeTag: 't1' }])
            assert.strict.equal(log.after, 1)
            await log.cl.updateTableTags({ tabA: 't1' })
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }, 2) //第2批次完成(getData先於其排定)
            assert.strict.deepEqual(log.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }])
            assert.strict.equal(log.rawErrors.length, 1)
            assert.strict.equal(log.after, 2)
            assert.strict.deepEqual(called, ['tabA.select', 'tabA.select'])
        })

        //R44: 使用端回調函數拋錯時改發出error, 同步照常完成
        it('回調函數拋錯時改發出error且同步照常完成', async function() {
            this.timeout(60000)
            let called = []
            let log = run(linkFake({ funcs: ['tabA.select'], tags: { tabA: 't1' }, called }), {
                getServerMethods: () => {
                    throw new Error('boomServerMethods')
                },
                getRefreshTable: () => {
                    throw new Error('boomRefreshTable')
                },
            })
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.deepEqual(log.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }])
            assert.strict.deepEqual(log.errors, ['boomServerMethods', 'boomRefreshTable'])
            assert.strict.equal(log.after, 1)
        })

    })

    describe('停止', function() {

        //R50: 首次輪詢成功前即停止者不送出任何請求、不呼叫回調函數(行為鎖定: w-serv-broadcast 1.1.8之clearBroadcast清除輪詢計時器)
        it('首次輪詢成功前停止時不送出任何請求', async function() {
            this.timeout(20000)
            let { cl, sent } = linkCtl()
            let log = run(cl, extraHooks())
            log.cl.clearBroadcast()
            log.cl.clearSync()
            assert.strict.equal(log.tr.count({ type: 'stop' }), 1, '停止事件') //肯定部分以事件判定
            await sleep(2600) //否定觀察窗(窗長大於輪詢間隔2秒; 缺陷版之輪詢計時器到期早於窗結束, 其請求同步送出, 與負載無關)
            assert.strict.equal(log.tr.count({ type: 'tick' }), 0, '停止後輪詢計時器不再觸發')
            assert.strict.deepEqual(sent, [])
            assert.strict.deepEqual(log.hooks, zeros())
            assert.strict.equal(log.nToken, 0)
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: 停止後不再呼叫回調函數、不再送出本套件之請求(建議w-serv-webdata修正.md之實測一: 原於openOnce內停止後, 取得函數清單回來時仍呼叫getServerMethods並續取時間戳)
        it('openOnce內停止時不呼叫getServerMethods、不再送出本套件之請求且不發出error', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl({ delay: { '[sys:getFuncList]': 200 } })
            let log = run(cl, extraHooks())
            let nSent = null
            log.cl.on('openOnce', () => {
                log.cl.clearBroadcast()
                log.cl.clearSync()
                nSent = sent.length
            })
            await log.tr.wait({ type: 'execEnd', func: '[sys:getFuncList]' }) //停止後才回到之函數清單
            await drain()
            assert.strict.equal(nSent, 2, '停止時取得函數清單已送出(本套件之openOnce監聽先於使用端者)')
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]'], '其後不再送出取時間戳與select')
            assert.strict.equal(log.fapi, null)
            assert.strict.deepEqual(log.hooks, zeros())
            assert.strict.equal(log.nToken, 1, '只有停止前已開始之取得函數清單呼叫過getToken')
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: getServerMethods內停止者, 不再送出取時間戳之請求(原於綁定後照常續取)
        it('getServerMethods內停止時不再送出取時間戳之請求', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl()
            let c = null
            let log = run(cl, {
                ...extraHooks(),
                getServerMethods: () => {
                    c.clearBroadcast()
                    c.clearSync()
                },
            })
            c = log.cl
            await log.tr.wait({ type: 'hook', name: 'getServerMethods' }) //於其內停止; 缺陷版於同一微任務鏈接著送出取時間戳
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]'])
            assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1 })
            assert.strict.equal(log.nToken, 1, '不再為取時間戳呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: 停止後才失敗之請求不發出error(建議w-serv-webdata修正.md之實測二: 原於停止後仍發出本套件之error)
        it('取時間戳之請求於停止後失敗時不發出error', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl({ delay: { '[sys:getTableTags]': 300 }, fail: { '[sys:getTableTags]': 'connect ECONNREFUSED' } })
            let c = null
            let log = run(cl, extraHooks())
            c = log.cl
            log.tr.wait({ type: 'exec', func: '[sys:getTableTags]' }).then(() => {
                c.clearBroadcast() //取時間戳已送出, 於其在途時停止(以請求送出為準, 不以等待毫秒)
                c.clearSync()
            })
            await log.tr.wait({ type: 'execEnd', func: '[sys:getTableTags]' }) //停止後才失敗
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]'])
            assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1 })
            assert.strict.equal(log.nToken, 2)
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: 停止由clearBroadcast或clearSync任一者觸發; 只呼叫clearBroadcast時, 停止後才回到之時間戳不再交付同步(原會續取select並呼叫recvData)
        it('只呼叫clearBroadcast時, 停止後才回到之時間戳不再交付同步', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl({ delay: { '[sys:getTableTags]': 300 } })
            let c = null
            let log = run(cl, extraHooks())
            c = log.cl
            log.tr.wait({ type: 'exec', func: '[sys:getTableTags]' }).then(() => {
                c.clearBroadcast() //取時間戳已送出, 於其在途時停止(以請求送出為準, 不以等待毫秒)
            })
            await log.tr.wait({ type: 'execEnd', func: '[sys:getTableTags]' }) //停止後才回到
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]'])
            assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1 })
            assert.strict.equal(log.nToken, 2, '不再為select呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: 同步表之select在途時停止, 其後之結果不呼叫回調函數亦不發出本套件之error; 兩者皆呼叫時由w-sync-webdata之clearSync不再提交(行為鎖定), 只呼叫clearBroadcast時由本套件之回調閘門擋下(原會呼叫recvData), 失敗則由仍運作之w-sync-webdata發出帶表名之error(行為鎖定: 下層之事件依其停止函數)
        it('select在途時停止, 其後之結果不呼叫回調函數亦不發出本套件之error', async function() {
            this.timeout(60000)
            let cases = [
                { name: '兩者皆呼叫且select成功', stops: ['clearBroadcast', 'clearSync'], fail: {}, errors: [] },
                { name: '兩者皆呼叫且select失敗', stops: ['clearBroadcast', 'clearSync'], fail: { 'tabA.select': 'connect ECONNREFUSED' }, errors: [] },
                { name: '只呼叫clearBroadcast且select成功', stops: ['clearBroadcast'], fail: {}, errors: [] },
                { name: '只呼叫clearBroadcast且select失敗', stops: ['clearBroadcast'], fail: { 'tabA.select': 'connect ECONNREFUSED' }, errors: [{ msg: 'can not get table data: tabA', err: 'connect ECONNREFUSED', tableName: 'tabA', timeTag: 't1' }] },
            ]
            let logs = cases.map(({ stops, fail }) => {
                let { cl, sent } = linkCtl({ delay: { 'tabA.select': 300 }, fail })
                let c = null
                let log = run(cl, extraHooks())
                c = log.cl
                log.sent = sent
                log.tr.wait({ type: 'exec', func: 'tabA.select' }).then(() => {
                    for (let k of stops) {
                        c[k]() //select已送出, 於其在途時停止(以請求送出為準, 不以等待毫秒)
                    }
                })
                return log
            })
            await Promise.all(logs.map((log) => log.tr.wait({ type: 'execEnd', func: 'tabA.select' }))) //停止後才回到
            await Promise.all(logs.map((log, i) => (cases[i].errors.length > 0 ? log.tr.wait({ type: 'error' }, cases[i].errors.length) : null))) //只clearBroadcast時由仍運作之w-sync-webdata發出之error
            await drain()
            cases.forEach(({ name, errors }, i) => {
                let log = logs[i]
                assert.strict.deepEqual(log.sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]', 'tabA.select'], name)
                assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1, getRefreshState: 1, getRefreshTable: 1, getBeforeUpdateTableTags: 1 }, name)
                assert.strict.equal(log.nToken, 3, name)
                assert.strict.deepEqual(log.rawErrors, errors, name)
            })
        })

        //R50: 只呼叫clearSync時(輪詢續行), 其後之openOnce不啟動取得函數清單之流程(原會取得函數清單並呼叫getServerMethods)
        it('只呼叫clearSync時, 其後之openOnce不啟動取得函數清單之流程', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl()
            let log = run(cl, extraHooks())
            log.cl.clearSync()
            await log.tr.wait({ type: 'deliver', name: 'openOnce' }) //輪詢首輪成功, openOnce已派發給仍作用之監聽(本套件之監聽已移除)
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]'], '輪詢續行, 但不送出本套件之請求')
            assert.strict.deepEqual(log.hooks, zeros())
            assert.strict.equal(log.nToken, 0)
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R50: 只呼叫clearBroadcast而使用端自行呼叫updateTableTags時, 本套件之監聽已移除而不送出select, 由w-sync-webdata以無監聽者結束並發出一則帶表名之error(原會送出select並呼叫recvData)
        it('只呼叫clearBroadcast後使用端自行呼叫updateTableTags時, 不送出select且不呼叫recvData', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl()
            let log = run(cl, extraHooks())
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.deepEqual(log.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }])
            log.cl.clearBroadcast()
            let n = sent.length
            let hooks = { ...log.hooks }
            let nToken = log.nToken
            await log.cl.updateTableTags({ tabA: 't2' })
            await log.tr.wait({ type: 'error' }) //w-sync-webdata以無監聽者結束而發出之error(1ms脫勾派發)
            await drain()
            assert.strict.equal(sent.length, n, '不送出select')
            assert.strict.deepEqual(log.hooks, hooks, '不呼叫任何回調函數')
            assert.strict.equal(log.nToken, nToken, '不呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [{ msg: 'can not get table data: tabA', err: new Error('no listener for event[refreshTable]'), tableName: 'tabA', timeTag: 't2' }])
        })

        //R50: getRefreshTable內停止時不送出select(停止於本套件之refreshTable監聽派發中, 監聽雖已移除仍走完本次), 以字串拒絕而由w-sync-webdata發出帶表名之error; 只呼叫clearBroadcast使w-sync-webdata仍作用時方可觀察
        it('getRefreshTable內停止時不送出select', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl()
            let c = null
            let log = run(cl, {
                ...extraHooks(),
                getRefreshTable: () => {
                    c.clearBroadcast()
                },
            })
            c = log.cl
            await log.tr.wait({ type: 'error' }) //refreshTable以停止之拒絕值結束, w-sync-webdata發出帶表名之error(1ms脫勾派發)
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]'], '不送出select')
            assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1, getRefreshState: 1, getRefreshTable: 1, getBeforeUpdateTableTags: 1 })
            assert.strict.equal(log.nToken, 2, '不為select呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [{ msg: 'can not get table data: tabA', err: 'stopped by clearBroadcast or clearSync', tableName: 'tabA', timeTag: 't1' }])
        })

        //R50: 使用端之openOnce監聽先於本套件註冊(例如w-serv-hapi於useWaitToken=true時, 通訊物件先於本套件建立)而於其中停止時, 本套件之openOnce監聽雖已移除仍於本次派發被呼叫(eventemitter3依派發開始時之清單), 須不啟動取得函數清單
        it('使用端之openOnce監聽先於本套件註冊而於其中停止時, 不送出取得函數清單', async function() {
            this.timeout(60000)
            let { cl, sent } = linkCtl()
            cl.on('openOnce', () => {
                cl.clearBroadcast() //建構後才被呼叫, 此時為本套件包裝後之函數
                cl.clearSync()
            })
            let log = run(cl, extraHooks())
            await log.tr.wait({ type: 'deliver', name: 'openOnce' }) //首輪輪詢成功, 使用端之監聽於此次派發中停止, 本套件之監聽雖已移除仍於本次被呼叫
            await drain()
            assert.strict.deepEqual(sent, ['[sys:polling]'])
            assert.strict.deepEqual(log.hooks, zeros())
            assert.strict.equal(log.nToken, 0, '不為取得函數清單呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R55: 停止時尚在等待getToken之本套件請求不送出: 尚未交給通訊物件, 送不送由本套件決定(原於token回來後照常送出, 伺服器已停時觸發通訊物件之重試與逐次error)
        it('停止時尚在等待getToken之本套件請求不送出', async function() {
            this.timeout(20000)
            //mkGetToken, 取得token需300ms(測試替身之延遲, 非同步點); 第n次呼叫之token回來時記一則{ type: 'tokenEnd', n }(getTr()為該前端之事件記錄器), onCall(n)於呼叫當下(尚未回傳)執行
            let mkGetToken = (getTr, onCall = null) => {
                let k = 0
                return () => {
                    let n = ++k
                    if (onCall !== null) {
                        onCall(n)
                    }
                    return sleep(300).then(() => {
                        getTr().onTrace({ type: 'tokenEnd', n })
                        return 'tok'
                    })
                }
            }

            //取得函數清單等待token時停止: 本套件之openOnce監聽先註冊, 已在等待token
            let a = linkCtl()
            let la = run(a.cl, { ...extraHooks(), getToken: mkGetToken(() => la.tr) })
            la.cl.on('openOnce', () => {
                la.cl.clearBroadcast()
                la.cl.clearSync()
            })

            //同步表之select等待token時停止: getRefreshTable之後緊接著呼叫getToken取select之token, 於該次getToken內停止(getToken尚未回傳, 請求必在等待token)
            let b = linkCtl()
            let lb = null
            let kSel = null
            lb = run(b.cl, {
                ...extraHooks(),
                getToken: mkGetToken(() => lb.tr, (n) => {
                    if (kSel === null && lb.hooks.getRefreshTable === 1) {
                        kSel = n //本次呼叫之序號
                        lb.cl.clearBroadcast()
                        lb.cl.clearSync()
                    }
                }),
            })

            await la.tr.wait({ type: 'tokenEnd', n: 2 }) //取得函數清單之token回來(第1次為輪詢)
            await lb.tr.until(() => kSel !== null)
            await lb.tr.wait({ type: 'tokenEnd', n: kSel }) //select之token回來
            await drain()
            assert.strict.deepEqual(a.sent, ['[sys:polling]'], '不送出取得函數清單')
            assert.strict.deepEqual(la.hooks, zeros())
            assert.strict.equal(la.nToken, 1, '停止前已開始等待token')
            assert.strict.deepEqual(la.rawErrors, [])
            assert.strict.deepEqual(b.sent, ['[sys:polling]', '[sys:getFuncList]', '[sys:getTableTags]'], '不送出select')
            assert.strict.deepEqual(lb.hooks, { ...zeros(), getServerMethods: 1, getRefreshState: 1, getRefreshTable: 1, getBeforeUpdateTableTags: 1 })
            assert.strict.equal(lb.nToken, 3, '停止前已開始等待token')
            assert.strict.deepEqual(lb.rawErrors, [])
        })

        //R56: 回調函數於自身內停止後才拋錯者, 停止後不再發出error事件, 改以console.error輸出: 使用端程式之錯誤不可無聲(同w-serv-broadcast); 原於停止後仍發出error, 僅加停止閘門時則完全無聲
        //R18(診斷輸出): 預設只輸出標籤與不含錯誤原文之摘要(原斷言輸出之第2項為錯誤本身, message為'boomAfterStop'; 診斷輸出之變更, 原文見logDetail與funLog, 詳unit-diaglog)
        it('回調函數於自身內停止後拋錯時不發出error而以console.error輸出', async function() {
            this.timeout(20000)
            let { cl } = linkCtl()
            let c = null
            let log = null
            let logged = []
            let consoleError = console.error
            console.error = (...args) => {
                logged.push(args)
                if (log !== null) {
                    log.tr.onTrace({ type: 'console', label: args[0] })
                }
            }
            try {
                log = run(cl, {
                    recvData: () => {
                        c.clearBroadcast()
                        c.clearSync()
                        throw new Error('boomAfterStop')
                    },
                })
                c = log.cl
                await log.tr.wait({ type: 'console', label: '[w-serv-webdata] callback error after stop' }) //停止後才拋錯, 改以console.error輸出
                await drain()
                let mine = logged.filter((v) => v[0] === '[w-serv-webdata] callback error after stop')
                assert.strict.deepEqual(log.rawErrors, [])
                assert.strict.equal(mine.length, 1)
                assert.strict.deepEqual(mine[0], ['[w-serv-webdata] callback error after stop', { hook: 'recvData', errType: 'Error' }])
                assert.strict.equal(JSON.stringify(logged).includes('boomAfterStop'), false)
            }
            finally {
                console.error = consoleError
            }
        })

        //R50: 停止只涵蓋本套件自身之流程, 使用端自行呼叫之函數照常(對稱伺服端: 停止廣播與同步後資料通道照常至通訊服務停止); 停止函數可重複且依任意順序呼叫(行為鎖定)
        it('停止後使用端仍可呼叫函數, 停止函數可重複且依任意順序呼叫', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let log = run(cl)
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成(已綁定)
            log.cl.clearSync()
            log.cl.clearBroadcast()
            log.cl.clearBroadcast()
            log.cl.clearSync()
            let nToken = log.nToken
            let r = await log.fapi.tabA.select()
            assert.strict.deepEqual(r, [{ id: 'row-of-tabA.select' }])
            assert.strict.equal(log.nToken, nToken + 1, '使用端自行呼叫之函數仍呼叫getToken')
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R52: 停止時移除本套件掛於通訊物件之監聽(掛的人負責移除), 下層皆允許停止後於同一事件物件重建; 原未移除而舊實體之監聽仍作用(修正前: 舊實體之回調照常被呼叫; 僅加停止閘門時: 舊實體之refreshTable監聽先註冊而拒絕新實體之取資料, 新實體同步失敗)
        it('停止後可於同一通訊物件重建, 舊實體之監聽已移除而不作用', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let names = ['openOnce', 'broadcast', 'refreshState', 'refreshTable', 'getData', 'beforeUpdateTableTags', 'afterUpdateTableTags']
            let n0 = names.map((k) => cl.listenerCount(k))
            let log1 = run(cl, extraHooks())
            await log1.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.equal(log1.recv.length, 1)
            log1.cl.clearBroadcast()
            log1.cl.clearSync()
            assert.strict.deepEqual(names.map((k) => cl.listenerCount(k)), n0, '停止後本套件之監聽已移除')
            let hooks1 = { ...log1.hooks }
            let log2 = run(cl, extraHooks())
            await log2.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //重建之實體首次同步批次完成
            assert.strict.deepEqual(log2.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }], '重建之實體照常同步')
            assert.strict.deepEqual(log1.hooks, hooks1, '舊實體之回調不再被呼叫')
            assert.strict.deepEqual(log2.rawErrors, [])
        })

        //R51: 伺服端只呼叫clearBroadcast而未停止通訊服務時, 前端之輪詢由資料通道回應invalid token; w-serv-broadcast 1.1.8起前端驗證輪詢回應須為陣列, 故每輪發出輪詢失敗之error(1.1.7為靜默略過), 且收不到推播(WServWebdataServer之JSDoc第9點)
        it('伺服端只呼叫clearBroadcast而未停止通訊服務時, 前端每輪發出輪詢失敗之error且收不到推播', async function() {
            this.timeout(60000)
            let tabA = evem()
            let srv = new WServWebdataServer(evem(), {
                fpTableTags: `${fdTmp}/halfstop.json`,
                getUserIdByToken: (token) => (token === 'tok' ? 'u1' : ''),
                useDbOrm: true,
                kpOrm: { tabA },
                operOrm: async (userId, tableName) => [{ id: `${tableName}-row` }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: () => true,
            })
            cleans.push(() => {
                srv.clearBroadcast()
                srv.clearSync()
            })
            let log = run(linkServer(srv))
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.equal(log.recv.length, 1)
            srv.clearBroadcast()
            tabA.emit('change')
            await log.tr.wait({ type: 'error' }, 2) //其後之輪詢每輪失敗(至少2輪), 期間收不到推播
            assert.strict.equal(log.recv.length, 1, '收不到推播')
            assert.ok(log.rawErrors.length >= 2, `每輪發出error: ${JSON.stringify(log.rawErrors)}`)
            for (let err of log.rawErrors) {
                assert.strict.deepEqual(err, { msg: '[sys:polling] error', err: { state: 'error', msg: 'invalid token' } })
            }
        })

    })

    describe('輪詢帶token', function() {

        //R17: 前端把getToken交w-serv-broadcast前端(1.1.11起opt.getToken), 輪詢輸入為{ clientId, __sysToken__ }(非資料通道之協定), 供伺服端opt.verifyPolling反查身分; 修前輪詢輸入恰為{ clientId }
        it('輪詢輸入帶getToken之值(每輪重新取得, sync與async皆可, 非字串取空字串, 未給取空字串)', async function() {
            this.timeout(60000)
            let n = 0
            let a = linkCtl() //sync, 每次呼叫回傳不同值
            let la = run(a.cl, { getToken: () => `tok${++n}` })
            let b = linkCtl() //async
            let lb = run(b.cl, { getToken: async () => 'tokAsync' })
            let c = linkCtl() //非字串
            let lc = run(c.cl, { getToken: () => undefined })
            let d = linkCtl() //未給getToken(預設), 不經run(其會包裝getToken)
            let trD = genTracer()
            let cld = new WServWebdataClient(d.cl, { getServerMethods: () => {}, recvData: () => {}, onTrace: trD.onTrace })
            cleans.push(() => {
                cld.clearBroadcast()
                cld.clearSync()
            })
            //輪詢至少2輪: 等第2輪之結果(輪詢間隔2秒), 不以等待毫秒
            await Promise.all([la.tr, lb.tr, lc.tr, trD].map((tr) => tr.wait({ type: 'result', n: 2 })))

            let polls = (x) => {
                return x.inputs.filter((v, i) => x.sent[i] === '[sys:polling]')
            }
            let pa = polls(a)
            assert.strict.ok(pa.length >= 2, `至少2輪輪詢: ${pa.length}`)
            for (let v of pa) {
                assert.strict.deepEqual(Object.keys(v).sort(), ['__sysToken__', 'clientId'], '輪詢輸入恰為clientId與__sysToken__')
                assert.strict.ok(/^tok\d+$/.test(v.__sysToken__), v.__sysToken__)
            }
            assert.strict.ok(new Set(pa.map((v) => v.__sysToken__)).size === pa.length, '每輪重新取得')
            assert.strict.equal(new Set(pa.map((v) => v.clientId)).size, 1, 'clientId不變')
            assert.strict.ok(polls(b).length >= 2)
            for (let v of polls(b)) {
                assert.strict.equal(v.__sysToken__, 'tokAsync')
            }
            for (let v of polls(c)) {
                assert.strict.equal(v.__sysToken__, '', '非字串取空字串')
            }
            assert.strict.ok(polls(c).length >= 2)
            for (let v of polls(d)) {
                assert.strict.equal(v.__sysToken__, '', '未給getToken取空字串')
            }
            assert.strict.ok(polls(d).length >= 2)
        })

    })

    describe('函數名之路徑綁定', function() {

        //R39: 綁定與取值只沿自有屬性, 不寫入Object.prototype之內建函數, 字面鍵不遮蔽路徑
        it('綁定只沿自有屬性, 同步依路徑取得正確之select', async function() {
            this.timeout(60000)
            let called = []
            let log = run(linkFake({ funcs: ['toString.select', '["a.b"].other', 'a.b.select'], tags: { 'toString': 't1', 'a.b': 't2' }, called }))
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            try {
                assert.strict.equal(Object.prototype.toString.select, undefined, '未寫入Object.prototype.toString')
                assert.strict.equal(typeof log.fapi['a.b'].other, 'function')
                assert.strict.equal(typeof log.fapi.a.b.select, 'function')
                assert.strict.deepEqual(called.sort(), ['a.b.select', 'toString.select'])
                assert.strict.deepEqual(log.recv.map((v) => v.tableName).sort(), ['a.b', 'toString'])
                assert.strict.deepEqual(log.errors, [])
            }
            finally {
                delete Object.prototype.toString.select //舊碼會寫入, 避免污染其他測試
            }
        })

    })

})
