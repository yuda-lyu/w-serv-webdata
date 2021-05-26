import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
import WServWebdataClient from './src/WServWebdataClient.mjs'


//wcc
let wcc = WConverhpClient({
    //url: window.location.origin + window.location.pathname,
    url: 'http://localhost:9000',
})

//wsdc
let wsdc = WServWebdataClient({
    instWConverClient: wcc,
    cbGetToken: () => {
        return '' //Vue.prototype.$store.state.token
    },
    cbGetServerMethods: (r) => {
        console.log('cbGetServerMethods', r)
        //Vue.prototype.$fapi = r

        //select tabA
        r.tabA.select()
            .then((res) => {
                console.log('r.tabA.select then', res)
            })
            .catch((err) => {
                console.log('r.tabA.select catch', err)
            })

        //select tabB
        r.tabB.select()
            .then((res) => {
                console.log('r.tabB.select then', res)
            })
            .catch((err) => {
                console.log('r.tabB.select catch', err)
            })

    },
    cbRecvData: (r) => {
        console.log('sync data', r)
        //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
    },
})

//error
wsdc.on('error', (err) => {
    console.log('error', err)
})
// cbGetServerMethods {
//     tabA: { select: [AsyncFunction: f], save: [AsyncFunction: f] },
//     tabB: { select: [AsyncFunction: f], save: [AsyncFunction: f] }
// }
// r.tabA.select then [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 123 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
//     { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
// ]
// r.tabB.select then [
//     { id: 'id-tabB-peter', name: 'peter', value: 123 },
//     { id: 'id-tabB-rosemary', name: 'rosemary', value: 123.456 }
// ]
// sync data {
//     tableName: 'tabA',
//     timeTag: 'wpA9pN',
//     data: [
//         { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },    { id: 'id-tabA-peter', name: 'peter', value: 0.8214024045926114 },    { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },
//         { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//     ]
// }


//node --experimental-modules --es-module-specifier-resolution=node scla.mjs
