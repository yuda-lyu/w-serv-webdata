import getDiagSecrets from 'wsemi/src/getDiagSecrets.mjs'


//前端與伺服端各記住之近期token數上限(超過者捨棄最舊者): 每次呼叫皆不同之token(例如帶時間戳)不使記憶體無限成長; 進行中請求之token另以hold保留至請求結束, 不受此上限淘汰
const N_TOKENS = 128


function noop() {
    //吞下記錄用分支之reject
}


function unboxString(v) {
    //包裝字串(含跨realm者)取其字串值, 不執行使用端程式(內建valueOf以內部槽判定, Proxy與一般物件拋TypeError); 非包裝字串回傳null
    try {
        return String.prototype.valueOf.call(v)
    }
    catch (e) {
        return null
    }
}


function toStr(t) {
    //單一值轉為可記錄之字串(包裝字串取其字串值), 非字串與空字串回傳''
    let s = ''
    if (typeof t === 'string') {
        s = t
    }
    else if (t !== null && typeof t === 'object') {
        s = unboxString(t) || ''
    }
    return s
}


function genTokenBook() {
    //token的紀錄(供診斷輸出與回給遠端之訊息遮罩): 近期至多N_TOKENS個(最近使用者留存), 加上進行中請求之token(hold至請求結束, 不被淘汰, 使請求結束前其token必在遮罩清單內)
    //  note: 記錄單一值(包裝字串亦取其字串值); hold: 記錄並保留至回傳之release被呼叫, 回傳release(可重複呼叫); watch: 供輪詢之getToken使用(見WServWebdataClient)
    //  list: 近期與進行中之token(不重複); secrets: 回傳getDiagSecrets({ values: list() })之結果(wsemi getDiag之cfg.secrets函數形式), 清單未變時沿用同一份凍結結果(使wsemi之比對器快取有效)
    let tokens = []
    let held = new Map()
    let rev = 0 //清單成員變動之版本(僅成員增減才遞增, 重複取得而移至尾端者不算)
    let cache = null
    let note = (t) => {
        let s = toStr(t)
        if (s === '') {
            return
        }
        let i = tokens.indexOf(s)
        if (i >= 0) {
            tokens.splice(i, 1) //重複取得者移至尾端(視為最近使用)
        }
        else {
            rev++
        }
        tokens.push(s)
        if (tokens.length > N_TOKENS) {
            tokens.shift()
            rev++
        }
    }
    let hold = (t) => {
        let s = toStr(t)
        if (s === '') {
            return noop
        }
        note(s)
        let n = held.get(s) || 0
        if (n === 0) {
            rev++
        }
        held.set(s, n + 1)
        let done = false
        return () => {
            if (done) {
                return
            }
            done = true
            let m = held.get(s) - 1
            if (m > 0) {
                held.set(s, m)
            }
            else {
                held.delete(s)
                rev++
            }
        }
    }
    let list = () => {
        let r = [...tokens]
        for (let s of held.keys()) {
            if (!tokens.includes(s)) {
                r.push(s)
            }
        }
        return r
    }
    let secrets = () => {
        if (cache === null || cache.rev !== rev) {
            cache = { rev, ss: getDiagSecrets({ values: list() }) }
        }
        return cache.ss
    }
    //watch, 觀察getToken之回傳值並原樣交還同一值(不包裝、不延後、不多呼叫其then): 字串直接記錄; 原生promise以內建then另附一條記錄用之分支(不讀其可被覆寫之then屬性, 同一promise仍由呼叫端自行採納);
    //其他物件(非原生promise之thenable、包裝字串等)不記錄(本套件請求路徑於取得後記錄, 見WServWebdataClient)
    let watch = (t) => {
        if (typeof t === 'string') {
            note(t)
        }
        else if (t !== null && typeof t === 'object') {
            try {
                Promise.prototype.then.call(t, note, noop)
            }
            catch (e) {
                //非原生promise或其constructor取值拋錯: 不記錄
            }
        }
        return t
    }
    return { tokens, note, hold, list, secrets, watch }
}


export default genTokenBook
