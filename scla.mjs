// import fs from 'fs'
import FormData from 'form-data'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
import WServWebdataClient from './src/WServWebdataClient.mjs'


//wcc
let wcc = WConverhpClient({
    FormData, //w-converhp的WConverhpClient, 於nodejs使用FormData需安裝套件並提供, 於browser就使用內建FormData故可不用給予
    //url: window.location.origin + window.location.pathname,
    url: 'http://localhost:9000',
})

//wsdc
let wsdc = WServWebdataClient(
    wcc,
    {
        funGetToken: () => {
            return '' //Vue.prototype.$store.state.userToken
        },
        funGetServerMethods: (r) => {
            console.log('funGetServerMethods', r)
            //Vue.prototype.$fapi = r

            //select tabA
            r.tabA.select(({ prog, p, m }) => {
                console.log('select tabA', prog, p, m)
            })
                .then((res) => {
                    console.log('r.tabA.select then', res)
                })
                .catch((err) => {
                    console.log('r.tabA.select catch', err)
                })

            //select tabB
            r.tabB.select(({ prog, p, m }) => {
                console.log('select tabB', prog, p, m)
            })
                .then((res) => {
                    console.log('r.tabB.select then', res)
                })
                .catch((err) => {
                    console.log('r.tabB.select catch', err)
                })

            //uploadFile
            r.uploadFile({
                name: 'zdata.b1',
                u8a: new Uint8Array([66, 97, 115]),
                // u8a: new Uint8Array(fs.readFileSync('../_data/500mb.7z')), //最多500mb, 因測試使用w-converhp, 其依賴新版@hapi/pez無法處理1g檔案, 會出現: Invalid string length
            }, ({ prog, p, m }) => {
                console.log('uploadFile', prog, p, m)
            })

        },
        funRecvData: (r) => {
            console.log('funRecvData', r)
            //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
        funGetRefreshState: (r) => {
            console.log('funGetRefreshState', 'needToRefresh', r.needToRefresh)
        },
        funGetRefreshTable: (r) => {
            console.log('funGetRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
        },
        funBeforeUpdateTableTags: (r) => {
            console.log('funBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
        funAfterUpdateTableTags: (r) => {
            console.log('funAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
    })

//error
wsdc.on('error', (err) => {
    console.log('error', err)
})

// funGetServerMethods {
//   tabA: {
//     select: [AsyncFunction: f],
//     insert: [AsyncFunction: f],
//     save: [AsyncFunction: f],
//     del: [AsyncFunction: f]
//   },
//   tabB: {
//     select: [AsyncFunction: f],
//     insert: [AsyncFunction: f],
//     save: [AsyncFunction: f],
//     del: [AsyncFunction: f]
//   },
//   uploadFile: [AsyncFunction: f]
// }
// r.tabB.select then [
//   { id: 'id-tabB-peter', name: 'peter', value: 123 },
//   { id: 'id-tabB-rosemary', name: 'rosemary', value: 123.456 }
// ]
// r.tabA.select then [
//   { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//   { id: 'id-tabA-peter', name: 'peter', value: 123 },
//   { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
//   { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
// ]
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag xzZGGa
// funRecvData {
//   tableName: 'tabA',
//   timeTag: 'xzZGGa',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 123 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:46+08:00|MneMQH
// funRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:46+08:00|MneMQH',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.5847204423720489 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:49+08:00|qzQJQ4
// funRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:49+08:00|qzQJQ4',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.9801109028960009 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:52+08:00|Cnk33i
// funRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:52+08:00|Cnk33i',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.9667464984165397 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:55+08:00|wyFygc
// funRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:55+08:00|wyFygc',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.311292348917773 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false
// funBeforeUpdateTableTags needToRefresh true
// funGetRefreshState needToRefresh true
// funGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:58+08:00|Bd82vG
// funRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:58+08:00|Bd82vG',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.6912250899420782 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// funAfterUpdateTableTags needToRefresh false

//node --experimental-modules scla.mjs
