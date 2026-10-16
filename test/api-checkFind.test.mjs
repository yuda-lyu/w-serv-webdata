import assert from 'assert'
import fs from 'fs'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs'
import WOrm from 'w-orm-lowdb/src/WOrmLowdb.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import { MAX_IN, MAX_STR } from '../src/checkFind.mjs'


//經真HTTP與真w-orm-lowdb驗證資料通道對select、delAll之find白名單(帳本R15), 規格句S1~S8見CLAUDE_rulebook.md與unit-checkFind.test.mjs檔頭
//自寫客戶端以WConverhpClient.execute直送input(繞過WServWebdataClient), 驗證JSON與二進位往返後所到達之形狀; 另以官方客戶端WServWebdataClient驗證w-web-*實際用法(無參數select)全數通過
//[重現]: 缺陷重現測試, 於修前碼(無檢核)須紅; [鎖定]: 行為鎖定測試, 於修前碼須綠
describe('api-checkFind', function() {

    //port, 固定埠, 避開api-servdata之9000、api-clientStop之9001與w-converhp測試之8300~8399區段
    let port = 9002

    //fdTmp, 本測試暫存檔(含lowdb資料庫)之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/api-checkFind'

    let rows = [
        { id: 'a1', name: 'alpha', n: 1 },
        { id: 'a2', name: 'beta', n: 2 },
        { id: 'a3', name: 'gamma', n: 3 },
    ]

    let wo = null
    let srv = null
    let cl = null
    let clf = null
    let fapi = null
    let cnt = { orm: [], auth: [] }

    //seed, 重置資料表為rows
    let seed = async () => {
        await wo.delAll()
        await wo.insert(rows.map((v) => ({ ...v })))
    }

    //ids, 資料表現存之id
    let ids = async () => {
        let r = await wo.select()
        return r.map((v) => v.id).sort()
    }

    before(async function() {
        fs.mkdirSync(fdTmp, { recursive: true })

        wo = new WOrm({ url: `${fdTmp}/db.json`, db: 'checkFind', cl: 'tabA' })

        srv = new WConverhpServer({ port, pathUploadTemp: `${fdTmp}/uploadTemp` })
        srv = new WServWebdataServer(srv, {
            fpTableTags: `${fdTmp}/tableTags.json`,
            getUserIdByToken: (token) => (token === 'tokOk' ? 'u1' : ''),
            useDbOrm: true,
            kpOrm: {},
            operOrm: async (...a) => {
                let [userId, tableName, methodName, input] = a
                cnt.orm.push({ n: a.length, userId, tableName, methodName, input }) //n: operOrm實際收到之參數個數
                return await wo[methodName](input)
            },
            tableNamesExec: ['tabA'],
            methodsExec: ['select', 'delAll'],
            authorizeExec: async (arg) => {
                cnt.auth.push(arg)
                return arg.userId === 'u1'
            },
        })
        srv.on('error', () => {})

        cl = new WConverhpClient({ url: `http://localhost:${port}`, retryMain: 0, timeout: 20000 })
        cl.on('error', () => {})

        fapi = await new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject(new Error('getServerMethods timeout'))
            }, 20000)
            clf = new WServWebdataClient(new WConverhpClient({ url: `http://localhost:${port}` }), {
                getToken: () => 'tokOk',
                getServerMethods: (r) => {
                    clearTimeout(t)
                    resolve(r)
                },
                recvData: () => {},
            })
            clf.on('error', () => {})
        })
    })

    beforeEach(async function() {
        await seed()
    })

    after(function() {
        if (clf) {
            clf.clearBroadcast()
            clf.clearSync()
        }
        if (srv) {
            srv.clearBroadcast()
            srv.clearSync()
            srv.stop()
        }
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //call, 自寫客戶端直送input; 每次呼叫前清空紀錄
    let call = async (args, token = 'tokOk', func = 'tabA.select') => {
        cnt.orm.length = 0
        cnt.auth.length = 0
        return cl.execute(func, { __sysToken__: token, __sysInputArgs__: args })
    }

    //S1~S3 [鎖定]: 端到端不變式, 白名單內之find經真HTTP與真後端得到正確之列, 授權函數所見與operOrm所收皆為深度相等之input
    it('白名單內之find(不給、{}、欄位等值、主鍵$in、多欄AND、空$in)經真HTTP放行且真後端回傳符合條件之列', async function() {
        let cases = [
            [undefined, ['a1', 'a2', 'a3']],
            [{}, ['a1', 'a2', 'a3']],
            [{ name: 'alpha' }, ['a1']],
            [{ n: 2 }, ['a2']],
            [{ id: { $in: ['a1', 'a3'] } }, ['a1', 'a3']],
            [{ name: { $in: ['alpha', 'beta'] } }, ['a1', 'a2']], //$in不限主鍵欄
            [{ n: { $in: [3, 99] }, name: 'gamma' }, ['a3']],
            [{ name: 'alpha', n: 2 }, []],
            [{ name: 'alpha', n: 1 }, ['a1']],
            [{ id: { $in: [] } }, []],
        ]
        for (let [f, expected] of cases) {
            let r = await call(f === undefined ? [] : [f])
            assert.strict.equal(r.state, 'success', JSON.stringify(f))
            assert.strict.deepEqual(r.msg.map((v) => v.id).sort(), expected, JSON.stringify(f))
            assert.strict.deepEqual(cnt.auth[0].input, f)
            assert.strict.deepEqual(cnt.orm[0].input, f)
        }
    })

    //S5 [重現]: 真後端接受凍結之複本, 且operOrm所收為非客戶端原物件之凍結複本
    it('operOrm收到凍結之複本, 真後端(lowdb)照常查詢', async function() {
        let r = await call([{ name: 'alpha', id: { $in: ['a1', 'a2'] } }])
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(r.msg.map((v) => v.id), ['a1'])
        assert.ok(Object.isFrozen(cnt.orm[0].input) && Object.isFrozen(cnt.orm[0].input.id) && Object.isFrozen(cnt.orm[0].input.id.$in))
        assert.strict.equal(cnt.auth[0].input, cnt.orm[0].input, '授權所見即執行所用(同一份)')
    })

    //S1, S4 [重現]: JSON往返使[undefined]成為[null], 通道無從區分顯式undefined與null, 依規格null拒絕(D2)
    it('顯式傳入undefined(JSON往返成null)被拒絕: invalid find[notObject]', async function() {
        let r = await call([undefined])
        assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[notObject]' })
        assert.strict.equal(cnt.auth.length, 0)
        assert.strict.equal(cnt.orm.length, 0)
    })

    //D2 [鎖定]: 條件值為undefined時, 鍵於JSON序列化時消失, 伺服端只見其餘之鍵(select之上界本即全表)
    it('條件值為undefined時鍵於序列化時消失, 伺服端只見其餘之鍵', async function() {
        let r = await call([{ ownerId: undefined }])
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(cnt.orm[0].input, {})
        assert.strict.equal(r.msg.length, 3)
        r = await call([{ name: 'alpha', ownerId: undefined }])
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(cnt.orm[0].input, { name: 'alpha' })
        assert.strict.deepEqual(r.msg.map((v) => v.id), ['a1'])
    })

    //S1~S4 [重現]: JSON與二進位往返後可到達之白名單外形狀
    it('白名單外之形狀經真HTTP被拒絕, 不呼叫授權函數與operOrm', async function() {
        let bads = [
            [[null], 'notObject'], [[[]], 'notObject'], [[[{ name: 'alpha' }]], 'notObject'], [['abc'], 'notObject'], [[''], 'notObject'],
            [[123], 'notObject'], [[true], 'notObject'], [[new Uint8Array([1, 2])], 'notObject'],
            [[{ $where: 'true' }], 'badKey'], [[{ $expr: { $eq: ['$n', 1] } }], 'badKey'], [[{ $custom: ['1=1'] }], 'badKey'], [[{ $or: [{ name: 'alpha' }] }], 'badKey'],
            [[{ name: { $regex: '^al' } }], 'badOperator'], [[{ name: { $gt: 0 } }], 'badOperator'], [[{ name: null }], 'badValue'], [[{ name: { x: 1 } }], 'badOperator'],
            [[{ name: ['alpha'] }], 'badValue'], [[{ name: new Uint8Array([1]) }], 'badValue'], [[{ id: { $in: 'a1' } }], 'badIn'], [[{ id: { $in: [{ x: 1 }] } }], 'badIn'],
            [[{ id: { $in: [null] } }], 'badIn'], [[{ 'a.b': 1 }], 'badKey'], [[{ constructor: { prototype: {} } }], 'badKey'], [[{ toString: 'x' }], 'badKey'],
            [[{ length: 1, name: 'alpha' }], 'badKey'], [[JSON.parse('{"__proto__":{"x":1}}')], 'badKey'], [[JSON.parse('{"name":"alpha","__proto__":{"x":1}}')], 'badKey'],
            [[{ name: 'x'.repeat(MAX_STR + 1) }], 'badValue'], [[{ name: 'a' + String.fromCodePoint(0) + 'b' }], 'badValue'],
            [[{ id: { $in: Array.from({ length: MAX_IN + 1 }, (_, i) => `x${i}`) } }], 'tooManyIn'],
        ]
        for (let [args, code] of bads) {
            let r = await call(args)
            assert.strict.deepEqual(r, { state: 'error', msg: `invalid find[${code}]` }, JSON.stringify(args).slice(0, 80))
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        }
    })

    //S3 (run04): 整個find之$in元素總數<=MAX_IN(跨鍵合計); 合計恰MAX_IN放行且真後端回正確之列, 合計超過以tooManyIn拒絕(select與delAll皆然, delAll被拒時資料表不變)
    it('整個find之$in元素總數上限(跨鍵合計): 恰MAX_IN放行並回正確之列, 超過拒絕', async function() {
        let fill = (head, tag, n) => [...head, ...Array.from({ length: n - head.length }, (_, i) => `${tag}${i}`)]
        let okFind = { id: { $in: fill(['a1', 'a2'], 'x', MAX_IN / 2) }, name: { $in: fill(['alpha', 'beta'], 'y', MAX_IN / 2) } } //合計恰MAX_IN
        let r = await call([okFind])
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(r.msg.map((v) => v.id).sort(), ['a1', 'a2'])
        assert.strict.deepEqual(cnt.orm[0].input, okFind, '元素完整保留')
        let ngFind = { id: { $in: fill(['a1', 'a2'], 'x', 600) }, name: { $in: fill(['alpha', 'beta'], 'y', 600) } } //各600, 合計1200
        for (let func of ['tabA.select', 'tabA.delAll']) {
            r = await call([ngFind], 'tokOk', func)
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[tooManyIn]' }, func)
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        }
        assert.strict.deepEqual(await ids(), ['a1', 'a2', 'a3'])
    })

    //S6 [鎖定]: delAll有條件者只刪符合者
    it('delAll: 白名單內有條件之find只刪除符合者', async function() {
        let r = await call([{ name: 'alpha' }], 'tokOk', 'tabA.delAll')
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(await ids(), ['a2', 'a3'])
        r = await call([{ id: { $in: ['a2', 'zzz'] } }], 'tokOk', 'tabA.delAll')
        assert.strict.equal(r.state, 'success')
        assert.strict.deepEqual(await ids(), ['a3'])
        assert.strict.deepEqual(cnt.orm[0].input, { id: { $in: ['a2', 'zzz'] } })
    })

    //S6 [鎖定]: delAll不給條件或{}依dspec為全部(與select同規則; requireKey預設關, Q11待使用者裁示)
    it('delAll: 未給與{}之find放行並刪除全部列(同select)', async function() {
        for (let args of [[], [{}]]) {
            await seed()
            let r = await call(args, 'tokOk', 'tabA.delAll')
            assert.strict.equal(r.state, 'success', JSON.stringify(args))
            assert.strict.deepEqual(await ids(), [], JSON.stringify(args))
        }
    })

    //S1~S4, S6 [重現]: 白名單外之delAll一律拒絕, 端到端不變式: 資料表一列不少(length鍵在w-serv-orm使條件消失而全刪, 其餘運算子隨後端)
    it('delAll: 白名單外之find一律拒絕, 資料表之列不變', async function() {
        let bads = [
            [[null], 'notObject'], [[[]], 'notObject'], [['abc'], 'notObject'], [[{ $where: 'true' }], 'badKey'], [[{ $or: [{ name: 'alpha' }] }], 'badKey'],
            [[{ name: { $gt: '' } }], 'badOperator'], [[{ name: { $regex: '.*' } }], 'badOperator'], [[{ length: 1, name: 'alpha' }], 'badKey'], [[{ id: 'a1', length: 3 }], 'badKey'],
            [[JSON.parse('{"name":"alpha","__proto__":{"x":1}}')], 'badKey'], [[{ name: null }], 'badValue'],
        ]
        for (let [args, code] of bads) {
            let r = await call(args, 'tokOk', 'tabA.delAll')
            assert.strict.deepEqual(r, { state: 'error', msg: `invalid find[${code}]` }, JSON.stringify(args))
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        }
        assert.strict.deepEqual(await ids(), ['a1', 'a2', 'a3'])
    })

    //S8 (D3) [鎖定]
    it('多餘參數(order、sort、limit)不交給授權函數與operOrm', async function() {
        for (let args of [[{}, { order: 'x' }], [{}, { sort: { name: -1 } }, { limit: 1 }]]) {
            let r = await call(args)
            assert.strict.equal(r.state, 'success', JSON.stringify(args))
            assert.strict.equal(r.msg.length, 3, '多餘參數不影響查詢(limit不生效)')
            assert.strict.equal(cnt.orm[0].n, 4, 'operOrm恆只收userId、tableName、methodName、input四個參數')
            assert.strict.deepEqual(Object.keys(cnt.auth[0]).sort(), ['input', 'methodName', 'tableName', 'userId'])
            assert.strict.deepEqual(cnt.auth[0].input, {})
            assert.strict.deepEqual(cnt.orm[0].input, {})
        }
    })

    //S7 [重現]
    it('__sysInputArgs__非陣列時回invalid input, 不呼叫授權函數與operOrm', async function() {
        for (let args of ['abc', { 0: { name: 'alpha' } }, 1, null, true]) {
            for (let func of ['tabA.select', 'tabA.delAll', '[sys:getFuncList]', '[sys:getTableTags]']) {
                let r = await call(args, 'tokOk', func)
                assert.strict.deepEqual(r, { state: 'error', msg: 'invalid input' }, `${func} ${JSON.stringify(args)}`)
                assert.strict.equal(cnt.auth.length, 0)
                assert.strict.equal(cnt.orm.length, 0)
            }
        }
        assert.strict.deepEqual(await ids(), ['a1', 'a2', 'a3']) //delAll未被執行
    })

    //S4 [重現]: 先驗後授權
    it('先驗後授權: 壞token+壞find回invalid find, 壞token+合法find回permission denied', async function() {
        let r = await call([{ $where: 'true' }], 'tokBad')
        assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[badKey]' })
        assert.strict.equal(cnt.auth.length, 0)
        r = await call([{}], 'tokBad')
        assert.strict.deepEqual(r, { state: 'error', msg: 'permission denied' })
        assert.strict.equal(cnt.orm.length, 0)
    })

    //S1~S3 [鎖定]: 官方客戶端之實際用法(w-web-perm/api/task之資料通道只送無參數select(), 同步取資料亦同)與其餘白名單內形狀全數通過
    it('官方客戶端$fapi: 無參數select()與白名單內之find全數通過', async function() {
        let idsOf = (r) => r.map((v) => v.id).sort()
        assert.strict.deepEqual(idsOf(await fapi.tabA.select()), ['a1', 'a2', 'a3'])
        assert.strict.deepEqual(idsOf(await fapi.tabA.select({})), ['a1', 'a2', 'a3'])
        assert.strict.deepEqual(idsOf(await fapi.tabA.select({ name: 'alpha' })), ['a1'])
        assert.strict.deepEqual(idsOf(await fapi.tabA.select({ id: { $in: ['a1', 'a2'] } })), ['a1', 'a2'])
    })

    //S4 [重現]: 官方客戶端送白名單外之find, 前端收到原因碼字串; delAll被拒時資料不變
    it('官方客戶端$fapi: 白名單外之find被拒絕, 前端收到invalid find字串', async function() {
        await assert.rejects(fapi.tabA.select({ $where: 'true' }), (err) => {
            assert.strict.equal(err, 'invalid find[badKey]')
            return true
        })
        await assert.rejects(fapi.tabA.select(null), (err) => {
            assert.strict.equal(err, 'invalid find[notObject]')
            return true
        })
        await assert.rejects(fapi.tabA.select(undefined), (err) => { //D2: undefined經JSON成null
            assert.strict.equal(err, 'invalid find[notObject]')
            return true
        })
        await assert.rejects(fapi.tabA.delAll({ $or: [{ name: 'alpha' }] }), (err) => {
            assert.strict.equal(err, 'invalid find[badKey]')
            return true
        })
        assert.strict.deepEqual(await ids(), ['a1', 'a2', 'a3'])
    })

})
