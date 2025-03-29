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

    //kpOrm
    let kpOrm = {}
    for (let k in tableNamesExec) {
        let v = tableNamesExec[k]
        let opt = { ...optWOrm, cl: v }
        let wo = new WOrm(opt)
        kpOrm[v] = wo
    }
    // console.log('kpOrm', kpOrm)

    async function saveData(cl, r) {

        //w
        let w = kpOrm[cl] //一定要由kpOrm操作, 否則傳kpOrm進去WServWebdataServer會無法收到change事件
        console.log('cl=', cl)

        //save
        await w.save(r, { autoInsert: true, atomic: true })
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
    console.log('saveData tabA before')
    await saveData('tabA', r)
    console.log('saveData tabA after')
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
        let r = await kpOrm[tableName][methodName](input)
        // console.log('procCommon result', r)
        return r
    }

    let uploadFile = async (userId, { name, u8a }) => {
        console.log('uploadFile', userId, name, _.size(u8a))
        fs.writeFileSync(name, Buffer.from(u8a))
        console.log('uploadFile writeFileSync finish')
        return 'finish'
    }

    let wsds = new WServWebdataServer(wsrv, {
        getUserIdByToken: async (token) => { //可使用async或sync函數
            return 'id-for-admin'
        },
        kpOrm,
        operOrm: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
        tableNamesExec,
        tableNamesSync,
        kpFunExt: { //接收參數第1個為userId, 之後才是前端給予參數
            uploadFile,
            // getUserFromID,
            // downloadFileFromID,
            // saveTableAndData,
            //...
        },
        // fpTableTags: 'tableTags-serv-webdata.json',
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


//node --experimental-modules srva.mjs
