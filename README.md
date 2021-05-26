# w-serv-webdata
An operator for data control and synchronization between nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![Build Status](https://travis-ci.org/yuda-lyu/w-serv-webdata.svg?branch=master)](https://travis-ci.org/yuda-lyu/w-serv-webdata) 
[![license](https://img.shields.io/npm/l/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-serv-webdata/master/dist/w-serv-webdata-server.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-serv-webdata)
[![npm download](https://img.shields.io/npm/dt/w-serv-webdata.svg)](https://npmjs.org/package/w-serv-webdata) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-serv-webdata.svg)](https://www.jsdelivr.com/package/npm/w-serv-webdata)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-serv-webdata/WServWebdataServer.html).

## Parts
`w-serv-webdata` includes 2 parts: 
* `w-serv-webdata-server`: for nodejs server
* `w-serv-webdata-client`: for nodejs and browser client

## Installation
### Using npm(ES6 module):
> **Note:** `w-serv-webdata-server` and `w-serv-webdata-client` is mainly dependent on `lodash`, `w-sync-webdata` and `wsemi`.

```alias
npm i w-serv-webdata
```

#### Example for server:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srv.mjs)]
```alias
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs'
import WServWebdataServer from './src/WServWebdataServer.mjs'


async function run() {

    //optWOrm
    let optWOrm = {
        url: 'mongodb://username:password@localhost:27017',
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

    setInterval(() => {
        console.log('update tabA')
        r = {
            id: 'id-tabA-peter',
            name: 'peter',
            value: Math.random(),
        }
        saveData('tabA', r)
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

    let wsds = WServWebdataServer({
        instWConverServer: wsrv,
        cbGetUserIDFromToken: (token) => {
            return 'id-for-admin'
        },
        dbORMs: woItems,
        operORM: procCommon, //funORMProc的輸入為: userId, tableName, methodName, input
        tableNamesExec,
        tableNamesSync,
        extFuncs: {
        // getUserFromID,
        // downloadFileFromID,
        // saveTableAndData,
        },
        hookBefores: null,
        hookAfters: null,
    })
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
// Server running at: http://DESKTOP-5UNLNF8:9000
// update tabA
// save then tabA [ { n: 1, nModified: 1, ok: 1 } ]

```

#### Example for client:
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

```

### In a browser(UMD module):
> **Note:** `w-serv-webdata-client` does't depend on any package.

[Necessary] Add script for w-serv-webdata-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.7/dist/w-serv-webdata-client.umd.js"></script>
```

#### Example for w-serv-webdata-client:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/web.html)]
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp/dist/w-converhp-client.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.7/dist/w-serv-webdata-client.umd.js"></script>

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
        r.tabA.select()
            .then(function(res) {
                console.log('r.tabA.select then', res)
            })
            .catch(function(err) {
                console.log('r.tabA.select catch', err)
            })

        //select tabB
        r.tabB.select()
        .then(function(res) {
                console.log('r.tabB.select then', res)
            })
            .catch(function(err) {
                console.log('r.tabB.select catch', err)
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