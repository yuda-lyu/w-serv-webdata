//本檔為測試共用之輔助函式, 不含測試案例(檔名不帶.test., 不被mocha之test/*.test.mjs抓取)
//genTracer: 記錄opt.onTrace之事件(與測試輔助自身之事件), 供測試以「等第N個事件」而非「等N毫秒」同步(規格: dspec/計時器相關函數之觀察回調與測試.md P1)
//flush、drain: 否定斷言前讓已排定之微任務與1ms內派發完成(見各函數註解)


//模組載入時保存真實計時器: 防懸置上限不受測試中之假時鐘(mock.timers)影響, 否則假時鐘下上限失效而缺陷版會整案懸置
const setTimeoutReal = setTimeout
const clearTimeoutReal = clearTimeout
const setImmediateReal = setImmediate


//flush, 讓出一個macrotask: 此前已排定之微任務(promise鏈)皆已執行完; 與負載無關(依事件迴圈階段而非時間)
let flush = () => {
    return new Promise((resolve) => {
        setImmediateReal(resolve)
    })
}


//drain, 否定斷言(「之後不再發生X」)前呼叫: 在最後一個肯定事件之後, 讓微任務鏈與n層「1ms脫勾派發」皆跑完
//  原理: 同為1ms之計時器依建立順序觸發, 故本函數於被測物之派發計時器之後才建立之1ms計時器必晚於它觸發, 與負載無關;
//  每層先flush(使該層之微任務鏈先排出下一層計時器)再等1ms; 派發鏈多於n層者須增加n(波及者另以肯定事件同步)
let drain = async (n = 2) => {
    for (let i = 0; i < n; i++) {
        await flush()
        await new Promise((resolve) => {
            setTimeoutReal(resolve, 1)
        })
    }
    await flush()
}


//isMatch, 事件是否符合條件: 條件為函數則以其回傳判定, 為物件則其每個欄位皆須相等(欄位值為函數者以其回傳判定)
let isMatch = (e, cond) => {
    if (typeof cond === 'function') {
        return cond(e) === true
    }
    return Object.keys(cond).every((k) => {
        let v = cond[k]
        return typeof v === 'function' ? v(e[k]) === true : e[k] === v
    })
}


//genTracer, 回傳{ onTrace, events, mark, count, of, wait, until }
//  onTrace: 給被測物之opt.onTrace(測試輔助自身之事件亦經由它記錄); events: 至今之全部事件(依發生順序)
//  mark(): 目前之事件數, 供wait/count之from參數(只看其後之事件)
//  count(cond, from=0): 符合條件之事件數
//  of(cond, from=0): 符合條件之事件陣列
//  wait(cond, n=1, from=0): 等第n個符合條件(自from起算)之事件, 回傳該事件; 已有者立即成立
//    成立時於事件通知當下resolve, 續行之程式於目前呼叫堆疊(含被測物之該次派發)結束後才執行
//  until(fn): 等fn()為真(於呼叫當下與每個事件之後檢查), 供「已排定之派發皆已送達」等狀態條件
//    msCap為防懸置上限(毫秒, 只防懸置不表達規格), 逾時以含已記錄事件摘要之錯誤reject
let genTracer = (opt = {}) => {
    let msCap = opt.msCap || 50000
    let events = []
    let waiters = []

    let find = (cond, n, from) => {
        let k = 0
        for (let i = from; i < events.length; i++) {
            if (isMatch(events[i], cond)) {
                k++
                if (k === n) {
                    return events[i]
                }
            }
        }
        return null
    }

    //summary, 逾時時附上之事件摘要(略去高頻之輪詢與偵測事件)
    let summary = () => {
        return events.filter((e) => !(e.type === 'alive' && e.evType === 'tick') && e.type !== 'exec' && e.type !== 'execEnd').map((e) => JSON.stringify(e)).join(' ')
    }

    let check = () => {
        for (let w of waiters.slice()) {
            let r = w.test()
            if (r !== null) {
                waiters.splice(waiters.indexOf(w), 1)
                clearTimeoutReal(w.t)
                w.resolve(r)
            }
        }
    }

    let onTrace = (e) => {
        events.push(e)
        check()
    }

    let add = (test, label) => {
        let r = test()
        if (r !== null) {
            return Promise.resolve(r)
        }
        return new Promise((resolve, reject) => {
            let w = { test, resolve, t: null }
            w.t = setTimeoutReal(() => {
                waiters.splice(waiters.indexOf(w), 1)
                reject(new Error(`event not reached within ${msCap}ms (${label}); events: ${summary()}`))
            }, msCap)
            waiters.push(w)
        })
    }

    let wait = (cond, n = 1, from = 0) => {
        return add(() => find(cond, n, from), `cond=${typeof cond === 'function' ? cond.toString() : JSON.stringify(cond)}, n=${n}, from=${from}`)
    }

    let until = (fn) => {
        return add(() => (fn() ? true : null), `until=${fn.toString()}`)
    }

    return {
        onTrace,
        events,
        mark: () => events.length,
        count: (cond, from = 0) => events.slice(from).filter((e) => isMatch(e, cond)).length,
        of: (cond, from = 0) => events.slice(from).filter((e) => isMatch(e, cond)),
        wait,
        until,
    }
}


export {
    genTracer,
    flush,
    drain
}
