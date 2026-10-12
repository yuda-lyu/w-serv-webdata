import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'


//以evem建構(不開網路), 並模擬w-converhp派發execute事件, 驗證資料通道之授權(authorizeExec)、建構檢查與各關卡之拒絕語意
describe('unit-authorizeExec', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-authorizeExec'
    let fpTableTags = `${fdTmp}/tableTags.json`

    //insts, 建構過之實體, 測完須clearBroadcast, 否則廣播之計時器使程序無法結束
    let insts = []

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        for (let inst of insts) {
            if (typeof inst.clearBroadcast === 'function') {
                inst.clearBroadcast()
            }
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //build, WSyncWebdataServer與WServBroadcastServer皆就地擴充傳入之實體, 故建構中途拋錯時仍可由inst回收廣播計時器
    let build = (opt) => {
        let inst = evem()
        insts.push(inst)
        new WServWebdataServer(inst, opt)
        return inst
    }

    //exec, 模擬w-converhp派發execute事件, 回傳Exec回應之物件{ state, msg }
    let exec = (inst, func, args = [], token = 'tok') => {
        let pm = genPm()
        inst.emit('execute', func, { __sysToken__: token, __sysInputArgs__: args }, pm)
        return pm
    }

    //withTimeout, 回應懸置時以逾時字串結束, 避免測試卡住
    let withTimeout = (pm, ms = 2000) => {
        return Promise.race([
            pm,
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve('timeout')
                }, ms)
            }),
        ])
    }

    //sleep
    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    //mk, 建立useDbOrm=true之實體, 並記錄operOrm與授權函數之呼叫
    let mk = (authorize, optExt = {}) => {
        let cnt = { orm: [], auth: [] }
        let opt = {
            fpTableTags,
            getUserIdByToken: (token) => {
                return token === 'tok' ? 'u1' : ''
            },
            useDbOrm: true,
            kpOrm: {},
            operOrm: async (userId, tableName, methodName, input) => {
                cnt.orm.push({ userId, tableName, methodName, input })
                return { userId, tableName, methodName, input }
            },
            tableNamesExec: ['tabA', 'tabB'],
            methodsExec: ['select', 'insert', 'save', 'del', 'delAll', 'mix'],
            authorizeExec: (arg) => {
                cnt.auth.push(arg)
                return authorize(arg)
            },
            kpFunExt: {
                add: (userId, a, b) => {
                    return a + b
                },
            },
            ...optExt,
        }
        let inst = build(opt)
        return { inst, cnt }
    }

    let allow = () => true

    describe('建構檢查', function() {

        //R09
        it('useDbOrm=true而未給authorizeExec時拋錯', function() {
            assert.throws(() => {
                mk(allow, { authorizeExec: undefined })
            }, { message: 'invalid opt.authorizeExec when useDbOrm=true' })
        })

        //R09
        it('useDbOrm=true而authorizeExec非函數時拋錯', function() {
            for (let v of [true, 'x', {}, null, 1]) {
                assert.throws(() => {
                    mk(allow, { authorizeExec: v })
                }, { message: 'invalid opt.authorizeExec when useDbOrm=true' }, `authorizeExec=${JSON.stringify(v)}`)
            }
        })

        //R10
        it('未給opt時不拋錯且無表操作', async function() {
            let inst = build()
            let r = await exec(inst, '[sys:getFuncList]')
            assert.strict.deepEqual(r, { state: 'success', msg: [] })
        })

        //R10
        it('useDbOrm未給或非布林時視同false, 不拋錯且無表操作', async function() {
            for (let useDbOrm of [undefined, 'y']) {
                let inst = build({ fpTableTags, useDbOrm, tableNamesExec: ['tabA'] })
                let r = await exec(inst, '[sys:getFuncList]')
                assert.strict.deepEqual(r, { state: 'success', msg: [] }, `useDbOrm=${useDbOrm}`)
            }
        })

        //R10
        it('useDbOrm=false時未給authorizeExec不拋錯', function() {
            build({ fpTableTags, useDbOrm: false })
        })

        //既有檢查順序不變: operOrm、tableNamesExec先於authorizeExec
        it('useDbOrm=true而未給operOrm或tableNamesExec時仍拋既有錯誤', function() {
            assert.throws(() => {
                mk(allow, { operOrm: undefined })
            }, { message: 'invalid opt.operOrm when useDbOrm=true' })
            assert.throws(() => {
                mk(allow, { tableNamesExec: undefined })
            }, { message: 'invalid opt.tableNames when useDbOrm=true' })
        })

        //R12
        it('kpFunExt與已建立之表操作同名時拋錯', function() {
            assert.throws(() => {
                mk(allow, { kpFunExt: { 'tabA.save': () => 'x' } })
            }, { message: 'kpFunExt[tabA.save] conflicts with the table operation[tabA.save]' })
        })

        //R12
        it('kpFunExt與已建立表操作之表名同名時拋錯', function() {
            assert.throws(() => {
                mk(allow, { kpFunExt: { 'tabB': () => 'x' } })
            }, { message: 'kpFunExt[tabB] conflicts with the table operation[tabB.select]' })
        })

        //R12
        it('kpFunExt於表名之下但非已建立之表操作時可用, 且不經授權', async function() {
            let { inst, cnt } = mk(allow, {
                methodsExec: ['select'],
                kpFunExt: { 'tabA.count': () => 3 },
            })
            let r = await exec(inst, 'tabA.count')
            assert.strict.deepEqual(r, { state: 'success', msg: 3 })
            assert.strict.equal(cnt.auth.length, 0)
        })

        //R12
        it('useDbOrm=false時kpFunExt使用表操作之名稱不拋錯且可呼叫', async function() {
            let inst = build({
                fpTableTags,
                useDbOrm: false,
                tableNamesExec: ['tabA'],
                kpFunExt: { 'tabA.save': () => 'saved', 'tabA': () => 'tab' },
            })
            assert.strict.deepEqual(await exec(inst, 'tabA.save'), { state: 'success', msg: 'saved' })
            assert.strict.deepEqual(await exec(inst, 'tabA'), { state: 'success', msg: 'tab' })
        })

        //R12＋R16: 同名判斷只認自有屬性, 不得把Object.prototype之名稱誤判為同名
        it('kpFunExt使用Object.prototype之名稱時不誤判且可呼叫', async function() {
            let { inst } = mk(allow, {
                kpFunExt: {
                    constructor: () => 'c',
                    toString: () => 's',
                },
            })
            assert.strict.deepEqual(await exec(inst, 'constructor'), { state: 'success', msg: 'c' })
            assert.strict.deepEqual(await exec(inst, 'toString'), { state: 'success', msg: 's' })
        })

    })

    describe('授權流程', function() {

        //R02, R05, D3
        it('回傳true時放行, 授權函數收到userId、tableName、methodName、input, operOrm收到同一input', async function() {
            let { inst, cnt } = mk(allow)
            let input = { a: 1 }
            let r = await exec(inst, 'tabA.select', [input])
            assert.strict.deepEqual(r, { state: 'success', msg: { userId: 'u1', tableName: 'tabA', methodName: 'select', input: { a: 1 } } })
            assert.strict.equal(cnt.auth.length, 1)
            assert.strict.deepEqual(Object.keys(cnt.auth[0]).sort(), ['input', 'methodName', 'tableName', 'userId'])
            assert.strict.deepEqual(cnt.auth[0], { userId: 'u1', tableName: 'tabA', methodName: 'select', input: { a: 1 } })
            assert.strict.equal(cnt.orm.length, 1)
            assert.strict.equal(cnt.auth[0].input, cnt.orm[0].input)
        })

        //R02
        it('async回傳true時放行', async function() {
            let { inst, cnt } = mk(async () => true)
            let r = await exec(inst, 'tabB.save', [[{ id: 'x' }]])
            assert.strict.equal(r.state, 'success')
            assert.strict.equal(cnt.orm.length, 1)
        })

        //R03, R05
        it('回傳值非嚴格等於true時一律拒絕, 回應permission denied且不呼叫operOrm', async function() {
            let vs = [false, 1, 'true', undefined, null, {}, [], 'yes']
            for (let v of vs) {
                let { inst, cnt } = mk(() => v)
                let r = await exec(inst, 'tabA.select', [{}])
                assert.strict.deepEqual(r, { state: 'error', msg: 'permission denied' }, `return ${JSON.stringify(v)}`)
                assert.strict.equal(cnt.orm.length, 0, `return ${JSON.stringify(v)}`)
            }
            let { inst, cnt } = mk(async () => 'true')
            let r = await exec(inst, 'tabA.select', [{}])
            assert.strict.deepEqual(r, { state: 'error', msg: 'permission denied' })
            assert.strict.equal(cnt.orm.length, 0)
        })

        //R04, R05
        it('授權函數reject字串時原樣回應且不呼叫operOrm', async function() {
            let { inst, cnt } = mk(() => Promise.reject('errNoPermission'))
            let r = await exec(inst, 'tabA.del', [{ id: 'x' }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'errNoPermission' })
            assert.strict.equal(cnt.orm.length, 0)
        })

        //R04, R05
        it('授權函數reject物件時原樣回應且不呼叫operOrm', async function() {
            let { inst, cnt } = mk(() => Promise.reject({ key: 'errNoPermission' }))
            let r = await exec(inst, 'tabA.del', [{ id: 'x' }])
            assert.strict.deepEqual(r, { state: 'error', msg: { key: 'errNoPermission' } })
            assert.strict.equal(cnt.orm.length, 0)
        })

        //R04, R05
        it('授權函數同步拋Error或async reject Error時原樣回應該Error且不呼叫operOrm', async function() {
            let fns = [
                () => {
                    throw new Error('errSync')
                },
                async () => {
                    throw new Error('errAsync')
                },
            ]
            for (let f of fns) {
                let { inst, cnt } = mk(f)
                let r = await exec(inst, 'tabA.insert', [[{ id: 'x' }]])
                assert.strict.equal(r.state, 'error')
                assert.ok(r.msg instanceof Error)
                assert.ok(['errSync', 'errAsync'].includes(r.msg.message))
                assert.strict.equal(cnt.orm.length, 0)
            }
        })

        //R06
        it('kpFunExt與系統函數不經授權函數', async function() {
            let { inst, cnt } = mk(() => false)
            assert.strict.deepEqual(await exec(inst, 'add', [1, 2]), { state: 'success', msg: 3 })
            let rl = await exec(inst, '[sys:getFuncList]')
            assert.strict.equal(rl.state, 'success')
            let rt = await exec(inst, '[sys:getTableTags]')
            assert.strict.equal(rt.state, 'success')
            assert.strict.equal(cnt.auth.length, 0)
        })

        //R07
        it('getUserIdByToken取不到userId或回傳非字串時, 授權函數收到空字串', async function() {
            let { inst, cnt } = mk(allow)
            await exec(inst, 'tabA.select', [{}], 'tokUnknown')
            assert.strict.equal(cnt.auth[0].userId, '')
            let m = mk(allow, { getUserIdByToken: () => 123 })
            await exec(m.inst, 'tabA.select', [{}])
            assert.strict.equal(m.cnt.auth[0].userId, '')
        })

        //R08
        it('methodName原樣傳入授權函數(含mix、delAll)', async function() {
            let { inst, cnt } = mk(allow)
            await exec(inst, 'tabA.mix', [{ x: 1 }])
            await exec(inst, 'tabB.delAll', [])
            assert.strict.deepEqual(cnt.auth.map((v) => `${v.tableName}.${v.methodName}`), ['tabA.mix', 'tabB.delAll'])
        })

        //D2
        it('授權函數與operOrm皆只收到前端第1個參數', async function() {
            let { inst, cnt } = mk(allow)
            await exec(inst, 'tabA.select', [{ a: 1 }, { b: 2 }])
            assert.strict.deepEqual(cnt.auth[0].input, { a: 1 })
            assert.strict.deepEqual(cnt.orm[0].input, { a: 1 })
        })

        //D1
        it('並發呼叫時每次呼叫各自授權一次', async function() {
            let { inst, cnt } = mk(async ({ input }) => {
                await sleep(5)
                return input.i % 2 === 0
            })
            let rs = await Promise.all([0, 1, 2, 3, 4].map((i) => exec(inst, 'tabA.select', [{ i }])))
            assert.strict.deepEqual(rs.map((r) => r.state), ['success', 'error', 'success', 'error', 'success'])
            assert.strict.equal(cnt.auth.length, 5)
            assert.strict.deepEqual(cnt.orm.map((v) => v.input.i), [0, 2, 4])
        })

        //D4
        it('授權拒絕時不發出error事件', async function() {
            let { inst } = mk(() => false)
            let errs = []
            inst.on('error', (err) => {
                errs.push(err)
            })
            await exec(inst, 'tabA.select', [{}])
            await sleep(20)
            assert.strict.equal(errs.length, 0)
        })

    })

    describe('getUserIdByToken之拒絕', function() {

        //R13: 修正前回應為'execFun func[tabA.select] has an error: undefined'
        it('reject字串時原樣回應, 且不呼叫授權函數與operOrm', async function() {
            let { inst, cnt } = mk(allow, { getUserIdByToken: () => Promise.reject('errUserIdMissing') })
            let r = await withTimeout(exec(inst, 'tabA.select', [{}]))
            assert.strict.deepEqual(r, { state: 'error', msg: 'errUserIdMissing' })
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        })

        //R13
        it('同步拋字串時原樣回應', async function() {
            let { inst } = mk(allow, {
                getUserIdByToken: () => {
                    // eslint-disable-next-line no-throw-literal
                    throw 'errSyncStr' //刻意拋字串, 驗證使用端同步拋字串時之回應
                },
            })
            let r = await withTimeout(exec(inst, 'tabA.select', [{}]))
            assert.strict.deepEqual(r, { state: 'error', msg: 'errSyncStr' })
        })

        //R13
        it('reject Error時原樣回應該Error(與各函數之拒絕同規則)', async function() {
            let { inst } = mk(allow, {
                getUserIdByToken: async () => {
                    throw new Error('errUserIdMissing')
                },
            })
            let r = await withTimeout(exec(inst, 'tabA.select', [{}]))
            assert.strict.equal(r.state, 'error')
            assert.ok(r.msg instanceof Error)
            assert.strict.equal(r.msg.message, 'errUserIdMissing')
        })

        //R13: 修正前catch內對undefined取message再拋錯, 回應永不送出
        it('reject undefined時仍回應error而不懸置', async function() {
            let { inst } = mk(allow, { getUserIdByToken: () => Promise.reject() })
            let r = await withTimeout(exec(inst, 'tabA.select', [{}]))
            assert.notStrictEqual(r, 'timeout')
            assert.strict.equal(r.state, 'error')
        })

        //R13: getUserIdByToken為所有函數之共同關卡, kpFunExt與[sys:getFuncList]亦同樣拒絕
        it('kpFunExt與[sys:getFuncList]亦同樣拒絕', async function() {
            let { inst } = mk(allow, { getUserIdByToken: () => Promise.reject('errUserIdMissing') })
            assert.strict.deepEqual(await withTimeout(exec(inst, 'add', [1, 2])), { state: 'error', msg: 'errUserIdMissing' })
            assert.strict.deepEqual(await withTimeout(exec(inst, '[sys:getFuncList]')), { state: 'error', msg: 'errUserIdMissing' })
        })

        //A1: 保留既有之error事件
        it('拒絕時仍發出error事件', async function() {
            let { inst } = mk(allow, { getUserIdByToken: () => Promise.reject('errUserIdMissing') })
            let errs = []
            inst.on('error', (err) => {
                errs.push(err)
            })
            await withTimeout(exec(inst, 'tabA.select', [{}]))
            await sleep(20)
            assert.strict.deepEqual(errs, ['errUserIdMissing'])
        })

    })

    describe('可呼叫之函數', function() {

        //R16: 修正前因haskey以in判斷, constructor等繼承自Object.prototype之名稱可被呼叫
        it('Object.prototype之名稱不可呼叫', async function() {
            let { inst } = mk(allow)
            for (let name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf', 'isPrototypeOf']) {
                let r = await exec(inst, name)
                assert.strict.deepEqual(r, { state: 'error', msg: `invalid func[${name}]` }, name)
            }
        })

        //既有行為
        it('不存在之函數回應invalid func', async function() {
            let { inst } = mk(allow)
            assert.strict.deepEqual(await exec(inst, 'nope'), { state: 'error', msg: 'invalid func[nope]' })
        })

        //既有行為: useDbOrm=false時表操作不存在
        it('useDbOrm=false時表操作不存在', async function() {
            let inst = build({ fpTableTags, useDbOrm: false, tableNamesExec: ['tabA'] })
            assert.strict.deepEqual(await exec(inst, 'tabA.select'), { state: 'error', msg: 'invalid func[tabA.select]' })
        })

        //既有行為: operOrm之拒絕值原樣回應
        it('operOrm拋錯時原樣回應', async function() {
            let { inst } = mk(allow, {
                operOrm: async () => {
                    throw new Error('errOrm')
                },
            })
            let r = await exec(inst, 'tabA.select', [{}])
            assert.strict.equal(r.state, 'error')
            assert.strict.equal(r.msg.message, 'errOrm')
        })

    })

})
