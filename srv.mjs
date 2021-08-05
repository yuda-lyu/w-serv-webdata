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
        cbGetUserIDFromToken: async (token) => { //可使用async或sync函數
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
// Server running at: http://localhost:9000
// update tabA
// save then tabA [ { n: 1, nModified: 1, ok: 1 } ]
// repeat...


//node --experimental-modules --es-module-specifier-resolution=node srv.mjs
