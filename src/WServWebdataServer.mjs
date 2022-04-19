import get from 'lodash/get'
// import isarr from 'wsemi/src/isarr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
// import isfun from 'wsemi/src/isfun.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import evem from 'wsemi/src/evem.mjs'
import WServWebdataServerSync from './WServWebdataServerSync.mjs'
import WServWebdataServerExec from './WServWebdataServerExec.mjs'


/**
 * 伺服器端之資料控制與同步器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Object} opt.instWConverServer 輸入通訊服務實體物件，可使用例如WConverhpServer等建立
 * @param {Boolean} [opt.useDbORM=true] 輸入是否使用資料庫ORM技術，給予false代表不使用直接存取資料庫函數與自動同步資料庫至前端功能，預設true
 * @param {Object} [opt.dbORMs={}] 輸入各資料表的操作物件，用以提供由tableNamesSync指定資料表的change事件，使能監聽與觸發資料變更事件，key為表名而值為該表的操作器實體，操作器實體可使用例如WOrmMongodb等建立，預設{}
 * @param {Function} [opt.operORM={}] 輸入各資料表的操作通用接口物件，用以提供操作由tableNamesExec指定資料表的例如'select'、'insert'、'save'、'del'函數。加上由extFuncs提供的函數，就為全部可由前端執行的函數，預設{}
 * @param {Array} [opt.tableNamesExec=[]] 輸入指定能被操作的表名陣列，預設[]
 * @param {Array} [opt.tableNamesSync=[]] 輸入指定能被同步的表名陣列，預設[]
 * @param {Array} [opt.methodsExec=['select','insert','save','del']] 輸入指定綁定操作器的方式陣列，可選'select'、'insert'、'save'、'del'、'delAll'，預設['select', 'insert', 'save', 'del']
 * @param {Function} [opt.cbGetUserIDFromToken=async ()=>''] 輸入取得使用者ID的回調函數，傳入參數為各函數的原始參數，預設async ()=>''
 * @param {Object} [opt.extFuncs=null] 輸入額外擴充執行函數物件，key為函數名而值為函數，預設null
 * @param {Function} [opt.hookBefores=null] 輸入執行函數的前攔截函數，預設null
 * @param {Function} [opt.hookAfters=null] 輸入執行函數的後攔截函數，預設null
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *
 * import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
 * import WServWebdataServer from 'w-serv-webdata/src/WServWebdataServer.mjs'
 *
 * let wsrv = new WConverhpServer({...})
 * let procCommon = () => {...}
 * let tableNamesExec = [...]
 * let tableNamesSync = [...]
 *
 * let wsds = WServWebdataServer({
 *     instWConverServer: wsrv,
 *     cbGetUserIDFromToken: async () => {
 *         return 'id-for-admin'
 *     },
 *     dbORMs: woItems,
 *     operORM: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
 *     tableNamesExec,
 *     tableNamesSync,
 *     extFuncs: { //接收參數第1個為userId, 之後才是前端給予參數
 *         // getUserFromID,
 *         // downloadFileFromID,
 *         // saveTableAndData,
 *     },
 *     hookBefores: null,
 *     hookAfters: null,
 * })
 * wsds.on('error', (err) => {
 *     console.log('error', err)
 * })
 *
 */
function WServWebdataServer(opt = {}) {
    let instWServWebdataServerExec = null
    let instWServWebdataServerSync = null

    //ev
    let ev = evem()

    //instWConverServer, 由外部提供通訊服務實體, 例如WConverhpServer等
    let instWConverServer = get(opt, 'instWConverServer', null)
    if (instWConverServer === null) {
        ev.emit('error', 'invalid opt.instWConverServer')
        return ev
    }

    //useDbORM
    let useDbORM = get(opt, 'useDbORM', null)
    if (!isbol(useDbORM)) {
        useDbORM = true
    }

    //dbORMs, 輸入外部ORM實體
    let dbORMs = get(opt, 'dbORMs', null)
    // if (!isobj(dbORMs)) {
    //     ev.emit('error', 'invalid opt.dbORMs')
    //     return ev
    // }

    //operORM, ORM的泛用接口procCommon
    let operORM = get(opt, 'operORM', null)
    // if (!isfun(operORM)) {
    //     ev.emit('error', 'invalid opt.operORM')
    //     return ev
    // }

    //tableNamesExec, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理
    let tableNamesExec = get(opt, 'tableNamesExec', null)
    // if (!isarr(tableNamesExec)) {
    //     ev.emit('error', 'invalid opt.tableNamesExec')
    //     return ev
    // }

    //methodsExec
    let methodsExec = get(opt, 'methodsExec', null)
    // if (!isarr(methodsExec)) {
    //     methodsExec = ['select', 'insert', 'save', 'del']
    // }

    //tableNamesSync, 指定需同步表名, 機敏資訊表記得過濾, 各表名需隸屬於ORM, 才能監聽其change事件
    let tableNamesSync = get(opt, 'tableNamesSync', null)
    // if (!isarr(tableNamesSync)) {
    //     ev.emit('error', 'invalid opt.tableNamesSync')
    //     return ev
    // }

    //cbGetUserIDFromToken, 由外部提供呼叫函數, 將提供各函數的輸入用以取得使用userID
    let cbGetUserIDFromToken = get(opt, 'cbGetUserIDFromToken', null)

    //extFuncs
    let extFuncs = get(opt, 'extFuncs', null)

    //hookBefores
    let hookBefores = get(opt, 'hookBefores', null)

    //hookAfters
    let hookAfters = get(opt, 'hookAfters', null)

    //fnTableTags
    let fnTableTags = get(opt, 'fnTableTags', null)

    //WServWebdataServerExec
    instWServWebdataServerExec = new WServWebdataServerExec({
        instWConverServer,
        cbGetUserIDFromToken,
        useDbORM,
        operORM,
        tableNames: tableNamesExec,
        methods: methodsExec,
        extFuncs,
        hookBefores,
        hookAfters,
    })
    instWServWebdataServerExec.on('error', (err) => {
        ev.emit('error', err)
    })

    //useDbORM
    if (useDbORM) {

        //check
        if (!isobj(dbORMs)) {
            ev.emit('error', 'invalid opt.dbORMs when useDbORM=true')
            return ev
        }

        //WServWebdataServerSync
        instWServWebdataServerSync = new WServWebdataServerSync({
            instWConverServer,
            dbORMs,
            tableNames: tableNamesSync,
            fnTableTags,
        })
        instWServWebdataServerSync.on('error', (err) => {
            ev.emit('error', err)
        })

    }

    //save
    ev.getInstWServWebdataServerExec = () => {
        return instWServWebdataServerExec
    }
    ev.getInstWServWebdataServerSync = () => {
        return instWServWebdataServerSync
    }

    return ev
}


export default WServWebdataServer
