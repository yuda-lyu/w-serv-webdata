import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import last from 'lodash-es/last.js'
import dropRight from 'lodash-es/dropRight.js'
import genPm from 'wsemi/src/genPm.mjs'
import evEmit from 'wsemi/src/evEmit.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import WSyncWebdataClient from 'w-sync-webdata/src/WSyncWebdataClient.mjs'
import WServBroadcastClient from 'w-serv-broadcast/src/WServBroadcastClient.mjs'
import { bindFuncByPath, getFuncByPath } from './funcPath.mjs'
import removeListeners from './removeListeners.mjs'
import { checkOptLog, genDiag } from './genDiag.mjs'
import genTokenBook from './genTokenBook.mjs'


//isGiven, 有給(不為undefined與null), 有給卻無效之設定須拋錯, 不可靜默改用預設或忽略
let isGiven = (v) => {
    return v !== undefined && v !== null
}


/**
 * 瀏覽器端之資料控制與同步器
 *
 * 設定錯誤(instWConverClient未給、非事件物件(無emit、on，或無removeListener與off)或無execute函數，getServerMethods、recvData非函數，或getToken與各回調函數有給但非函數)於建構任何元件之前拋錯；執行環境須內建AbortController(停止時中止在途請求所需)，缺者於設定檢查之後、建構任何元件之前拋'AbortController is not available'。連線後先取得可呼叫函數清單並綁定，綁定完成前收到之同步廣播一律略過，綁定後即以當下全部資料表時間戳同步，不會遺漏。某表取資料失敗(例如表操作select被拒絕、傳輸失敗，或前端缺該表之表操作)時不呼叫recvData、不推進該表時間戳，前端既有資料維持不變，並發出error事件(內容為{msg,err,tableName,timeTag}，err為原拒絕值)，之後再收到同一時間戳(例如任一同步表變更之推播)時重抓。各回調函數拋錯時改發出error事件，不中斷同步。
 *
 * 身分驗證責任：本套件不驗證token，只依opt.getToken於每個請求(含輪詢)帶使用方提供之token；驗證一律由伺服端使用方注入之函數負責(getUserIdByToken反查執行身分，即驗證身分，須完整驗證，不可只解碼或只查id)，前端不可視為已驗證。
 *
 * 回傳之事件物件即傳入之通訊物件，其上之error事件另含w-serv-broadcast之輪詢失敗({msg:'[sys:polling] error',err}，例如伺服端已停止廣播或通訊服務，或輪詢被伺服端以'[sys:polling] permission denied'拒絕)與通訊物件自身之錯誤(例如WConverhpClient每次嘗試失敗之訊息)。
 *
 * 停止時呼叫clearBroadcast與clearSync(兩者皆須呼叫，皆可重複呼叫)。任一者被呼叫後，本套件即移除其掛於通訊物件之監聽，不再呼叫getServerMethods、recvData與getRefreshState等回調函數，不再發出本套件之error事件，亦不再送出本套件之請求(取得函數清單、時間戳與同步表資料，含停止時尚在等待getToken者)；停止時已交給通訊物件之本套件請求一併中止(經通訊物件execute之opt.signal)，通訊物件不再為其重試、不再發出其各次嘗試失敗之error，亦不再為其呼叫通訊物件之getToken；中止前已發出之error不收回，伺服端已開始之處理照常完成而其結果忽略。通訊物件之execute不支援opt.signal者(例如w-converhp 2.1.8之前之WConverhpClient)無法中止，停止前已交給它之請求於其重試期間仍會發出各次嘗試失敗之error，於停止後才回到之結果一律忽略。停止前已被呼叫之回調函數於停止後才拋錯者改以診斷輸出(console.error)，預設只輸出固定標籤與不含資料值之摘要(回調函數名稱、錯誤類別與代碼)，不輸出錯誤原文，見opt.logDetail與opt.funLog。w-serv-broadcast之事件(openOnce、broadcast與輪詢之error等)於clearBroadcast後、w-sync-webdata之事件於clearSync後才停止，故只呼叫其一時，另一下層依其自身之規則繼續(例如只呼叫clearBroadcast時，停止時在途之同步表資料請求被中止(通訊物件不支援opt.signal者為其於停止後失敗時)，由w-sync-webdata以其拒絕值為err發出帶表名之error，中止者之拒絕值為'stopped by clearBroadcast or clearSync'(執行環境不支援abort(reason)者為name為AbortError之錯誤)；於停止後才派發之取資料因無監聽者而由其結束並發出error)。兩者皆呼叫後可於同一通訊物件重建；只呼叫其一即重建時，未停止之下層仍屬舊實體而與新實體並存。中止只及於本套件自身之請求：同一通訊物件上w-serv-broadcast之輪詢依其自身之停止規則，使用端自行呼叫之函數(getServerMethods所提供者，其仍會呼叫getToken)不受停止影響，照常完成或依通訊物件之重試失敗。getServerMethods所提供之物件，本套件同步時亦由之取用表操作select；使用端替換其函數者，該表之同步請求不再視為本套件之請求。
 *
 * @class
 * @param {Object} instWConverClient 輸入通訊服務實體物件，須為具emit、on、execute與removeListener或off函數之eventemitter3事件物件(例如WConverhpClient所建立者)，未給、非事件物件(無emit、on，或無removeListener與off)或無execute函數時拋錯
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Function} [opt.getToken=()=>''] 輸入取得使用者token的回調函數，可使用sync或async函數，有給但非函數時拋錯，預設()=>''。其回傳值放於每個請求(含w-serv-broadcast之輪詢，由其opt.getToken於每輪輪詢前呼叫，故輪詢亦會呼叫本函數)之固定鍵__sysToken__，供伺服端opt.getUserIdByToken驗證身分(此即驗證身分之步驟，須完整驗證，見WServWebdataServer)；伺服端未將[sys:polling]列於sysFuncsPublic(嚴格設定，伺服端預設則三者皆公開)時，輪詢須帶可反查出非空userId之token，否則被拒絕(固定訊息'[sys:polling] permission denied')而不連線，error事件為{ msg: '[sys:polling] error', err }；使用本版元件(輪詢帶token)者，建議伺服端設為只公開['[sys:getFuncList]']。token隨請求明文送出，傳輸安全由使用端與通訊層負責
 * @param {Function} opt.getServerMethods 輸入提供操作物件的回調函數，前後端通訊先取得可呼叫函數清單，映射完之後，後端函數都將依函數名之路徑放入物件當中(例如'tabA.select'放入為obj.tabA.select)，並通過回調函數提供該物件，必填，非函數時拋錯
 * @param {Function} opt.recvData 輸入取得變更表資料的回調函數，必填，非函數時拋錯
 * @param {Function} [opt.getRefreshState=null] 輸入取得資料表時間戳是否需更新之回調函數，有給但非函數時拋錯，預設null
 * @param {Function} [opt.getRefreshTable=null] 輸入取得資料表即將更新之回調函數，有給但非函數時拋錯，預設null
 * @param {Function} [opt.getBeforeUpdateTableTags=null] 輸入取得更新資料表時間戳前之回調函數，有給但非函數時拋錯，預設null
 * @param {Function} [opt.getAfterUpdateTableTags=null] 輸入取得更新資料表時間戳後之回調函數，有給但非函數時拋錯，預設null
 * @param {Boolean} [opt.logDetail=false] 輸入診斷輸出是否還原為完整細節(含資料值與錯誤原文，供除錯)，有給但非布林時拋錯，預設false。本套件僅有一處診斷輸出(停止後才拋錯之回調函數，console.error)，預設只輸出固定標籤'[w-serv-webdata] callback error after stop'與摘要{ hook, errType, errCode }(回調函數名稱、錯誤類別與代碼)，不輸出錯誤原文；設為true時再輸出該錯誤之完整內容。憑證與token一律遮罩為'***'(logDetail與funLog亦然，由wsemi之getDiag提供，規則見其R-DIAG-01)：opt.getToken所得者(含輪詢所取，近期至多128個加上進行中請求者，字串內以子字串比對，長度不足4字元者不遮)、名稱含password、secret、token、authorization或api-key之鍵的值、Bearer憑證、網址內之帳密，以及字串內token=、"__sysToken__":"…"等鍵值形式之值；無法辨識之任意文字中的其他token不保證；摘要中的錯誤類別(僅內建錯誤類別名，其餘為Error)與代碼(自有屬性code，限系統與Node之具名錯誤代碼如ENOENT、ECONNREFUSED、ERR_*之內建代碼，不收整數與任意樣式)由wsemi之白名單決定。對外之錯誤值亦遮罩：error事件之錯誤引數與$fapi等請求之拒絕值(伺服端回覆之error訊息、通訊層之錯誤、getToken之拋錯與reject)含上述憑證與token者以'***'取代，不含者原樣(身分不變)；本套件自身以固定詞彙組成之拒絕值(如'stopped by clearBroadcast or clearSync')不經遮罩。只涵蓋本套件自身之輸出，不含w-serv-broadcast與w-sync-webdata等下層之輸出
 * @param {Function} [opt.funLog=null] 輸入診斷輸出函數(label, safe, detail)，有給但非函數時拋錯，預設null。給予時診斷輸出只交給它而不寫console：label為固定標籤，safe為不含資料值之摘要，detail為完整細節(該錯誤之拷貝，含資料值與錯誤原文，token已遮罩；無細節者不傳)，供使用端遮罩或轉送；拷貝時函數、二進位資料、Promise、過深或過大者以標記字串代替，不執行getter與Proxy陷阱(可偵測時)，副本之原型為內建(不沿用使用端原型)，循環參照以'[Circular]'代替；其拋錯與回傳promise之reject皆被吞下，不影響本套件流程
 * @param {Function} [opt.onTrace=null] 輸入觀察回調函數，格式為(e)=>{}，預設null(未給或非函數時忽略，行為、時序與效能同未提供)，供測試與診斷以事件(而非等待毫秒)同步。本套件自身無計時器，本選項原樣轉交所包之w-serv-broadcast前端之opt.onTrace(1.1.14起)，事件不增不減、欄位與時機以其JSDoc為準；回調同步呼叫、不帶接收者，e為凍結之事件物件{ type, ... }(欄位皆為原始值)，其拋錯與回傳之rejection皆忽略，不影響輪詢與同步。type有：start(輪詢計時器建立，ms為輪詢間隔)、tick(計時器每次觸發，n為已開始之輪數，skipped為前一輪在途而略過)、request(發出第n輪輪詢，token為輸入是否帶token)、result(第n輪結果，ok、reason為'ok'、'invalid'或'error'，早於對應事件之派發)、emit(w-serv-broadcast之事件已排定於1ms後派發，name為事件名，如openOnce、open、broadcast、error)、deliver(事件已派發而監聽器皆已呼叫完，name為事件名，ok為監聽器是否皆未拋錯)、report(改以error事件或console.error通報，src為'listener'或'error'，via為'event'或'console')、stop(clearBroadcast首次呼叫完成，inflight為停止時是否有在途之輪詢)。停止後除停止當下已在進行之那次派發之deliver與report外不再通知。w-sync-webdata之opt.onTrace不轉交
 * @returns {Object} 回傳事件物件，可監聽error事件，可使用函數clearBroadcast(停止輪詢)、clearSync(釋放資料同步)停止(見上方說明)
 * @example
 *
 * import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios不適合執行於nodejs, 故需引用原程式碼執行
 * import WServWebdataClient from './src/WServWebdataClient.mjs'
 *
 * let ms = []
 *
 * //instWConverClient
 * let instWConverClient = new WConverhpClient({
 *     //url: window.location.origin + window.location.pathname,
 *     url: 'http://localhost:9000',
 * })
 *
 * //instWConverClient
 * instWConverClient = new WServWebdataClient(
 *     instWConverClient,
 *     {
 *         getToken: () => {
 *             return '' //Vue.prototype.$store.state.userToken
 *         },
 *         getServerMethods: (r) => {
 *             console.log('getServerMethods', r)
 *             //Vue.prototype.$fapi = r
 *
 *             //$fapi
 *             let $fapi = r
 *
 *             let core = async() => {
 *
 *                 //select tabA
 *                 await $fapi.tabA.select(({ prog, p, m }) => {
 *                     console.log('select tabA', prog, p, m)
 *                 })
 *                     .then((res) => {
 *                         console.log('tabA.select then', res)
 *                         ms.push({ 'select tabA': JSON.stringify(res) })
 *                     })
 *                     .catch((err) => {
 *                         console.log('tabA.select catch', err)
 *                     })
 *
 *                 //select tabB
 *                 await $fapi.tabB.select(({ prog, p, m }) => {
 *                     console.log('select tabB', prog, p, m)
 *                 })
 *                     .then((res) => {
 *                         console.log('tabB.select then', res)
 *                         ms.push({ 'select tabB': JSON.stringify(res) })
 *                     })
 *                     .catch((err) => {
 *                         console.log('tabB.select catch', err)
 *                     })
 *
 *                 //add
 *                 ms.push({ 'call add before': '' })
 *                 await $fapi.add({
 *                     pa: 1,
 *                     pb: 2.5,
 *                 }, ({ prog, p, m }) => {
 *                     console.log('add', prog, p, m)
 *                 })
 *                     .then((res) => {
 *                         console.log('add then', res)
 *                         ms.push({ 'call add after': res })
 *                     })
 *                     .catch((err) => {
 *                         console.log('add catch', err)
 *                     })
 *
 *                 //uploadFile
 *                 ms.push({ 'call uploadFile before': '' })
 *                 await $fapi.uploadFile({
 *                     name: 'zdata.b1',
 *                     u8a: new Uint8Array([66, 97, 115]),
 *                 }, ({ prog, p, m }) => {
 *                     console.log('uploadFile', prog, p, m)
 *                 })
 *                     .then((res) => {
 *                         console.log('uploadFile then', res)
 *                         ms.push({ 'call uploadFile after': res })
 *                     })
 *                     .catch((err) => {
 *                         console.log('uploadFile catch', err)
 *                     })
 *
 *             }
 *             core()
 *                 .catch(() => {})
 *
 *         },
 *         recvData: (r) => {
 *             console.log('recvData', r)
 *             //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
 *         },
 *         getRefreshState: (r) => {
 *             console.log('getRefreshState', 'needToRefresh', r.needToRefresh)
 *         },
 *         getRefreshTable: (r) => {
 *             console.log('getRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
 *         },
 *         getBeforeUpdateTableTags: (r) => {
 *             console.log('getBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
 *         },
 *         getAfterUpdateTableTags: (r) => {
 *             console.log('getAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
 *         },
 *     })
 *
 * //error
 * instWConverClient.on('error', (err) => {
 *     console.log('error', err)
 * })
 *
 * //sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
 * setTimeout(() => {
 *     instWConverClient.clearBroadcast()
 *     instWConverClient.clearSync()
 *     console.log('ms', ms)
 * }, 14000)
 * // => ms [
 * //   {
 * //     'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
 * //   },
 * //   {
 * //     'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
 * //   },
 * //   { 'call add before': '' },
 * //   { 'call add after': 3.5 },
 * //   { 'call uploadFile before': '' },
 * //   { 'call uploadFile after': { name: 'zdata.b1', size: 3 } }
 * // ]
 *
 */
function WServWebdataClient(instWConverClient, opt = {}) {
    let kpExec = {}
    let isBound = false //可呼叫函數是否已綁定, 綁定完成前略過同步廣播
    let isStopped = false //是否已停止(clearBroadcast或clearSync任一被呼叫), 停止後本套件不再呼叫回調函數、不再發出error事件、不再送出本套件之請求, 已交給通訊物件者以acSelf中止(通訊物件不支援opt.signal者其結果一律忽略)
    let msgStop = 'stopped by clearBroadcast or clearSync' //停止之拒絕值: 等待getToken期間停止、refreshTable內停止與中止之reason同一值

    //check, 須為可輪詢之通訊物件(具emit、on與execute之事件物件), 於建構任何元件之前檢查: w-serv-broadcast前端亦於建構時檢查同三者, 但本套件先建構之WSyncWebdataClient已擴充傳入之物件, 故前移至此
    //另須具removeListener或off: 停止時以之移除本套件之監聽(見clearBroadcast, clearSync之包裝), 缺者移除靜默失敗, 重建後舊實體之監聽仍會先處理新實體之事件
    if (!iseobj(instWConverClient)) {
        throw new Error(`instWConverClient is not an effective object`)
    }
    if (!haskey(instWConverClient, 'emit') || !isfun(instWConverClient.on) || (!isfun(instWConverClient.removeListener) && !isfun(instWConverClient.off))) {
        throw new Error(`instWConverClient is not an EventEmitter`)
    }
    if (!isfun(instWConverClient.execute)) {
        throw new Error(`instWConverClient.execute is not a function`)
    }

    //getToken, 有給須為函數
    let getToken = get(opt, 'getToken', null)
    if (isGiven(getToken) && !isfun(getToken)) {
        throw new Error('invalid opt.getToken')
    }
    if (!isfun(getToken)) {
        getToken = () => {
            return ''
        }
    }

    //logDetail, funLog, 診斷輸出之設定(見genDiag), 有給卻無效者拋錯
    let optLog = checkOptLog(opt)

    //tokenBook, 近期取得之token(至多128個)與進行中請求之token(保留至請求結束), 供診斷輸出與對外錯誤值遮罩: 本套件請求取得token後記錄並保留至請求結束(executeShell), 輪詢之token經book.watch記錄(交給w-serv-broadcast前端之getToken); 兩處皆只記錄, 不改變getToken之呼叫次數、拋錯與回傳值
    let book = genTokenBook()

    //diag, 診斷輸出(wsemi getDiag之實例, 另帶diag.brief、diag.err); 對外之錯誤值(error事件、reject)為後端、通訊層或使用端回調所給之外來值, 一律經diag.err遮罩token(不含token者原樣交出, 身分不變)
    let diag = genDiag(optLog, book)

    //toOut, 對外交出之錯誤值: 本套件自身以固定詞彙組成之拒絕值(msgStop, 亦為中止之reason經通訊層原樣回到本套件者)不經遮罩(固定字串經遮罩挖空會讓缺口反推短token), 其餘皆為外來值, 經diag.err
    let toOut = (v) => {
        return v === msgStop ? v : diag.err(v)
    }

    //getServerMethods, 必填, 於建構任何元件之前拋錯(原為建構中emit, 呼叫端此時尚未能監聽而遺失)
    let getServerMethods = get(opt, 'getServerMethods', null)
    if (!isfun(getServerMethods)) {
        throw new Error('invalid opt.getServerMethods')
    }

    //recvData, 必填
    let recvData = get(opt, 'recvData', null)
    if (!isfun(recvData)) {
        throw new Error('invalid opt.recvData')
    }

    //getRefreshState, getRefreshTable, getBeforeUpdateTableTags, getAfterUpdateTableTags, 有給須為函數
    let kpHook = {}
    each(['getRefreshState', 'getRefreshTable', 'getBeforeUpdateTableTags', 'getAfterUpdateTableTags'], (k) => {
        let v = get(opt, k, null)
        if (isGiven(v) && !isfun(v)) {
            throw new Error(`invalid opt.${k}`)
        }
        kpHook[k] = v
    })
    let { getRefreshState, getRefreshTable, getBeforeUpdateTableTags, getAfterUpdateTableTags } = kpHook

    //emitError, 本套件之error事件經evEmit發出, 隔離監聽者之拋錯; 停止後不再發出(例如停止前已送出之請求於停止後才失敗)
    let emitError = (err) => {
        if (isStopped) {
            return
        }
        evEmit(instWConverClient, 'error', [toOut(err)])
    }

    //callHook, 呼叫使用端之回調函數, 拋錯時改發出error事件, 不中斷本套件之流程(例如refreshTable之pm須照常結束); 停止後不再呼叫
    //回調於自身內停止後才拋錯者, 停止後不再發出error事件, 改以診斷輸出(console.error): 使用端程式之錯誤不可無聲(同w-serv-broadcast停止後之監聽器拋錯)
    //診斷輸出預設只含回調函數名稱name與錯誤之類別與代碼, 錯誤原文可能夾帶資料值或token, 僅logDetail或funLog收得(見genDiag)
    let callHook = (name, fn, ...args) => {
        if (isStopped || !isfun(fn)) {
            return
        }
        try {
            fn(...args)
        }
        catch (err) {
            if (isStopped) {
                diag('[w-serv-webdata] callback error after stop', { hook: name, ...diag.brief(err) }, () => err, 'error')
                return
            }
            emitError(err)
        }
    }

    //check, 執行環境須內建AbortController(本套件之acSelf與w-serv-broadcast 1.1.9起之輪詢中止皆需要), 缺者以與w-serv-broadcast前端相同之訊息拋錯
    //於opt之檢查之後(設定錯誤之訊息不被環境錯誤蓋過)、建構任何元件之前(只靠下層之檢查時, WSyncWebdataClient已先擴充傳入之物件)
    if (typeof AbortController !== 'function') {
        throw new Error(`AbortController is not available`)
    }

    //acSelf, 本實體自身之請求(見SELF)之中止控制器, 停止時中止(見clearBroadcast, clearSync之包裝), 使通訊物件不再為其重試、發出error與呼叫getToken; 每實體一個, 於同一通訊物件重建者另有自己的; 使用端呼叫$fapi不帶
    let acSelf = new AbortController()

    //擴充同步資料功能
    instWConverClient = new WSyncWebdataClient(instWConverClient)

    //擴充廣播功能, getToken交給w-serv-broadcast前端(1.1.11起opt.getToken), 使輪詢亦帶token(固定鍵__sysToken__), 供伺服端opt.verifyPolling驗證身分(見WServWebdataServer);
    //輪詢每輪重新呼叫getToken(與停止之關係: 輪詢依w-serv-broadcast之生命週期, 見clearBroadcast, 只呼叫clearSync時輪詢續行而仍帶token)
    //onTrace, 觀察回調(選用), 原樣轉交w-serv-broadcast前端(本套件自身無計時器), 非函數時不轉交
    let onTrace = get(opt, 'onTrace', null)
    instWConverClient = new WServBroadcastClient(instWConverClient, {
        getToken: () => {
            return book.watch(getToken())
        },
        onTrace: isfun(onTrace) ? onTrace : null,
    })

    //on, 註冊本套件於通訊物件之監聽並記錄, 停止時移除(掛的人負責移除): 下層皆允許停止後於同一事件物件重建, 舊實體之監聽若留著會先於新實體處理同一事件
    let hs = []
    let on = (name, h) => {
        instWConverClient.on(name, h)
        hs.push({ ev: instWConverClient, name, h })
    }

    //clearBroadcast, clearSync, 包裝下層之同名函數: 先標記已停止、中止本套件在途之請求並移除本套件之監聽, 再呼叫下層; 任一被呼叫即停止本套件(下層之事件仍依各自之停止函數, 故停止時兩者皆須呼叫), 可重複呼叫(abort第二次起無作用)
    //why: 下層於停止後皆不再派發事件(含已排定與在途者), 本套件原無停止狀態, 停止前已啟動之流程(取得函數清單→getServerMethods→取時間戳→同步)於停止後照常呼叫回調、發出error並續送請求;
    //已交給通訊物件之請求原無從中止, 通訊物件於停止後照常重試並逐次發出error, Node行程須待重試結束, w-converhp 2.1.8起以opt.signal中止(其中止之拒絕皆非同步, 不同步回呼本套件)
    each(['clearBroadcast', 'clearSync'], (k) => {
        let clearCore = instWConverClient[k]
        instWConverClient[k] = () => {
            isStopped = true
            acSelf.abort(msgStop)
            removeListeners(hs)
            hs = []
            clearCore()
        }
    })

    //SELF, 本套件自身之請求(取得函數清單、時間戳, 與同步表之select)一律以SELF為this呼叫executeShell所建之函數, 使停止時尚在等待getToken者不送出, 已交給通訊物件者帶acSelf之signal而於停止時中止; 使用端呼叫$fapi時this為其所在物件或undefined, 不受影響
    //同步表之select取自交給使用端之kpExec, 使用端替換其函數者(例如以箭頭函數包裝)this不再為SELF, 該表之同步請求即視為使用端之請求, JSDoc載明(業主裁示: 不另建內部函數表, 以免使用端刻意替換之select被同步忽略)
    let SELF = {}

    function executeShell(func) {
        //通過instWConverClient.execute調用後端函數func
        async function f() {

            //self, 是否為本套件自身之請求(見SELF)
            let self = this === SELF

            //pm
            let pm = genPm()

            //args
            let args = [...arguments]
            // console.log('args1', args)

            //fprog
            let fprog = () => {}
            let argLast = last(args) //若最後一個參數是函數, 因前端對後端無法使用回調函數, 故一定為監聽上下傳的進度函數
            // console.log('argLast', argLast)
            if (isfun(argLast)) {
                fprog = argLast
                args = dropRight(args) //剔除最後的監聽上下傳的進度函數
            }
            // console.log('args2', args)

            //token, getToken拋錯或reject之值為使用端回調所給之外來值, 經diag.err遮罩token後再拋出(不含token者原樣, 身分不變)
            let token
            try {
                token = getToken()
                if (ispm(token)) {
                    token = await token
                }
            }
            catch (err) {
                throw diag.err(err)
            }

            //release, 記錄取得之token供診斷輸出與對外錯誤值遮罩(只記錄, 不改變token), 保留至本請求結束(finally), 使進行中請求之token不被近期上限(128個)淘汰而漏遮
            let release = book.hold(token)

            try {

                //check, 本套件自身之請求於等待token期間已停止者不送出: 尚未交給通訊物件, 送不送由本套件決定; 支援opt.signal之通訊物件其入口亦以已中止之signal拒絕而不送出, 此檢查供不支援者(例如w-converhp 2.1.8之前), 否則伺服器已停時觸發其重試與逐次error
                if (self && isStopped) {
                    pm.reject(msgStop)
                    return pm
                }

                //check, 若允許undefined會導致傳輸input時欄位__sysToken__消失, 故強制取代為空字串
                if (!isestr(token)) {
                    token = ''
                }

                //input
                let input = { __sysInputArgs__: args, __sysToken__: token }

                //execute, 本套件自身之請求帶acSelf之signal(停止時中止, 以msgStop拒絕, 通訊物件不再為其重試、發出error與呼叫getToken); 使用端之請求不帶(給undefined, w-converhp取其預設{}), 不受停止影響
                //通訊物件不支援opt.signal者(execute只收3參數)忽略之, 行為同未中止前
                //拒絕值(伺服端回覆之error訊息、通訊層之錯誤)為外來值, 經diag.err遮罩token(含token者才改為副本)
                await instWConverClient.execute(func, input, fprog, self ? { signal: acSelf.signal } : undefined)
                    .then((r) => {
                        // console.log('instWConverClient.execute then', r)
                        let res = r.msg
                        if (r.state === 'success') {
                            pm.resolve(res)
                        }
                        else {
                            pm.reject(toOut(res))
                        }
                    })
                    .catch((err) => {
                        // console.log('instWConverClient.execute catch', err)
                        pm.reject(toOut(err))
                    })

                return pm
            }
            finally {
                release()
            }
        }
        return f
    }

    function bindFuncs(funcs) {
        //將函數清單自動綁定至物件kpExec

        //kpExec, 依函數名之路徑綁定, 解析與後端之函數名檢查同一套(見funcPath.mjs), 只沿自有屬性前進
        kpExec = {}
        each(funcs, (func) => {
            bindFuncByPath(kpExec, func, executeShell(func))
        })

        //isBound, 先標記已綁定再交給使用端, 使用端回調函數拋錯不影響其後之同步
        isBound = true

        //getServerMethods
        callHook('getServerMethods', getServerMethods, kpExec)

    }

    function updateSyncTable(data) {
        //當收到後端broadcast

        //check, 停止後不再交付同步(例如停止前已送出之取時間戳於停止後才回到)
        if (isStopped) {
            return
        }

        //check, 當mode='syncKpTable'代表為資料同步器發送訊息(各資料表時間戳), 調用instWConverClient.updateTableTags(傳入時間戳), 會觸發instWConverClient.refreshTable事件, 於內呼叫API來更新資料
        if (get(data, 'mode') === 'syncKpTable') {
            // console.log('syncKpTable', data)

            //updateTableTags, 其回傳之promise須接catch, 否則reject時成為unhandledRejection
            instWConverClient.updateTableTags(get(data, 'data'))
                .catch((err) => {
                    emitError(err)
                })

        }

    }

    on('openOnce', function() {
        // console.log('instWConverClient: openOnce')

        //check, 於本次派發中已停止者不啟動(例如使用端於建構前即掛之openOnce監聽內停止; 停止時本監聽已移除, 其後之openOnce不會進來)
        if (isStopped) {
            return
        }

        //core
        let core = async() => {

            //1.openOnce是第1次完成通過execute調用[sys:polling]後才會觸發
            //2.於openOnce內再通過execute調用[sys:getFuncList]後, 才能取得伺服器可用函數清單, 有orm可用函數清單才有辦法綁定kpExec, 才有辦法針對後端orm對應函數執行select撈取資料庫數據
            //3.updateSyncTable內是通過updateTableTags去觸發[w-sync-webdata的client]的refreshTable, refreshTable再通過kpExec[input.tableName].select()去撈資料庫資料
            //4.調用[sys:getFuncList]與[sys:getTableTags]不能保證回傳順序, 得要強制await
            //5.停止時尚在等待getToken之請求不送出(見SELF); 已交給通訊物件者以acSelf中止, 其await拋出而由core之catch經emitError(已停止)結束; 通訊物件不支援opt.signal者無法中止, 於停止後才回到者: 函數清單照常綁定而不呼叫getServerMethods(callHook已停止), 時間戳不交付同步(updateSyncTable已停止), 失敗不發出error(emitError已停止); 本流程非監聽, 停止時移除監聽不會中斷它, 故須逐步檢查

            //getFuncList, 取得可用函數清單, 本套件自身之請求(見SELF)
            let res = await executeShell('[sys:getFuncList]').call(SELF)
            // console.log('[sys:getFuncList] res', res)

            //bindFuncs
            bindFuncs(res)

            //check, 停止後(含於getServerMethods內停止)不再取時間戳
            if (isStopped) {
                return
            }

            //getTableTags, 取得同步資料, 本套件自身之請求(見SELF)
            let data = await executeShell('[sys:getTableTags]').call(SELF)
            // console.log('[sys:getTableTags] data', data)

            //updateSyncTable, 啟動並連線成功後取得時間戳
            updateSyncTable(data)

        }

        //core
        core()
            .catch((err) => {
                emitError(err)
            })

    })

    on('broadcast', function(data) {
        // console.log('instWConverClient: broadcast', data)

        //check, 綁定完成前略過同步廣播: 此時尚無表操作可取資料, 照常處理只會使各表取資料失敗而發出error(時間戳不推進, 資料不會遺失); 綁定後core會以[sys:getTableTags]取得當下全部時間戳, 不會遺漏
        if (!isBound) {
            return
        }

        //updateSyncTable
        updateSyncTable(data)

    })

    // //setTableTags, 前端先不暫存時間戳於localStorage
    // instWConverClient.setTableTags(tableTagsCl)

    //refreshState
    on('refreshState', (msg) => {
        // console.log('refreshState needToRefresh', msg.needToRefresh)
        callHook('getRefreshState', getRefreshState, msg)
    })

    //refreshTable, 收到資料表時間戳有變更通知, 各路徑皆須以pm.resolve或pm.reject結束input.pm; 失敗一律reject, 由w-sync-webdata發出帶表名與時間戳之error並不推進該表時間戳, 再收到同一時間戳時重抓, 故本套件不另發error
    on('refreshTable', (input) => {
        // console.log('refreshTable', input)

        //exec, 以與bindFuncs相同之路徑解析取得該表之表操作物件
        let exec = getFuncByPath(kpExec, input.tableName)

        //check, 缺表(綁定前由使用端直接呼叫updateTableTags, 或已綁定而前後端版本不一致等情形; 伺服端已檢查同步表須有表操作select)
        if (!iseobj(exec)) {
            input.pm.reject(`invalid kpExec[${input.tableName}]`)
            return
        }

        //getRefreshTable
        callHook('getRefreshTable', getRefreshTable, input)

        //funSelect
        let funSelect = get(exec, 'select')

        //check
        if (!isfun(funSelect)) {
            input.pm.reject(`kpExec[${input.tableName}].select is not a function`)
            return
        }

        //check, 於本次派發中已停止者(例如getRefreshTable內停止; 停止時本監聽已移除, 其後之refreshTable不會進來)不再送出select, 以msgStop拒絕(w-sync-webdata未停止時由其發出帶表名之error)
        if (isStopped) {
            input.pm.reject(msgStop)
            return
        }

        //select, 失敗(例如授權拒絕、傳輸失敗)時以原拒絕值reject, 不可以空資料結束, 否則前端該表被清空且記下時間戳, 到該表下次變動前不重抓; 本套件自身之請求(見SELF), 停止時在途者被中止而以msgStop拒絕(只呼叫clearBroadcast時由仍運作之w-sync-webdata發出帶表名之error)
        // console.log('getAPIData before: ', input.tableName)
        funSelect.call(SELF) //沒限制{isActive:'y'}, 後端須基於權限給予適合數據
            .then((data) => {
                // console.log('getAPIData after: ', input.tableName, data)
                input.pm.resolve(data)
            }, (err) => {
                // console.log(`${input.tableName}.select: catch`, err)
                input.pm.reject(toOut(err)) //select可能為使用端替換之函數, 其拒絕值亦為外來值; 停止時在途者之拒絕值為msgStop(固定詞彙)
            })

    })

    //getData
    on('getData', (data) => {
        // console.log('getData', data)

        //recvData
        callHook('recvData', recvData, data)

    })

    //beforeUpdateTableTags, afterUpdateTableTags, beforePollingTableTags, afterPollingTableTags
    on('beforeUpdateTableTags', (msg) => {
        // console.log('client: beforeUpdateTableTags', msg)
        callHook('getBeforeUpdateTableTags', getBeforeUpdateTableTags, msg)
    })
    on('afterUpdateTableTags', (msg) => {
        // console.log('client: afterUpdateTableTags', msg)
        callHook('getAfterUpdateTableTags', getAfterUpdateTableTags, msg)
    })

    return instWConverClient
}


export default WServWebdataClient
