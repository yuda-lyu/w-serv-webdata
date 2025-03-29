import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'
import iseobj from 'wsemi/src/iseobj.mjs'
import now2str from 'wsemi/src/now2str.mjs'
import genID from 'wsemi/src/genID.mjs'
import pickTables from './pickTables.mjs'


function WServWebdataServerSync(instWConverServer, tableNames, kpOrm, opt = {}) {

    //check instWConverServer
    if (!iseobj(instWConverServer)) {
        throw new Error('invalid instWConverServer')
    }

    //check tableNames
    if (size(tableNames) === 0) {
        //無同步表名, 不需要同步資料
        return instWConverServer
    }

    //check kpOrm
    if (!iseobj(kpOrm)) {
        //無同步事件物件, 不需要同步資料
        return instWConverServer
    }

    //tableTagsSrv
    let tableTagsSrv = {}
    each(tableNames, (tableName) => {
        tableTagsSrv[tableName] = `${now2str()}:${genID(10)}` //啟動時用時間與隨機字串初始化, 視為皆有變更須同步
    })
    // console.log('tableTagsSrv', tableTagsSrv)

    //initTableTags
    instWConverServer.initTableTags(tableTagsSrv, 'useInputOnly')

    //對各tableName監聽change事件進行接入updateTableTag
    each(tableNames, (tableName) => {
        let ev = kpOrm[tableName]
        if (ev) {
            try {
                ev.on('change', () => {
                    instWConverServer.updateTableTag(tableName)
                })
            }
            catch (err) {
                throw new Error(`kpOrm[${tableName}] can not listen to change events`)
            }
        }
        else {
            throw new Error(`invalid kpOrm[${tableName}]`)
        }
    })

    //changeTableTags
    instWConverServer.on('changeTableTags', (nowTableTags) => {
        //console.log('changeTableTags', nowTableTags)

        //broadcast, 資料有更新時對全部人推播時間戳
        instWConverServer.broadcast({
            mode: 'syncKpTable',
            data: pickTables(tableNames, nowTableTags),
        })

    })

    return instWConverServer
}


export default WServWebdataServerSync
