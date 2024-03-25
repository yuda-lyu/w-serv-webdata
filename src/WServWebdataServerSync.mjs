import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import isarr from 'wsemi/src/isarr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import genID from 'wsemi/src/genID.mjs'
import evem from 'wsemi/src/evem.mjs'
import WSyncWebdataServer from 'w-sync-webdata/src/WSyncWebdataServer.mjs'


function WServWebdataServerSync(opt = {}) {

    //ev
    let ev = evem()

    //instWConverServer, 由外部提供通訊服務實體, 例如WConverhpServer等
    let instWConverServer = get(opt, 'instWConverServer', null)
    if (instWConverServer === null) {
        ev.emit('error', 'invalid opt.instWConverServer')
        return ev
    }

    //dbORMs, 輸入外部ORM實體
    let dbORMs = get(opt, 'dbORMs', null)
    if (!isobj(dbORMs)) {
        ev.emit('error', 'invalid opt.dbORMs')
        return ev
    }

    //tableNames, 指定需同步表名, 機敏資訊表記得過濾, 各表名需隸屬於ORM, 才能監聽其change事件
    let tableNames = get(opt, 'tableNames', null)
    if (!isarr(tableNames)) {
        ev.emit('error', 'invalid opt.tableNames')
        return ev
    }

    //check
    if (size(tableNames) === 0) {
        console.log('opt.tableNames.lenght = 0')
    }

    //fnTableTags
    let fnTableTags = get(opt, 'fnTableTags', null)
    if (!isestr(fnTableTags)) {
        fnTableTags = 'tableTags.json'
    }

    //wsds
    let wsds = new WSyncWebdataServer({ fnTableTags })

    //cloneDeep
    tableNames = cloneDeep(tableNames)

    //tableTagsSrv
    let tableTagsSrv = {}
    each(tableNames, (tableName) => {
        tableTagsSrv[tableName] = genID(6)
    })

    //initTableTags
    wsds.initTableTags(tableTagsSrv, 'useInputOnly')

    //對各ORM註冊監聽change事件
    each(tableNames, (tableName) => {
        let dbOrm = dbORMs[tableName]
        if (dbOrm) {
            dbOrm.on('change', () => {
                wsds.updateTableTag(tableName)
            })
        }
        else {
            throw new Error(`invalid dbORMs.${tableName}`)
        }
    })

    instWConverServer.on('clientEnter', function(clientId, data) {
        //console.log('clientEnter', clientId)

        //deliver, 使用者第1次瀏覽時推播時間戳
        instWConverServer.deliver(clientId, {
            mode: 'syncTable',
            data: wsds.readTableTags(),
        })

    })

    //pickTables
    function pickTables(tables) {
        let r = {}
        each(tableNames, (v) => {
            let key = v
            let value = tables[v]
            r[key] = value
        })
        return r
    }

    //changeTableTags
    wsds.on('changeTableTags', (nowTableTags) => {
        //console.log('changeTableTags', nowTableTags)

        //broadcast, 資料有更新時對全部人推播時間戳
        instWConverServer.broadcast({
            mode: 'syncTable',
            data: pickTables(nowTableTags),
        })

    })

    return wsds
}


export default WServWebdataServerSync
