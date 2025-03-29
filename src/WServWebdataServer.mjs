import get from 'lodash-es/get.js'
import haskey from 'wsemi/src/haskey.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import evem from 'wsemi/src/evem.mjs'
import WSyncWebdataServer from 'w-sync-webdata/src/WSyncWebdataServer.mjs'
import WServBroadcastServer from 'w-serv-broadcast/src/WServBroadcastServer.mjs'
import pickTables from './pickTables.mjs'
import WServWebdataServerSync from './WServWebdataServerSync.mjs'
import WServWebdataServerExec from './WServWebdataServerExec.mjs'


/**
 * 伺服器端之資料控制與同步器
 *
 * @class
 * @param {Object} instWConverServer 輸入通訊服務實體物件，可使用例如WConverhpServer等建立
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Boolean} [opt.useDbOrm=true] 輸入是否使用資料庫ORM技術，給予false代表不使用直接存取資料庫函數與自動同步資料庫至前端功能，預設true
 * @param {Object} [opt.kpOrm={}] 輸入各資料表的操作物件，用以提供由tableNamesSync指定資料表的change事件，使能監聽與觸發資料變更事件，key為表名而值為該表的操作器實體，操作器實體可使用例如WOrmMongodb等建立，預設{}
 * @param {Function} [opt.operOrm={}] 輸入各資料表的操作通用接口物件，用以提供操作由tableNamesExec指定資料表的例如'select'、'insert'、'save'、'del'函數。加上由kpFunExt提供的函數，就為全部可由前端執行的函數，預設{}
 * @param {Array} [opt.tableNamesExec=[]] 輸入指定能被操作的表名陣列，預設[]
 * @param {Array} [opt.tableNamesSync=[]] 輸入指定能被同步的表名陣列，預設[]
 * @param {Array} [opt.methodsExec=['select','insert','save','del']] 輸入指定綁定操作器的方式陣列，可選'select'、'insert'、'save'、'del'、'delAll'，預設['select', 'insert', 'save', 'del']
 * @param {Function} [opt.getUserIdByToken=async ()=>''] 輸入取得使用者ID的回調函數，傳入參數為各函數的原始參數，預設async ()=>''
 * @param {Object} [opt.kpFunExt=null] 輸入額外擴充執行函數物件，key為函數名而值為函數，預設null
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *

 * // repeat...
 *
 */
function WServWebdataServer(instWConverServer, opt = {}) {

    //check
    if (!iseobj(instWConverServer)) {
        console.log('instWConverServer is not an effective object, and set instWConverServer to an EventEmitter')
        instWConverServer = evem()
    }
    if (!haskey(instWConverServer, 'emit')) {
        throw new Error(`instWConverServer is not an EventEmitter`)
    }

    //fpTableTags
    let fpTableTags = get(opt, 'fpTableTags', null)
    if (!isestr(fpTableTags)) {
        fpTableTags = './tableTags.json'
    }

    //擴充同步資料功能
    instWConverServer = new WSyncWebdataServer(instWConverServer, { fpTableTags })

    //擴充廣播功能
    instWConverServer = new WServBroadcastServer(instWConverServer)

    //useDbOrm
    let useDbOrm = get(opt, 'useDbOrm', null)
    if (!isbol(useDbOrm)) {
        useDbOrm = true
    }

    //kpOrm, 輸入外部ORM實體
    let kpOrm = get(opt, 'kpOrm', null)

    //operOrm, ORM的泛用接口procCommon
    let operOrm = get(opt, 'operOrm', null)

    //tableNamesExec, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理
    let tableNamesExec = get(opt, 'tableNamesExec', null)

    //methodsExec
    let methodsExec = get(opt, 'methodsExec', null)

    //tableNamesSync, 指定需同步表名, 機敏資訊表記得過濾, 各表名需隸屬於ORM, 才能監聽其change事件
    let tableNamesSync = get(opt, 'tableNamesSync', null)

    //getUserIdByToken, 由外部提供呼叫函數, 將提供各函數的輸入用以取得使用userID
    let getUserIdByToken = get(opt, 'getUserIdByToken', null)

    //kpFunExt
    let kpFunExt = get(opt, 'kpFunExt', null)
    if (!iseobj(kpFunExt)) {
        kpFunExt = {}
    }

    //提供同步資料[sys:getTableTags]函數
    kpFunExt = {
        ...kpFunExt,
        '[sys:getTableTags]': () => {
            let nowTableTags = instWConverServer.getTableTags()
            // console.log('nowTableTags', nowTableTags)
            return {
                mode: 'syncKpTable',
                data: pickTables(tableNamesSync, nowTableTags),
            }
        },
    }

    //WServWebdataServerExec
    instWConverServer = new WServWebdataServerExec(
        instWConverServer,
        {
            getUserIdByToken,
            useDbOrm,
            operOrm,
            tableNames: tableNamesExec,
            methods: methodsExec,
            kpFunExt,
        },
    )
    instWConverServer.on('error', (err) => {
        instWConverServer.emit('error', err)
    })

    //useDbOrm
    if (useDbOrm) {

        //check
        if (!isobj(kpOrm)) {
            instWConverServer.emit('error', 'invalid opt.kpOrm when useDbOrm=true')
            return instWConverServer
        }

        //WServWebdataServerSync
        instWConverServer = new WServWebdataServerSync(
            instWConverServer,
            tableNamesSync,
            kpOrm,
        )
        instWConverServer.on('error', (err) => {
            instWConverServer.emit('error', err)
        })

    }

    return instWConverServer
}


export default WServWebdataServer
