import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import uniq from 'lodash-es/uniq.js'
import keys from 'lodash-es/keys.js'
import isobj from 'wsemi/src/isobj.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import arrPull from 'wsemi/src/arrPull.mjs'
import pm2resolve from 'wsemi/src/pm2resolve.mjs'
import evEmit from 'wsemi/src/evEmit.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'
import { getFuncPath, isBindableFuncPath, findFuncPathConflict } from './funcPath.mjs'
import checkFind from './checkFind.mjs'


//isGiven, 有給(不為undefined與null), 有給卻無效之設定須拋錯, 不可靜默改用預設
let isGiven = (v) => {
    return v !== undefined && v !== null
}


//methodsFind, 第1參數為find(查詢條件)之表操作方法, 其input來自不可信之前端, 須先經checkFind白名單檢核
let methodsFind = ['select', 'delAll']


//sysFuncs, 系統函數全集, 名稱保留給本套件與w-serv-broadcast([sys:polling]), kpFunExt不得使用[sys:前綴; sysFuncsPublic之元素須為其一
let sysFuncs = ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']


//buildFuncs
function buildFuncs(tableNames, methods, operOrm, authorizeExec) {
    let funcs = {}

    //存取[ORM]資料表函數
    each(tableNames, (tableName) => { //通過ds取得資料表清單
        each(methods, (methodName) => {

            //pathName, 各資料表之各ORM方法
            let pathName = `${tableName}.${methodName}`

            //bind
            funcs[pathName] = async function(userId, input) { //第1參數需為userId; 其後僅收前端第1個參數, 之後之多餘參數(如order)丟棄, 不交給授權函數與operOrm

                //checkFind, 前端所送之find須在白名單內, 先於授權函數(使其只見白名單內之形狀)與operOrm; 不合者不呼叫兩者, 拒絕值須為字串且不含前端所送之值; 通過者改用全新凍結之複本, 授權所見即交給ORM者
                if (methodsFind.includes(methodName)) {
                    let rc = checkFind(input)
                    if (!rc.ok) {
                        return Promise.reject(`invalid find[${rc.reason}]`)
                    }
                    input = rc.find
                }

                //authorizeExec, 預設拒絕, 回傳嚴格等於true才放行, 拒絕時不呼叫operOrm; 授權函數拋錯或reject時其值原樣轉出, 經execFun之pm2resolve成為回應之msg
                let b = await authorizeExec({ userId, tableName, methodName, input })
                if (b !== true) {
                    return Promise.reject('permission denied') //須reject字串, 若用Error物件, 序列化後前端收到的是'Error: permission denied'
                }

                //呼叫ORM的泛用接口procCommon
                let r = await operOrm(userId, tableName, methodName, input)

                return r
            }

        })
    })

    return funcs
}


/**
 * 解析與檢查資料通道之設定, 無副作用(不呼叫使用端函數、不修改輸入), 設定錯誤時拋錯
 *
 * @param {Object} [opt={}] 輸入設定物件, 鍵同WServWebdataServerExec之opt
 * @returns {Object} 回傳正規化後之設定, 另含表操作之函數名陣列pathNames
 */
function parseOpt(opt = {}) {

    //getUserIdByToken, 由外部提供呼叫函數, 提供token回傳使用userID; 有給卻非函數時拋錯, 否則全部呼叫會靜默變成匿名
    let getUserIdByToken = get(opt, 'getUserIdByToken', null)
    if (isGiven(getUserIdByToken) && !isfun(getUserIdByToken)) {
        throw new Error('invalid opt.getUserIdByToken')
    }
    if (!isfun(getUserIdByToken)) {
        getUserIdByToken = async () => {
            return ''
        }
    }

    //useDbOrm
    let useDbOrm = get(opt, 'useDbOrm', null)
    if (!isbol(useDbOrm)) {
        useDbOrm = false
    }

    //operOrm, ORM的泛用接口procCommon
    let operOrm = null
    if (useDbOrm) {
        operOrm = get(opt, 'operOrm', null)
        if (!isfun(operOrm)) {
            throw new Error('invalid opt.operOrm when useDbOrm=true')
        }
    }

    //tableNames, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理; 訊息用WServWebdataServer對外之參數名
    let tableNames = []
    if (useDbOrm) {
        tableNames = get(opt, 'tableNames', null)
        if (!isarr(tableNames)) {
            throw new Error('invalid opt.tableNamesExec when useDbOrm=true')
        }
        each(tableNames, (v, i) => {
            if (!isestr(v)) {
                throw new Error(`invalid opt.tableNamesExec[${i}] when useDbOrm=true`)
            }
        })
        tableNames = [...tableNames] //快照, 避免建構期間外部修改
    }

    //methods
    let methods = []
    if (useDbOrm) {
        methods = get(opt, 'methods', null)
        if (methods === null) {
            // methods = ['select', 'insert', 'save', 'del', 'dellAll']
            methods = ['select', 'insert', 'save', 'del']
        }
        else if (!isarr(methods)) {
            throw new Error('invalid opt.methodsExec when useDbOrm=true') //有給但非陣列時拋錯, 不可靜默改用預設而開放寫入方法
        }
        each(methods, (v, i) => {
            if (!isestr(v)) {
                throw new Error(`invalid opt.methodsExec[${i}] when useDbOrm=true`)
            }
        })
        methods = [...methods] //快照, 避免建構期間外部修改
    }

    //authorizeExec, 表操作之授權函數, 資料通道是資料表直接開放給前端之處, 表操作之授權在此, operOrm可能亦被伺服端程式呼叫而分不出呼叫來源故不負責授權
    let authorizeExec = null
    if (useDbOrm) {
        authorizeExec = get(opt, 'authorizeExec', null)
        if (!isfun(authorizeExec)) {
            throw new Error('invalid opt.authorizeExec when useDbOrm=true')
        }
    }

    //kpFunExt, 使用端提供之擴充函數; 有給須為純物件且各值須為函數, 否則拋錯(例如陣列、模組命名空間物件原會被靜默捨棄)
    let kpFunExt = get(opt, 'kpFunExt', null)
    if (isGiven(kpFunExt) && !isobj(kpFunExt)) {
        throw new Error('invalid opt.kpFunExt')
    }
    if (!isobj(kpFunExt)) {
        kpFunExt = {}
    }
    each(kpFunExt, (v, k) => {
        if (!isfun(v)) {
            throw new Error(`invalid opt.kpFunExt[${k}]`)
        }
    })

    //kpFunSys, 本套件內部提供之系統函數(例如[sys:getTableTags]), 與kpFunExt分開傳入, 不受kpFunExt之命名限制
    let kpFunSys = get(opt, 'kpFunSys', null)

    //sysFuncsPublic, 無須身分(getUserIdByToken得空字串)即可呼叫之系統函數, 未列者須getUserIdByToken得非空字串; 有給須為陣列且元素須為系統函數名, 否則拋錯(不可靜默忽略而使部署方以為已公開或已收緊), 預設只公開函數名稱清單
    let sysFuncsPublic = get(opt, 'sysFuncsPublic', null)
    if (!isGiven(sysFuncsPublic)) {
        sysFuncsPublic = ['[sys:getFuncList]']
    }
    else if (!isarr(sysFuncsPublic)) {
        throw new Error('invalid opt.sysFuncsPublic')
    }
    sysFuncsPublic = [...sysFuncsPublic] //快照, 避免建構期間外部修改; 先取快照再檢查, 檢查之值即使用之值(陣列自訂迭代器使展開與索引所見不同時, 不致檢查通過而使用另一份)
    each(sysFuncsPublic, (v, i) => {
        if (!sysFuncs.includes(v)) {
            throw new Error(`invalid opt.sysFuncsPublic[${i}]`)
        }
    })

    //pathNames, 表操作之函數名
    let pathNames = []
    if (useDbOrm) {
        each(tableNames, (tableName) => {
            each(methods, (methodName) => {
                pathNames.push(`${tableName}.${methodName}`)
            })
        })
        pathNames = uniq(pathNames)
    }

    //check, 前端以函數名之路徑綁定(見funcPath.mjs與WServWebdataClient之bindFuncs), 函數名須可綁定
    each(pathNames, (pathName) => {
        if (!isBindableFuncPath(pathName)) {
            throw new Error(`table operation[${pathName}] can not be bound by the client`)
        }
    })

    //topsTable, 表操作之頂層名(表名), 前端綁定為$fapi.表名.方法, 此頂層名保留給表操作
    let topsTable = uniq(map(pathNames, (pathName) => {
        return getFuncPath(pathName)[0]
    }))

    each(kpFunExt, (v, k) => {

        //check, 系統函數之名稱保留
        if (k.startsWith('[sys:')) {
            throw new Error(`kpFunExt[${k}] can not use the reserved prefix [sys:`)
        }

        //check, 函數名須可綁定
        if (!isBindableFuncPath(k)) {
            throw new Error(`kpFunExt[${k}] can not be bound by the client`)
        }

        //check, kpFunExt之頂層名不得為表名, 否則前端綁定時覆蓋該表之表操作(同名時更會覆蓋伺服端之表操作而脫離authorizeExec), 或使kpFunExt看似表操作卻不經authorizeExec
        let p0 = getFuncPath(k)[0]
        if (topsTable.includes(p0)) {
            throw new Error(`kpFunExt[${k}] conflicts with the table operations of table[${p0}]`)
        }

    })

    //check, 不同函數名不得綁到同一路徑(別名), 亦不得互為前綴(葉與父), 否則前端綁定時互相覆蓋, 涵蓋表操作彼此與kpFunExt彼此
    let r = findFuncPathConflict([...pathNames, ...keys(kpFunExt)])
    if (r !== null) {
        let from = (name) => {
            return pathNames.includes(name) ? 'table operation' : 'kpFunExt'
        }
        throw new Error(`${from(r[1])}[${r[1]}] conflicts with ${from(r[0])}[${r[0]}] on the client binding path`)
    }

    return {
        getUserIdByToken,
        useDbOrm,
        operOrm,
        tableNames,
        methods,
        authorizeExec,
        kpFunExt,
        kpFunSys,
        sysFuncsPublic,
        pathNames,
    }
}


function WServWebdataServerExec(instWConverServer, opt = {}) {

    //check
    if (!iseobj(instWConverServer)) {
        throw new Error('invalid instWConverServer')
    }

    //parseOpt, 設定之檢查集中於此(單一擁有者), WServWebdataServer於建構任何元件之前亦先呼叫
    let { getUserIdByToken, useDbOrm, operOrm, tableNames, methods, authorizeExec, kpFunExt, kpFunSys, sysFuncsPublic } = parseOpt(opt)

    //isSysPollingActive, 內部選項(由WServWebdataServer交入): [sys:polling]是否仍由w-serv-broadcast處理(其opt.verifyPolling已含身分關卡), 未給時視為否(此時輪詢回invalid token)
    let isSysPollingActive = get(opt, 'isSysPollingActive', null)
    if (!isfun(isSysPollingActive)) {
        isSysPollingActive = () => {
            return false
        }
    }

    //funcs
    let funcs = {}
    if (useDbOrm) {

        //buildFuncs
        funcs = buildFuncs(tableNames, methods, operOrm, authorizeExec)
        // console.log('funcs(buildFuncs)', funcs)

    }
    each(kpFunExt, (v, k) => { //add ext. async funcs
        funcs[k] = v
    })
    // console.log('funcs(kpFunExt)', funcs)
    if (iseobj(kpFunSys)) { //add sys. funcs
        each(kpFunSys, (v, k) => {
            funcs[k] = v
        })
    }

    //execFun
    async function execFun(func, input, pm) {
        // console.log('execFun', func, input)

        //check, 必要檢測, 有些防火牆會刪除或修改封包內容, 導致無法解析func或input, 進而會導致後續取得sysToken或sysInput失效, 為避免誤判須先行偵測func, 若無func多半是封包被修改導致
        if (!isestr(func)) {
            pm.resolve({ state: 'error', msg: 'invalid func' })
            return pm //提前離開
        }

        //[sys:polling], 輸入為{ clientId, __sysToken__ }(非{ __sysInputArgs__, __sysToken__ }), 由w-serv-broadcast處理並經其opt.verifyPolling(身分關卡, 見genPollingGate)
        //其回覆為非同步, 本函數若同步回應則先結算者勝出而輪詢每輪失敗, 故廣播仍運作時只略過(不回應, 且不可回傳pm: 其被w-serv-broadcast拒絕時會使下方execute監聽器之catch多發一則error事件)
        //廣播已停止(clearBroadcast)或未建構時維持既有回應invalid token(rulebook L16), 不反查
        if (func === '[sys:polling]') {
            if (!isSysPollingActive()) {
                pm.resolve({ state: 'error', msg: 'invalid token' })
                return pm //提前離開
            }
            return //略過
        }

        //get token, 將內部token提出
        let token = ''
        if (!haskey(input, '__sysToken__')) {
            pm.resolve({ state: 'error', msg: 'invalid token' })
            return pm //提前離開
        }
        token = cstr(input.__sysToken__)

        //get input, 將內部sysInput提出
        if (!haskey(input, '__sysInputArgs__')) {
            pm.resolve({ state: 'error', msg: 'invalid input' })
            return pm //提前離開
        }
        input = input.__sysInputArgs__

        //check, 參數須為陣列(對所有函數), 否則下方展開時字串會變成逐字之參數, 物件、數字、null等則拋出內部錯誤訊息; 先於getUserIdByToken與任何下游
        if (!Array.isArray(input)) {
            pm.resolve({ state: 'error', msg: 'invalid input' })
            return pm //提前離開
        }

        //userId
        let userId = ''
        if (true) {

            //getUserIdByToken, 拋錯或reject時視同拒絕, 拒絕值原樣成為回應之msg(與各函數經pm2resolve之拒絕值同規則), 使用端可藉此回自己之語系鍵
            //不可改用pm2resolve: 其將同步throw null視為成功, 會以空字串userId繼續執行(fail-open)
            try {
                userId = await getUserIdByToken(token) //以await取值, 使原生Promise與其他thenable一致處理
            }
            catch (err) {
                pm.resolve({ state: 'error', msg: err }) //先回應再發事件
                evEmit(instWConverServer, 'error', [err]) //監聽者拋錯時由evEmit隔離, 不中斷流程
                return pm //提前離開
            }

            //check
            if (!isestr(userId)) {
                userId = ''
            }

        }

        //check, 系統函數須有身分(userId為非空字串), 除非列於sysFuncsPublic; 先於任何系統函數之處理, 回固定拒絕鍵(不回顯token)並發error事件(系統函數無使用端授權函數可記錄, error事件為唯一觀察點)
        //表操作與kpFunExt之空userId語意不變(交authorizeExec或函數自行把關)
        if (sysFuncs.includes(func) && !sysFuncsPublic.includes(func) && userId === '') {
            pm.resolve({ state: 'error', msg: 'permission denied' }) //先回應再發事件
            evEmit(instWConverServer, 'error', [{ msg: 'permission denied', func }])
            return pm //提前離開
        }

        //getFuncList, 提供可用函數清單
        if (func === '[sys:getFuncList]') {

            //ks
            let ks = keys(funcs)

            //會提供內部同步用系統函數, 須去除
            ks = arrPull(ks, '[sys:getTableTags]')

            //r
            let r = {
                state: 'success',
                msg: ks,
            }

            pm.resolve(r)
            return pm //提前離開
        }

        //check, 只認funcs之自有屬性, 不可用haskey(其以in判斷), 否則constructor、toString等繼承自Object.prototype之名稱亦可被前端呼叫
        if (!Object.prototype.hasOwnProperty.call(funcs, func)) {
            pm.resolve({ state: 'error', msg: `invalid func[${func}]` })
            return pm //提前離開
        }

        //fun
        let fun = funcs[func]

        //call fun
        try {
            let r = await pm2resolve(fun)(userId, ...input) //第1參數現在改為userId, 後端函數接收各自處理userId
            pm.resolve(r)
        }
        catch (err) {
            pm.resolve({ state: 'error', msg: `call func[${func}] has an error: ${getErrorMessage(err)}` })
        }

        return pm //共用Promise
    }

    //監聽execute, 依w-converhp之契約監聽器須為同步函數且不可回傳promise(其rejection即unhandledRejection而使行程崩潰), 非同步結果一律經pm回覆
    instWConverServer.on('execute', function(func, input, pm) {
        //console.log(`Server[port:${optServer.port}]: execute`, func, input)

        //execFun, 收尾之catch不可再拋錯: getErrorMessage不拋錯, 事件經evEmit隔離監聽者之拋錯
        execFun(func, input, pm)
            .catch((err) => {
                pm.resolve({ state: 'error', msg: `execFun func[${func}] has an error: ${getErrorMessage(err)}` }) //先回應再發事件
                evEmit(instWConverServer, 'error', [err])
            })

    })

    return instWConverServer
}


export { parseOpt }
export default WServWebdataServerExec
