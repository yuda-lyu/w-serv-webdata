// import fs from 'fs'
import FormData from 'form-data'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios與form-data都不適合執行於nodejs, 故需引用原程式碼執行
import WServWebdataClient from './src/WServWebdataClient.mjs'


//wcc
let wcc = WConverhpClient({
    FormData, //w-converhp的WConverhpClient, 於nodejs使用FormData需安裝套件並提供, 於browser就使用內建FormData故可不用給予
    //url: window.location.origin + window.location.pathname,
    url: 'http://localhost:9000',
})

//wsdc
let wsdc = WServWebdataClient(
    wcc,
    {
        funGetToken: () => {
            return '' //Vue.prototype.$store.state.userToken
        },
        funGetServerMethods: (r) => {
            console.log('funGetServerMethods', r)
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
        funRecvData: (r) => {
            console.log('funRecvData', r)
        //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
    })

//error
wsdc.on('error', (err) => {
    console.log('error', err)
})
// funGetServerMethods {
//     execFunA: [AsyncFunction: f]
// }
// execFunA then result: pa+pb=3.5

//node --experimental-modules sclb.mjs
