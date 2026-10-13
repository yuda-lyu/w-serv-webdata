import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import evem from 'wsemi/src/evem.mjs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'


//以真WConverhpServer與WConverhpClient驗證前端停止時中止本套件自身之在途請求(R14 ②③④, 2026-10-13第七輪): 停止後通訊物件之error 0則、無重試訊息、行程於停止後500ms內自然結束
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

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
        srv = new WConverhpServer({ port, pathUploadTemp: `${fdTmp}/uploadTemp` }) //上傳暫存資料夾亦落於本測試專用資料夾, 不可用預設之./uploadTemp
        srv = new WServWebdataServer(srv, {
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

    //R14 ②: 取得函數清單後(getServerMethods內)即停止(建議書§4.1之字面情境; 1.1.11起取時間戳即不送出, 行為鎖定)
    it('取得函數清單後即停止時, 停止後0則error且行程於停止後500ms內自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('fnList')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [])
        assert.strict.deepEqual(r.logsAfterStop, [])
        assert.strict.deepEqual(r.hooksAfterStop, [])
        assert.ok(r.exitDelay < 500, `exitDelay=${r.exitDelay}, pollInFlightAtStop=${r.pollInFlightAtStop}`)
    })

    //R14 ②③: 取時間戳在途時停止, 其請求被中止: 通訊物件不再重試、不再發出error與重試訊息, 不再呼叫getToken, 行程即可結束(原停止後4則error、約9秒)
    it('取時間戳在途時停止, 不再重試且停止後0則error, 行程於停止後500ms內自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('tags')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [], `pollInFlightAtStop=${r.pollInFlightAtStop}`)
        assert.strict.deepEqual(r.logsAfterStop, [], '不印重試訊息')
        assert.strict.deepEqual(r.hooksAfterStop, [])
        assert.strict.equal(r.tokenAfterStop, 0)
        assert.ok(r.exitDelay < 500, `exitDelay=${r.exitDelay}, pollInFlightAtStop=${r.pollInFlightAtStop}`)
    })

    //R14 ②③: 同步表之select在途時停止, 其請求被中止(同上)
    it('同步表之select在途時停止, 不再重試且停止後0則error, 行程於停止後500ms內自然結束', async function() {
        this.timeout(40000)
        let r = await runChild('select')
        assert.strict.notEqual(r.tStop, null, JSON.stringify(r))
        assert.strict.equal(r.watchdog, undefined, '自然結束')
        assert.strict.deepEqual(r.errorsAfterStop, [], `pollInFlightAtStop=${r.pollInFlightAtStop}`)
        assert.strict.deepEqual(r.logsAfterStop, [], '不印重試訊息')
        assert.strict.deepEqual(r.hooksAfterStop, [])
        assert.strict.equal(r.tokenAfterStop, 0)
        assert.ok(r.exitDelay < 500, `exitDelay=${r.exitDelay}, pollInFlightAtStop=${r.pollInFlightAtStop}`)
    })

    //R14 ④: 停止時使用端在途之函數不中止, 照常結算(行為鎖定)
    it('停止時使用端在途之函數照常結算', async function() {
        this.timeout(40000)
        let r = await runChild('fapi')
        assert.strict.deepEqual(r.fapi, { state: 'resolve', r: [{ id: 'tabA-row' }] })
        assert.strict.deepEqual(r.errorsAfterStop, [])
    })

})
