// import fs from 'fs'
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

        //execFunA
        r.execFunA({
            pa: 1,
            pb: 2.5,
        }, ({ prog, p, m }) => {
            console.log('execFunA', prog, p, m)
        })
            .then((res) => {
                console.log('execFunA then', res)
            })
            .catch((err) => {
                console.log('execFunA catch', err)
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
//     execFunA: [AsyncFunction: f]
// }
// execFunA then result: pa+pb=3.5

//node --experimental-modules --es-module-specifier-resolution=node sclb.mjs
