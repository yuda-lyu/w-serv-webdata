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
 * @param {Function} [opt.getToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''
 * @param {Function} opt.getServerMethods 輸入提供操作物件的回調函數，前後端通訊先取得可呼叫函數清單，映射完之後，後端函數都將放入物件當中，key為函數名而值為函數，並通過回調函數提供該物件
 * @param {Function} opt.recvData 輸入取得變更表資料的回調函數
 * @returns {Object} 回傳事件物件，可監聽error事件
 * @example
 *
 * import FormData from 'form-data'
 * import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
 * import WServWebdataClient from './src/WServWebdataClient.mjs'
 *
 * let ms = []
 *
 * //instWConverClient
 * let instWConverClient = new WConverhpClient({
 *     FormData, //w-converhp的WConverhpClient, 於nodejs使用FormData需安裝套件並提供, 於browser就使用內建FormData故可不用給予
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

    //check
    if (!iseobj(instWConverClient)) {
        console.log('instWConverClient is not an effective object, and set instWConverClient to an EventEmitter')
        instWConverClient = evem()
    }
    if (!haskey(instWConverClient, 'emit')) {
        throw new Error(`instWConverClient is not an EventEmitter`)
    }

    //getToken
    let getToken = get(opt, 'getToken', null)
    if (!isfun(getToken)) {
        getToken = () => {
            return ''
        }
    }

    //getServerMethods
    let getServerMethods = get(opt, 'getServerMethods', null)
    if (!isfun(getServerMethods)) {
        instWConverClient.emit('error', 'invalid opt.getServerMethods')
        return instWConverClient
    }

    //recvData
    let recvData = get(opt, 'recvData', null)
    if (!isfun(recvData)) {
        instWConverClient.emit('error', 'invalid opt.recvData')
        return instWConverClient
    }

    //getRefreshState, getRefreshTable, getBeforeUpdateTableTags, getAfterUpdateTableTags
    let getRefreshState = get(opt, 'getRefreshState', null)
    let getRefreshTable = get(opt, 'getRefreshTable', null)
    let getBeforeUpdateTableTags = get(opt, 'getBeforeUpdateTableTags', null)
    let getAfterUpdateTableTags = get(opt, 'getAfterUpdateTableTags', null)

    //擴充同步資料功能
    instWConverClient = new WSyncWebdataClient(instWConverClient)

    //擴充廣播功能
    instWConverClient = new WServBroadcastClient(instWConverClient)

    function executeShell(func) {
        //通過instWConverClient.execute調用後端函數func
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
            let token = getToken()
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
        //將函數清單自動綁定至物件kpExec

        //kpExec
        kpExec = {}
        each(funcs, (func) => {
            set(kpExec, func, executeShell(func))
        })

        //getServerMethods
        getServerMethods(kpExec)

    }

    function updateSyncTable(data) {
        //當收到後端broadcast

        //check, 當mode='syncKpTable'代表為資料同步器發送訊息(各資料表時間戳), 調用instWConverClient.updateTableTags(傳入時間戳), 會觸發instWConverClient.refreshTable事件, 於內呼叫API來更新資料
        if (get(data, 'mode') === 'syncKpTable') {
            // console.log('syncKpTable', data)

            //updateTableTags
            instWConverClient.updateTableTags(get(data, 'data'))

        }

    }

    instWConverClient.on('openOnce', function() {
        // console.log('instWConverClient: openOnce')

        //core
        let core = async() => {

            //1.openOnce是第1次完成通過execute調用[sys:polling]後才會觸發
            //2.於openOnce內再通過execute調用[sys:getFuncList]後, 才能取得伺服器可用函數清單, 有orm可用函數清單才有辦法綁定kpExec, 才有辦法針對後端orm對應函數執行select撈取資料庫數據
            //3.updateSyncTable內是通過updateTableTags去觸發[w-sync-webdata的client]的refreshTable, refreshTable再通過kpExec[input.tableName].select()去撈資料庫資料
            //4.調用[sys:getFuncList]與[sys:getTableTags]不能保證回傳順序, 得要強制await

            //getFuncList, 取得可用函數清單
            let res = await executeShell('[sys:getFuncList]')()
            // console.log('[sys:getFuncList] res', res)

            //bindFuncs
            bindFuncs(res)

            //getTableTags, 取得同步資料
            let data = await executeShell('[sys:getTableTags]')()
            // console.log('[sys:getTableTags] data', data)

            //updateSyncTable, 啟動並連線成功後取得時間戳
            updateSyncTable(data)

        }

        //core
        core()
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
        if (isfun(getRefreshState)) {
            getRefreshState(msg)
        }
    })

    //refreshTable, 收到資料表時間戳有變更通知
    instWConverClient.on('refreshTable', (input) => {
        // console.log('refreshTable', input)

        //check
        if (!iseobj(kpExec[input.tableName])) {
            instWConverClient.emit('error', `invalid kpExec[${input.tableName}]`)
            return
        }

        //getRefreshTable
        if (isfun(getRefreshTable)) {
            getRefreshTable(input)
        }

        //exec
        let exec = get(kpExec, input.tableName)

        //check
        if (!iseobj(exec)) {
            console.log(`kpExec[${input.tableName}] is not an effective object`)
            return
        }

        //funSelect
        let funSelect = get(exec, 'select')

        //check
        if (!isfun(funSelect)) {
            console.log(`kpExec[${input.tableName}].select is not a function`)
            return
        }

        //select
        // console.log('getAPIData before: ', input.tableName)
        funSelect() //沒限制{isActive:'y'}, 後端須基於權限給予適合數據
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

        //recvData
        recvData(data)

    })

    //beforeUpdateTableTags, afterUpdateTableTags, beforePollingTableTags, afterPollingTableTags
    instWConverClient.on('beforeUpdateTableTags', (msg) => {
        // console.log('client: beforeUpdateTableTags', msg)
        if (isfun(getBeforeUpdateTableTags)) {
            getBeforeUpdateTableTags(msg)
        }
    })
    instWConverClient.on('afterUpdateTableTags', (msg) => {
        // console.log('client: afterUpdateTableTags', msg)
        if (isfun(getAfterUpdateTableTags)) {
            getAfterUpdateTableTags(msg)
        }
    })

    return instWConverClient
}


export default WServWebdataClient
