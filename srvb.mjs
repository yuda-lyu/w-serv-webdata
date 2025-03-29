// import fs from 'fs'
// import _ from 'lodash-es'
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

    let wsds = new WServWebdataServer(
        wsrv,
        {
            funGetUserIdByToken: async (token) => { //可使用async或sync函數
                return 'id-for-admin'
            },
            useDbOrm: false, //不使用直接存取資料庫函數與自動同步資料庫至前端功能
            kpFunExt: { //接收參數第1個為userId, 之後才是前端給予參數
                execFunA,
                //...
            },
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


//node --experimental-modules srvb.mjs
