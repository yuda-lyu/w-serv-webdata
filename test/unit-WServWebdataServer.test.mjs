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

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
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

        //R16: sysFuncsPublic有給卻無效者拋錯(不可靜默忽略而使部署方以為已公開或已收緊), 於建構任何元件之前; 與useDbOrm無關
        it('sysFuncsPublic有給卻無效(非陣列、元素非三個系統函數名之一)', function() {
            for (let v of ['[sys:getFuncList]', {}, 1, true, '']) {
                expectNoSideEffect(base({ kpOrm: {}, sysFuncsPublic: v }), 'invalid opt.sysFuncsPublic')
            }
            for (let [v, i] of [[['x'], 0], [['[sys:getFuncList]', 'getFuncList'], 1], [[1], 0], [[null], 0], [[undefined], 0], [[['[sys:polling]']], 0], [['[sys:getTableTags] '], 0], [['[sys:getFuncList]', '[sys:polling]', ''], 2], [['__proto__'], 0]]) {
                expectNoSideEffect(base({ kpOrm: {}, sysFuncsPublic: v }), `invalid opt.sysFuncsPublic[${i}]`)
            }
            expectNoSideEffect({ fpTableTags, useDbOrm: false, sysFuncsPublic: ['nothing'] }, 'invalid opt.sysFuncsPublic[0]')
            expectNoSideEffect({ fpTableTags, sysFuncsPublic: 'x' }, 'invalid opt.sysFuncsPublic')

            //自訂迭代器(外審sol #4): 展開(快照)與索引所見不同時, 檢查之值即使用之值, 仍於建構任何元件之前拋錯(原檢查索引、使用展開之值, 至Exec建構時才拋而已擴充事件物件)
            let p = ['[sys:getFuncList]']
            p[Symbol.iterator] = function* () {
                yield 'x'
            }
            expectNoSideEffect(base({ kpOrm: {}, sysFuncsPublic: p }), 'invalid opt.sysFuncsPublic[0]')
        })

        //R16: 合法之sysFuncsPublic可建構(含未給、null、空陣列、重複、三者、useDbOrm未指定)
        it('sysFuncsPublic合法之值可建構', function() {
            let ok = [undefined, null, [], ['[sys:getFuncList]'], ['[sys:polling]', '[sys:polling]'], ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']]
            for (let v of ok) {
                let inst = evem()
                insts.push(inst)
                new WServWebdataServer(inst, { fpTableTags, sysFuncsPublic: v })
                let inst2 = evem()
                insts.push(inst2)
                new WServWebdataServer(inst2, base({ kpOrm: {}, sysFuncsPublic: v }))
            }
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

        //R49: w-serv-broadcast 1.1.7起clearBroadcast以off移除監聽, 本套件之停止與建構失敗之catch皆呼叫之; 原只檢查emit與on, 缺off時建構成功, 而於停止或catch內拋TypeError(後者蓋掉原錯誤且略過clearSync). w-serv-broadcast 1.1.8起其伺服端亦於建構時檢查, 但本套件先建構之WSyncWebdataServer已擴充傳入之物件, 故仍須於建構任何元件之前檢查
        it('instWConverServer無off函數時於建構任何元件之前拋錯', function() {
            let inst = evem()
            inst.off = undefined
            insts.push(inst)
            let n0 = countTimeout()
            try {
                assert.throws(() => {
                    new WServWebdataServer(inst, { fpTableTags })
                }, { message: 'instWConverServer is not an EventEmitter' })
                assert.strict.equal(inst.clearBroadcast, undefined)
                assert.strict.equal(inst.clearSync, undefined)
                assert.strict.equal(countTimeout(), n0)
            }
            finally {
                delete inst.off //還原eventemitter3原型之off, 供after之clearBroadcast使用(舊碼會建構成功)
            }
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
            assert.strict.equal(inst.listeners('execute').length, 1, '廣播之execute監聽已由clearBroadcast移除, 僅餘資料通道者(L8)')
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

    describe('釋放', function() {

        //R46: w-sync-webdata之clearSync不處理上層掛於外部物件之監聽, 須由本套件移除(原無釋放途徑, 以同一kpOrm重建會累加監聽)
        //R53: 掛於通訊物件之changeTableTags監聽亦由clearSync移除(掛的人負責移除; 原殘留而與文件「僅餘資料通道之execute監聽」不符)
        it('clearSync時移除掛於kpOrm之change監聽且可重複呼叫, 之後之變更不再更新時間戳', async function() {
            let tabA = mkOrm()
            let tabB = mkOrm()
            let inst = evem()
            insts.push(inst)
            new WServWebdataServer(inst, base({ fpTableTags: `${fdTmp}/release.json`, kpOrm: { tabA, tabB }, tableNamesSync: ['tabA', 'tabB'] }))
            assert.strict.equal(tabA.listenerCount('change'), 2)
            assert.strict.equal(tabB.listenerCount('change'), 2)
            assert.strict.equal(inst.listenerCount('changeTableTags'), 1)
            let tags0 = JSON.stringify(inst.getTableTags())
            inst.clearSync()
            inst.clearSync()
            assert.strict.equal(tabA.listenerCount('change'), 1, '只移除本套件所掛者, 使用端既有之監聽保留')
            assert.strict.equal(tabB.listenerCount('change'), 1)
            assert.strict.equal(inst.listenerCount('changeTableTags'), 0, '掛於通訊物件之changeTableTags監聽已移除')
            tabA.emit('change')
            await sleep(300)
            assert.strict.equal(JSON.stringify(inst.getTableTags()), tags0)
        })

        //R46: 包裝後仍執行w-sync-webdata之釋放: 尚未落檔之時間戳寫入檔案, 待推播者取消(行為鎖定)
        it('clearSync時將尚未落檔之時間戳寫入檔案且不再推播', async function() {
            let fp = `${fdTmp}/release-flush.json`
            let tabA = mkOrm()
            let inst = evem()
            insts.push(inst)
            let n = 0
            new WServWebdataServer(inst, base({ fpTableTags: fp, kpOrm: { tabA }, tableNamesSync: ['tabA'], genTag: () => `tag${++n}` }))
            let nChange = 0
            inst.on('changeTableTags', () => {
                nChange++
            })
            assert.strict.deepEqual(JSON.parse(fs.readFileSync(fp, 'utf8')), { tabA: 'tag1' })
            tabA.emit('change')
            inst.clearSync()
            assert.strict.deepEqual(JSON.parse(fs.readFileSync(fp, 'utf8')), { tabA: 'tag2' })
            await sleep(300)
            assert.strict.equal(nChange, 0)
        })

        //R46: 建構之執行期異常時, 除停止廣播之計時器外亦須釋放同步元件, 殘留之實體不再更新時間戳或寫檔
        it('建構之執行期異常時釋放同步元件', async function() {
            let fp = `${fdTmp}/release-fail.json`
            fs.writeFileSync(fp, 'PRE', 'utf8')
            let tabA = mkOrm()
            let inst = evem()
            insts.push(inst)
            assert.throws(() => {
                new WServWebdataServer(inst, base({ fpTableTags: fp, kpOrm: { tabA }, tableNamesSync: ['tabA'], genTag: () => Date.now() }))
            }, { message: 'invalid opt.genTag' })
            inst.updateTableTag('tabA')
            await sleep(300)
            assert.strict.deepEqual(inst.getTableTags(), {})
            assert.strict.equal(fs.readFileSync(fp, 'utf8'), 'PRE')
        })

        //R17+R13: 本套件掛於事件物件之clientLeave監聽(解除clientId之綁定)由clearBroadcast移除(掛的人負責移除), 可重複呼叫; 建構之執行期異常時亦移除
        it('clearBroadcast時移除本套件掛於事件物件之clientLeave監聽, 建構之執行期異常時亦然', function() {
            let inst = evem()
            insts.push(inst)
            let n0 = inst.listenerCount('clientLeave')
            new WServWebdataServer(inst, base({ kpOrm: {} }))
            assert.strict.equal(inst.listenerCount('clientLeave'), n0 + 1, '建構後掛1個')
            inst.clearBroadcast()
            assert.strict.equal(inst.listenerCount('clientLeave'), n0, '停止後移除')
            inst.clearBroadcast()
            assert.strict.equal(inst.listenerCount('clientLeave'), n0, '可重複呼叫')

            let inst2 = evem()
            insts.push(inst2)
            assert.throws(() => {
                new WServWebdataServer(inst2, base({ kpOrm: { tabA: mkOrm() }, tableNamesSync: ['tabA'], genTag: () => Date.now() }))
            }, { message: 'invalid opt.genTag' })
            assert.strict.equal(inst2.listenerCount('clientLeave'), 0, '建構之執行期異常時移除')
        })

        //R17 ⑦(外審sol #6): clientLeave監聽註冊拋錯時(以事件物件之on模擬), 已建構之廣播(execute監聽與計時器)經catch停止, 不殘留
        it('clientLeave監聽註冊失敗時停止已建構之廣播(無殘留計時器與execute監聽)', function() {
            let inst = evem()
            insts.push(inst)
            let on0 = inst.on
            inst.on = function(name, ...args) {
                if (name === 'clientLeave') {
                    throw new Error('onLeaveBoom')
                }
                return on0.call(this, name, ...args)
            }
            let n0 = countTimeout()
            assert.throws(() => {
                new WServWebdataServer(inst, base({ kpOrm: {} }))
            }, { message: 'onLeaveBoom' })
            assert.strict.equal(inst.listenerCount('execute'), 0, '廣播之execute監聽已移除')
            assert.strict.equal(countTimeout(), n0, '無殘留計時器')
        })

        //R46: 掛kpOrm監聽之後的步驟失敗亦須回滾(以事件物件之on於註冊changeTableTags時拋錯模擬), 且不寫時間戳檔
        it('註冊changeTableTags失敗時回滾使用端ORM上之監聽且不寫時間戳檔', function() {
            let fp = `${fdTmp}/release-on.json`
            fs.writeFileSync(fp, 'PRE', 'utf8')
            let tabA = mkOrm()
            let inst = evem()
            insts.push(inst)
            let on0 = inst.on
            inst.on = function(name, ...args) {
                if (name === 'changeTableTags') {
                    throw new Error('onChangeBoom')
                }
                return on0.call(this, name, ...args)
            }
            let n0 = countTimeout()
            assert.throws(() => {
                new WServWebdataServer(inst, base({ fpTableTags: fp, kpOrm: { tabA }, tableNamesSync: ['tabA'] }))
            }, { message: 'onChangeBoom' })
            assert.strict.equal(tabA.listenerCount('change'), 1)
            assert.strict.equal(fs.readFileSync(fp, 'utf8'), 'PRE')
            assert.strict.equal(countTimeout(), n0)
        })

    })

})
