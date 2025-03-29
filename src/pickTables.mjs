import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import isestr from 'wsemi/src/isestr.mjs'


let pickTables = (tableNames, nowTableTags) => {
    let r = {}
    each(tableNames, (v) => {
        let key = v
        let value = get(nowTableTags, v, '')
        if (isestr(value)) {
            r[key] = value
        }
    })
    return r
}


export default pickTables
