// import fs from 'fs'
import _ from 'lodash-es'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選用ORM, 此處用mongodb示範
import WServWebdataServer from './src/WServWebdataServer.mjs'


let ms = []

//optWOrm
let optWOrm = {
    url: 'mongodb://username:password@127.0.0.1:27017',
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

let uploadFile = async (userId, { name, u8a }) => {
    console.log('uploadFile', userId, name, _.size(u8a))
    ms.push({ 'uploadFile before': { name, size: _.size(u8a) } })
    // fs.writeFileSync(name, Buffer.from(u8a))
    ms.push({ 'uploadFile after': { name, size: _.size(u8a) } })
    console.log('uploadFile writeFileSync finish')
    return { name, size: _.size(u8a) }
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
        uploadFile,
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
//       data: '[{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1}]'
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
//       data: '[{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1}]'
//     }
//   },
//   { 'kpFunExt add': { input: '{"pa":1,"pb":2.5}', output: '3.5' } },
//   { 'uploadFile before': { name: 'zdata.b1', size: 3 } },
//   { 'uploadFile after': { name: 'zdata.b1', size: 3 } },
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


//node --experimental-modules srv.mjs
