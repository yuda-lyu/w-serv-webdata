# w-serv-webdata
An operator for data control and synchronization between nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![license](https://img.shields.io/npm/l/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
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
```alias
npm i w-serv-webdata
```

#### Example for w-serv-webdata-server:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srv.mjs)]
```alias
// import fs from 'fs'
import _ from 'lodash-es'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
// import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選擇引用ORM
import WOrm from 'w-orm-lowdb/src/WOrmLowdb.mjs' //自行選擇引用ORM
import WServWebdataServer from './src/WServWebdataServer.mjs'

let ms = []

//預先刪除w-orm-lowdb資料庫
try {
    fs.unlinkSync('./db.json')
}
catch (err) {}

//optWOrm
let optWOrm = {
    // url: 'mongodb://username:password@127.0.0.1:27017',
    // db: 'servdata',
    url: './db.json',
    db: 'servdata',
    cl: '',
}

//tableNamesExec, tableNamesSync
let tableNamesExec = ['tabA', 'tabB']
let tableNamesSync = ['tabA']

//kpOrm
let kpOrm = {}
for (let k in tableNamesExec) {
    let v = tableNamesExec[k]
    let opt = { ...optWOrm, cl: v }
    let wo = new WOrm(opt)
    kpOrm[v] = wo
}
// console.log('kpOrm', kpOrm)

//saveData
let saveData = async(cl, r) => {

    //w
    let w = kpOrm[cl] //一定要由kpOrm操作, 否則傳kpOrm進去WServWebdataServer會無法收到change事件
    console.log('saveData cl', cl, r)
    ms.push({ 'saveData before': { cl, data: JSON.stringify(r) } })

    //save
    await w.save(r, { autoInsert: true })
        .then(function(msg) {
            console.log('save then', cl, msg)
            ms.push({ 'saveData after': { cl, data: JSON.stringify(msg) } })
        })
        .catch(function(err) {
            console.log('save catch', cl, err)
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
console.log('saveData tabA')

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
console.log('saveData tabB')

let n = 0
let t = setInterval(async () => {
    n++
    console.log('update tabA', n)
    r = {
        id: 'id-tabA-peter',
        name: 'peter',
        value: `peter-n[${n}]`,
    }
    ms.push({ 'timer update tabA before': n, r })
    await saveData('tabA', r)
    ms.push({ 'timer update tabA after': n, r })
    if (n >= 5) {
        clearInterval(t)
    }
}, 2000)

let instWConverServer = new WConverhpServer({
    port: 9000,
})

let procCommon = async (userId, tableName, methodName, input) => {
    // console.log('procCommon call', tableName, methodName, input)
    let r = await kpOrm[tableName][methodName](input)
    // console.log('procCommon result', r)
    return r
}

instWConverServer = new WServWebdataServer(instWConverServer, {
    getUserIdByToken: async (token) => { //可使用async或sync函數
        return 'id-for-admin'
    },
    kpOrm,
    operOrm: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
    tableNamesExec,
    tableNamesSync,
    kpFunExt: { //接收參數第1個為userId, 之後才是前端給予參數
        uploadFile: async (userId, { name, u8a }) => {
            console.log('uploadFile', userId, name, _.size(u8a))
            ms.push({ 'uploadFile before': { name, size: _.size(u8a) } })
            // fs.writeFileSync(name, Buffer.from(u8a))
            ms.push({ 'uploadFile after': { name, size: _.size(u8a) } })
            console.log('uploadFile writeFileSync finish')
            return { name, size: _.size(u8a) }
        },
        add: (userId, input) => {
            console.log('add', input)
            let r = input.pa + input.pb
            ms.push({ 'kpFunExt add': { input: JSON.stringify(input), output: JSON.stringify(r) } })
            return r
        },
        //...
    },
    // fpTableTags: 'tableTags-serv-webdata.json',
})

//error
instWConverServer.on('error', (err) => {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverServer.clearBroadcast()
    instWConverServer.stop()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//     }
//   },
//   {
//     'saveData after': {
//       cl: 'tabA',
//       data: '[{"n":1,"nInserted":1,"ok":1},{"n":1,"nInserted":1,"ok":1},{"n":1,"nInserted":1,"ok":1}]'
//     }
//   },
//   {
//     'saveData before': {
//       cl: 'tabB',
//       data: '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//     }
//   },
//   {
//     'saveData after': {
//       cl: 'tabB',
//       data: '[{"n":1,"nInserted":1,"ok":1},{"n":1,"nInserted":1,"ok":1}]'
//     }
//   },
//   {
//     'timer update tabA before': 1,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[1]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 1,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
//   },
//   {
//     'timer update tabA before': 2,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[2]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 2,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
//   },
//   {
//     'timer update tabA before': 3,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[3]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 3,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
//   },
//   {
//     'timer update tabA before': 4,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[4]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 4,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
//   },
//   {
//     'timer update tabA before': 5,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[5]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 5,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
//   }
// ]
```

#### Example for w-serv-webdata-client in node.js:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srv.mjs)]
```alias
import FormData from 'form-data'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
import WServWebdataClient from './src/WServWebdataClient.mjs'

let ms = []

//instWConverClient
let instWConverClient = new WConverhpClient({
    FormData, //w-converhp的WConverhpClient, 於nodejs使用FormData需安裝套件並提供, 於browser就使用內建FormData故可不用給予
    //url: window.location.origin + window.location.pathname,
    url: 'http://localhost:9000',
})

//instWConverClient
instWConverClient = new WServWebdataClient(
    instWConverClient,
    {
        getToken: () => {
            return '' //Vue.prototype.$store.state.userToken
        },
        getServerMethods: (r) => {
            console.log('getServerMethods', r)
            //Vue.prototype.$fapi = r

            //$fapi
            let $fapi = r

            let core = async() => {

                //select tabA
                await $fapi.tabA.select(({ prog, p, m }) => {
                    console.log('select tabA', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabA.select then', res)
                        ms.push({ 'select tabA': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabA.select catch', err)
                    })

                //select tabB
                await $fapi.tabB.select(({ prog, p, m }) => {
                    console.log('select tabB', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabB.select then', res)
                        ms.push({ 'select tabB': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabB.select catch', err)
                    })

                //add
                ms.push({ 'call add before': '' })
                await $fapi.add({
                    pa: 1,
                    pb: 2.5,
                }, ({ prog, p, m }) => {
                    console.log('add', prog, p, m)
                })
                    .then((res) => {
                        console.log('add then', res)
                        ms.push({ 'call add after': res })
                    })
                    .catch((err) => {
                        console.log('add catch', err)
                    })

                //uploadFile
                ms.push({ 'call uploadFile before': '' })
                await $fapi.uploadFile({
                    name: 'zdata.b1',
                    u8a: new Uint8Array([66, 97, 115]),
                }, ({ prog, p, m }) => {
                    console.log('uploadFile', prog, p, m)
                })
                    .then((res) => {
                        console.log('uploadFile then', res)
                        ms.push({ 'call uploadFile after': res })
                    })
                    .catch((err) => {
                        console.log('uploadFile catch', err)
                    })

            }
            core()
                .catch(() => {})

        },
        recvData: (r) => {
            console.log('recvData', r)
            //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
        getRefreshState: (r) => {
            console.log('getRefreshState', 'needToRefresh', r.needToRefresh)
        },
        getRefreshTable: (r) => {
            console.log('getRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
        },
        getBeforeUpdateTableTags: (r) => {
            console.log('getBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
        getAfterUpdateTableTags: (r) => {
            console.log('getAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
    })

//error
instWConverClient.on('error', (err) => {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverClient.clearBroadcast()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//   },
//   {
//     'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//   },
//   { 'call add before': '' },
//   { 'call add after': 3.5 },
//   { 'call uploadFile before': '' },
//   { 'call uploadFile after': { name: 'zdata.b1', size: 3 } }
// ]
```

### In a browser(UMD module):
> **Note:** `w-serv-webdata-client` does't depend on any package.

[Necessary] Add script for w-serv-webdata-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.57/dist/w-serv-webdata-client.umd.js"></script>
```

#### Example for w-serv-webdata-client in web:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/web.html)]
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp/dist/w-converhp-client.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.0.57/dist/w-serv-webdata-client.umd.js"></script>

let ms = []

//instWConverClient
let WConverhpClient = window['w-converhp-client']

//instWConverClient
let WServWebdataClient = window['w-serv-webdata-client']

let instWConverClient = new WConverhpClient({
    // FormData,
    url: 'http://localhost:9000',
})

instWConverClient = new WServWebdataClient(
    instWConverClient,
    {
        getToken: () => {
            return '' //Vue.prototype.$store.state.token
        },
        getServerMethods: (r) => {
            console.log('getServerMethods', r)
            //Vue.prototype.$fapi = r
                
            //$fapi
            let $fapi = r

            let core = async() => {

                //select tabA
                await $fapi.tabA.select(({ prog, p, m }) => {
                    console.log('select tabA', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabA.select then', res)
                        ms.push({ 'select tabA': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabA.select catch', err)
                    })

                //select tabB
                await $fapi.tabB.select(({ prog, p, m }) => {
                    console.log('select tabB', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabB.select then', res)
                        ms.push({ 'select tabB': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabB.select catch', err)
                    })

                //add
                ms.push({ 'call add before': '' })
                await $fapi.add({
                    pa: 1,
                    pb: 2.5,
                }, ({ prog, p, m }) => {
                    console.log('add', prog, p, m)
                })
                    .then((res) => {
                        console.log('add then', res)
                        ms.push({ 'call add after': res })
                    })
                    .catch((err) => {
                        console.log('add catch', err)
                    })

                //uploadFile
                ms.push({ 'call uploadFile before': '' })
                await $fapi.uploadFile({
                    name: 'zdata.b1',
                    u8a: new Uint8Array([66, 97, 115]),
                }, ({ prog, p, m }) => {
                    console.log('uploadFile', prog, p, m)
                })
                    .then((res) => {
                        console.log('uploadFile then', res)
                        ms.push({ 'call uploadFile after': res })
                    })
                    .catch((err) => {
                        console.log('uploadFile catch', err)
                    })

            }
            core()
                .catch(() => {})

        },
        recvData: (r) => {
            console.log('sync data', r)
            //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
    }
)

//error
instWConverClient.on('error', function(err) {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverClient.clearBroadcast()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//   },
//   {
//     'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//   },
//   { 'call add before': '' },
//   { 'call add after': 3.5 },
//   { 'call uploadFile before': '' },
//   { 'call uploadFile after': { name: 'zdata.b1', size: 3 } }
// ]
```