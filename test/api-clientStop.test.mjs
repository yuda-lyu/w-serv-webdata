import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import evem from 'wsemi/src/evem.mjs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'


//以真WConverhpServer與WConverhpClient驗證前端停止時中止本套件自身之在途請求(R14 ②③④, 2026-10-13第七輪): 停止後通訊物件之error 0則、無重試訊息、無在途請求與殘留計時器而行程自然結束
//同步以事件而非等待毫秒: 伺服器就緒等WConverhpServer之ready, 子行程於目標請求交給通訊物件後停止(clientStopChild), 「行程可立即結束」改為結構指標(規格P6, 見checkExit)
//前端於子行程執行(tools/clientStopChild.mjs), 伺服端在本行程且不停止: 子行程之通訊物件timeout為1000ms, 伺服端對tokSlow延遲3000ms, 未中止之請求即逾時重試並逐次發出error
describe('api-clientStop', function() {

    //port, 固定埠(主控登記, 避開api-servdata之9000與api-authorizeExec之8301)
    let port = 9001

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/api-clientStop'

    //fpChild, 前端子行程, 以本檔所在位置定位
    let fpChild = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'tools/clientStopChild.mjs')

    let srv = null

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    before(async function() {
        this.timeout(30000)
        fs.mkdirSync(fdTmp, { recursive: true })
        let wsv = new WConverhpServer({ port, pathUploadTemp: `${fdTmp}/uploadTemp` }) //上傳暫存資料夾亦落於本測試專用資料夾, 不可用預設之./uploadTemp
        srv = new WServWebdataServer(wsv, {
            fpTableTags: `${fdTmp}/tableTags.json`,
            getUserIdByToken: async (token) => {
                if (token === 'tokSlow') {
                    await sleep(3000) //長於前端通訊物件之timeout(1000ms), 使未中止之請求逾時重試
                }
                if (token === 'tokMid') {
                    await sleep(300)
                }
                return 'u1'
            },
            useDbOrm: true,
            kpOrm: { tabA: evem() },
            operOrm: async (userId, tableName) => [{ id: `${tableName}-row` }],
            tableNamesExec: ['tabA'],
            methodsExec: ['select'],
            tableNamesSync: ['tabA'],
            authorizeExec: ({ userId }) => userId === 'u1',
        })
        srv.on('error', () => {})
        assert.strict.equal(await wsv.ready, true, '伺服器已就緒') //w-converhp 2.1.12起ready恆resolve, 啟動失敗為false
    })

    after(async function() {
        this.timeout(20000)
        srv.clearBroadcast()
        srv.clearSync()
        await srv.stop()
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //runChild, 執行一個情境之前端子行程, 回傳其RESULT
    let runChild = (scenario) => {
        return new Promise((resolve, reject) => {
            let child = spawn(process.execPath, [fpChild, scenario, String(port)], { stdio: ['ignore', 'pipe', 'pipe'] })
            let out = ''
            let err = ''
            child.stdout.on('data', (d) => {
                out += d.toString()
            })
            child.stderr.on('data', (d) => {
                err += d.toString()
            })
            child.on('exit', () => {
                let line = out.split('\n').find((v) => v.startsWith('RESULT '))
                if (!line) {
                    reject(new Error(`no RESULT: ${out} ${err}`))
                    return
                }
                resolve(JSON.parse(line.slice(7)))
            })
        })
    }

    //「行程可立即結束」(原斷言停止至結束<500ms之牆鐘門檻, 負載下會誤失敗)改以結構判定(規格P6): 停止後一個macrotask內在途之請求皆已被中止(inFlightAfterFlush為0;
    //  未中止者仍在伺服端延遲3秒中, 為缺陷版之特徵), 且再讓已排定之派發跑完後不殘留Timeout(殘留者行程無法立即結束); 另以子行程自行結束(無看門狗)為證
    let checkExit = (r) => {
        assert.strict.equal(r.inFlightAfterFlush, 0, `停止後一個macrotask內在途之請求皆已被中止(pollInFlightAtStop=${r.pollInFlightAtStop})`)
        assert.strict.notEqual(r.activeAfterDrain, null, '已取得停止後之存活資源快照')
        assert.strict.deepEqual(r.activeAfterDrain.filter((v) => v === 'Timeout'), [], `停止後不殘留計時器: ${JSON.stringify(r.activeAfterDrain)}`)
    }

    //R14 ②: 取得函數清單後(getServerMethods內)即停止(建議書§4.1之字面情境; 1.1.11起取時間戳即不送出, 行為鎖定)
    it('取得函數清單後即停止時, 停止後0則error, 無在途請求與殘留計時器且行程自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('fnList')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [])
        assert.strict.deepEqual(r.logsAfterStop, [])
        assert.strict.deepEqual(r.hooksAfterStop, [])
        checkExit(r)
    })

    //R14 ②③: 取時間戳在途時停止, 其請求被中止: 通訊物件不再重試、不再發出error與重試訊息, 不再呼叫getToken, 行程即可結束(原停止後4則error、約9秒)
    it('取時間戳在途時停止, 不再重試且停止後0則error, 無在途請求與殘留計時器且行程自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('tags')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [], `pollInFlightAtStop=${r.pollInFlightAtStop}`)
        assert.strict.deepEqual(r.logsAfterStop, [], '不印重試訊息')
        assert.strict.deepEqual(r.hooksAfterStop, [])
        assert.strict.equal(r.tokenAfterStop, 0)
        checkExit(r)
    })

    //R14 ②③: 同步表之select在途時停止, 其請求被中止(同上)
    it('同步表之select在途時停止, 不再重試且停止後0則error, 無在途請求與殘留計時器且行程自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('select')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [], `pollInFlightAtStop=${r.pollInFlightAtStop}`)
        assert.strict.deepEqual(r.logsAfterStop, [], '不印重試訊息')
        assert.strict.deepEqual(r.hooksAfterStop, [])
        assert.strict.equal(r.tokenAfterStop, 0)
        checkExit(r)
    })

    //R14 ④: 停止時使用端在途之函數不中止, 照常結算(行為鎖定)
    it('停止時使用端在途之函數照常結算', async function() {
        this.timeout(40000)
        let r = await runChild('fapi')
        assert.strict.deepEqual(r.fapi, { state: 'resolve', r: [{ id: 'tabA-row' }] })
        assert.strict.deepEqual(r.errorsAfterStop, [])
    })

})
