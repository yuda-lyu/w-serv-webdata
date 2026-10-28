import get from 'lodash-es/get.js'


//診斷輸出之單一出口: src內除本檔外不得直接呼叫console(R18); 前端(瀏覽器)與伺服端共用, 故不使用Node內建模組

//遮罩字串
const MASK = '[token]'

//cpDetail之上限: 深度, 處理的節點與鍵合計數; 超過者以標記字串代替(不交出原參照)
const CP_DEPTH = 8
const CP_MAX = 5000

//已知token入比對式之長度上限: 單一token與合計(超過者改以切割取代, 見genRe)
const LEN_RE = 4096
const LEN_RE_TOTAL = 65536

//前端記住之近期token數上限(超過者捨棄最舊者): 每次呼叫皆不同之token(例如帶時間戳)不使記憶體無限成長, 更早者只依鍵名與樣式遮罩
const N_TOKENS = 128

//名稱含token、authorization或api-key之鍵, 其值一律遮罩
const RE_KEY = /token|authorization|api[_-]?key/i

//錯誤類別名稱與代碼的白名單樣式: 只放行建構子名稱(程式識別字), 以及系統慣用之機器代碼(ENOENT、ERR_xxx、整數), 其餘(可能夾帶資料值之文字)不進預設輸出
const RE_ERR_TYPE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const RE_ERR_CODE = /^(E[A-Z0-9]{2,15}|ERR_[A-Z0-9_]{1,40})$/

//二進位資料byteLength的內建getter(不讀使用端可自訂於實例上之byteLength)
const BL_AB = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get
const BL_TA = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength').get
const BL_DV = Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength').get

//Error的stack於V8為自有存取器, 其getter為同一realm內共用的內建函數: 僅當描述子的getter與此相同才執行(不執行使用端自訂的getter)
const STACK_GETTER = (() => {
    try {
        let d = Object.getOwnPropertyDescriptor(new Error(), 'stack')
        return d !== undefined && typeof d.get === 'function' ? d.get : null
    }
    catch (e) {
        return null
    }
})()

//ci, 字母改為大小寫皆可之字元集(不用i旗標, 以免已知token亦被不分大小寫比對)
let ci = (w) => {
    return w.replace(/[a-z]/gi, (c) => {
        return `[${c.toLowerCase()}${c.toUpperCase()}]`
    })
}

//字串內夾帶之token樣式, 與已知token合為單一比對式, 一次掃描取代(已取代之文字不再被比對): 順序為Bearer等憑證、鍵值形式、已知token
//  Bearer憑證: Bearer後之憑證(群組1為Bearer與空白); 單獨出現時只認Bearer(Basic、Token等為常用字, 單獨出現會誤傷一般文字)
//  鍵值形式: 鍵名為__sysToken__、token、authorization、x-api-key、api-key之後接:或=, 值為引號包住者(含空白與跳脫字元, 未結束之引號則取至字串結尾)或無引號者(可帶Bearer、Basic等scheme, 至空白、引號、&、;、}、]為止); 群組2為鍵與分隔, 群組3為引號; 值恰為遮罩字樣(其後為值之邊界)者視為已遮罩, 不重複取代
const SCHEMES = `(?:${['Bearer', 'Basic', 'Digest', 'Negotiate', 'Token'].map(ci).join('|')})`
const SRC_BEARER = `(${ci('Bearer')}\\s+)[A-Za-z0-9._~+/=-]+`
const SRC_PAIR = `((?:${ci('__sysToken__')}|${ci('token')}|${ci('authorization')}|${ci('x-api-key')}|${ci('api')}[_-]?${ci('key')})["']?\\s*[:=]\\s*)(?:(["'])(?:(?!\\3)[^\\\\]|\\\\[\\s\\S])*\\3?|(?!\\[token\\](?![^"'\\s&;}\\]]))(?:${SCHEMES}\\s+)?(?:\\[token\\]|[^"'\\s&;}\\]])+)`


function genRe(tokens) {
    //遮罩比對式: 回傳{ re, reKnown, known }; re為Bearer、鍵值樣式與已知token(前端取得過之token, 長者優先避免短token截走長token的前段而殘留後段, 元字元逐字比對)合為單一全域比對式,
    //reKnown僅含已知token(無則null, 供Bearer被判為單字之一部分時仍遮罩其中的已知token), known為已知token集合(數值等非字串值以字串形式比對)
    //過長之已知token(超過LEN_RE字元; 比對式過大會被引擎拒絕而拋SyntaxError)不入比對式, 另以切割取代(c.long, 先於比對式; 過長之token不致與鍵名等短字樣交疊)
    let ts = []
    let long = []
    let known = new Set()
    let total = 0
    for (let t of tokens) {
        if (typeof t === 'string' && t !== '' && !known.has(t)) {
            known.add(t)
            if (t.length > LEN_RE || total + t.length > LEN_RE_TOTAL) {
                long.push(t)
            }
            else {
                ts.push(t)
                total += t.length
            }
        }
    }
    ts.sort((a, b) => b.length - a.length)
    long.sort((a, b) => b.length - a.length)
    let srcKnown = ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    let src = `${SRC_BEARER}|${SRC_PAIR}`
    if (ts.length > 0) {
        src += '|' + srcKnown
    }
    return { re: new RegExp(src, 'g'), reKnown: ts.length > 0 ? new RegExp(srcKnown, 'g') : null, known, long }
}


function maskStr(s, c) {
    //字串內的token遮罩, 單次掃描(c為genRe之結果)
    for (let t of c.long) {
        s = s.split(t).join(MASK)
    }
    return s.replace(c.re, (m, g1, g2, g3, offset, whole) => {
        if (g1 !== undefined) {
            //Bearer須為獨立單字(前一字元非英數底線), 否則視為一般文字(例如notBearer), 其中的已知token仍遮罩
            if (offset > 0 && /[A-Za-z0-9_]/.test(whole[offset - 1])) {
                return c.reKnown === null ? m : m.replace(c.reKnown, MASK)
            }
            return g1 + MASK
        }
        if (g2 !== undefined) {
            return g3 !== undefined ? g2 + g3 + MASK + g3 : g2 + MASK
        }
        return MASK
    })
}


function isSensitiveKey(k) {
    //鍵名(字串或Symbol之描述)含token、authorization或api-key者
    if (typeof k === 'string') {
        return RE_KEY.test(k)
    }
    if (typeof k === 'symbol') {
        return RE_KEY.test(k.description === undefined ? '' : k.description)
    }
    return false
}


function maskSym(sym, c) {
    //Symbol之描述內若含token, 以遮罩後之描述另建Symbol(Symbol之描述可被讀取)
    let d = sym.description
    if (d === undefined) {
        return sym
    }
    let m = maskStr(d, c)
    return m === d ? sym : Symbol(m)
}


function getOptLog(opt) {
    //診斷輸出的設定, 供WServWebdataServer與WServWebdataClient建構時使用: 型別錯誤即拋Error, 與建構期其他設定(invalid opt.xxx)一致; undefined與null視為未給
    //logDetail: 布林(僅原生布林值), 預設false; true時console輸出還原為含資料值與錯誤原文的完整細節(供除錯), token仍遮罩
    //funLog: 函數(label, safe, detail), 預設無; 給予時診斷輸出只交給它(不寫console), detail為完整細節(含資料值與錯誤原文, token已遮罩), 供使用端遮罩或轉送
    //回傳固定快照{ logDetail, funLog }, 其後各路徑共用此快照, 不再讀取使用端的opt(getter可能前後不同)
    let logDetail = get(opt, 'logDetail', null)
    if (logDetail !== undefined && logDetail !== null && typeof logDetail !== 'boolean') {
        throw new Error('invalid opt.logDetail')
    }
    let funLog = get(opt, 'funLog', null)
    if (funLog !== undefined && funLog !== null && typeof funLog !== 'function') {
        throw new Error('invalid opt.funLog')
    }
    return { logDetail: logDetail === true, funLog: typeof funLog === 'function' ? funLog : null }
}


function noop() {
    //吞下funLog回傳之promise的reject
}


function attach(r, depth = 0) {
    //對promise或thenable附上reject處理, 回傳是否已附上
    //原生promise用內建then(不讀其可被覆寫的then屬性); 其他thenable只讀一次then並以其為this呼叫, 其回傳之物件亦附處理(至多3層, 自回傳之thenable不致無限遞迴)
    if (depth > 3) {
        return false
    }
    try {
        Promise.prototype.then.call(r, undefined, noop)
        return true
    }
    catch (e) {
        //非原生promise
    }
    let t = r.then
    if (typeof t !== 'function') {
        return false
    }
    let x = t.call(r, undefined, noop)
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
        try {
            attach(x, depth + 1)
        }
        catch (e) {
            //放棄
        }
    }
    return true
}


function swallow(r) {
    //funLog的回傳若為promise或thenable, 附上reject處理, 使其reject不成為unhandledRejection; 全程不使診斷輸出拋錯
    try {
        if (r !== null && (typeof r === 'object' || typeof r === 'function')) {
            attach(r)
        }
    }
    catch (e) {
        //放棄
    }
}


function cpAddKeys(src, dst, keys, st, depth) {
    //把src的自有屬性(依keys)複製到dst: 資料屬性遞迴複製並遮罩token(鍵名含token等字樣者其值遮罩, 字串鍵內之已知token亦遮罩), 存取器不執行而以標記字串代替(保留其鍵; 惟Error的stack為內建存取器, 取其字串), 每個鍵都計入預算, 預算用盡即停
    for (let k of keys) {
        if (st.n >= CP_MAX) {
            break
        }
        let d = Object.getOwnPropertyDescriptor(src, k)
        if (d === undefined) {
            continue
        }
        st.n++
        let v = null
        if (!Object.prototype.hasOwnProperty.call(d, 'value')) {
            if (k === 'stack' && STACK_GETTER !== null && d.get === STACK_GETTER) {
                try {
                    let s = STACK_GETTER.call(src)
                    v = typeof s === 'string' ? maskStr(s, st.c) : '[Uncopyable]'
                }
                catch (e) {
                    v = '[Uncopyable]'
                }
            }
            else {
                v = '[Getter/Setter]'
            }
        }
        else if (isSensitiveKey(k)) {
            v = MASK
        }
        else {
            v = cpDetail(d.value, null, st, depth + 1)
        }
        let kd = k
        if (typeof k === 'string') {
            kd = maskStr(k, st.c)
        }
        else if (typeof k === 'symbol') {
            kd = maskSym(k, st.c)
        }
        Object.defineProperty(dst, kd, { value: v, writable: d.writable !== false, enumerable: d.enumerable, configurable: true })
    }
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


function binLen(v) {
    //二進位資料之長度, 以內建getter讀取(不執行使用端自訂之byteLength)
    try {
        return BL_TA.call(v)
    }
    catch (e) {
        return BL_DV.call(v)
    }
}


function cpDetail(v, tokens = [], st = null, depth = 0) {
    //交給console或funLog之完整細節的拷貝並遮罩token: 細節若與其後仍要使用的物件共用, 遮罩不得改到原物件
    //  複製: 純物件與類別實例(保留原型參照、複製自有屬性; 跨realm的Error亦同)、陣列、Date、Map、Set; 字串內之token取代為標記;
    //  標記字串代替: 函數('[Function]')、RegExp('[RegExp]')、二進位資料('[Binary n bytes]')、Promise與WeakMap等無法複製的內建物件('[Object]')、深度超過8或處理的節點與鍵合計超過5000者('[Truncated]')
    //  不執行使用端程式: 不呼叫getter(Error的stack為內建存取器除外)、不讀Symbol.toStringTag、二進位長度與包裝字串以內建方法讀取; 惟型別判斷用instanceof與Array.isArray, 遇Proxy時其陷阱仍會被觸發(瀏覽器無從偵測Proxy), 原型物件不複製(類別實例與其複本共用原型, 原型上的資料屬性不遮罩、可變狀態仍共用)
    //  數值或bigint恰等於已知token(以字串形式比對)者、Symbol之描述含token者亦遮罩
    //  tokens為已知token陣列, 僅最外層呼叫給予(轉為比對式放入st, 遞迴時傳st)
    if (st === null) {
        st = { n: 0, c: genRe(tokens) }
    }
    if (typeof v === 'string') {
        return maskStr(v, st.c)
    }
    if (typeof v === 'function') {
        return '[Function]'
    }
    if (typeof v === 'number' || typeof v === 'bigint') {
        return st.c.known.has(String(v)) ? MASK : v
    }
    if (typeof v === 'symbol') {
        return maskSym(v, st.c)
    }
    if (v === null || typeof v !== 'object') {
        return v
    }
    if (depth >= CP_DEPTH || st.n >= CP_MAX) {
        return '[Truncated]'
    }
    st.n++
    try {
        if (ArrayBuffer.isView(v)) {
            return `[Binary ${binLen(v)} bytes]`
        }
        if (v instanceof ArrayBuffer) {
            return `[Binary ${BL_AB.call(v)} bytes]`
        }
        if (Array.isArray(v)) {
            let r = new Array(v.length)
            cpAddKeys(v, r, Reflect.ownKeys(v).filter((k) => k !== 'length'), st, depth)
            return r
        }
        if (v instanceof RegExp) {
            return '[RegExp]'
        }
        let u = unboxString(v)
        if (u !== null) {
            return maskStr(u, st.c)
        }
        if (v instanceof Number) {
            return Number.prototype.valueOf.call(v)
        }
        if (v instanceof Boolean) {
            return Boolean.prototype.valueOf.call(v)
        }
        if (v instanceof Promise || v instanceof WeakMap || v instanceof WeakSet) {
            return '[Object]'
        }
        let r = null
        if (v instanceof Date) {
            r = new Date(Date.prototype.getTime.call(v))
        }
        else if (v instanceof Map) {
            r = new Map()
            for (let [k, x] of Map.prototype.entries.call(v)) {
                if (st.n >= CP_MAX) {
                    break
                }
                st.n++
                r.set(cpDetail(k, null, st, depth + 1), isSensitiveKey(k) ? MASK : cpDetail(x, null, st, depth + 1))
            }
        }
        else if (v instanceof Set) {
            r = new Set()
            for (let x of Set.prototype.values.call(v)) {
                if (st.n >= CP_MAX) {
                    break
                }
                st.n++
                r.add(cpDetail(x, null, st, depth + 1))
            }
        }
        else {
            r = Object.create(Object.getPrototypeOf(v))
        }
        cpAddKeys(v, r, Reflect.ownKeys(v), st, depth)
        return r
    }
    catch (e) {
        return '[Uncopyable]'
    }
}


function readData(o, k) {
    //取o(含原型鏈)上資料屬性k之值, 不執行getter; 非資料屬性或無則undefined
    for (let x = o; x !== null; x = Object.getPrototypeOf(x)) {
        let d = Object.getOwnPropertyDescriptor(x, k)
        if (d !== undefined) {
            return Object.prototype.hasOwnProperty.call(d, 'value') ? d.value : undefined
        }
    }
    return undefined
}


function getBriefErr(e) {
    //錯誤(使用端回調拋出的值)的摘要: 只列類別與代碼, 不含訊息文字; 不執行getter(遇Proxy時其陷阱仍會被觸發, 見cpDetail)
    //字串列為string; Error取其建構子名稱(程式識別字, 非執行期資料; 不取name, 其可被指定為任意文字; 以資料動態命名類別者不在保證範圍);
    //代碼(自有資料屬性code)限機器代碼樣式: 整數(絕對值至99999)或ENOENT、ERR_xxx之字串; code屬使用端可指定之屬性, 將使用者識別存入code者不在保證範圍
    try {
        if (typeof e === 'string') {
            return { errType: 'string' }
        }
        if (e === null || (typeof e !== 'object' && typeof e !== 'function')) {
            return { errType: e === null ? 'null' : typeof e }
        }
        let r = { errType: typeof e === 'function' ? 'function' : 'object' }
        if (e instanceof Error) {
            let ctor = readData(e, 'constructor')
            let cname = typeof ctor === 'function' ? readData(ctor, 'name') : undefined
            r.errType = typeof cname === 'string' && RE_ERR_TYPE.test(cname) ? cname : 'Error'
        }
        let code = Object.prototype.hasOwnProperty.call(e, 'code') ? Object.getOwnPropertyDescriptor(e, 'code') : undefined
        if (code !== undefined && Object.prototype.hasOwnProperty.call(code, 'value')) {
            let c = code.value
            if ((Number.isInteger(c) && Math.abs(c) <= 99999) || (typeof c === 'string' && RE_ERR_CODE.test(c))) {
                r.errCode = c
            }
        }
        return r
    }
    catch (e2) {
        return { errType: 'unknown' }
    }
}


function genTokenBook() {
    //前端取得過之token的紀錄(至多N_TOKENS個, 最近使用者留存, 供診斷輸出遮罩): note記錄單一值(包裝字串亦取其字串值), watch供輪詢之getToken使用(見WServWebdataClient)
    let tokens = []
    let note = (t) => {
        let s = ''
        if (typeof t === 'string') {
            s = t
        }
        else if (t !== null && typeof t === 'object') {
            s = unboxString(t) || ''
        }
        if (s === '') {
            return
        }
        let i = tokens.indexOf(s)
        if (i >= 0) {
            tokens.splice(i, 1) //重複取得者移至尾端(視為最近使用)
        }
        tokens.push(s)
        if (tokens.length > N_TOKENS) {
            tokens.shift()
        }
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
    return { tokens, note, watch }
}


function getDiag(optLog, getTokens = null) {
    //回傳診斷輸出函數diag(label, safe, getDetail, isErr), 所有診斷輸出皆經此(R18); src內除本函數外不得直接呼叫console
    //label: 固定標籤; safe: 不含資料值、id、token與錯誤原文的摘要(預設輸出), 無則undefined; getDetail: 回傳完整細節的函數(只在有消費者時才呼叫), 無細節則undefined
    //isErr: 為true者以console.error輸出(舊版該站即為console.error), 否則console.log
    //getTokens: 回傳已知token陣列之函數(前端取得過之token), safe與細節內出現者遮罩; 另依鍵名與字串樣式遮罩, 無論有無已知token
    //輸出不得使呼叫端的流程拋錯: 細節的取得、console與funLog的拋錯一律吞下; funLog回傳的promise之reject亦吞下
    let { logDetail, funLog } = optLog
    return (label, safe, getDetail, isErr = false) => {

        //getTokenList, 已知token
        let getTokenList = () => {
            try {
                return typeof getTokens === 'function' ? getTokens() : []
            }
            catch (e) {
                return []
            }
        }

        //getSafe, 摘要(token遮罩); 摘要本不含資料, 遮罩僅防止已知token恰為類別名稱或代碼
        let getSafe = () => {
            if (safe === undefined) {
                return undefined
            }
            try {
                return cpDetail(safe, getTokenList())
            }
            catch (e) {
                return undefined
            }
        }

        //args, 完整細節(token已遮罩); 僅在需要時取得
        let getArgs = () => {
            if (getDetail === undefined) {
                return []
            }
            try {
                return [cpDetail(getDetail(), getTokenList())]
            }
            catch (e) {
                return ['(unprintable)']
            }
        }

        //funLog, 取代console輸出
        if (funLog !== null) {
            try {
                swallow(funLog(label, getSafe(), ...getArgs()))
            }
            catch (e) {
                //放棄輸出
            }
            return
        }

        //console, 預設為安全摘要; logDetail為true時還原完整細節
        try {
            let out = (...args) => {
                if (isErr) {
                    console.error(...args)
                }
                else {
                    console.log(...args)
                }
            }
            if (logDetail) {
                out(label, ...getArgs())
            }
            else if (safe === undefined) {
                out(label)
            }
            else {
                out(label, getSafe())
            }
        }
        catch (e) {
            //放棄輸出
        }
    }
}


export { getOptLog, getDiag, getBriefErr, genTokenBook, cpDetail }
