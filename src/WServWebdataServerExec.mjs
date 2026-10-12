import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import uniq from 'lodash-es/uniq.js'
import keys from 'lodash-es/keys.js'
import toPath from 'lodash-es/toPath.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
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


function WServWebdataServerExec(instWConverServer, opt = {}) {

    //check
    if (!iseobj(instWConverServer)) {
        throw new Error('invalid instWConverServer')
    }

    //getUserIdByToken, 由外部提供呼叫函數, 提供token回傳使用userID
    let getUserIdByToken = get(opt, 'getUserIdByToken', null)
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

    //tableNames, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理
    let tableNames = []
    if (useDbOrm) {
        tableNames = get(opt, 'tableNames', null)
        if (!isarr(tableNames)) {
            throw new Error('invalid opt.tableNamesExec when useDbOrm=true') //訊息用WServWebdataServer對外之參數名
        }
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
    }

    //authorizeExec, 表操作之授權函數, 資料通道是資料表直接開放給前端之處, 表操作之授權在此, operOrm可能亦被伺服端程式呼叫而分不出呼叫來源故不負責授權
    let authorizeExec = null
    if (useDbOrm) {
        authorizeExec = get(opt, 'authorizeExec', null)
        if (!isfun(authorizeExec)) {
            throw new Error('invalid opt.authorizeExec when useDbOrm=true')
        }
    }

    //kpFunExt, 使用端提供之擴充函數
    let kpFunExt = get(opt, 'kpFunExt', null)

    //kpFunSys, 本套件內部提供之系統函數(例如[sys:getTableTags]), 與kpFunExt分開傳入, 不受kpFunExt之命名限制
    let kpFunSys = get(opt, 'kpFunSys', null)

    //buildFuncs
    function buildFuncs(tableNames, methods, operOrm, authorizeExec) {
        let funcs = {}

        //存取[ORM]資料表函數
        each(tableNames, (tableName) => { //通過ds取得資料表清單
            each(methods, (methodName) => {

                //pathName, 各資料表之各ORM方法
                let pathName = `${tableName}.${methodName}`

                //bind
                funcs[pathName] = async function(userId, input) { //第1參數需為userId

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

    //funcs
    let funcs = {}
    if (useDbOrm) {

        //cloneDeep
        tableNames = cloneDeep(tableNames)

        //buildFuncs
        funcs = buildFuncs(tableNames, methods, operOrm, authorizeExec)
        // console.log('funcs(buildFuncs)', funcs)

    }
    //namesGuard, 前端以lodash之set依函數名綁定(見WServWebdataClient之bindFuncs), set會略過路徑中之此三者而無法綁定
    let namesGuard = ['__proto__', 'constructor', 'prototype']

    //getBindPath, 取前端綁定函數時之路徑(與lodash之set同一解析, 例如'tabA[select]'亦為['tabA','select']), 無法綁定者拋錯
    let getBindPath = (name, from) => {
        let ps = toPath(name)
        if (ps.length === 0) {
            throw new Error(`${from}[${name}] can not be bound by the client`)
        }
        each(ps, (p) => {
            if (namesGuard.includes(p)) {
                throw new Error(`${from}[${name}] can not be bound by the client`)
            }
        })
        return ps
    }

    //topsTable, 表操作之頂層名(表名), 前端綁定為$fapi.表名.方法, 此頂層名保留給表操作
    let topsTable = uniq(map(keys(funcs), (pathName) => {
        return getBindPath(pathName, 'table operation')[0]
    }))

    if (iseobj(kpFunExt)) { //add ext. async funcs
        each(kpFunExt, (v, k) => {

            //check, 系統函數之名稱保留
            if (k.startsWith('[sys:')) {
                throw new Error(`kpFunExt[${k}] can not use the reserved prefix [sys:`)
            }

            //check, kpFunExt之頂層名不得為表名, 否則前端綁定時覆蓋該表之表操作(同名時更會覆蓋伺服端之表操作而脫離authorizeExec), 或使kpFunExt看似表操作卻不經authorizeExec
            let ps = getBindPath(k, 'kpFunExt')
            if (topsTable.includes(ps[0])) {
                throw new Error(`kpFunExt[${k}] conflicts with the table operations of table[${ps[0]}]`)
            }

            funcs[k] = v
        })
        // console.log('funcs(kpFunExt)', funcs)
    }
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


export default WServWebdataServerExec
