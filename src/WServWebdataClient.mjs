import get from 'lodash-es/get.js'
import set from 'lodash-es/set.js'
import each from 'lodash-es/each.js'
import last from 'lodash-es/last.js'
import dropRight from 'lodash-es/dropRight.js'
import genPm from 'wsemi/src/genPm.mjs'
import evem from 'wsemi/src/evem.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import WSyncWebdataClient from 'w-sync-webdata/src/WSyncWebdataClient.mjs'
import WServBroadcastClient from 'w-serv-broadcast/src/WServBroadcastClient.mjs'


/**
 * 瀏覽器端之資料控制與同步器
 *
 * @class
 * @param {Object} instWConverClient 輸入通訊服務實體物件，可使用例如WConverhpClient等建立
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Function} [opt.funGetToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''
 * @param {Function} opt.funGetServerMethods 輸入提供操作物件的回調函數，前後端通訊先取得可呼叫函數清單，映射完之後，後端函數都將放入物件當中，key為函數名而值為函數，並通過回調函數提供該物件
 * @param {Function} opt.funRecvData 輸入取得變更表資料的回調函數
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *
 * import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
 * import WServWebdataClient from './src/WServWebdataClient.mjs'
 *
 * //wcc
 * let wcc = new WConverhpClient({
 *     FormData, //w-converhp的WConverhpClient, 於nodejs使用FormData需安裝套件並提供, 於browser就使用內建FormData故可不用給予
 *     //url: window.location.origin + window.location.pathname,
 *     url: 'http://localhost:9000',
 * })
 *
 * //wsdc
 * let wsdc = new WServWebdataClient(
 *     wcc,
 *     {
 *         funGetToken: () => {
 *             return '' //Vue.prototype.$store.state.userToken
 *         },
 *         funGetServerMethods: (r) => {
 *             console.log('funGetServerMethods', r)
 *             //Vue.prototype.$fapi = r
 *
 *             //select tabA
 *             r.tabA.select(({ prog, p, m }) => {
 *                 console.log('select tabA', prog, p, m)
 *             })
 *                 .then((res) => {
 *                     console.log('r.tabA.select then', res)
 *                 })
 *                 .catch((err) => {
 *                     console.log('r.tabA.select catch', err)
 *                 })
 *
 *             //select tabB
 *             r.tabB.select(({ prog, p, m }) => {
 *                 console.log('select tabB', prog, p, m)
 *             })
 *                 .then((res) => {
 *                     console.log('r.tabB.select then', res)
 *                 })
 *                 .catch((err) => {
 *                     console.log('r.tabB.select catch', err)
 *                 })
 *
 *             //uploadFile
 *             r.uploadFile({
 *                 name: 'zdata.b1',
 *                 u8a: new Uint8Array([66, 97, 115]),
 *                 // u8a: new Uint8Array(fs.readFileSync('../_data/500mb.7z')), //最多500mb, 因測試使用w-converhp, 其依賴新版@hapi/pez無法處理1g檔案, 會出現: Invalid string length
 *             }, ({ prog, p, m }) => {
 *                 console.log('uploadFile', prog, p, m)
 *             })
 *
 *         },
 *         funRecvData: (r) => {
 *             console.log('funRecvData', r)
 *             //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
 *         },
 *         funGetRefreshState: (r) => {
 *             console.log('funGetRefreshState', 'needToRefresh', r.needToRefresh)
 *         },
 *         funGetRefreshTable: (r) => {
 *             console.log('funGetRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
 *         },
 *         funBeforeUpdateTableTags: (r) => {
 *             console.log('funBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
 *         },
 *         funAfterUpdateTableTags: (r) => {
 *             console.log('funAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
 *         },
 *     })
 *
 * //error
 * wsdc.on('error', (err) => {
 *     console.log('error', err)
 * })
 *
 * // funGetServerMethods {
 * //   tabA: {
 * //     select: [AsyncFunction: f],
 * //     insert: [AsyncFunction: f],
 * //     save: [AsyncFunction: f],
 * //     del: [AsyncFunction: f]
 * //   },
 * //   tabB: {
 * //     select: [AsyncFunction: f],
 * //     insert: [AsyncFunction: f],
 * //     save: [AsyncFunction: f],
 * //     del: [AsyncFunction: f]
 * //   },
 * //   uploadFile: [AsyncFunction: f]
 * // }
 * // r.tabB.select then [
 * //   { id: 'id-tabB-peter', name: 'peter', value: 123 },
 * //   { id: 'id-tabB-rosemary', name: 'rosemary', value: 123.456 }
 * // ]
 * // r.tabA.select then [
 * //   { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //   { id: 'id-tabA-peter', name: 'peter', value: 123 },
 * //   { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
 * //   { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * // ]
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag xzZGGa
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: 'xzZGGa',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 123 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:46+08:00|MneMQH
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: '2022-03-02T16:40:46+08:00|MneMQH',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 0.5847204423720489 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:49+08:00|qzQJQ4
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: '2022-03-02T16:40:49+08:00|qzQJQ4',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 0.9801109028960009 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:52+08:00|Cnk33i
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: '2022-03-02T16:40:52+08:00|Cnk33i',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 0.9667464984165397 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:55+08:00|wyFygc
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: '2022-03-02T16:40:55+08:00|wyFygc',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 0.311292348917773 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 * // funBeforeUpdateTableTags needToRefresh true
 * // funGetRefreshState needToRefresh true
 * // funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:58+08:00|Bd82vG
 * // funRecvData {
 * //   tableName: 'tabA',
 * //   timeTag: '2022-03-02T16:40:58+08:00|Bd82vG',
 * //   data: [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 0.6912250899420782 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //   ]
 * // }
 * // funAfterUpdateTableTags needToRefresh false
 *
 */
function WServWebdataClient(instWConverClient, opt = {}) {
    let execs = {}

    //check
    if (!iseobj(instWConverClient)) {
        console.log('instWConverClient is not an effective object, and set instWConverClient to an EventEmitter')
        instWConverClient = evem()
    }
    if (!haskey(instWConverClient, 'emit')) {
        throw new Error(`instWConverClient is not an EventEmitter`)
    }

    //funGetToken
    let funGetToken = get(opt, 'funGetToken', null)
    if (!isfun(funGetToken)) {
        funGetToken = () => {
            return ''
        }
    }

    //funGetServerMethods
    let funGetServerMethods = get(opt, 'funGetServerMethods', null)
    if (!isfun(funGetServerMethods)) {
        instWConverClient.emit('error', 'invalid opt.funGetServerMethods')
        return instWConverClient
    }

    //funRecvData
    let funRecvData = get(opt, 'funRecvData', null)
    if (!isfun(funRecvData)) {
        instWConverClient.emit('error', 'invalid opt.funRecvData')
        return instWConverClient
    }

    //funGetRefreshState
    let funGetRefreshState = get(opt, 'funGetRefreshState', null)
    let funGetRefreshTable = get(opt, 'funGetRefreshTable', null)
    let funBeforeUpdateTableTags = get(opt, 'funBeforeUpdateTableTags', null)
    let funAfterUpdateTableTags = get(opt, 'funAfterUpdateTableTags', null)

    //擴充同步資料功能
    instWConverClient = new WSyncWebdataClient(instWConverClient)

    //擴充廣播功能
    instWConverClient = new WServBroadcastClient(instWConverClient)

    function executeShell(func) {
        //通過instWConverClient.execute調用後端函數
        async function f() {

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

            //token
            let token = funGetToken()
            if (ispm(token)) {
                token = await token
            }

            //check, 若允許undefined會導致傳輸input時欄位__sysToken__消失, 故強制取代為空字串
            if (!isestr(token)) {
                token = ''
            }

            //input
            let input = { __sysInputArgs__: args, __sysToken__: token }

            //execute
            await instWConverClient.execute(func, input, fprog)
                .then((r) => {
                    // console.log('instWConverClient.execute then', r)
                    let res = r.msg
                    if (r.state === 'success') {
                        pm.resolve(res)
                    }
                    else {
                        pm.reject(res)
                    }
                })
                .catch((err) => {
                    // console.log('instWConverClient.execute catch', err)
                    pm.reject(err)
                })

            return pm
        }
        return f
    }

    function bindFuncs(funcs) {
        //將函數清單自動綁定至物件execs

        //execs
        execs = {}
        each(funcs, (func) => {
            set(execs, func, executeShell(func))
        })

        //funGetServerMethods
        funGetServerMethods(execs)

    }

    function updateSyncTable(data) {
        //當收到後端broadcast

        //check, 當mode='syncKpTable'代表為資料同步器發送訊息(各資料表時間戳), 調用wsdc.updateTableTags(傳入時間戳), 會觸發wsdc.refreshTable事件, 於內呼叫API來更新資料
        if (get(data, 'mode') === 'syncKpTable') {
            // console.log('syncKpTable', data)

            //updateTableTags
            instWConverClient.updateTableTags(get(data, 'data'))

        }

    }

    instWConverClient.on('openOnce', function() {
        // console.log('instWConverClient: openOnce')

        //getFuncList, 取得可用函數清單
        executeShell('[sys:getFuncList]')()
            .then((res) => {
                // console.log('[sys:getFuncList] res', res)

                //bindFuncs
                bindFuncs(res)

            })
            .catch((err) => {
                instWConverClient.emit('error', err)
            })

        //getFuncList, 取得同步資料
        executeShell('[sys:getTableTags]')()
            .then((data) => {
                // console.log('[sys:getTableTags] data', data)

                //updateSyncTable, 啟動並連線成功後取得時間戳
                updateSyncTable(data)

            })
            .catch((err) => {
                instWConverClient.emit('error', err)
            })

    })

    instWConverClient.on('broadcast', function(data) {
        // console.log('instWConverClient: broadcast', data)

        //updateSyncTable
        updateSyncTable(data)

    })

    // //setTableTags, 前端先不暫存時間戳於localStorage
    // instWConverClient.setTableTags(tableTagsCl)

    //refreshState
    instWConverClient.on('refreshState', (msg) => {
        // console.log('refreshState needToRefresh', msg.needToRefresh)
        if (isfun(funGetRefreshState)) {
            funGetRefreshState(msg)
        }
    })

    //refreshTable, 收到資料表時間戳有變更通知
    instWConverClient.on('refreshTable', (input) => {
        // console.log('refreshTable', input)

        //check
        if (!iseobj(execs[input.tableName])) {
            instWConverClient.emit('error', `invalid execs[${input.tableName}]`)
            return
        }

        //funGetRefreshTable
        if (isfun(funGetRefreshTable)) {
            funGetRefreshTable(input)
        }

        //select, 通過$fapi來取資料
        // console.log('getAPIData before: ', input.tableName)
        execs[input.tableName].select()
            .then((data) => {
                // console.log('getAPIData after: ', input.tableName, data)
                input.pm.resolve(data)
            })
            .catch((err) => {
                console.log(`${input.tableName}.select: catch`, err)
                input.pm.resolve([]) //refreshTable內通過pm回傳, 發生非預期錯誤用resolve回傳避免自動同步中斷
            })

    })

    //getData
    instWConverClient.on('getData', (data) => {
        // console.log('getData', data)

        //funRecvData
        funRecvData(data)

    })

    //beforeUpdateTableTags, afterUpdateTableTags, beforePollingTableTags, afterPollingTableTags
    instWConverClient.on('beforeUpdateTableTags', (msg) => {
        // console.log('client: beforeUpdateTableTags', msg)
        if (isfun(funBeforeUpdateTableTags)) {
            funBeforeUpdateTableTags(msg)
        }
    })
    instWConverClient.on('afterUpdateTableTags', (msg) => {
        // console.log('client: afterUpdateTableTags', msg)
        if (isfun(funAfterUpdateTableTags)) {
            funAfterUpdateTableTags(msg)
        }
    })

    return instWConverClient
}


export default WServWebdataClient
