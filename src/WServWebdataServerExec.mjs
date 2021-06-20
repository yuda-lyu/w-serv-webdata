import get from 'lodash/get'
import each from 'lodash/each'
import size from 'lodash/size'
import keys from 'lodash/keys'
import cloneDeep from 'lodash/cloneDeep'
import isobj from 'wsemi/src/isobj.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import evem from 'wsemi/src/evem.mjs'
import pm2resolve from 'wsemi/src/pm2resolve.mjs'


let useFuncs = {}
let cbGetUserIDFromToken = null


function buildFuncs(tableNames, methods, operORM) {
    let funcs = {}

    //存取[ORM]資料表函數
    each(tableNames, (tableName) => { //通過ds取得資料表清單
        each(methods, (methodName) => {

            //pathName, 各資料表之各ORM方法
            let pathName = `${tableName}.${methodName}`

            //bind
            funcs[pathName] = async function(userId, input) { //第1參數需為userId

                //呼叫ORM的泛用接口funORMProc
                let r = await operORM(userId, tableName, methodName, input)

                return r
            }

        })
    })

    return funcs
}


async function execFun({ func, input, pm }) {
    // console.log('execFun', func, input)

    //get token, 將內部token提出
    let token = ''
    if (!haskey(input, '__sysToken__')) {
        pm.resolve({ state: 'error', msg: 'invalid token' })
        return pm //提前離開
    }
    token = cstr(input.__sysToken__)

    //get input, 將內部sysInput提出
    if (!haskey(input, '__sysInputArgs__')) {
        pm.resolve({ state: 'error', msg: 'invalid input' })
        return pm //提前離開
    }
    input = input.__sysInputArgs__

    //cbGetUserIDFromToken
    let userId = cbGetUserIDFromToken(token)
    if (!isestr(userId)) {
        userId = ''
    }

    //getFuncList, 提供可用函數清單
    if (func === 'getFuncList') {
        let r = {
            state: 'success',
            msg: keys(useFuncs)
        }
        pm.resolve(r)
        return pm //提前離開
    }

    //check
    if (!haskey(useFuncs, func)) {
        pm.resolve({ state: 'error', msg: `invalid func[${func}]` })
        return pm //提前離開
    }

    //callFun
    let callFun = useFuncs[func]

    //func非可用函數清單, 則直接調用
    try {
        let r = await pm2resolve(callFun)(userId, ...input) //第1參數現在改為userId, 後端函數接收各自處理userId
        pm.resolve(r)
    }
    catch (err) {
        pm.resolve({ state: 'error', msg: `無法識別func: ${func}` })
    }

    return pm //共用Promise
}


function WServWebdataServerExec(opt = {}) {

    //ev
    let ev = evem()

    //instWConverServer, 由外部提供通訊服務實體, 例如WConverhpServer等
    let instWConverServer = get(opt, 'instWConverServer', null)
    if (instWConverServer === null) {
        ev.emit('error', 'invalid opt.instWConverServer')
        return ev
    }

    //cbGetUserIDFromToken, 由外部提供呼叫函數, 提供token回傳使用userID
    cbGetUserIDFromToken = get(opt, 'cbGetUserIDFromToken', null)
    if (!isfun(cbGetUserIDFromToken)) {
        cbGetUserIDFromToken = () => {
            return ''
        }
    }

    //operORM, ORM的泛用接口funORMProc
    let operORM = get(opt, 'operORM', null)
    if (!isfun(operORM)) {
        ev.emit('error', 'invalid opt.operORM')
        return ev
    }

    //tableNames, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口funORMProc處理
    let tableNames = get(opt, 'tableNames', null)
    if (!isarr(tableNames)) {
        ev.emit('error', 'invalid opt.tableNames')
        return ev
    }

    //methods
    let methods = get(opt, 'methods', null)
    if (!isarr(methods)) {
        methods = ['select', 'insert', 'save', 'del']
    }

    //extFuncs
    let extFuncs = get(opt, 'extFuncs', null)

    //hookBefores
    let hookBefores = get(opt, 'hookBefores', null)

    //hookAfters
    let hookAfters = get(opt, 'hookAfters', null)

    //check
    if (size(tableNames) === 0) {
        console.log('opt.tableNames.lenght = 0')
    }

    //cloneDeep
    tableNames = cloneDeep(tableNames)

    //buildFuncs
    let funcs = buildFuncs(tableNames, methods, operORM)

    //add ext. async funcs
    if (isobj(extFuncs)) {
        each(extFuncs, (v, k) => {
            funcs[k] = v
        })
    }

    //save
    useFuncs = funcs

    //監聽execute
    instWConverServer.on('execute', async function(func, input, pm) {
        //console.log(`Server[port:${optServer.port}]: execute`, func, input)

        //params
        let params = { func, input, pm }

        //hookBefores
        if (isfun(hookBefores)) {
            try {
                hookBefores(params)
            }
            catch (err) {
                ev.emit('error', err)
            }
        }
        else if (isearr(hookBefores)) {
            each(hookBefores, (hookBefore) => {
                if (isfun(hookBefore)) {
                    try {
                        hookBefore(params)
                    }
                    catch (err) {
                        ev.emit('error', err)
                    }
                }
            })
        }

        //execute
        let r = await execFun(params)
            .catch((err) => {
                ev.emit('error', err)
            })

        //paramsRet
        let paramsRet = {
            ...params,
            output: r,
        }

        //hookAfters
        if (isfun(hookAfters)) {
            try {
                hookAfters(paramsRet)
            }
            catch (err) {
                ev.emit('error', err)
            }
        }
        else if (isearr(hookAfters)) {
            each(hookAfters, (hookAfter) => {
                if (isfun(hookAfter)) {
                    try {
                        hookAfter(paramsRet)
                    }
                    catch (err) {
                        ev.emit('error', err)
                    }
                }
            })
        }

    })

    return ev
}


export default WServWebdataServerExec
