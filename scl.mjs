// import fs from 'fs'
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

//node scl.mjs
