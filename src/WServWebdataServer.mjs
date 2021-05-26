import get from 'lodash/get'
import isarr from 'wsemi/src/isarr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import evem from 'wsemi/src/evem.mjs'
import WServWebdataServerSync from './WServWebdataServerSync.mjs'
import WServWebdataServerExec from './WServWebdataServerExec.mjs'


/**
 * 伺服器端之資料控制與同步器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Object} opt.instWConverServer 輸入通訊服務實體物件，可使用例如WConverhpServer等建立
 * @param {Object} opt.dbORMs 輸入各資料表的操作物件，用以提供由tableNamesSync指定資料表的change事件，使能監聽與觸發資料變更事件，key為表名而值為該表的操作器實體，操作器實體可使用例如WOrmMongodb等建立
 * @param {Function} opt.operORM 輸入各資料表的操作通用接口，用以提供操作由tableNamesExec指定資料表的'select'與'save'函數。加上由extFuncs提供的函數，就為全部可由前端執行的函數
 * @param {Array} opt.tableNamesExec 輸入指定能被操作的表名陣列
 * @param {Array} opt.tableNamesSync 輸入指定能被同步的表名陣列
 * @param {Function} [opt.cbGetUserIDFromToken=()=>''] 輸入取得使用者ID的回調函數，傳入參數為各函數的原始參數，預設()=>''
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
 *     cbGetUserIDFromToken: () => {
 *         return 'id-for-admin'
 *     },
 *     dbORMs: woItems,
 *     operORM: procCommon, //funORMProc的輸入為: userId, tableName, methodName, input
 *     tableNamesExec,
 *     tableNamesSync,
 *     extFuncs: {
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

    //ev
    let ev = evem()

    //instWConverServer, 由外部提供通訊服務實體, 例如WConverhpServer等
    let instWConverServer = get(opt, 'instWConverServer', null)
    if (instWConverServer === null) {
        ev.emit('error', 'invalid opt.instWConverServer')
        return ev
    }

    //dbORMs, 輸入外部ORM實體
    let dbORMs = get(opt, 'dbORMs', null)
    if (!isobj(dbORMs)) {
        ev.emit('error', 'invalid opt.dbORMs')
        return ev
    }

    //operORM, ORM的泛用接口funORMProc
    let operORM = get(opt, 'operORM', null)
    if (!isfun(operORM)) {
        ev.emit('error', 'invalid opt.operORM')
        return ev
    }

    //tableNamesExec, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口funORMProc處理
    let tableNamesExec = get(opt, 'tableNamesExec', null)
    if (!isarr(tableNamesExec)) {
        ev.emit('error', 'invalid opt.tableNamesExec')
        return ev
    }

    //tableNamesSync, 指定需同步表名, 機敏資訊表記得過濾, 各表名需隸屬於ORM, 才能監聽其change事件
    let tableNamesSync = get(opt, 'tableNamesSync', null)
    if (!isarr(tableNamesSync)) {
        ev.emit('error', 'invalid opt.tableNamesSync')
        return ev
    }

    //cbGetUserIDFromToken, 由外部提供呼叫函數, 將提供各函數的輸入用以取得使用userID
    let cbGetUserIDFromToken = get(opt, 'cbGetUserIDFromToken', null)

    //extFuncs
    let extFuncs = get(opt, 'extFuncs', null)

    //hookBefores
    let hookBefores = get(opt, 'hookBefores', null)

    //hookAfters
    let hookAfters = get(opt, 'hookAfters', null)

    //WServWebdataServerExec
    let wsde = WServWebdataServerExec({
        instWConverServer,
        cbGetUserIDFromToken,
        operORM,
        tableNames: tableNamesExec,
        extFuncs,
        hookBefores,
        hookAfters,
    })
    wsde.on('error', (err) => {
        ev.emit('error', err)
    })

    //WServWebdataServerSync
    let wsds = WServWebdataServerSync({
        instWConverServer,
        dbORMs,
        tableNames: tableNamesSync,
    })
    wsds.on('error', (err) => {
        ev.emit('error', err)
    })

    return ev
}


export default WServWebdataServer