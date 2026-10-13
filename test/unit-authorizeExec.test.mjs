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
        it('useDbOrm未給或非布林且未給資料通道設定時視同false, 不拋錯且無表操作', async function() {
            for (let useDbOrm of [undefined, 'y']) {
                let inst = build({ fpTableTags, useDbOrm, kpFunExt: { add: () => 1 } })
                let r = await exec(inst, '[sys:getFuncList]')
                assert.strict.deepEqual(r, { state: 'success', msg: ['add'] }, `useDbOrm=${useDbOrm}`)
            }
        })

        //R24: 未指定useDbOrm卻給了資料通道或資料同步之設定時拋錯, 否則該些設定靜默不生效
        it('useDbOrm未給或非布林卻給了資料通道或資料同步之設定時拋錯', function() {
            let kp = {
                operOrm: async () => 'ok',
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                authorizeExec: allow,
                kpOrm: {},
                tableNamesSync: [],
            }
            for (let useDbOrm of [undefined, 'y']) {
                for (let k in kp) {
                    assert.throws(() => {
                        build({ fpTableTags, useDbOrm, [k]: kp[k] })
                    }, { message: `invalid opt.useDbOrm when opt.${k} is given` }, `useDbOrm=${useDbOrm}, ${k}`)
                }
            }
        })

        //R10: 明示useDbOrm=false時不檢查資料通道設定(例如w-web-sso給tableNamesExec:[]與methodsExec:[])
        it('useDbOrm=false時未給authorizeExec或給了資料通道設定皆不拋錯且無表操作', async function() {
            build({ fpTableTags, useDbOrm: false })
            let inst = build({ fpTableTags, useDbOrm: false, operOrm: async () => 'ok', tableNamesExec: [], methodsExec: [] })
            let r = await exec(inst, '[sys:getFuncList]')
            assert.strict.deepEqual(r, { state: 'success', msg: [] })
        })

        //R25: useDbOrm=true時kpOrm須為物件, 於建構任何元件之前拋錯(原為建構中emit而遺失)
        it('useDbOrm=true而kpOrm非物件時拋錯, 且未建構任何元件', function() {
            for (let v of [undefined, 'x', [], 1]) {
                assert.throws(() => {
                    mk(allow, { kpOrm: v })
                }, { message: 'invalid opt.kpOrm when useDbOrm=true' }, `kpOrm=${JSON.stringify(v)}`)
                let inst = insts[insts.length - 1]
                assert.strict.equal(inst.listeners('execute').length, 0, '未註冊任何execute監聽')
                assert.strict.equal(inst.broadcast, undefined, '未擴充廣播')
            }
        })

        //既有檢查順序不變: operOrm、tableNamesExec先於authorizeExec, 訊息用對外之參數名
        it('useDbOrm=true而未給operOrm或tableNamesExec時拋錯', function() {
            assert.throws(() => {
                mk(allow, { operOrm: undefined })
            }, { message: 'invalid opt.operOrm when useDbOrm=true' })
            assert.throws(() => {
                mk(allow, { tableNamesExec: undefined })
            }, { message: 'invalid opt.tableNamesExec when useDbOrm=true' })
        })

        //R19: 有給但非陣列時不可靜默改用預設(預設含寫入方法)
        it('useDbOrm=true而methodsExec有給但非陣列時拋錯', function() {
            for (let v of ['select', {}, 1, true]) {
                assert.throws(() => {
                    mk(allow, { methodsExec: v })
                }, { message: 'invalid opt.methodsExec when useDbOrm=true' }, `methodsExec=${JSON.stringify(v)}`)
            }
        })

        //R19
        it('methodsExec未給或為null時使用預設之select、insert、save、del', async function() {
            for (let methodsExec of [undefined, null]) {
                let { inst } = mk(allow, { tableNamesExec: ['tabA'], methodsExec, kpFunExt: {} })
                let r = await exec(inst, '[sys:getFuncList]')
                assert.strict.deepEqual(r, { state: 'success', msg: ['tabA.select', 'tabA.insert', 'tabA.save', 'tabA.del'] }, `methodsExec=${methodsExec}`)
            }
        })

        //R12: 同名會覆蓋表操作而脫離授權
        it('kpFunExt與已建立之表操作同名時拋錯', function() {
            assert.throws(() => {
                mk(allow, { kpFunExt: { 'tabA.save': () => 'x' } })
            }, { message: 'kpFunExt[tabA.save] conflicts with the table operations of table[tabA]' })
        })

        //R12: 等於表名時前端綁定會覆蓋該表之表操作
        it('kpFunExt與表名同名時拋錯', function() {
            assert.throws(() => {
                mk(allow, { kpFunExt: { 'tabB': () => 'x' } })
            }, { message: 'kpFunExt[tabB] conflicts with the table operations of table[tabB]' })
        })

        //R12: 前端以lodash路徑綁定, 中括號寫法與表名之下的名稱亦屬表名之命名空間
        it('kpFunExt之頂層名為表名時一律拋錯(含表名之下的名稱與中括號寫法)', function() {
            for (let k of ['tabA.count', 'tabA[select]', '["tabA"].select', '[tabA]']) {
                assert.throws(() => {
                    mk(allow, { kpFunExt: { [k]: () => 'x' } })
                }, { message: `kpFunExt[${k}] conflicts with the table operations of table[tabA]` }, k)
            }
        })

        //R12: 系統函數之名稱保留
        it('kpFunExt使用保留之[sys:前綴時拋錯', function() {
            for (let k of ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']) {
                assert.throws(() => {
                    mk(allow, { kpFunExt: { [k]: () => 'x' } })
                }, { message: `kpFunExt[${k}] can not use the reserved prefix [sys:` }, k)
            }
        })

        //R12: lodash之set略過__proto__、constructor、prototype, 前端無法綁定
        it('kpFunExt或表操作之路徑含前端無法綁定之段時拋錯', function() {
            for (let k of ['constructor', 'prototype', 'a.__proto__']) {
                assert.throws(() => {
                    mk(allow, { kpFunExt: { [k]: () => 'x' } })
                }, { message: `kpFunExt[${k}] can not be bound by the client` }, k)
            }
            assert.throws(() => {
                mk(allow, { tableNamesExec: ['prototype'], methodsExec: ['select'] })
            }, { message: 'table operation[prototype.select] can not be bound by the client' })
        })

        //R12: useDbOrm=false時沒有表操作, 表名命名空間之規則不適用
        it('useDbOrm=false時kpFunExt使用表操作之名稱不拋錯且可呼叫', async function() {
            let inst = build({
                fpTableTags,
                useDbOrm: false,
                tableNamesExec: ['tabA'],
                kpFunExt: { 'tabA.save': () => 'saved', 'tabB': () => 'tab' },
            })
            assert.strict.deepEqual(await exec(inst, 'tabA.save'), { state: 'success', msg: 'saved' })
            assert.strict.deepEqual(await exec(inst, 'tabB'), { state: 'success', msg: 'tab' })
        })

        //R12＋R16: 命名檢查與函數查找只認自有屬性, 前端可綁定之Object.prototype名稱(非lodash略過者)不得被誤判
        it('kpFunExt使用toString、hasOwnProperty等名稱時不誤判且可呼叫', async function() {
            let { inst } = mk(allow, {
                kpFunExt: {
                    toString: () => 's',
                    hasOwnProperty: () => 'h',
                },
            })
            assert.strict.deepEqual(await exec(inst, 'toString'), { state: 'success', msg: 's' })
            assert.strict.deepEqual(await exec(inst, 'hasOwnProperty'), { state: 'success', msg: 'h' })
        })

        //R20: 設定錯誤拋錯前須停止廣播之計時器, 否則呼叫端攔下錯誤後程序仍被計時器撐住
        it('建構拋錯後不殘留計時器', function() {
            let countTimeout = () => {
                return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
            }
            let n0 = countTimeout()
            assert.throws(() => {
                mk(allow, { authorizeExec: undefined })
            }, { message: 'invalid opt.authorizeExec when useDbOrm=true' })
            assert.strict.equal(countTimeout(), n0, 'Exec拋錯')
            assert.throws(() => {
                mk(allow, { tableNamesSync: ['tabA'], kpOrm: { tabB: evem() } })
            }, { message: 'invalid kpOrm[tabA]' })
            assert.strict.equal(countTimeout(), n0, 'Sync拋錯')
            assert.throws(() => {
                mk(allow, { kpOrm: undefined })
            }, { message: 'invalid opt.kpOrm when useDbOrm=true' })
            assert.strict.equal(countTimeout(), n0, 'kpOrm非物件')
            assert.throws(() => {
                build({ fpTableTags, operOrm: async () => 'ok' })
            }, { message: 'invalid opt.useDbOrm when opt.operOrm is given' })
            assert.strict.equal(countTimeout(), n0, '未指定useDbOrm卻給了資料通道設定')
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

        //R13: 拒絕值為null時仍須拒絕, 不可以空字串userId繼續執行(pm2resolve會把同步throw null視為成功)
        it('reject null或同步拋null時回應error, 且不呼叫授權函數與operOrm', async function() {
            let fns = [
                () => Promise.reject(null),
                () => {
                    // eslint-disable-next-line no-throw-literal
                    throw null //刻意拋null, 驗證不會被當成成功而以匿名繼續執行
                },
            ]
            for (let f of fns) {
                let { inst, cnt } = mk(allow, { getUserIdByToken: f })
                let r = await withTimeout(exec(inst, 'tabA.select', [{}]))
                assert.strict.deepEqual(r, { state: 'error', msg: null })
                assert.strict.equal(cnt.auth.length, 0)
                assert.strict.equal(cnt.orm.length, 0)
            }
        })

        //R13: 以await取值, 非原生Promise之thenable亦取其結果
        it('回傳非原生Promise之thenable時以其結果為userId', async function() {
            let { inst, cnt } = mk(allow, {
                getUserIdByToken: () => {
                    return {
                        then: (resolve) => {
                            resolve('u9')
                        },
                    }
                },
            })
            await withTimeout(exec(inst, 'tabA.select', [{}]))
            assert.strict.equal(cnt.auth[0].userId, 'u9')
        })

    })

    describe('execute監聽器之契約', function() {

        //R21: w-converhp之契約, 監聽器須為同步函數且不可回傳promise, 否則其rejection即unhandledRejection
        it('execute之各監聽器皆不回傳promise', function() {
            let { inst } = mk(allow)
            let fns = inst.listeners('execute')
            assert.ok(fns.length >= 2)
            for (let fn of fns) {
                let r = fn('[sys:getFuncList]', { __sysToken__: 'tok', __sysInputArgs__: [] }, genPm())
                assert.ok(!(r && typeof r.then === 'function'))
            }
        })

        //R21: error監聽者拋錯時, 回應仍只送出一次, 且不產生unhandledRejection
        it('error事件之監聽者拋錯時回應只送出一次且不產生unhandledRejection', async function() {
            let { inst } = mk(allow, { getUserIdByToken: () => Promise.reject('errUserIdMissing') })
            inst.on('error', () => {
                throw new Error('listenerBoom')
            })
            let unhandled = []
            let onUnhandled = (err) => {
                unhandled.push(err)
            }
            let errLogs = []
            let consoleError = console.error
            process.on('unhandledRejection', onUnhandled)
            console.error = (...args) => {
                errLogs.push(args)
            }
            try {
                let pm = genPm()
                let nResolve = 0
                let resolve = pm.resolve
                pm.resolve = (v) => {
                    nResolve++
                    resolve(v)
                }
                inst.emit('execute', 'tabA.select', { __sysToken__: 'tok', __sysInputArgs__: [{}] }, pm)
                let r = await withTimeout(pm)
                await sleep(50)
                assert.strict.deepEqual(r, { state: 'error', msg: 'errUserIdMissing' })
                assert.strict.equal(nResolve, 1)
                assert.strict.equal(unhandled.length, 0)
                assert.strict.equal(errLogs.length, 1) //監聽者之拋錯由evEmit隔離並以console.error通報
            }
            finally {
                console.error = consoleError
                process.removeListener('unhandledRejection', onUnhandled)
            }
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
