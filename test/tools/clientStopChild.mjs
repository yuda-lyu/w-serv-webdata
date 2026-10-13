//api-clientStop之前端子行程(不帶.test., 不被runner當測試檔): 只含前端, 伺服端在測試行程, 使伺服端之延遲計時器不影響本行程結束時間之量測
//用法: node clientStopChild.mjs <scenario> <port>; 行程結束時印一行'RESULT {...}'
//  res.exitDelay: 停止至本行程自然結束之毫秒(本行程不呼叫process.exit, 只有看門狗逾時才結束)
//  res.errorsAfterStop: 停止後通訊物件上之全部error(w-converhp每次嘗試失敗為字串, w-serv-broadcast與w-sync-webdata為{msg,...})
//  res.logsAfterStop: 停止後之console.log(w-converhp之重試訊息)
//  res.pollInFlightAtStop: 停止當下在途之輪詢數(w-serv-broadcast 1.1.8之輪詢不帶signal而不被中止, 供判讀)
//通訊物件之timeout為1000ms: 伺服端對tokSlow延遲3000ms, 使本套件在途之請求於停止後(若未中止)逾時而依retryMain=3重試並逐次發出error; 伺服器本身不停止(輪詢照常成功)
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'

let [scenario, sport] = process.argv.slice(2)

//fdSrc, 本套件之src, 以本檔所在位置定位(test/tools → src)
let fdSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
let { default: WServWebdataClient } = await import(pathToFileURL(path.resolve(fdSrc, 'WServWebdataClient.mjs')).href)

let t0 = Date.now()
let now = () => Date.now() - t0
let res = { scenario, tStop: null, errorsAfterStop: [], logsAfterStop: [], hooksAfterStop: [], tokenAfterStop: 0, pollInFlightAtStop: null, fapi: null, exitDelay: null }

//w-converhp之重試訊息經console.log輸出, 停止後者記錄之
let log0 = console.log
console.log = (...args) => {
    if (res.tStop !== null) {
        res.logsAfterStop.push(args.map((v) => String(v)).join(' '))
    }
}

//conv, 記錄在途之輪詢數(轉呼叫時原樣傳遞全部參數)
let conv = new WConverhpClient({ url: `http://localhost:${sport}`, timeout: 1000 })
let pollInFlight = 0
let execute0 = conv.execute
conv.execute = (...args) => {
    if (args[0] !== '[sys:polling]') {
        return execute0(...args)
    }
    pollInFlight++
    return execute0(...args)
        .finally(() => {
            pollInFlight--
        })
}

let token = 'tok'
let cl = null
let fapi = null
let onServerMethods = () => {}
let onRefreshTable = () => {}
let onRecv = () => {}
let stop = () => {
    res.tStop = now()
    res.pollInFlightAtStop = pollInFlight
    cl.clearBroadcast()
    cl.clearSync()
}
let hook = (name, fn) => {
    return (...args) => {
        if (res.tStop !== null) {
            res.hooksAfterStop.push(name)
        }
        if (fn) {
            return fn(...args)
        }
    }
}
cl = new WServWebdataClient(conv, {
    getToken: () => {
        if (res.tStop !== null) {
            res.tokenAfterStop++
        }
        return token
    },
    getServerMethods: hook('getServerMethods', (r) => {
        fapi = r
        onServerMethods()
    }),
    recvData: hook('recvData', () => {
        onRecv()
    }),
    getRefreshState: hook('getRefreshState'),
    getRefreshTable: hook('getRefreshTable', () => {
        onRefreshTable()
    }),
    getBeforeUpdateTableTags: hook('getBeforeUpdateTableTags'),
    getAfterUpdateTableTags: hook('getAfterUpdateTableTags'),
})
cl.on('error', (err) => {
    if (res.tStop !== null) {
        res.errorsAfterStop.push(typeof err === 'string' ? err : JSON.parse(JSON.stringify(err)))
    }
})

process.on('exit', () => {
    res.exitDelay = res.tStop === null ? null : now() - res.tStop
    log0('RESULT ' + JSON.stringify(res))
})

//看門狗: 不影響自然結束(unref), 逾時才強制結束並標記
setTimeout(() => {
    res.watchdog = true
    process.exit(0)
}, 25000).unref()

if (scenario === 'fnList') {
    //取得函數清單後(getServerMethods內)即停止: 此時取時間戳尚未送出
    onServerMethods = () => {
        stop()
    }
}
else if (scenario === 'tags') {
    //取時間戳在途時停止
    onServerMethods = () => {
        token = 'tokSlow'
        setTimeout(stop, 50)
    }
}
else if (scenario === 'select') {
    //同步表之select在途時停止
    onRefreshTable = () => {
        token = 'tokSlow'
        setTimeout(stop, 50)
    }
}
else if (scenario === 'fapi') {
    //同步完成後使用端呼叫函數(伺服端延遲300ms), 隨即停止: 照常結算
    onRecv = () => {
        onRecv = () => {}
        setTimeout(async () => {
            token = 'tokMid'
            let p = fapi.tabA.select()
            stop()
            try {
                res.fapi = { state: 'resolve', r: await p }
            }
            catch (err) {
                res.fapi = { state: 'reject', err: String(err) }
            }
        }, 50)
    }
}
