import assert from 'assert'
import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'
import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選用ORM, 此處用mongodb示範
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


describe('servdata', function() {

    let msAll = []

    let runServer = async () => {

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
            // console.log('saveData cl', cl, r)
            ms.push({ 'saveData before': { cl, data: JSON.stringify(r) } })

            //save
            await w.save(r, { autoInsert: true })
                .then(function(msg) {
                    // console.log('save then', cl, msg)
                    ms.push({ 'saveData after': { cl, data: JSON.stringify(msg) } })
                })
                .catch(function() {
                    // console.log('save catch', cl, err)
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
        // console.log('saveData tabA')

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
        // console.log('saveData tabB')

        let n = 0
        let t = setInterval(async () => {
            n++
            // console.log('update tabA', n)
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
            // console.log('uploadFile', userId, name, _.size(u8a))
            ms.push({ 'uploadFile before': { name, size: _.size(u8a) } })
            // fs.writeFileSync(name, Buffer.from(u8a))
            ms.push({ 'uploadFile after': { name, size: _.size(u8a) } })
            // console.log('uploadFile writeFileSync finish')
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
                    // console.log('add', input)
                    let r = input.pa + input.pb
                    ms.push({ 'kpFunExt add': { input: JSON.stringify(input), output: JSON.stringify(r) } })
                    return r
                },
                //...
            },
            // fpTableTags: 'tableTags-serv-webdata.json',
        })

        //error
        instWConverServer.on('error', () => {
            // console.log('error', err)
        })

        //sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
        setTimeout(() => {
            instWConverServer.clearBroadcast()
            instWConverServer.stop()
            // console.log('ms', ms)
            msAll.push({ server: ms })
        }, 14000)

    }

    let runClient = () => {

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
                    // console.log('getServerMethods', r)
                    //Vue.prototype.$fapi = r

                    //$fapi
                    let $fapi = r

                    let core = async() => {

                        //select tabA
                        await $fapi.tabA.select(({ prog, p, m }) => {
                            // console.log('select tabA', prog, p, m)
                        })
                            .then((res) => {
                                // console.log('tabA.select then', res)
                                ms.push({ 'select tabA': JSON.stringify(res) })
                            })
                            .catch(() => {
                                // console.log('tabA.select catch', err)
                            })

                        //select tabB
                        await $fapi.tabB.select(({ prog, p, m }) => {
                            // console.log('select tabB', prog, p, m)
                        })
                            .then((res) => {
                                // console.log('tabB.select then', res)
                                ms.push({ 'select tabB': JSON.stringify(res) })
                            })
                            .catch(() => {
                                // console.log('tabB.select catch', err)
                            })

                        //add
                        ms.push({ 'call add before': '' })
                        await $fapi.add({
                            pa: 1,
                            pb: 2.5,
                        }, ({ prog, p, m }) => {
                            // console.log('add', prog, p, m)
                        })
                            .then((res) => {
                                // console.log('add then', res)
                                ms.push({ 'call add after': res })
                            })
                            .catch(() => {
                                // console.log('add catch', err)
                            })

                        //uploadFile
                        ms.push({ 'call uploadFile before': '' })
                        await $fapi.uploadFile({
                            name: 'zdata.b1',
                            u8a: new Uint8Array([66, 97, 115]),
                        }, ({ prog, p, m }) => {
                            // console.log('uploadFile', prog, p, m)
                        })
                            .then((res) => {
                                // console.log('uploadFile then', res)
                                ms.push({ 'call uploadFile after': res })
                            })
                            .catch(() => {
                                // console.log('uploadFile catch', err)
                            })

                    }
                    core()
                        .catch(() => {})

                },
                recvData: (r) => {
                    // console.log('recvData', r)
                    //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
                },
                getRefreshState: (r) => {
                    // console.log('getRefreshState', 'needToRefresh', r.needToRefresh)
                },
                getRefreshTable: (r) => {
                    // console.log('getRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
                },
                getBeforeUpdateTableTags: (r) => {
                    // console.log('getBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
                },
                getAfterUpdateTableTags: (r) => {
                    // console.log('getAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
                },
            })

        //error
        instWConverClient.on('error', () => {
            // console.log('error', err)
        })

        //sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
        setTimeout(() => {
            instWConverClient.clearBroadcast()
            // console.log('ms', ms)
            msAll.push({ client: ms })
        }, 14000)

    }

    let run = () => {
        let pm = w.genPm()
        runServer()
        runClient()
        setTimeout(() => {
            // console.log('msAll', JSON.stringify(msAll))
            fs.writeFileSync('./test_servdata.json', JSON.stringify(msAll), 'utf8')
            pm.resolve(msAll)
        }, 15000)
        return pm
    }

    let res = [{ 'client': [{ 'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":"peter-n[1]"},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]' }, { 'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]' }, { 'call add before': '' }, { 'call add after': 3.5 }, { 'call uploadFile before': '' }, { 'call uploadFile after': { 'name': 'zdata.b1', 'size': 3 } }] }, { 'server': [{ 'saveData before': { 'cl': 'tabA', 'data': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1}]' } }, { 'saveData before': { 'cl': 'tabB', 'data': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]' } }, { 'saveData after': { 'cl': 'tabB', 'data': '[{"n":1,"nModified":1,"ok":1},{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA before': 1, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[1]' } }, { 'saveData before': { 'cl': 'tabA', 'data': '{"id":"id-tabA-peter","name":"peter","value":"peter-n[1]"}' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA after': 1, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[1]' } }, { 'kpFunExt add': { 'input': '{"pa":1,"pb":2.5}', 'output': '3.5' } }, { 'uploadFile before': { 'name': 'zdata.b1', 'size': 3 } }, { 'uploadFile after': { 'name': 'zdata.b1', 'size': 3 } }, { 'timer update tabA before': 2, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[2]' } }, { 'saveData before': { 'cl': 'tabA', 'data': '{"id":"id-tabA-peter","name":"peter","value":"peter-n[2]"}' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA after': 2, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[2]' } }, { 'timer update tabA before': 3, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[3]' } }, { 'saveData before': { 'cl': 'tabA', 'data': '{"id":"id-tabA-peter","name":"peter","value":"peter-n[3]"}' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA after': 3, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[3]' } }, { 'timer update tabA before': 4, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[4]' } }, { 'saveData before': { 'cl': 'tabA', 'data': '{"id":"id-tabA-peter","name":"peter","value":"peter-n[4]"}' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA after': 4, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[4]' } }, { 'timer update tabA before': 5, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[5]' } }, { 'saveData before': { 'cl': 'tabA', 'data': '{"id":"id-tabA-peter","name":"peter","value":"peter-n[5]"}' } }, { 'saveData after': { 'cl': 'tabA', 'data': '[{"n":1,"nModified":1,"ok":1}]' } }, { 'timer update tabA after': 5, 'r': { 'id': 'id-tabA-peter', 'name': 'peter', 'value': 'peter-n[5]' } }] }]
    it(`should return ${res} when test`, async function() {
        let r = await run()
        let rr = res
        assert.strict.deepEqual(r, rr)
    })

})
