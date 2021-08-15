import get from 'lodash/get'
import set from 'lodash/set'
import each from 'lodash/each'
import last from 'lodash/last'
import dropRight from 'lodash/dropRight'
import genPm from 'wsemi/src/genPm.mjs'
import evem from 'wsemi/src/evem.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import WSyncWebdataClient from 'w-sync-webdata/src/WSyncWebdataClient.mjs'


/**
 * 瀏覽器端之資料控制與同步器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Object} opt.instWConverClient 輸入通訊服務實體物件，可使用例如WConverhpClient等建立
 * @param {Function} [opt.cbGetToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''
 * @param {Function} opt.cbGetServerMethods 輸入提供操作物件的回調函數，前後端通訊先取得可呼叫函數清單，映射完之後，後端函數都將放入物件當中，key為函數名而值為函數，並通過回調函數提供該物件
 * @param {Function} opt.cbRecvData 輸入取得變更表資料的回調函數
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *
 * import WConverhpClient from 'w-converhp/dist/w-converhp-client.umd.js'
 * import WServWebdataClient from 'w-serv-webdata/dist/w-serv-webdata-client.umd.js'
 *
 * //wcc
 * let wcc = WConverhpClient({...})
 *
 * //wsdc
 * let wsdc = WServWebdataClient({
 *     instWConverClient: wcc,
 *     cbGetToken: () => {
 *         return '' //Vue.prototype.$store.state.userToken
 *     },
 *     cbGetServerMethods: (r) => {
 *         console.log('cbGetServerMethods', r)
 *         //Vue.prototype.$fapi = r
 *
 *         //select tabA
 *         r.tabA.select(({ prog, p, m }) => {
 *             console.log('select tabA', prog, p, m)
 *         })
 *             .then((res) => {
 *                 console.log('r.tabA.select then', res)
 *             })
 *             .catch((err) => {
 *                 console.log('r.tabA.select catch', err)
 *             })
 *
 *         //select tabB
 *         r.tabB.select(({ prog, p, m }) => {
 *             console.log('select tabB', prog, p, m)
 *         })
 *             .then((res) => {
 *                 console.log('r.tabB.select then', res)
 *             })
 *             .catch((err) => {
 *                 console.log('r.tabB.select catch', err)
 *             })
 *
 *         //uploadFile
 *         r.uploadFile({
 *             name: 'zdata.b1',
 *             u8a: new Uint8Array([66, 97, 115]),
 *             // u8a: new Uint8Array(fs.readFileSync('../_data/500mb.7z')), //最多500mb, 因測試使用w-converhp, 其依賴新版@hapi/pez無法處理1g檔案, 會出現: Invalid string length
 *         }, ({ prog, p, m }) => {
 *             console.log('uploadFile', prog, p, m)
 *         })
 *
 *     },
 *     cbRecvData: (r) => {
 *         console.log('sync data', r)
 *         //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
 *     },
 * })
 *
 * //error
 * wsdc.on('error', (err) => {
 *     console.log('error', err)
 * })
 * // cbGetServerMethods {
 * //     tabA: { select: [AsyncFunction: f], save: [AsyncFunction: f] },
 * //     tabB: { select: [AsyncFunction: f], save: [AsyncFunction: f] }
 * // }
 * // r.tabA.select then [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
 * //     { id: 'id-tabA-peter', name: 'peter', value: 123 },
 * //     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
 * //     { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * // ]
 * // r.tabB.select then [
 * //     { id: 'id-tabB-peter', name: 'peter', value: 123 },
 * //     { id: 'id-tabB-rosemary', name: 'rosemary', value: 123.456 }
 * // ]
 * // sync data {
 * //     tableName: 'tabA',
 * //     timeTag: 'wpA9pN',
 * //     data: [
 * //         { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },    { id: 'id-tabA-peter', name: 'peter', value: 0.8214024045926114 },    { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
 * //         { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
 * //     ]
 * // }
 *
 */
function WServWebdataClient(opt = {}) {
    let execs = {}

    //ev
    let ev = evem()

    //instWConverClient
    let instWConverClient = get(opt, 'instWConverClient', null)
    if (instWConverClient === null) {
        ev.emit('error', 'invalid opt.instWConverClient')
        return ev
    }

    //cbGetToken
    let _cbGetToken = get(opt, 'cbGetToken', null)
    if (!isfun(_cbGetToken)) {
        _cbGetToken = () => {
            return ''
        }
    }
    let cbGetToken = () => {
        let token = _cbGetToken()
        if (token === undefined) {
            token = ''
        }
        return token
    }

    //cbGetServerMethods
    let cbGetServerMethods = get(opt, 'cbGetServerMethods', null)
    if (!isfun(cbGetServerMethods)) {
        ev.emit('error', 'invalid opt.cbGetServerMethods')
        return ev
    }

    //cbRecvData
    let cbRecvData = get(opt, 'cbRecvData', null)
    if (!isfun(cbRecvData)) {
        ev.emit('error', 'invalid opt.cbRecvData')
        return ev
    }

    //wsdc
    let wsdc = WSyncWebdataClient()

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

            //input
            let input = { __sysInputArgs__: args, __sysToken__: cbGetToken() }

            //execute
            await instWConverClient.execute(func, input,
                function (prog, p, m) {
                    fprog({ prog, p, m })
                })
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

        //cbGetServerMethods
        cbGetServerMethods(execs)

    }

    instWConverClient.on('openOnce', function() {
        // console.log('instWConverClient: openOnce')

        //getFuncList, 取得可用函數清單
        executeShell('getFuncList')()
            .then((res) => {
                bindFuncs(res)
            })
            .catch((err) => {
                ev.emit('error', err)
            })

    })

    function updateSyncTable(data) {
        //當收到後端broadcast與deliver時

        //check, 當mode='syncTable'代表為資料同步器發送訊息(各資料表時間戳), 調用wsdc.updateTableTags(傳入時間戳), 會觸發wsdc.refreshTable事件, 於內呼叫API來更新資料
        if (get(data, 'mode') === 'syncTable') {

            //updateTableTags
            wsdc.updateTableTags(get(data, 'data'))

        }

    }

    instWConverClient.on('broadcast', function(data) {
        // console.log('instWConverClient: broadcast', data)

        //updateSyncTable
        updateSyncTable(data)

    })

    instWConverClient.on('deliver', function(data) { //使用者第1次瀏覽時會用deliver推播時間戳
        // console.log('instWConverClient: deliver', data)

        //updateSyncTable
        updateSyncTable(data)

    })

    // //setTableTags, 前端先不暫存時間戳於localStorage
    // wsdc.setTableTags(tableTagsCl)

    //refreshTable, 收到資料表時間戳有變更通知
    wsdc.on('refreshTable', (input) => {
        // console.log('refreshTable', input)

        //check
        if (!iseobj(execs[input.tableName])) {
            ev.emit('error', `無法存取${input.tableName}資料表`)
            return
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
            })

    })

    //getData
    wsdc.on('getData', (data) => {
        // console.log('getData', data)

        //cbRecvData
        cbRecvData(data)

    })

    //error
    wsdc.on('error', (err) => {
        ev.emit('error', err)
    })

    return ev
}


export default WServWebdataClient