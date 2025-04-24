import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import keys from 'lodash-es/keys.js'
import cloneDeep from 'lodash-es/cloneDeep.js'
import iseobj from 'wsemi/src/iseobj.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import arrPull from 'wsemi/src/arrPull.mjs'
import pm2resolve from 'wsemi/src/pm2resolve.mjs'


function WServWebdataServerExec(instWConverServer, opt = {}) {

    //check
    if (!iseobj(instWConverServer)) {
        throw new Error('invalid instWConverServer')
    }

    //getUserIdByToken, 由外部提供呼叫函數, 提供token回傳使用userID
    let getUserIdByToken = get(opt, 'getUserIdByToken', null)
    if (!isfun(getUserIdByToken)) {
        getUserIdByToken = async () => {
            return ''
        }
    }

    //useDbOrm
    let useDbOrm = get(opt, 'useDbOrm', null)
    if (!isbol(useDbOrm)) {
        useDbOrm = false
    }

    //operOrm, ORM的泛用接口procCommon
    let operOrm = null
    if (useDbOrm) {
        operOrm = get(opt, 'operOrm', null)
        if (!isfun(operOrm)) {
            throw new Error('invalid opt.operOrm when useDbOrm=true')
        }
    }

    //tableNames, 指定能被呼叫的表名, 各表名需隸屬於ORM, 才能被ORM的泛用接口procCommon處理
    let tableNames = []
    if (useDbOrm) {
        tableNames = get(opt, 'tableNames', null)
        if (!isarr(tableNames)) {
            throw new Error('invalid opt.tableNames when useDbOrm=true')
        }
    }

    //methods
    let methods = []
    if (useDbOrm) {
        methods = get(opt, 'methods', null)
        if (!isarr(methods)) {
            // methods = ['select', 'insert', 'save', 'del', 'dellAll']
            methods = ['select', 'insert', 'save', 'del']
        }
    }

    //kpFunExt
    let kpFunExt = get(opt, 'kpFunExt', null)

    //buildFuncs
    function buildFuncs(tableNames, methods, operOrm) {
        let funcs = {}

        //存取[ORM]資料表函數
        each(tableNames, (tableName) => { //通過ds取得資料表清單
            each(methods, (methodName) => {

                //pathName, 各資料表之各ORM方法
                let pathName = `${tableName}.${methodName}`

                //bind
                funcs[pathName] = async function(userId, input) { //第1參數需為userId

                    //呼叫ORM的泛用接口procCommon
                    let r = await operOrm(userId, tableName, methodName, input)

                    return r
                }

            })
        })

        return funcs
    }

    //funcs
    let funcs = {}
    if (useDbOrm) {

        //cloneDeep
        tableNames = cloneDeep(tableNames)

        //buildFuncs
        funcs = buildFuncs(tableNames, methods, operOrm)
        // console.log('funcs(buildFuncs)', funcs)

    }
    if (iseobj(kpFunExt)) { //add ext. async funcs
        each(kpFunExt, (v, k) => {
            funcs[k] = v
        })
        // console.log('funcs(kpFunExt)', funcs)
    }

    //execFun
    async function execFun(func, input, pm) {
        // console.log('execFun', func, input)

        //check, 必要檢測, 有些防火牆會刪除或修改封包內容, 導致無法解析func或input, 進而會導致後續取得sysToken或sysInput失效, 為避免誤判須先行偵測func, 若無func多半是封包被修改導致
        if (!isestr(func)) {
            pm.resolve({ state: 'error', msg: 'invalid func' })
            return pm //提前離開
        }

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

        //userId
        let userId = ''
        if (true) {

            //getUserIdByToken
            userId = getUserIdByToken(token)
            if (ispm(userId)) {
                userId = await userId
            }

            //check
            if (!isestr(userId)) {
                userId = ''
            }

        }

        //getFuncList, 提供可用函數清單
        if (func === '[sys:getFuncList]') {

            //ks
            let ks = keys(funcs)

            //會提供內部同步用系統函數, 須去除
            ks = arrPull(ks, '[sys:getTableTags]')

            //r
            let r = {
                state: 'success',
                msg: ks,
            }

            pm.resolve(r)
            return pm //提前離開
        }

        //check
        if (!haskey(funcs, func)) {
            pm.resolve({ state: 'error', msg: `invalid func[${func}]` })
            return pm //提前離開
        }

        //fun
        let fun = funcs[func]

        //call fun
        try {
            let r = await pm2resolve(fun)(userId, ...input) //第1參數現在改為userId, 後端函數接收各自處理userId
            pm.resolve(r)
        }
        catch (err) {
            pm.resolve({ state: 'error', msg: `call func[${func}] has an error: ${err.message}` })
        }

        return pm //共用Promise
    }

    //監聽execute
    instWConverServer.on('execute', async function(func, input, pm) {
        //console.log(`Server[port:${optServer.port}]: execute`, func, input)

        //execFun
        await execFun(func, input, pm)
            .catch((err) => {
                instWConverServer.emit('error', err)
                pm.resolve({ state: 'error', msg: `execFun func[${func}] has an error: ${err.message}` })
            })

    })

    return instWConverServer
}


export default WServWebdataServerExec
