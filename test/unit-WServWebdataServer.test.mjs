import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'


//以evem建構(不開網路), 驗證設定檢查: 設定錯誤於建構任何元件之前拋錯而不留副作用, 以及資料同步、函數名路徑之規則
describe('unit-WServWebdataServer', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-WServWebdataServer'
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

    //mkOrm, 使用端之ORM事件物件, 預掛1個既有監聽, 用以驗證不會被增減
    let mkOrm = () => {
        let ev = evem()
        ev.on('change', () => {})
        return ev
    }

    //base, useDbOrm=true之合法設定
    let base = (ext = {}) => {
        return {
            fpTableTags,
            useDbOrm: true,
            operOrm: async (userId, tableName, methodName, input) => {
                return { tableName, methodName }
            },
            tableNamesExec: ['tabA', 'tabB'],
            methodsExec: ['select'],
            authorizeExec: () => true,
            ...ext,
        }
    }

    //countTimeout
    let countTimeout = () => {
        return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
    }

    //snapshot, 建構前後須相同之狀態: 傳入之事件物件(自有鍵、方法參照、execute監聽數)、計時器數、使用端ORM之監聽數、時間戳檔內容
    let snapshot = (inst, kpOrm) => {
        let orm = {}
        for (let k of Object.keys(kpOrm || {})) {
            let v = kpOrm[k]
            orm[k] = (v && typeof v.listenerCount === 'function') ? v.listenerCount('change') : null
        }
        return {
            keys: Object.keys(inst).sort().join(','),
            emit: inst.emit,
            on: inst.on,
            nExecute: inst.listeners('execute').length,
            nTimeout: countTimeout(),
            orm,
            file: fs.existsSync(fpTableTags) ? fs.readFileSync(fpTableTags, 'utf8') : null,
        }
    }

    //expectNoSideEffect, 設定錯誤時拋指定訊息, 且不留任何副作用、不呼叫使用端genTag
    let expectNoSideEffect = (opt, message) => {
        fs.writeFileSync(fpTableTags, 'PRE', 'utf8') //既有之時間戳檔, 須維持原內容
        let nGenTag = 0
        let o = {
            genTag: () => {
                nGenTag++
                return 'tag'
            },
            ...opt,
        }
        let inst = evem()
        insts.push(inst)
        let s0 = snapshot(inst, o.kpOrm)
        assert.throws(() => {
            new WServWebdataServer(inst, o)
        }, { message })
        assert.strict.deepEqual(snapshot(inst, o.kpOrm), s0, message)
        assert.strict.equal(nGenTag, 0, message)
    }

    describe('設定錯誤於建構任何元件之前拋錯且不留副作用', function() {

        //R35: 既有檢查前移至建構任何元件之前
        it('useDbOrm、kpOrm與資料通道之既有檢查', function() {
            expectNoSideEffect({ fpTableTags, operOrm: async () => 1 }, 'invalid opt.useDbOrm when opt.operOrm is given')
            expectNoSideEffect(base({ kpOrm: undefined }), 'invalid opt.kpOrm when useDbOrm=true')
            expectNoSideEffect(base({ kpOrm: {}, operOrm: undefined }), 'invalid opt.operOrm when useDbOrm=true')
            expectNoSideEffect(base({ kpOrm: {}, tableNamesExec: undefined }), 'invalid opt.tableNamesExec when useDbOrm=true')
            expectNoSideEffect(base({ kpOrm: {}, methodsExec: 'select' }), 'invalid opt.methodsExec when useDbOrm=true')
            expectNoSideEffect(base({ kpOrm: {}, authorizeExec: undefined }), 'invalid opt.authorizeExec when useDbOrm=true')
        })

        //R35: 命名規則前移
        it('函數名之檢查', function() {
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { '[sys:x]': () => 1 } }), 'kpFunExt[[sys:x]] can not use the reserved prefix [sys:')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { 'tabA.count': () => 1 } }), 'kpFunExt[tabA.count] conflicts with the table operations of table[tabA]')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { constructor: () => 1 } }), 'kpFunExt[constructor] can not be bound by the client')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { 'x': () => 1, 'x.y': () => 2 } }), 'kpFunExt[x.y] conflicts with kpFunExt[x] on the client binding path')
        })

        //R36: 有給卻無效之設定
        it('有給卻無效之設定(原會被靜默改用預設或捨棄)', function() {
            expectNoSideEffect(base({ kpOrm: {}, getUserIdByToken: 'abc' }), 'invalid opt.getUserIdByToken')
            expectNoSideEffect(base({ kpOrm: {}, fpTableTags: 123 }), 'invalid opt.fpTableTags')
            expectNoSideEffect(base({ kpOrm: {}, genTag: 'x' }), 'invalid opt.genTag')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: [] }), 'invalid opt.kpFunExt')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: 'x' }), 'invalid opt.kpFunExt')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { add: 42 } }), 'invalid opt.kpFunExt[add]')
            expectNoSideEffect(base({ kpOrm: {}, kpFunExt: { add: null } }), 'invalid opt.kpFunExt[add]')
            expectNoSideEffect({ fpTableTags, kpFunExt: { add: undefined } }, 'invalid opt.kpFunExt[add]')
        })

        //R37: 元素須為非空字串
        it('tableNamesExec、methodsExec、tableNamesSync之元素須為非空字串', function() {
            for (let v of [null, '', 1]) {
                expectNoSideEffect(base({ kpOrm: {}, tableNamesExec: [v] }), 'invalid opt.tableNamesExec[0] when useDbOrm=true')
                expectNoSideEffect(base({ kpOrm: {}, methodsExec: ['select', v] }), 'invalid opt.methodsExec[1] when useDbOrm=true')
                expectNoSideEffect(base({ kpOrm: { tabA: mkOrm() }, tableNamesSync: [v] }), 'invalid opt.tableNamesSync[0] when useDbOrm=true')
            }
            expectNoSideEffect(base({ kpOrm: { tabA: mkOrm() }, tableNamesSync: 'tabA' }), 'invalid opt.tableNamesSync when useDbOrm=true')
        })

        //R35: 同步之檢查前移, 失敗之表位於首、中、末皆不在使用端ORM留下監聽
        it('同步之表不在kpOrm中或無法監聽change事件', function() {
            let kpOrm = { tabA: mkOrm(), tabB: mkOrm() }
            expectNoSideEffect(base({ kpOrm, tableNamesSync: ['tabX', 'tabA', 'tabB'] }), 'invalid kpOrm[tabX]')
            expectNoSideEffect(base({ kpOrm, tableNamesSync: ['tabA', 'tabX', 'tabB'] }), 'invalid kpOrm[tabX]')
            expectNoSideEffect(base({ kpOrm, tableNamesSync: ['tabA', 'tabB', 'tabX'] }), 'invalid kpOrm[tabX]')
            expectNoSideEffect(base({ kpOrm: { tabA: mkOrm(), tabB: {} }, tableNamesSync: ['tabA', 'tabB'] }), 'kpOrm[tabB] can not listen to change events')
            expectNoSideEffect(base({ kpOrm: { tabA: mkOrm(), tabB: null }, tableNamesSync: ['tabA', 'tabB'] }), 'invalid kpOrm[tabB]')
        })

        //R38: 同步之表須有經授權之表操作select
        it('同步之表無表操作select', function() {
            let kpOrm = { tabA: mkOrm(), tabC: mkOrm(), tabS: mkOrm() }
            expectNoSideEffect(base({ kpOrm, tableNamesSync: ['tabC'] }), 'invalid opt.tableNamesSync when table operation[tabC.select] does not exist')
            expectNoSideEffect(base({ kpOrm, methodsExec: ['insert'], tableNamesSync: ['tabA'] }), 'invalid opt.tableNamesSync when table operation[tabA.select] does not exist')
            expectNoSideEffect(base({ kpOrm, tableNamesSync: ['tabS'], kpFunExt: { 'tabS.select': () => [] } }), 'invalid opt.tableNamesSync when table operation[tabS.select] does not exist')
        })

    })

    describe('函數名之路徑衝突', function() {

        //R39: 不同函數名不得解析為同一路徑
        it('不同表名解析為同一路徑時拋錯', function() {
            expectNoSideEffect(base({ kpOrm: {}, tableNamesExec: ['a.b', 'a["b"]'] }), 'table operation[a["b"].select] conflicts with table operation[a.b.select] on the client binding path')
            expectNoSideEffect({ fpTableTags, kpFunExt: { 'tools.run': () => 1, 'tools[run]': () => 2 } }, 'kpFunExt[tools[run]] conflicts with kpFunExt[tools.run] on the client binding path')
        })

        //R39: 不得互為前綴(葉與父), 不論先後
        it('函數名互為前綴時拋錯', function() {
            expectNoSideEffect(base({ kpOrm: {}, tableNamesExec: ['a', 'a.select'] }), 'table operation[a.select.select] conflicts with table operation[a.select] on the client binding path')
            expectNoSideEffect({ fpTableTags, kpFunExt: { 'x.y': () => 1, 'x': () => 2 } }, 'kpFunExt[x] conflicts with kpFunExt[x.y] on the client binding path')
        })

        //R39: 路徑不得有空段
        it('函數名之路徑有空段時拋錯', function() {
            expectNoSideEffect({ fpTableTags, kpFunExt: { 'a..b': () => 1 } }, 'kpFunExt[a..b] can not be bound by the client')
        })

        //R39: 不衝突之組合可用(行為鎖定)
        it('不衝突之組合可正常建構', function() {
            let mkOk = (opt) => {
                let inst = evem()
                insts.push(inst)
                new WServWebdataServer(inst, opt)
            }
            mkOk(base({ kpOrm: {}, tableNamesExec: ['a', 'a.b'] })) //a.select與a.b.select不互為前綴
            mkOk(base({ kpOrm: {}, tableNamesExec: ['a.b'], kpFunExt: { '["a.b"].other': () => 1 } })) //字面鍵'a.b'與路徑a.b不同
            mkOk(base({ kpOrm: {}, tableNamesExec: ['tabA', 'tabA'] })) //完全同名視為同一函數
            mkOk(base({ kpOrm: {}, tableNamesExec: ['toString'] })) //前端綁定只沿自有屬性, 不會寫到Object.prototype.toString
        })

    })

    describe('資料同步', function() {

        //業主裁示: kpOrm為空物件時不同步, 亦不檢查同步表
        it('kpOrm為空物件時不同步且不拋錯(業主裁示)', function() {
            let inst = evem()
            insts.push(inst)
            new WServWebdataServer(inst, base({ kpOrm: {}, tableNamesSync: ['tabC'] }))
        })

        //R35: 沿用kpOrm[表]之取值語意, 以原型提供之事件物件可同步(行為鎖定)
        it('以原型提供之kpOrm事件物件可同步', function() {
            let tabA = mkOrm()
            let inst = evem()
            insts.push(inst)
            new WServWebdataServer(inst, base({ kpOrm: Object.create({ tabA }), tableNamesSync: ['tabA'] }))
            assert.strict.equal(tabA.listenerCount('change'), 2)
        })

        //R24: 明示useDbOrm=false時不檢查資料通道與同步之設定(未指定時才檢查)
        it('明示useDbOrm=false時不檢查', function() {
            let inst = evem()
            insts.push(inst)
            new WServWebdataServer(inst, { fpTableTags, useDbOrm: false, tableNamesExec: [], methodsExec: [], tableNamesSync: ['tabA'], kpOrm: { tabA: 1 } })
        })

        //R40: 執行期kpOrm之on拋錯時, 移除已掛之監聽、不寫時間戳檔、停止廣播之計時器
        it('執行期kpOrm之on拋錯時回滾使用端ORM上之監聽', function() {
            fs.writeFileSync(fpTableTags, 'PRE', 'utf8')
            let tabA = mkOrm()
            let tabB = mkOrm()
            tabB.on = () => {
                throw new Error('onBoom')
            }
            let inst = evem()
            insts.push(inst)
            let n0 = countTimeout()
            assert.throws(() => {
                new WServWebdataServer(inst, base({ kpOrm: { tabA, tabB }, tableNamesSync: ['tabA', 'tabB'] }))
            }, { message: 'kpOrm[tabB] can not listen to change events' })
            assert.strict.equal(tabA.listenerCount('change'), 1, 'tabA之監聽已移除')
            assert.strict.equal(fs.readFileSync(fpTableTags, 'utf8'), 'PRE', '未寫入時間戳檔')
            assert.strict.equal(countTimeout(), n0, '廣播之計時器已停止')
        })

        //R40: genTag回傳非字串時拋錯, 於掛監聽與寫檔之前
        it('genTag回傳非字串時拋錯, 且未掛監聽、未寫時間戳檔', function() {
            fs.writeFileSync(fpTableTags, 'PRE', 'utf8')
            let tabA = mkOrm()
            let inst = evem()
            insts.push(inst)
            let n0 = countTimeout()
            assert.throws(() => {
                new WServWebdataServer(inst, base({ kpOrm: { tabA }, tableNamesSync: ['tabA'], genTag: () => Date.now() }))
            }, { message: 'invalid opt.genTag' })
            assert.strict.equal(tabA.listenerCount('change'), 1)
            assert.strict.equal(fs.readFileSync(fpTableTags, 'utf8'), 'PRE')
            assert.strict.equal(countTimeout(), n0)
        })

    })

})
