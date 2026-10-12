import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import evem from 'wsemi/src/evem.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import now2str from 'wsemi/src/now2str.mjs'
import genID from 'wsemi/src/genID.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import WSyncWebdataServer from 'w-sync-webdata/src/WSyncWebdataServer.mjs'
import WServBroadcastServer from 'w-serv-broadcast/src/WServBroadcastServer.mjs'
import pickTables from './pickTables.mjs'
import WServWebdataServerSync from './WServWebdataServerSync.mjs'
import WServWebdataServerExec from './WServWebdataServerExec.mjs'


/**
 * 伺服器端之資料控制與同步器
 *
 * 資料通道(useDbOrm=true時開啟)開放給前端呼叫之函數有三類：表操作(由tableNamesExec與methodsExec組成，例如'tabA.select')、kpFunExt、系統函數。前端每次呼叫依序經過getUserIdByToken(取得userId)、authorizeExec(僅表操作)，再執行operOrm或kpFunExt之函數。授權與拒絕之規則如下：
 *
 * 1. 資料通道是資料表直接開放給前端之處，表操作之授權在此，由authorizeExec負責。採預設拒絕，回傳值須嚴格等於true才放行，回傳其他值(例如false、1、'true'、undefined)一律回應'permission denied'且不呼叫operOrm。operOrm可能亦被伺服端程式呼叫而分不出呼叫來源，故不負責授權。kpFunExt之函數不經authorizeExec，須各自把關。
 * 2. 各關卡(getUserIdByToken、authorizeExec、operOrm、kpFunExt之函數)拋錯或reject時，其值原樣成為前端收到之拒絕值，故欲回傳語系鍵須reject字串，Error物件經序列化後前端收到'Error: 訊息'字串。各關卡之回傳值與拒絕值須為可序列化之格式，此為設計要求，不支援之格式(例如循環參照、BigInt)本就不在設計範圍內，前端必然失敗。
 * 3. 僅getUserIdByToken之拒絕會發出error事件(其值可能為undefined或null)；authorizeExec、operOrm與kpFunExt之拒絕不發出error事件，需於伺服端紀錄者請於函數內自行處理。
 * 4. authorizeExec只能放行或拒絕整次呼叫，無法逐筆過濾資料或限制欄位。同步資料時前端呼叫select不帶參數，故tableNamesSync內之表其select須對所有連線者放行，否則前端該表會被清空。需逐筆控管可見範圍者請改用kpFunExt提供。
 * 5. authorizeExec收到之input與傳給operOrm者為同一物件，僅供判斷，不支援修改。授權與operOrm之執行非原子操作。methodsExec含'mix'時，允許mix等同允許該表之新增、修改與刪除。
 * 6. getUserIdByToken須完整驗證token(不可只解碼)，其token取自請求內容，與通訊層(例如w-converhp之verifyConn)所驗證者為不同來源。getUserIdByToken或authorizeExec不結束(promise不settle)時，該次請求將懸置。
 * 7. 函數名須能被前端綁定(前端以lodash之set依函數名綁定)：路徑各段不得為'__proto__'、'constructor'、'prototype'；kpFunExt不得以'[sys:'開頭；kpFunExt之頂層名不得為表名(例如表名為'tabA'時，'tabA'、'tabA.count'、'tabA[select]'皆不可)。違反者於建構時拋錯。
 * 8. 設定錯誤於建構時拋錯，拋錯前會先停止廣播之計時器。設定錯誤包含：useDbOrm=true而缺operOrm、tableNamesExec、authorizeExec，或kpOrm非物件，或methodsExec有給但非陣列；未指定useDbOrm(非布林值)卻給了operOrm、tableNamesExec、methodsExec、authorizeExec、kpOrm或tableNamesSync。
 *
 * @class
 * @param {Object} instWConverServer 輸入通訊服務實體物件，可使用例如WConverhpServer等建立
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Boolean} [opt.useDbOrm=false] 輸入是否使用資料庫ORM技術，給予true代表開啟資料通道(前端可直接呼叫由tableNamesExec與methodsExec組成之表操作，例如'tabA.select')與自動同步資料庫至前端功能，此時operOrm、tableNamesExec、authorizeExec為必填，未給或無效時拋錯。未指定(非布林值)卻給了operOrm、tableNamesExec、methodsExec、authorizeExec、kpOrm或tableNamesSync時拋錯，預設false
 * @param {Object} [opt.kpOrm={}] 輸入各資料表的操作物件，用以提供由tableNamesSync指定資料表的change事件，使能監聽與觸發資料變更事件，key為表名而值為該表的操作器實體，操作器實體可使用例如WOrmMongodb等建立，useDbOrm為true時須為物件，否則拋錯，預設{}
 * @param {Function} [opt.operOrm={}] 輸入各資料表的操作通用接口物件，用以提供操作由tableNamesExec指定資料表的例如'select'、'insert'、'save'、'del'函數。加上由kpFunExt提供的函數，就為全部可由前端執行的函數。前端呼叫表操作時須先通過authorizeExec授權才會呼叫operOrm，operOrm不負責授權，預設{}
 * @param {Array} [opt.tableNamesExec=[]] 輸入指定能被操作的表名陣列，預設[]
 * @param {Array} [opt.tableNamesSync=[]] 輸入指定能被同步的表名陣列，預設[]
 * @param {Array} [opt.methodsExec=['select','insert','save','del']] 輸入指定綁定操作器的方式陣列，可選'select'、'insert'、'save'、'del'、'delAll'，useDbOrm為true時若有給須為陣列，否則拋錯，預設['select', 'insert', 'save', 'del']
 * @param {Function} [opt.authorizeExec=null] 輸入資料表操作之授權函數，useDbOrm為true時必填，未給或非函數時拋錯。前端呼叫表操作時，會於呼叫operOrm之前傳入物件{ userId, tableName, methodName, input }，可使用sync或async函數，回傳值須嚴格等於true才放行。userId為getUserIdByToken所得，取不到時為空字串，宜拒絕；methodName為methodsExec所列之方法，宜以白名單判斷，其中'mix'之input可含多筆操作須自行解析，規則詳見上方說明，預設null
 * @param {Function} [opt.getUserIdByToken=async()=>''] 輸入取得使用者ID的回調函數，傳入參數為前端提供之token字串，可使用sync或async函數，回傳非字串時視為空字串，拋錯或reject時拒絕該次呼叫，規則詳見上方說明，預設async()=>''
 * @param {Object} [opt.kpFunExt=null] 輸入額外擴充執行函數物件，key為函數名而值為函數，函數第1參數為userId(取不到時為空字串)，之後為前端給予之參數。kpFunExt之函數不經authorizeExec須各自把關，命名限制詳見上方說明，預設null
 * @param {String} [opt.fpTableTags='tableTags.json'] 輸入儲存各資料表時間戳檔案路徑串，預設'./tableTags.json'
 * @param {Function} [opt.genTag=()=>'{random string}'] 輸入產生不重複識別碼函數，預設()=>'{random string}'
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *
 * // import fs from 'fs'
 * import _ from 'lodash-es'
 * import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
 * // import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選擇引用ORM
 * import WOrm from 'w-orm-lowdb/src/WOrmLowdb.mjs' //自行選擇引用ORM
 * import WServWebdataServer from './src/WServWebdataServer.mjs'
 *
 * let ms = []
 *
 * //預先刪除w-orm-lowdb資料庫
 * try {
 *     fs.unlinkSync('./db.json')
 * }
 * catch (err) {}
 *
 * //optWOrm
 * let optWOrm = {
 *     // url: 'mongodb://username:password@127.0.0.1:27017',
 *     // db: 'servdata',
 *     url: './db.json',
 *     db: 'servdata',
 *     cl: '',
 * }
 *
 * //tableNamesExec, tableNamesSync
 * let tableNamesExec = ['tabA', 'tabB']
 * let tableNamesSync = ['tabA']
 *
 * //kpOrm
 * let kpOrm = {}
 * for (let k in tableNamesExec) {
 *     let v = tableNamesExec[k]
 *     let opt = { ...optWOrm, cl: v }
 *     let wo = new WOrm(opt)
 *     kpOrm[v] = wo
 * }
 * // console.log('kpOrm', kpOrm)
 *
 * //saveData
 * let saveData = async(cl, r) => {
 *
 *     //w
 *     let w = kpOrm[cl] //一定要由kpOrm操作, 否則傳kpOrm進去WServWebdataServer會無法收到change事件
 *     console.log('saveData cl', cl, r)
 *     ms.push({ 'saveData before': { cl, data: JSON.stringify(r) } })
 *
 *     //save
 *     await w.save(r, { autoInsert: true })
 *         .then(function(msg) {
 *             console.log('save then', cl, msg)
 *             ms.push({ 'saveData after': { cl, data: JSON.stringify(msg) } })
 *         })
 *         .catch(function(err) {
 *             console.log('save catch', cl, err)
 *         })
 *
 * }
 *
 * let r
 *
 * r = [
 *     {
 *         id: 'id-tabA-peter',
 *         name: 'peter',
 *         value: 123,
 *     },
 *     {
 *         id: 'id-tabA-rosemary',
 *         name: 'rosemary',
 *         value: 123.456,
 *     },
 *     {
 *         id: 'id-tabA-kettle',
 *         name: 'kettle',
 *         value: 456,
 *     },
 * ]
 *
 * await saveData('tabA', r)
 * console.log('saveData tabA')
 *
 * r = [
 *     {
 *         id: 'id-tabB-peter',
 *         name: 'peter',
 *         value: 123,
 *     },
 *     {
 *         id: 'id-tabB-rosemary',
 *         name: 'rosemary',
 *         value: 123.456,
 *     },
 * ]
 *
 * await saveData('tabB', r)
 * console.log('saveData tabB')
 *
 * let n = 0
 * let t = setInterval(async () => {
 *     n++
 *     console.log('update tabA', n)
 *     r = {
 *         id: 'id-tabA-peter',
 *         name: 'peter',
 *         value: `peter-n[${n}]`,
 *     }
 *     ms.push({ 'timer update tabA before': n, r })
 *     await saveData('tabA', r)
 *     ms.push({ 'timer update tabA after': n, r })
 *     if (n >= 5) {
 *         clearInterval(t)
 *     }
 * }, 2000)
 *
 * let instWConverServer = new WConverhpServer({
 *     port: 9000,
 * })
 *
 * let procCommon = async (userId, tableName, methodName, input) => {
 *     // console.log('procCommon call', tableName, methodName, input)
 *     let r = await kpOrm[tableName][methodName](input)
 *     // console.log('procCommon result', r)
 *     return r
 * }
 *
 * instWConverServer = new WServWebdataServer(instWConverServer, {
 *     getUserIdByToken: async (token) => { //可使用async或sync函數
 *         return 'id-for-admin'
 *     },
 *     useDbOrm: true, //開啟資料通道, 此時operOrm、tableNamesExec、authorizeExec為必填
 *     kpOrm,
 *     operOrm: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
 *     tableNamesExec,
 *     tableNamesSync,
 *     authorizeExec: async ({ userId, tableName, methodName, input }) => { //可使用async或sync函數, 預設拒絕, 回傳嚴格等於true才放行
 *         if (userId !== 'id-for-admin') {
 *             return false //取不到使用者(空字串)或非允許之使用者一律拒絕
 *         }
 *         return methodName === 'select' //此範例只開放前端讀取, 寫入一律拒絕
 *     },
 *     kpFunExt: { //接收參數第1個為userId, 之後才是前端給予參數
 *         uploadFile: async (userId, { name, u8a }) => {
 *             console.log('uploadFile', userId, name, _.size(u8a))
 *             ms.push({ 'uploadFile before': { name, size: _.size(u8a) } })
 *             // fs.writeFileSync(name, Buffer.from(u8a))
 *             ms.push({ 'uploadFile after': { name, size: _.size(u8a) } })
 *             console.log('uploadFile writeFileSync finish')
 *             return { name, size: _.size(u8a) }
 *         },
 *         add: (userId, input) => {
 *             console.log('add', input)
 *             let r = input.pa + input.pb
 *             ms.push({ 'kpFunExt add': { input: JSON.stringify(input), output: JSON.stringify(r) } })
 *             return r
 *         },
 *         //...
 *     },
 *     // fpTableTags: 'tableTags-serv-webdata.json',
 * })
 *
 * //error
 * instWConverServer.on('error', (err) => {
 *     console.log('error', err)
 * })
 *
 * //sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
 * setTimeout(() => {
 *     instWConverServer.clearBroadcast()
 *     instWConverServer.stop()
 *     console.log('ms', ms)
 * }, 14000)
 * // => ms [
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': {
 * //       cl: 'tabA',
 * //       data: '[{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1}]'
 * //     }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabB',
 * //       data: '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': {
 * //       cl: 'tabB',
 * //       data: '[{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1}]'
 * //     }
 * //   },
 * //   {
 * //     'timer update tabA before': 1,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[1]"}'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
 * //   },
 * //   {
 * //     'timer update tabA after': 1,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
 * //   },
 * //   {
 * //     'timer update tabA before': 2,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[2]"}'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
 * //   },
 * //   {
 * //     'timer update tabA after': 2,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
 * //   },
 * //   {
 * //     'timer update tabA before': 3,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[3]"}'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
 * //   },
 * //   {
 * //     'timer update tabA after': 3,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
 * //   },
 * //   {
 * //     'timer update tabA before': 4,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[4]"}'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
 * //   },
 * //   {
 * //     'timer update tabA after': 4,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
 * //   },
 * //   {
 * //     'timer update tabA before': 5,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
 * //   },
 * //   {
 * //     'saveData before': {
 * //       cl: 'tabA',
 * //       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[5]"}'
 * //     }
 * //   },
 * //   {
 * //     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
 * //   },
 * //   {
 * //     'timer update tabA after': 5,
 * //     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
 * //   }
 * // ]
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

    //genTag
    let genTag = get(opt, 'genTag')
    if (!isfun(genTag)) {
        genTag = () => {
            return now2str() + '|' + genID(6)
        }
    }

    //擴充同步資料功能
    instWConverServer = new WSyncWebdataServer(instWConverServer, {
        fpTableTags,
        genTag, //供updateTableTag使用
    })

    //擴充廣播功能
    instWConverServer = new WServBroadcastServer(instWConverServer)

    //useDbOrm, 預設false, 開啟資料通道須由使用端明確指定, 開啟時operOrm、tableNamesExec、authorizeExec為必填
    let useDbOrm = get(opt, 'useDbOrm', null)
    let useDbOrmGiven = isbol(useDbOrm)
    if (!useDbOrmGiven) {
        useDbOrm = false
    }

    //kpOrm, 輸入外部ORM實體
    let kpOrm = get(opt, 'kpOrm', null)

    //operOrm, ORM的泛用接口procCommon
    let operOrm = get(opt, 'operOrm', null)

    //tableNamesExec, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理
    let tableNamesExec = get(opt, 'tableNamesExec', null)

    //methodsExec
    let methodsExec = get(opt, 'methodsExec', null)

    //authorizeExec, 表操作之授權函數, 預設拒絕, 回傳嚴格等於true才放行
    let authorizeExec = get(opt, 'authorizeExec', null)

    //tableNamesSync, 指定需同步表名, 機敏資訊表記得過濾, 各表名需隸屬於ORM, 才能監聽其change事件
    let tableNamesSync = get(opt, 'tableNamesSync', null)

    //getUserIdByToken, 由外部提供呼叫函數, 將提供各函數的輸入用以取得使用userID
    let getUserIdByToken = get(opt, 'getUserIdByToken', null)

    //kpFunExt
    let kpFunExt = get(opt, 'kpFunExt', null)
    if (!iseobj(kpFunExt)) {
        kpFunExt = {}
    }

    //kpFunSys, 提供同步資料[sys:getTableTags]函數, 與使用端之kpFunExt分開傳入, 使kpFunExt之命名檢查不涉及系統函數
    let kpFunSys = {
        '[sys:getTableTags]': () => {
            let nowTableTags = instWConverServer.getTableTags()
            // console.log('nowTableTags', nowTableTags)
            return {
                mode: 'syncKpTable',
                data: pickTables(tableNamesSync, nowTableTags),
            }
        },
    }

    //設定錯誤時拋錯, 拋錯前先停止廣播之計時器, 否則呼叫端攔下錯誤後程序仍被計時器撐住而無法結束
    try {

        //check, 未指定useDbOrm(非布林)卻給了資料通道或資料同步之設定時拋錯, 否則該些設定會因useDbOrm預設false而靜默不生效
        if (!useDbOrmGiven) {
            let kpOptDbOrm = { operOrm, tableNamesExec, methodsExec, authorizeExec, kpOrm, tableNamesSync }
            each(kpOptDbOrm, (v, k) => {
                if (v !== null) {
                    throw new Error(`invalid opt.useDbOrm when opt.${k} is given`)
                }
            })
        }

        //check, useDbOrm=true時kpOrm須為物件, 於建立資料通道之前檢查
        if (useDbOrm && !isobj(kpOrm)) {
            throw new Error('invalid opt.kpOrm when useDbOrm=true')
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
                authorizeExec,
                kpFunExt,
                kpFunSys,
            },
        )

        //useDbOrm
        if (useDbOrm) {

            //WServWebdataServerSync
            instWConverServer = new WServWebdataServerSync(
                instWConverServer,
                tableNamesSync,
                kpOrm,
                {
                    genTag, //供初始化tableTagsSrv用
                },
            )

        }

    }
    catch (err) {
        instWConverServer.clearBroadcast()
        throw err
    }

    return instWConverServer
}


export default WServWebdataServer
