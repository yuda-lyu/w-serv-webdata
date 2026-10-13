import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import now2str from 'wsemi/src/now2str.mjs'
import genID from 'wsemi/src/genID.mjs'
import pickTables from './pickTables.mjs'


/**
 * 檢查資料同步之設定, 無副作用(不呼叫使用端函數、不掛監聽), 設定錯誤時拋錯
 *
 * @param {Array} tableNames 輸入同步表名陣列
 * @param {Object} kpOrm 輸入各資料表的操作物件
 * @returns {Boolean} 回傳是否需同步
 */
function checkOpt(tableNames, kpOrm) {

    //check tableNames
    if (size(tableNames) === 0) {
        //無同步表名, 不需要同步資料
        return false
    }

    //check kpOrm
    if (!iseobj(kpOrm)) {
        //無同步事件物件, 不需要同步資料
        return false
    }

    //check, 各同步表須有可監聽change事件之事件物件, 取值語意同下方掛監聽處(kpOrm[tableName])
    each(tableNames, (tableName) => {
        let ev = kpOrm[tableName]
        if (!ev) {
            throw new Error(`invalid kpOrm[${tableName}]`)
        }
        if (!isfun(ev.on)) {
            throw new Error(`kpOrm[${tableName}] can not listen to change events`)
        }
    })

    return true
}


function WServWebdataServerSync(instWConverServer, tableNames, kpOrm, opt = {}) {

    //check instWConverServer
    if (!iseobj(instWConverServer)) {
        throw new Error('invalid instWConverServer')
    }

    //checkOpt, 無同步表名或無同步事件物件時不需同步
    if (!checkOpt(tableNames, kpOrm)) {
        return instWConverServer
    }

    //genTag
    let genTag = get(opt, 'genTag')
    if (!isfun(genTag)) {
        genTag = () => {
            return now2str() + '|' + genID(6)
        }
    }

    //tableTagsSrv
    let tableTagsSrv = {}
    each(tableNames, (tableName) => {
        tableTagsSrv[tableName] = genTag()
    })
    // console.log('tableTagsSrv', tableTagsSrv)

    //check, 時間戳須為非空字串, 否則被pickTables濾除而前端永不同步; 於掛監聽與寫檔之前檢查
    each(tableTagsSrv, (v) => {
        if (!isestr(v)) {
            throw new Error('invalid opt.genTag')
        }
    })

    //對各tableName監聽change事件進行接入updateTableTag, 任一失敗即移除已掛者再拋錯, 不在使用端之ORM實體上留下監聽
    let hs = []
    try {
        each(tableNames, (tableName) => {
            let ev = kpOrm[tableName]
            let h = () => {
                instWConverServer.updateTableTag(tableName)
            }
            try {
                ev.on('change', h)
            }
            catch (err) {
                throw new Error(`kpOrm[${tableName}] can not listen to change events`)
            }
            hs.push({ ev, h })
        })
    }
    catch (err) {
        each(hs, ({ ev, h }) => {
            try {
                if (isfun(ev.removeListener)) {
                    ev.removeListener('change', h)
                }
                else if (isfun(ev.off)) {
                    ev.off('change', h)
                }
            }
            catch (errRemove) {} //盡力移除, 以原錯誤為準
        })
        throw err
    }

    //initTableTags, 全部監聽成功後才寫入時間戳檔
    instWConverServer.initTableTags(tableTagsSrv, 'useInputOnly')

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


export { checkOpt }
export default WServWebdataServerSync
