# w-serv-webdata
An operator for data control and synchronization between nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![license](https://img.shields.io/npm/l/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-serv-webdata/master/dist/w-serv-webdata-server.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-serv-webdata)
[![npm download](https://img.shields.io/npm/dt/w-serv-webdata.svg)](https://npmjs.org/package/w-serv-webdata) 
[![npm download](https://img.shields.io/npm/dm/w-serv-webdata.svg)](https://npmjs.org/package/w-serv-webdata)
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-serv-webdata.svg)](https://www.jsdelivr.com/package/npm/w-serv-webdata)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-serv-webdata/WServWebdataServer.html).

## Parts
`w-serv-webdata` includes 2 parts: 
* `w-serv-webdata-server`: for nodejs server
* `w-serv-webdata-client`: for nodejs and browser client

## Installation
### Using npm(ES6 module):
> **Note:** `w-serv-webdata-server` and `w-serv-webdata-client` is mainly dependent on `lodash-es`, `w-sync-webdata` and `wsemi`.

```alias
npm i w-serv-webdata
```

#### Example for w-serv-webdata-server:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srva.mjs)]
```alias
import fs from 'fs'
import _ from 'lodash-es'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選用ORM, 此處用mongodb示範
import WServWebdataServer from './src/WServWebdataServer.mjs'


async function run() {

    //optWOrm
    let optWOrm = {
        url: 'mongodb://username:password@127.0.0.1:27017',
        db: 'servdata',
        cl: '',
    }

    //tableNamesExec, tableNamesSync
    let tableNamesExec = ['tabA', 'tabB']
    let tableNamesSync = ['tabA']

    //woItems
    let woItems = {}
    for (let k in tableNamesExec) {
        let v = tableNamesExec[k]
        let opt = { ...optWOrm, cl: v }
        let wo = new WOrm(opt)
        woItems[v] = wo
    }

    async function saveData(cl, r) {

        //w
        let w = woItems[cl] //一定要由woItems操作, 否則傳woItems進去WServWebdataServer會無法收到change事件

        //save
        await w.save(r, { atomic: true }) //autoInsert: false
            .then(function(msg) {
                console.log('save then', cl, msg)
            })
            .catch(function(msg) {
                console.log('save catch', cl, msg)
            })

    }

    let r
    r = [
        {
            id: 'id-tabA-peter',
            name: 'peter',
            value: 123,
        },
        {
            id: 'id-tabA-rosemary',
            name: 'rosemary',
            value: 123.456,
        },
        {
            id: 'id-tabA-kettle',
            name: 'kettle',
            value: 456,
        },
    ]
    await saveData('tabA', r)
    r = [
        {
            id: 'id-tabB-peter',
            name: 'peter',
            value: 123,
        },
        {
            id: 'id-tabB-rosemary',
            name: 'rosemary',
            value: 123.456,
        },
    ]
    await saveData('tabB', r)

    let n = 0
    let tn = setInterval(() => {
        n++
        console.log('update tabA', n)
        r = {
            id: 'id-tabA-peter',
            name: 'peter',
            value: Math.random(),
        }
        saveData('tabA', r)
        if (n >= 5) {
            clearInterval(tn)
        }
    }, 3000)

    let wsrv = new WConverhpServer({
        port: 9000,
    })

    let procCommon = async (userId, tableName, methodName, input) => {
        // console.log('procCommon call', tableName, methodName, input)
        let r = await woItems[tableName][methodName](input)
        // console.log('procCommon result', r)
        return r
    }

    let uploadFile = async (userId, { name, u8a }) => {
        console.log('uploadFile', userId, name, _.size(u8a))
        fs.writeFileSync(name, Buffer.from(u8a))
        console.log('uploadFile writeFileSync finish')
        return 'finish'
    }

    let wsds = new WServWebdataServer({
        instWConverServer: wsrv,
        cbGetUserIDFromToken: async (token) => { //可使用async或sync函數
            return 'id-for-admin'
        },
        dbORMs: woItems,
        operORM: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
        tableNamesExec,
        tableNamesSync,
        extFuncs: { //接收參數第1個為userId, 之後才是前端給予參數
            uploadFile,
            // getUserFromID,
            // downloadFileFromID,
            // saveTableAndData,
            //...
        },
        hookBefores: null,
        hookAfters: null,
        // fnTableTags: 'tableTags-serv-webdata.json',
    })

    //error
    wsds.on('error', (err) => {
        console.log('error', err)
    })

}
run()
    .catch((err) => {
        console.log(err)
    })

// save then tabA [
//     { n: 1, nModified: 1, ok: 1 },
//     { n: 1, nModified: 1, ok: 1 },
//     { n: 1, nModified: 1, ok: 1 }
// ]
// save then tabB [ { n: 1, nModified: 1, ok: 1 }, { n: 1, nModified: 1, ok: 1 } ]
// Server running at: http://localhost:9000
// update tabA
// save then tabA [ { n: 1, nModified: 1, ok: 1 } ]
// repeat...
```

#### Example for w-serv-webdata-client:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/scla.mjs)]
```alias
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
        return '' //Vue.prototype.$store.state.userToken
    },
    cbGetServerMethods: (r) => {
        console.log('cbGetServerMethods', r)
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
    cbRecvData: (r) => {
        console.log('cbRecvData', r)
        //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
    },
    cbGetRefreshState: (r) => {
        console.log('cbGetRefreshState', 'needToRefresh', r.needToRefresh)
    },
    cbBeforeUpdateTableTags: (r) => {
        console.log('cbBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
    },
    cbAfterUpdateTableTags: (r) => {
        console.log('cbAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
    },
    cbBeforePollingTableTags: () => {
        console.log('cbBeforePollingTableTags')
    },
    cbAfterPollingTableTags: () => {
        console.log('cbAfterPollingTableTags')
    },
})

//error
wsdc.on('error', (err) => {
    console.log('error', err)
})

// cbGetServerMethods {
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
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag xzZGGa
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: 'xzZGGa',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 123 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:46+08:00|MneMQH
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:46+08:00|MneMQH',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.5847204423720489 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:49+08:00|qzQJQ4
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:49+08:00|qzQJQ4',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.9801109028960009 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:52+08:00|Cnk33i
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:52+08:00|Cnk33i',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.9667464984165397 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:55+08:00|wyFygc
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:55+08:00|wyFygc',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.311292348917773 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
// cbBeforeUpdateTableTags needToRefresh true
// cbGetRefreshState needToRefresh true
// cbGetRefreshTable tableName tabA timeTag 2022-03-02T16:40:58+08:00|Bd82vG
// cbRecvData {
//   tableName: 'tabA',
//   timeTag: '2022-03-02T16:40:58+08:00|Bd82vG',
//   data: [
//     { id: 'id-tabB-peter', name: 'peter', value: 0.6735191308795969 },
//     { id: 'id-tabA-peter', name: 'peter', value: 0.6912250899420782 },
//     { id: 'id-tabA-rosemary', name: 'rosemary', value: 123.456 },    { id: 'id-tabA-kettle', name: 'kettle', value: 456 }
//   ]
// }
// cbAfterUpdateTableTags needToRefresh false
```

### In a browser(UMD module):
> **Note:** `w-serv-webdata-client` does't depend on any package.

[Necessary] Add script for w-serv-webdata-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.32/dist/w-serv-webdata-client.umd.js"></script>
```

#### Example for w-serv-webdata-client:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/weba.html)]
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp/dist/w-converhp-client.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.32/dist/w-serv-webdata-client.umd.js"></script>

//wcc
let WConverhpClient = window['w-converhp-client']
let wcc = new WConverhpClient({
    url: 'http://localhost:9000',
})

//wsdc
let WServWebdataClient = window['w-serv-webdata-client']
let wsdc = WServWebdataClient({
    instWConverClient: wcc,
    cbGetToken: function() {
        return '' //Vue.prototype.$store.state.token
    },
    cbGetServerMethods: function(r) {
        console.log('cbGetServerMethods', r)
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
    cbRecvData: function(r) {
        console.log('sync data', r)
        //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
    },
})

//error
wsdc.on('error', function(err) {
    console.log('error', err)
})
```