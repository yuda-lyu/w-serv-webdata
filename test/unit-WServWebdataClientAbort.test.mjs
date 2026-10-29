import assert from 'assert'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import { drain, extraHooks, zeros, genRun, linkCtl, linkSig } from './tools/clientHarness.mjs'


//前端停止時中止本套件自身之在途請求(R14 ②③④⑥⑦, 2026-10-13第七輪, w-converhp 2.1.8之opt.signal), 以記憶體假通訊層相連(不開埠)
//中止之行為以linkSig(依w-converhp 2.1.8之契約處理opt.signal)驗證; 先於本套件註冊之使用端監聽內停止之閘門以linkCtl(不支援opt.signal之通訊物件)驗證
//同步一律以事件(log.tr, 見./tools/clientHarness.mjs與unit-WServWebdataClient之說明), 不以等待毫秒; 否定斷言前以drain讓已排定之微任務與1ms脫勾派發跑完
describe('unit-WServWebdataClientAbort', function() {

    //cleans, 測完須停止之輪詢與廣播
    let cleans = []

    after(function() {
        for (let f of cleans) {
            f()
        }
    })

    let run = genRun(WServWebdataClient, cleans)

    //msgStop, 停止之拒絕值(等待getToken期間停止、refreshTable內停止與中止之reason同一值)
    let msgStop = 'stopped by clearBroadcast or clearSync'

    //isSignal, 以鴨子型別判定AbortSignal(同w-converhp之isAbortSignal)
    let isSignal = (v) => {
        return v !== null && typeof v === 'object' && typeof v.aborted === 'boolean' && typeof v.addEventListener === 'function'
    }

    //sigOf, 第一次送出之指定函數所帶之signal(未送出者為undefined)
    let sigOf = (sigs, func) => {
        let r = sigs.find((v) => v.func === func)
        return r ? r.signal : undefined
    }

    describe('中止', function() {

        //R14 ②④: 本套件自身之請求(取得函數清單、時間戳、同步表之select)帶本實體之中止訊號, 使用端自行呼叫之函數不帶(原皆不帶)
        it('本套件自身之請求帶中止訊號, 使用端自行呼叫之函數不帶', async function() {
            this.timeout(60000)
            let { cl, sent, sigs } = linkSig()
            let log = run(cl, extraHooks())
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.deepEqual(log.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }])
            for (let func of ['[sys:getFuncList]', '[sys:getTableTags]', 'tabA.select']) {
                let signal = sigOf(sigs, func)
                assert.ok(isSignal(signal), `${func}: 帶AbortSignal`)
                assert.strict.equal(signal.aborted, false, `${func}: 停止前未中止`)
            }
            let n = sent.length
            let r = await log.fapi.tabA.select()
            assert.strict.deepEqual(r, [{ id: 'row-of-tabA.select' }])
            assert.strict.deepEqual(sigs.slice(n).filter((v) => v.func !== '[sys:polling]'), [{ func: 'tabA.select', signal: null }], '使用端之函數不帶中止訊號') //輪詢可能於等待期間發生(w-serv-broadcast 1.1.9起亦帶其自身之signal), 不在本條斷言範圍
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R14 ②③: 取得函數清單在途時停止, 其請求於停止當下即中止(原於回到後照常綁定而只略過getServerMethods), 不呼叫回調亦不發出error
        it('取得函數清單在途時停止, 其請求於停止當下即中止', async function() {
            this.timeout(60000)
            let { cl, sent, sigs } = linkSig({ delay: { '[sys:getFuncList]': 300 } })
            let log = run(cl, extraHooks())
            let abortedRightAfterStop = null
            log.cl.on('openOnce', () => {
                log.cl.clearBroadcast() //本套件之openOnce監聽先註冊, 取得函數清單已送出
                log.cl.clearSync()
                let signal = sigOf(sigs, '[sys:getFuncList]')
                abortedRightAfterStop = signal ? signal.aborted : null
            })
            await log.tr.wait({ type: 'execEnd', func: '[sys:getFuncList]' }) //請求於停止當下被中止而結束(未中止者約300ms後才回到)
            await drain()
            assert.strict.equal(abortedRightAfterStop, true, '停止當下即中止')
            assert.strict.deepEqual(sent, ['[sys:polling]', '[sys:getFuncList]'])
            assert.strict.equal(log.fapi, null)
            assert.strict.deepEqual(log.hooks, zeros())
            assert.strict.equal(log.nToken, 1)
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R14 ②③⑥: 取時間戳在途時停止, 不論兩者皆呼叫或只呼叫其一, 其請求於停止當下即中止(原於其後照常回到或於通訊物件重試), 不交付同步、不呼叫getToken、不發出error
        it('取時間戳在途時停止(兩者、只clearBroadcast、只clearSync), 其請求於停止當下即中止且不發出error', async function() {
            this.timeout(60000)
            let cases = [['clearBroadcast', 'clearSync'], ['clearBroadcast'], ['clearSync']]
            let logs = cases.map((stops) => {
                let { cl, sent, sigs } = linkSig({ delay: { '[sys:getTableTags]': 300 } })
                let c = null
                let obs = { abortedRightAfterStop: null }
                let log = run(cl, extraHooks())
                c = log.cl
                log.tr.wait({ type: 'exec', func: '[sys:getTableTags]' }).then(() => {
                    for (let k of stops) {
                        c[k]() //取時間戳已送出, 於其在途時停止(以請求送出為準, 不以等待毫秒)
                    }
                    let signal = sigOf(sigs, '[sys:getTableTags]')
                    obs.abortedRightAfterStop = signal ? signal.aborted : null
                })
                return { log, sent, obs, name: stops.join('+') }
            })
            await Promise.all(logs.map(({ log }) => log.tr.wait({ type: 'execEnd', func: '[sys:getTableTags]' }))) //請求於停止當下被中止而結束
            await drain()
            for (let { log, sent, obs, name } of logs) {
                assert.strict.equal(obs.abortedRightAfterStop, true, `${name}: 停止當下即中止`)
                assert.strict.deepEqual(sent.filter((v) => v !== '[sys:polling]'), ['[sys:getFuncList]', '[sys:getTableTags]'], `${name}: 不送出select`)
                assert.strict.deepEqual(log.hooks, { ...zeros(), getServerMethods: 1 }, `${name}: 不交付同步`)
                assert.strict.equal(log.nToken, 2, `${name}: 停止後不呼叫getToken`)
                assert.strict.deepEqual(log.rawErrors, [], `${name}: 不發出error`)
            }
        })

        //R14 ③⑥: 同步表之select在途時停止, 其請求被中止; 兩者皆呼叫時w-sync-webdata已停而無事件; 只呼叫clearBroadcast時w-sync-webdata以停止之拒絕值發出一則帶表名之error,
        //不論select原本會成功或失敗(業主裁示Q1之行為改變: 原select照常成功時無error, 失敗時err為原失敗值)
        it('同步表之select在途時停止: 兩者皆呼叫不發出error, 只呼叫clearBroadcast時由w-sync-webdata以停止之拒絕值發出帶表名之error', async function() {
            this.timeout(60000)
            let cases = [
                { name: '兩者皆呼叫且select原本成功', stops: ['clearBroadcast', 'clearSync'], fail: {}, errors: [] },
                { name: '兩者皆呼叫且select原本失敗', stops: ['clearBroadcast', 'clearSync'], fail: { 'tabA.select': 'connect ECONNREFUSED' }, errors: [] },
                { name: '只呼叫clearBroadcast且select原本成功', stops: ['clearBroadcast'], fail: {}, errors: [{ msg: 'can not get table data: tabA', err: msgStop, tableName: 'tabA', timeTag: 't1' }] },
                { name: '只呼叫clearBroadcast且select原本失敗', stops: ['clearBroadcast'], fail: { 'tabA.select': 'connect ECONNREFUSED' }, errors: [{ msg: 'can not get table data: tabA', err: msgStop, tableName: 'tabA', timeTag: 't1' }] },
            ]
            let logs = cases.map(({ stops, fail }) => {
                let { cl, sigs } = linkSig({ delay: { 'tabA.select': 300 }, fail })
                let c = null
                let log = run(cl, extraHooks())
                c = log.cl
                log.tr.wait({ type: 'exec', func: 'tabA.select' }).then(() => {
                    for (let k of stops) {
                        c[k]() //select已送出, 於其在途時停止(以請求送出為準, 不以等待毫秒)
                    }
                })
                return { log, sigs }
            })
            await Promise.all(logs.map(({ log }) => log.tr.wait({ type: 'execEnd', func: 'tabA.select' }))) //select於停止當下被中止而結束
            await Promise.all(logs.map(({ log }, i) => (cases[i].errors.length > 0 ? log.tr.wait({ type: 'error' }, cases[i].errors.length) : null))) //只clearBroadcast時由仍運作之w-sync-webdata發出之error(1ms脫勾派發)
            await drain()
            cases.forEach(({ name, errors }, i) => {
                let { log, sigs } = logs[i]
                let signal = sigOf(sigs, 'tabA.select')
                assert.ok(isSignal(signal) && signal.aborted, `${name}: select已中止`)
                assert.strict.deepEqual(log.recv, [], name)
                assert.strict.equal(log.hooks.recvData, 0, name)
                assert.strict.equal(log.nToken, 3, name)
                assert.strict.deepEqual(log.rawErrors, errors, name)
            })
        })

        //R14 ④: 停止時使用端在途之函數不中止, 照常結算(行為鎖定)
        it('停止時使用端在途之函數不中止且照常結算', async function() {
            this.timeout(60000)
            let { cl, sigs } = linkSig({ delay: { 'tabA.select': 300 } })
            let log = run(cl)
            await log.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成(已綁定)
            let n = sigs.length
            let p = log.fapi.tabA.select()
            log.cl.clearBroadcast()
            log.cl.clearSync()
            assert.strict.deepEqual(sigs.slice(n), [{ func: 'tabA.select', signal: null }])
            assert.strict.deepEqual(await p, [{ id: 'row-of-tabA.select' }])
            assert.strict.deepEqual(log.rawErrors, [])
        })

        //R14 ⑦: 停止(含重複呼叫)後於同一通訊物件重建, 新實體之本套件請求帶自己之中止訊號(未中止)而照常同步(重建照常為原有行為; 每實體一個中止控制器為新行為: 若放在通訊物件或模組層, 新實體之請求一送即被拒)
        it('停止後於同一通訊物件重建, 新實體之本套件請求不受舊實體之中止影響', async function() {
            this.timeout(60000)
            let { cl, sigs } = linkSig()
            let log1 = run(cl, extraHooks())
            await log1.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //首次同步批次完成
            assert.strict.equal(log1.recv.length, 1)
            log1.cl.clearBroadcast()
            log1.cl.clearSync()
            log1.cl.clearBroadcast()
            let n = sigs.length
            let log2 = run(cl, extraHooks())
            await log2.tr.wait({ type: 'hook', name: 'getAfterUpdateTableTags' }) //重建之實體首次同步批次完成
            assert.strict.deepEqual(log2.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }], '重建之實體照常同步')
            let own = sigs.slice(n).filter((v) => v.func !== '[sys:polling]')
            assert.strict.deepEqual(own.map((v) => v.func), ['[sys:getFuncList]', '[sys:getTableTags]', 'tabA.select'])
            for (let v of own) {
                assert.ok(isSignal(v.signal) && v.signal !== sigOf(sigs, v.func), `${v.func}: 新實體自己之中止訊號`)
            }
            assert.strict.deepEqual(log2.rawErrors, [])
        })

    })

    describe('建構檢查', function() {

        //R12 ①': 執行環境須內建AbortController, 缺者於opt之檢查之後、建構任何元件之前拋錯, 訊息同w-serv-broadcast 1.1.9前端; 設定錯誤之訊息仍優先, 且不擴充傳入之通訊物件、不啟動輪詢
        //(只靠w-serv-broadcast 1.1.9之檢查時, WSyncWebdataClient已先擴充傳入之物件; 只靠new AbortController()時以ReferenceError拋出而訊息與下層不一致)
        it('執行環境無AbortController時於建構任何元件之前拋錯, 設定錯誤之訊息仍優先', function() {
            let mk = () => {
                let ev = evem()
                ev.execute = async () => {
                    return { state: 'success', msg: [] }
                }
                return ev
            }
            let countTimeout = () => {
                return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
            }
            let n0 = countTimeout()
            let AC = globalThis.AbortController
            let ev1 = mk()
            let ev2 = mk()
            delete globalThis.AbortController //同步範圍內刪除並還原, 不影響其他測試
            try {
                assert.throws(() => {
                    new WServWebdataClient(ev1, {})
                }, { message: 'invalid opt.getServerMethods' })
                assert.throws(() => {
                    new WServWebdataClient(ev2, { getServerMethods: () => {}, recvData: () => {} })
                }, { message: 'AbortController is not available' })
            }
            finally {
                globalThis.AbortController = AC
            }
            assert.strict.equal(ev2.clearSync, undefined, '未建構WSyncWebdataClient')
            assert.strict.equal(ev2.clearBroadcast, undefined, '未建構w-serv-broadcast前端')
            assert.strict.equal(countTimeout(), n0, '未啟動輪詢')
        })

    })

    describe('先於本套件註冊之使用端監聽內停止', function() {

        //R14 ②: 使用端之broadcast監聽先於本套件註冊而於其中停止時, 本套件之broadcast監聽雖已移除仍於本次派發被呼叫(eventemitter3依派發開始時之清單), 須不交付同步(updateSyncTable之閘門);
        //不依賴停止後才回到之請求, 通訊物件支援opt.signal與否皆然(行為鎖定: 拿掉閘門則交付同步, w-sync-webdata因本套件之refreshTable監聽已移除而發出無監聽者之error)
        it('使用端之broadcast監聽先於本套件註冊而於其中停止時, 不交付同步', async function() {
            this.timeout(60000)
            let nPoll = 0
            let { cl, sent } = linkCtl({
                poll: () => {
                    nPoll++
                    return nPoll === 2 ? [{ mode: 'broadcast', data: { mode: 'syncKpTable', data: { tabA: 't2' } } }] : [] //第2次輪詢帶推播(tabA之新時間戳)
                },
            })
            let log = null
            let hooksAtStop = null
            let nSentAtStop = null
            cl.on('broadcast', () => {
                hooksAtStop = { ...log.hooks }
                nSentAtStop = sent.length
                cl.clearBroadcast() //建構後才被呼叫, 此時為本套件包裝後之函數; 只呼叫clearBroadcast, 使w-sync-webdata仍作用而可觀察
            })
            log = run(cl, extraHooks())
            await log.tr.wait({ type: 'deliver', name: 'broadcast' }) //第2輪輪詢帶推播, 使用端之監聽於此次派發中停止(本套件之監聽雖已移除仍於本次被呼叫)
            await drain()
            assert.ok(hooksAtStop !== null, '已收到推播')
            assert.strict.equal(log.recv.length, 1, '停止前已同步一次')
            assert.strict.deepEqual(log.hooks, hooksAtStop, '停止後不呼叫回調函數')
            assert.strict.equal(sent.length, nSentAtStop, '不送出select')
            assert.strict.deepEqual(log.rawErrors, [], '不交付同步, w-sync-webdata無取資料之error')
        })

        //R14 ②: 使用端之getData監聽先於本套件註冊而於其中停止時, 本套件之getData監聽仍於本次派發被呼叫, 須不呼叫recvData(callHook入口之閘門);
        //不依賴停止後才回到之請求(行為鎖定: 拿掉閘門則停止後仍呼叫recvData)
        it('使用端之getData監聽先於本套件註冊而於其中停止時, 不呼叫recvData', async function() {
            this.timeout(60000)
            let { cl } = linkCtl()
            let stopped = 0
            let log = null
            let tStop = genPm()
            cl.on('getData', () => {
                stopped++
                cl.clearBroadcast()
                cl.clearSync()
                tStop.resolve(true)
            })
            log = run(cl, extraHooks())
            await tStop //第一次同步批次之getData已派發(使用端之監聽先於本套件之監聽, 於其中停止)
            await drain()
            assert.strict.equal(stopped, 1, '已派發getData')
            assert.strict.deepEqual(log.recv, [])
            assert.strict.equal(log.hooks.recvData, 0)
            assert.strict.deepEqual(log.rawErrors, [])
        })

    })

})
