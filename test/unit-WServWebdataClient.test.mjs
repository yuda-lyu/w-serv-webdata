import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'


//前端與後端以記憶體假通訊層相連(不開埠, 以JSON複製模擬序列化), 驗證前端之設定檢查、綁定前之同步廣播、refreshTable各路徑之結束與回調函數之隔離
describe('unit-WServWebdataClient', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-WServWebdataClient'

    //cleans, 測完須停止之輪詢與廣播
    let cleans = []

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        for (let f of cleans) {
            f()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    let clone = (v) => {
        return v === undefined ? undefined : JSON.parse(JSON.stringify(v))
    }

    //linkServer, 前端execute → 後端execute事件
    let linkServer = (srv) => {
        let cl = evem()
        cl.execute = (func, input) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    let pm = genPm()
                    srv.emit('execute', func, clone(input), pm)
                    pm.then((r) => {
                        setTimeout(() => resolve(clone(r)), 5)
                    })
                }, 5)
            })
        }
        return cl
    }

    //linkFake, 假後端: 直接回應函數清單、時間戳與select, 用以製造伺服端已不允許之設定(例如同步表無select)
    let linkFake = ({ funcs, tags, called }) => {
        let cl = evem()
        cl.execute = async (func) => {
            await sleep(5)
            if (func === '[sys:polling]') {
                return []
            }
            if (func === '[sys:getFuncList]') {
                return { state: 'success', msg: funcs }
            }
            if (func === '[sys:getTableTags]') {
                return { state: 'success', msg: { mode: 'syncKpTable', data: tags } }
            }
            called.push(func)
            return { state: 'success', msg: [{ id: `row-of-${func}` }] }
        }
        return cl
    }

    //run, 建構前端並收集事件
    let run = (cl, opt = {}) => {
        let log = { recv: [], errors: [], after: 0, fapi: null }
        cl = new WServWebdataClient(cl, {
            getToken: () => 'tok',
            getServerMethods: (r) => {
                log.fapi = r
            },
            recvData: (r) => {
                log.recv.push({ tableName: r.tableName, data: r.data })
            },
            getAfterUpdateTableTags: () => {
                log.after++
            },
            ...opt,
        })
        cl.on('error', (err) => {
            log.errors.push(typeof err === 'string' ? err : String(err && err.message ? err.message : (err && err.msg) || err))
        })
        cleans.push(() => {
            cl.clearBroadcast()
        })
        return log
    }

    let countTimeout = () => {
        return process.getActiveResourcesInfo().filter((v) => v === 'Timeout').length
    }

    describe('設定檢查', function() {

        //R41: 原為建構中emit而遺失, 改為建構任何元件之前拋錯
        it('必填與有給之回調函數無效時拋錯, 且未啟動輪詢', function() {
            let ok = { getServerMethods: () => {}, recvData: () => {} }
            let cases = [
                [{ recvData: () => {} }, 'invalid opt.getServerMethods'],
                [{ getServerMethods: () => {} }, 'invalid opt.recvData'],
                [{ ...ok, getToken: 'x' }, 'invalid opt.getToken'],
                [{ ...ok, getRefreshState: 1 }, 'invalid opt.getRefreshState'],
                [{ ...ok, getRefreshTable: 1 }, 'invalid opt.getRefreshTable'],
                [{ ...ok, getBeforeUpdateTableTags: 1 }, 'invalid opt.getBeforeUpdateTableTags'],
                [{ ...ok, getAfterUpdateTableTags: 1 }, 'invalid opt.getAfterUpdateTableTags'],
            ]
            for (let [opt, message] of cases) {
                let cl = evem()
                let n0 = countTimeout()
                assert.throws(() => {
                    new WServWebdataClient(cl, opt)
                }, { message })
                assert.strict.equal(countTimeout(), n0, message)
                assert.strict.equal(cl.clearBroadcast, undefined, message)
            }
        })

    })

    describe('同步', function() {

        //R42: 綁定完成前收到之同步廣播須略過, 綁定後仍須載入資料(行為鎖定: 原方案以空資料結束pm會使該表一直是空表)
        it('綁定完成前收到同步廣播時, 綁定後仍載入資料且不發出錯誤', async function() {
            this.timeout(20000)
            let tabA = evem()
            let srv = evem()
            srv = new WServWebdataServer(srv, {
                fpTableTags: `${fdTmp}/race.json`,
                getUserIdByToken: (token) => (token === 'tok' ? 'u1' : ''),
                useDbOrm: true,
                kpOrm: { tabA },
                operOrm: async (userId, tableName) => [{ id: `${tableName}-row` }],
                tableNamesExec: ['tabA'],
                methodsExec: ['select'],
                tableNamesSync: ['tabA'],
                authorizeExec: () => true,
            })
            cleans.push(() => {
                srv.clearBroadcast()
            })
            let nTok = 0
            let log = run(linkServer(srv), {
                getToken: () => {
                    nTok++
                    if (nTok === 1) {
                        return sleep(3500).then(() => 'tok') //首次取函數清單變慢, 其間後端資料變更並經輪詢送達
                    }
                    return 'tok'
                },
            })
            setTimeout(() => {
                tabA.emit('change')
            }, 2400)
            await sleep(7500)
            assert.strict.deepEqual(log.recv.filter((v) => v.tableName === 'tabA').map((v) => v.data.length), [1], JSON.stringify(log.recv))
            assert.strict.deepEqual(log.errors, [])
        })

        //R43: 已綁定而同步表缺select時, 以空資料結束pm(該次updateTableTags照常完成)並發出error
        it('已綁定而同步表缺select或缺表時, pm以空資料結束並發出error', async function() {
            this.timeout(20000)
            let called = []
            let log1 = run(linkFake({ funcs: ['tabA.insert'], tags: { tabA: 't1' }, called }))
            let log2 = run(linkFake({ funcs: ['tabB.select'], tags: { tabX: 't1' }, called }))
            await sleep(3000)
            assert.strict.deepEqual(log1.recv, [{ tableName: 'tabA', data: [] }])
            assert.strict.deepEqual(log1.errors, ['kpExec[tabA].select is not a function'])
            assert.strict.equal(log1.after, 1)
            assert.strict.deepEqual(log2.recv, [{ tableName: 'tabX', data: [] }])
            assert.strict.deepEqual(log2.errors, ['invalid kpExec[tabX]'])
            assert.strict.equal(log2.after, 1)
            assert.strict.deepEqual(called, [])
        })

        //R44: 使用端回調函數拋錯時改發出error, 同步照常完成
        it('回調函數拋錯時改發出error且同步照常完成', async function() {
            this.timeout(20000)
            let called = []
            let log = run(linkFake({ funcs: ['tabA.select'], tags: { tabA: 't1' }, called }), {
                getServerMethods: () => {
                    throw new Error('boomServerMethods')
                },
                getRefreshTable: () => {
                    throw new Error('boomRefreshTable')
                },
            })
            await sleep(3000)
            assert.strict.deepEqual(log.recv, [{ tableName: 'tabA', data: [{ id: 'row-of-tabA.select' }] }])
            assert.strict.deepEqual(log.errors, ['boomServerMethods', 'boomRefreshTable'])
            assert.strict.equal(log.after, 1)
        })

    })

    describe('函數名之路徑綁定', function() {

        //R39: 綁定與取值只沿自有屬性, 不寫入Object.prototype之內建函數, 字面鍵不遮蔽路徑
        it('綁定只沿自有屬性, 同步依路徑取得正確之select', async function() {
            this.timeout(20000)
            let called = []
            let log = run(linkFake({ funcs: ['toString.select', '["a.b"].other', 'a.b.select'], tags: { 'toString': 't1', 'a.b': 't2' }, called }))
            await sleep(3000)
            try {
                assert.strict.equal(Object.prototype.toString.select, undefined, '未寫入Object.prototype.toString')
                assert.strict.equal(typeof log.fapi['a.b'].other, 'function')
                assert.strict.equal(typeof log.fapi.a.b.select, 'function')
                assert.strict.deepEqual(called.sort(), ['a.b.select', 'toString.select'])
                assert.strict.deepEqual(log.recv.map((v) => v.tableName).sort(), ['a.b', 'toString'])
                assert.strict.deepEqual(log.errors, [])
            }
            finally {
                delete Object.prototype.toString.select //舊碼會寫入, 避免污染其他測試
            }
        })

    })

})
