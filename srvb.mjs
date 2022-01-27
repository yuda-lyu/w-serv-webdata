// import fs from 'fs'
// import _ from 'lodash'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WServWebdataServer from './src/WServWebdataServer.mjs'


async function run() {

    let wsrv = new WConverhpServer({
        port: 9000,
    })

    let execFunA = async (userId, { pa, pb }) => {
        // console.log('execFunA', userId, pa, pb)
        return `result: pa+pb=${pa + pb}`
    }

    let wsds = WServWebdataServer({
        instWConverServer: wsrv,
        cbGetUserIDFromToken: async (token) => { //可使用async或sync函數
            return 'id-for-admin'
        },
        useDbORM: false, //不使用直接存取資料庫函數與自動同步資料庫至前端功能
        extFuncs: { //接收參數第1個為userId, 之後才是前端給予參數
            execFunA,
            //...
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


//node --experimental-modules --es-module-specifier-resolution=node srvb.mjs
