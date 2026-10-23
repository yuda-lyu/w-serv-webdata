import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import WServWebdataServerExec from '../src/WServWebdataServerExec.mjs'
import genPollingGate from '../src/genPollingGate.mjs'


//以evem建構(不開網路), 模擬w-converhp派發execute事件, 驗證系統函數([sys:getFuncList]、[sys:getTableTags]、[sys:polling])之身分關卡:
//  依據: 使用者身分驗證原則(C:\opensrcOper\dspec\使用者身分驗證原則.md)第二節7「系統函數:只回公開資訊者(函數名稱清單)可公開, 會回資料或改變狀態者須身分」與第二節2「getUserIdByToken即驗證身分之步驟」;
//  主控裁定Q1(②: 預設三者皆公開以相容已發布之前端元件〔輪詢不帶token〕, 嚴格設定為顯式只公開[sys:getFuncList]; 2026-10-24 webdata-run01-receipt)、Q2(輪詢經w-serv-broadcast 1.1.11之verifyPolling注入)、Q3(因無身分被拒時發error事件);任務修正輪範圍2、3
//  規則帳本: R16(系統函數之身分關卡與sysFuncsPublic)、R17(輪詢之鉤子注入、略過與clientId歸屬)
describe('unit-sysFuncs', function() {

    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-sysFuncs'
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

    let sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    //withTimeout, 回應懸置時以{ timeout: true }結束, 避免測試卡住
    let withTimeout = (pm, ms = 2000) => {
        return Promise.race([
            pm,
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ timeout: true })
                }, ms)
            }),
        ])
    }

    //以token決定反查結果: tokU1、tokU1b→u1, tokU2→u2, tokRej→reject字串, tokThrow→同步拋字串, tokNonStr→回傳數字, 其餘(含空字串與bad)→空字串
    let genGetUserId = (calls) => {
        return (token) => {
            calls.push(token)
            if (token === 'tokU1' || token === 'tokU1b') {
                return 'u1'
            }
            if (token === 'tokU2') {
                return Promise.resolve('u2')
            }
            if (token === 'tokRej') {
                return Promise.reject('errRej')
            }
            if (token === 'tokThrow') {
                // eslint-disable-next-line no-throw-literal
                throw 'errThrow' //刻意拋字串(非Error): 使用端可藉拒絕值回自己之語系鍵
            }
            if (token === 'tokNonStr') {
                return 123
            }
            return ''
        }
    }

    //mk, 建立useDbOrm=true之實體(不同步); calls為getUserIdByToken收到之token, errs為error事件, enters為clientEnter事件, cnt記錄授權函數與operOrm之呼叫
    let mk = (optExt = {}) => {
        let calls = []
        let errs = []
        let enters = []
        let cnt = { auth: [], orm: [], ext: [] }
        let opt = {
            fpTableTags,
            getUserIdByToken: genGetUserId(calls),
            useDbOrm: true,
            kpOrm: {},
            operOrm: async (userId, tableName, methodName, input) => {
                cnt.orm.push({ userId, tableName, methodName, input })
                return [{ id: 'r1' }]
            },
            tableNamesExec: ['tabA'],
            methodsExec: ['select'],
            authorizeExec: (arg) => {
                cnt.auth.push(arg)
                return true
            },
            kpFunExt: {
                who: (userId) => {
                    cnt.ext.push(userId)
                    return `who:${userId}`
                },
            },
            ...optExt,
        }
        let inst = evem()
        insts.push(inst)
        new WServWebdataServer(inst, opt)
        inst.on('error', (e) => {
            errs.push(e)
        })
        inst.on('clientEnter', (id, data) => {
            enters.push({ id, data })
        })
        let nTags = { n: 0 } //[sys:getTableTags]實際被執行之次數
        let getTableTags = inst.getTableTags
        inst.getTableTags = () => {
            nTags.n++
            return getTableTags()
        }
        return { inst, calls, errs, enters, cnt, nTags }
    }

    //exec, 模擬w-converhp派發execute事件(資料通道之協定: __sysToken__與__sysInputArgs__), 回傳回應
    let exec = async (inst, func, args = [], token = 'tokU1') => {
        let pm = genPm()
        inst.emit('execute', func, { __sysToken__: token, __sysInputArgs__: args }, pm)
        let r = await withTimeout(pm)
        await sleep(30) //error事件由w-serv-broadcast與本套件以1ms計時器派發
        return r
    }

    //poll, 模擬前端輪詢(輸入為{ clientId, __sysToken__ }, token為undefined時不帶該鍵), 回傳{ ok: true, v }或{ ok: false, err }
    let poll = async (inst, clientId, token) => {
        let input = { clientId }
        if (token !== undefined) {
            input.__sysToken__ = token
        }
        let pm = genPm()
        inst.emit('execute', '[sys:polling]', input, pm)
        let r = await withTimeout(pm.then((v) => {
            return { ok: true, v }
        }, (err) => {
            return { ok: false, err }
        }))
        await sleep(120) //clientEnter由w-serv-broadcast之在線偵測(偵測間隔50ms)發出, error事件亦以1ms計時器派發
        return r
    }

    let sysAll = ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']

    //token狀態: 反查之結果與次數(token未帶時不反查)
    let tokenStates = [
        { name: '有效token', token: 'tokU1', lookups: 1, userId: 'u1' },
        { name: '空字串token', token: '', lookups: 1, userId: '' },
        { name: '無效token(反查得空字串)', token: 'bad', lookups: 1, userId: '' },
        { name: '反查回傳非字串', token: 'tokNonStr', lookups: 1, userId: '' },
        { name: '反查reject', token: 'tokRej', lookups: 1, rejected: 'errRej' },
        { name: '反查同步拋錯', token: 'tokThrow', lookups: 1, rejected: 'errThrow' },
        //非字串token(自寫客戶端可送): 同資料通道以cstr轉為字串後反查(數字轉字串, 其餘型別轉空字串), 反查函數收到者恆為字串
        { name: 'token為數字', token: 123, lookupToken: '123', lookups: 1, userId: '' },
        { name: 'token為null', token: null, lookupToken: '', lookups: 1, userId: '' },
        { name: 'token為物件', token: { a: 1 }, lookupToken: '', lookups: 1, userId: '' },
    ]

    //lookupOf, 反查函數實際應收到之token
    let lookupOf = (st) => {
        return st.lookupToken !== undefined ? st.lookupToken : st.token
    }

    //sysFuncsPublic設定: pub為各系統函數是否公開(依設定內容人工寫出, 不由程式推導)
    let configs = [
        { name: '未給(預設: 三者皆公開)', opt: undefined, pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': true, '[sys:polling]': true } },
        { name: 'null(同未給)', opt: null, pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': true, '[sys:polling]': true } },
        { name: '空陣列', opt: [], pub: { '[sys:getFuncList]': false, '[sys:getTableTags]': false, '[sys:polling]': false } },
        { name: '只含getFuncList(建議之嚴格設定)', opt: ['[sys:getFuncList]'], pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': false, '[sys:polling]': false } },
        { name: '只含getTableTags', opt: ['[sys:getTableTags]'], pub: { '[sys:getFuncList]': false, '[sys:getTableTags]': true, '[sys:polling]': false } },
        { name: '只含polling', opt: ['[sys:polling]'], pub: { '[sys:getFuncList]': false, '[sys:getTableTags]': false, '[sys:polling]': true } },
        { name: '含getFuncList與getTableTags', opt: ['[sys:getFuncList]', '[sys:getTableTags]'], pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': true, '[sys:polling]': false } },
        { name: '含getFuncList與polling', opt: ['[sys:getFuncList]', '[sys:polling]'], pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': false, '[sys:polling]': true } },
        { name: '含getTableTags與polling', opt: ['[sys:getTableTags]', '[sys:polling]'], pub: { '[sys:getFuncList]': false, '[sys:getTableTags]': true, '[sys:polling]': true } },
        { name: 'polling重複', opt: ['[sys:polling]', '[sys:polling]'], pub: { '[sys:getFuncList]': false, '[sys:getTableTags]': false, '[sys:polling]': true } },
        { name: '三者(sso型)', opt: sysAll, pub: { '[sys:getFuncList]': true, '[sys:getTableTags]': true, '[sys:polling]': true } },
    ]

    describe('R16 系統函數之身分關卡', function() {

        //原則§二7+裁示Q1: 函數名稱清單可公開(預設), getTableTags會回資料(同步表時間戳)須身分; 原則§二2: 反查reject即拒絕(含公開者)
        it('[sys:getFuncList]、[sys:getTableTags] × token狀態 × sysFuncsPublic設定', async function() {
            for (let cfg of configs) {
                let { inst, calls, errs, nTags } = mk(cfg.opt === undefined ? {} : { sysFuncsPublic: cfg.opt })
                for (let func of ['[sys:getFuncList]', '[sys:getTableTags]']) {
                    for (let st of tokenStates) {
                        let label = `${cfg.name}｜${func}｜${st.name}`
                        calls.length = 0
                        errs.length = 0
                        let n0 = nTags.n
                        let r = await exec(inst, func, [], st.token)
                        assert.strict.deepEqual(calls, [lookupOf(st)], `${label}: 反查1次且為該token`)
                        if (st.rejected !== undefined) {
                            //反查reject: 拒絕值原樣成為回應, 公開與否皆拒, 不執行, 發error事件(原拒絕值)
                            assert.strict.deepEqual(r, { state: 'error', msg: st.rejected }, label)
                            assert.strict.deepEqual(errs, [st.rejected], `${label}: error事件為原拒絕值`)
                            assert.strict.equal(nTags.n, n0, `${label}: 不執行`)
                        }
                        else if (st.userId === '' && !cfg.pub[func]) {
                            //無身分且未公開: 固定拒絕鍵, 不執行, 發error事件(Q3)
                            assert.strict.deepEqual(r, { state: 'error', msg: 'permission denied' }, label)
                            assert.strict.deepEqual(errs, [{ msg: 'permission denied', func }], `${label}: error事件`)
                            assert.strict.equal(nTags.n, n0, `${label}: 不執行`)
                        }
                        else {
                            //有身分, 或無身分但公開: 放行
                            assert.strict.equal(r.state, 'success', label)
                            assert.strict.deepEqual(errs, [], `${label}: 無error事件`)
                            if (func === '[sys:getFuncList]') {
                                assert.strict.deepEqual(r.msg, ['tabA.select', 'who'], label)
                            }
                            else {
                                assert.strict.deepEqual(r.msg, { mode: 'syncKpTable', data: {} }, label)
                                assert.strict.equal(nTags.n, n0 + 1, `${label}: 執行1次`)
                            }
                        }
                    }
                }
            }
        })

        //裁示Q1②: 預設三者皆公開(相容已發布之前端元件), 逐項釘住(與上列矩陣互為印證)
        it('預設(未給)三者皆公開: 空身分亦可取得函數清單與時間戳', async function() {
            let { inst, errs, nTags } = mk()
            let r1 = await exec(inst, '[sys:getFuncList]', [], '')
            assert.strict.deepEqual(r1, { state: 'success', msg: ['tabA.select', 'who'] })
            let r2 = await exec(inst, '[sys:getTableTags]', [], '')
            assert.strict.deepEqual(r2, { state: 'success', msg: { mode: 'syncKpTable', data: {} } })
            assert.strict.equal(nTags.n, 1)
            assert.strict.deepEqual(errs, [])
            assert.strict.deepEqual(await poll(inst, 'c1', ''), { ok: true, v: [] }, '空token之輪詢')
        })

        //裁示Q1②+原則§二7: 建議之嚴格設定(只公開函數清單): 空身分取得函數清單, 但getTableTags被拒絕且不執行
        it('嚴格設定只公開[sys:getFuncList]: 空身分取得函數清單, 但getTableTags被拒絕且不執行', async function() {
            let { inst, errs, nTags } = mk({ sysFuncsPublic: ['[sys:getFuncList]'] })
            let r1 = await exec(inst, '[sys:getFuncList]', [], '')
            assert.strict.deepEqual(r1, { state: 'success', msg: ['tabA.select', 'who'] })
            let r2 = await exec(inst, '[sys:getTableTags]', [], '')
            assert.strict.deepEqual(r2, { state: 'error', msg: 'permission denied' })
            assert.strict.equal(nTags.n, 0)
            assert.strict.deepEqual(errs, [{ msg: 'permission denied', func: '[sys:getTableTags]' }])
            let r3 = await exec(inst, '[sys:getTableTags]', [], 'tokU1')
            assert.strict.deepEqual(r3, { state: 'success', msg: { mode: 'syncKpTable', data: {} } })
            assert.strict.equal(nTags.n, 1)
        })

        //裁示Q1: sysFuncsPublic為空陣列時, 連函數清單亦須身分
        it('sysFuncsPublic為空陣列時, [sys:getFuncList]亦須身分', async function() {
            let { inst } = mk({ sysFuncsPublic: [] })
            assert.strict.deepEqual(await exec(inst, '[sys:getFuncList]', [], ''), { state: 'error', msg: 'permission denied' })
            assert.strict.deepEqual(await exec(inst, '[sys:getFuncList]', [], 'tokU1'), { state: 'success', msg: ['tabA.select', 'who'] })
        })

        //useDbOrm=false亦有系統函數(sso為useDbOrm:false), sysFuncsPublic與useDbOrm無關
        it('useDbOrm=false時sysFuncsPublic亦生效', async function() {
            let { inst } = mk({ useDbOrm: false, operOrm: undefined, kpOrm: undefined, tableNamesExec: undefined, methodsExec: undefined, authorizeExec: undefined, sysFuncsPublic: ['[sys:getTableTags]'] })
            assert.strict.deepEqual(await exec(inst, '[sys:getTableTags]', [], ''), { state: 'success', msg: { mode: 'syncKpTable', data: {} } })
            assert.strict.deepEqual(await exec(inst, '[sys:getFuncList]', [], ''), { state: 'error', msg: 'permission denied' })
        })

        //sysFuncsPublic拷貝: 建構後外部修改陣列不影響
        it('sysFuncsPublic於建構時快照, 建構後修改原陣列不生效', async function() {
            let pub = ['[sys:getFuncList]']
            let { inst } = mk({ sysFuncsPublic: pub })
            pub.push('[sys:getTableTags]')
            pub.shift()
            assert.strict.deepEqual(await exec(inst, '[sys:getTableTags]', [], ''), { state: 'error', msg: 'permission denied' })
            assert.strict.equal((await exec(inst, '[sys:getFuncList]', [], '')).state, 'success')
        })

        //任務不得改變: 表操作與kpFunExt之空userId語意不變(交authorizeExec或函數自行把關, sso依賴), 不受sysFuncsPublic影響
        it('表操作與kpFunExt之空userId語意不變(不論sysFuncsPublic為何)', async function() {
            for (let pub of [undefined, [], sysAll]) {
                let { inst, cnt } = mk(pub === undefined ? {} : { sysFuncsPublic: pub })
                let r1 = await exec(inst, 'tabA.select', [{}], '')
                assert.strict.equal(r1.state, 'success')
                assert.strict.deepEqual(cnt.auth.map((v) => v.userId), [''], '授權函數收到空userId')
                assert.strict.equal(cnt.orm.length, 1)
                let r2 = await exec(inst, 'who', [], '')
                assert.strict.deepEqual(r2, { state: 'success', msg: 'who:' }, 'kpFunExt以空userId執行')
            }
        })

        //任務不得改變 + 原則§二2: 反查reject時表操作與kpFunExt仍不執行(規則4釘住)
        it('反查reject時表操作與kpFunExt不執行', async function() {
            let { inst, cnt } = mk()
            assert.strict.deepEqual(await exec(inst, 'tabA.select', [{}], 'tokRej'), { state: 'error', msg: 'errRej' })
            assert.strict.deepEqual(await exec(inst, 'who', [], 'tokRej'), { state: 'error', msg: 'errRej' })
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
            assert.strict.equal(cnt.ext.length, 0)
        })

        //既有行為釘住: 協定鍵缺漏於反查之前即拒絕(不呼叫getUserIdByToken), 各系統函數皆然
        it('協定鍵缺漏或參數非陣列時不反查(含系統函數)', async function() {
            let { inst, calls } = mk()
            for (let func of ['[sys:getFuncList]', '[sys:getTableTags]', 'who']) {
                let pm = genPm()
                inst.emit('execute', func, { __sysInputArgs__: [] }, pm)
                assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid token' }, `${func}: 無__sysToken__`)
                pm = genPm()
                inst.emit('execute', func, { __sysToken__: 'tokU1' }, pm)
                assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid input' }, `${func}: 無__sysInputArgs__`)
                pm = genPm()
                inst.emit('execute', func, { __sysToken__: 'tokU1', __sysInputArgs__: 'abc' }, pm)
                assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid input' }, `${func}: 參數非陣列`)
            }
            assert.strict.deepEqual(calls, [])
        })

        //既有行為釘住: 不存在之函數亦先反查再判斷
        it('不存在之函數先反查, 反查reject時回拒絕值, 得空字串時回invalid func', async function() {
            let { inst, calls } = mk()
            assert.strict.deepEqual(await exec(inst, 'nothing', [], 'tokRej'), { state: 'error', msg: 'errRej' })
            assert.strict.deepEqual(await exec(inst, '[sys:nothing]', [], ''), { state: 'error', msg: 'invalid func[[sys:nothing]]' })
            assert.strict.deepEqual(calls, ['tokRej', ''])
        })

        //系統函數之函數清單內容(釘住): 不含[sys:getTableTags]與[sys:polling]
        it('函數清單含表操作與kpFunExt, 不含系統函數', async function() {
            let { inst } = mk({ sysFuncsPublic: sysAll })
            let r = await exec(inst, '[sys:getFuncList]', [], '')
            assert.strict.deepEqual(r, { state: 'success', msg: ['tabA.select', 'who'] })
        })

        //裁示Q1②: 未注入getUserIdByToken(預設async()=>'', 無身分)且未設sysFuncsPublic(sso型相容): 三者皆可匿名; 嚴格設定(只公開函數清單)時另兩者被拒
        it('未給或null之getUserIdByToken(預設無身分): 預設三者皆可匿名, 嚴格設定時只剩[sys:getFuncList]', async function() {
            for (let v of [undefined, null]) {
                let a = mk({ getUserIdByToken: v })
                assert.strict.equal((await exec(a.inst, '[sys:getFuncList]', [], 'tokU1')).state, 'success', '函數清單')
                assert.strict.equal((await exec(a.inst, '[sys:getTableTags]', [], 'tokU1')).state, 'success', '預設可匿名取時間戳')
                assert.strict.deepEqual(await poll(a.inst, 'c1', 'tokU1'), { ok: true, v: [] }, '預設可匿名輪詢')
                assert.strict.deepEqual(a.errs, [])

                let { inst, errs } = mk({ getUserIdByToken: v, sysFuncsPublic: ['[sys:getFuncList]'] })
                assert.strict.equal((await exec(inst, '[sys:getFuncList]', [], 'tokU1')).state, 'success', '函數清單')
                assert.strict.deepEqual(await exec(inst, '[sys:getTableTags]', [], 'tokU1'), { state: 'error', msg: 'permission denied' }, '即使帶token, 預設反查恆得空字串')
                assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: false, err: '[sys:polling] permission denied' })
                assert.strict.deepEqual(errs.map((e) => e.msg), ['permission denied', '[sys:polling] permission denied'])
            }
        })

        //裁示Q1②+範圍2: 已發布之舊前端元件之輪詢輸入恰為{ clientId }(不帶__sysToken__); 預設下可綁定、輪詢、收廣播, 且不因getUserIdByToken對空token拒絕(fail-closed之部署)而失敗; 該輪詢不反查
        it('預設下舊前端元件(輪詢不帶__sysToken__)可輪詢並收廣播, 不反查', async function() {
            let { inst, calls, errs } = mk({
                getUserIdByToken: (token) => {
                    calls.push(token)
                    if (token === '') {
                        return Promise.reject('errUserIdMissing') //fail-closed: 對空token拒絕(perm、api、task型)
                    }
                    return 'u1'
                },
            })
            assert.strict.deepEqual(await poll(inst, 'old1', undefined), { ok: true, v: [] }, '首輪')
            inst.broadcast({ n: 1 })
            assert.strict.deepEqual(await poll(inst, 'old1', undefined), { ok: true, v: [{ mode: 'broadcast', data: { n: 1 } }] }, '收廣播')
            assert.strict.deepEqual(calls, [], '舊前端輪詢未出示token, 不反查')
            assert.strict.deepEqual(errs, [])
            //其他函數照常: 舊前端之函數清單、時間戳、函數呼叫皆帶本體token
            assert.strict.equal((await exec(inst, '[sys:getFuncList]', [], 'tokOk')).state, 'success')
            assert.strict.equal((await exec(inst, '[sys:getTableTags]', [], 'tokOk')).state, 'success')
            //帶鍵之輪詢(新前端元件)對空token仍依反查結果拒絕(fail-closed), 不因公開而例外
            assert.strict.deepEqual(await poll(inst, 'new1', ''), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(errs, [{ msg: '[sys:polling] verifyPolling error', err: 'errUserIdMissing' }])
        })

        //裁示Q1②+範圍2: 嚴格設定(只公開函數清單)下, 無身分之輪詢(含舊前端元件不帶token者)與時間戳被拒, 帶有效token之新前端元件照常
        it('嚴格設定下舊前端元件(無身分)之輪詢被拒, 帶有效token之輪詢放行', async function() {
            let { inst, errs, nTags } = mk({ sysFuncsPublic: ['[sys:getFuncList]'] })
            assert.strict.deepEqual(await poll(inst, 'old1', undefined), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(errs, [{ msg: '[sys:polling] permission denied', err: 'empty userId' }])
            assert.strict.deepEqual(await poll(inst, 'old1', ''), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(await exec(inst, '[sys:getTableTags]', [], ''), { state: 'error', msg: 'permission denied' })
            assert.strict.equal(nTags.n, 0)
            assert.strict.deepEqual(await poll(inst, 'new1', 'tokU1'), { ok: true, v: [] })
            assert.strict.equal((await exec(inst, '[sys:getTableTags]', [], 'tokU1')).state, 'success')
        })

        //原則§二2: 反查之拒絕值為falsy(undefined、null、false、0、空字串)時亦為拒絕, 不得被當成匿名成功(各系統函數、輪詢; 公開者亦然; reject與同步拋錯皆然)
        it('反查reject或同步拋出falsy值時一律拒絕(含公開之系統函數與輪詢)', async function() {
            for (let mode of ['reject', 'throw']) {
                for (let v of [undefined, null, false, 0, '']) {
                    let label = `${mode}[${String(v)}]`
                    let getUserIdByToken = () => {
                        if (mode === 'reject') {
                            return Promise.reject(v)
                        }
                        throw v
                    }
                    let { inst, errs, nTags, cnt } = mk({ getUserIdByToken, sysFuncsPublic: sysAll })
                    for (let func of ['[sys:getFuncList]', '[sys:getTableTags]']) {
                        errs.length = 0
                        let r = await exec(inst, func, [], 'tokU1')
                        assert.strict.deepEqual(r, { state: 'error', msg: v }, `${label}: ${func}`)
                        assert.strict.equal(errs.length, 1, `${label}: ${func}發1則error事件`)
                    }
                    assert.strict.equal(nTags.n, 0, `${label}: 不執行`)
                    assert.strict.deepEqual(await exec(inst, 'who', [], 'tokU1'), { state: 'error', msg: v }, `${label}: kpFunExt`)
                    assert.strict.deepEqual(cnt.ext, [], `${label}: kpFunExt不執行`)
                    errs.length = 0
                    let r2 = await poll(inst, 'c1', 'tokU1')
                    assert.strict.deepEqual(r2, { ok: false, err: '[sys:polling] permission denied' }, `${label}: 輪詢`)
                    assert.strict.deepEqual(errs, [{ msg: '[sys:polling] verifyPolling error', err: v }], `${label}: 輪詢error事件含原拒絕值`)
                    assert.strict.equal(inst.getClients().length, 0, `${label}: 不建立在線身分`)
                }
            }
        })
    })

    describe('R17 輪詢之身分關卡', function() {

        //Q2(2c)+原則§二2: 輪詢經verifyPolling反查身分; 空身分依sysFuncsPublic是否含[sys:polling]; reject一律拒絕
        it('[sys:polling] × token狀態(含未帶token鍵) × sysFuncsPublic設定', async function() {
            //未帶__sysToken__鍵(已發布之舊前端元件, 輪詢輸入恰為{ clientId }): 未出示token, 以空身分處理而不反查(公開時放行, 否則拒絕); 帶鍵者(含空字串、非字串)每輪恰反查1次且reject一律拒絕
            let states = [...tokenStates, { name: '未帶__sysToken__鍵(舊前端)', token: undefined, lookups: 0, userId: '' }]
            for (let cfg of configs) {
                let { inst, calls, errs, enters } = mk(cfg.opt === undefined ? {} : { sysFuncsPublic: cfg.opt })
                let pub = cfg.pub['[sys:polling]']
                let i = 0
                for (let st of states) {
                    i++
                    let label = `${cfg.name}｜${st.name}`
                    let clientId = `c-${i}`
                    calls.length = 0
                    errs.length = 0
                    enters.length = 0
                    let r = await poll(inst, clientId, st.token)
                    assert.strict.deepEqual(calls, st.lookups === 1 ? [lookupOf(st)] : [], `${label}: 帶鍵者每輪恰反查1次且為該token, 未帶鍵者不反查`)
                    if (st.rejected !== undefined) {
                        assert.strict.deepEqual(r, { ok: false, err: '[sys:polling] permission denied' }, label)
                        assert.strict.deepEqual(errs, [{ msg: '[sys:polling] verifyPolling error', err: st.rejected }], `${label}: error事件`)
                    }
                    else if (st.userId === '' && !pub) {
                        assert.strict.deepEqual(r, { ok: false, err: '[sys:polling] permission denied' }, label)
                        assert.strict.deepEqual(errs, [{ msg: '[sys:polling] permission denied', err: 'empty userId' }], `${label}: error事件`)
                    }
                    else {
                        assert.strict.deepEqual(r, { ok: true, v: [] }, label)
                        assert.strict.deepEqual(errs, [], `${label}: 無error事件`)
                    }
                    //放行才建立在線身分; 拒絕者不建立在線身分、佇列與clientEnter
                    let passed = r.ok === true
                    assert.strict.equal(inst.getClients().some((v) => v.key === clientId), passed, `${label}: 在線身分`)
                    assert.strict.equal(Object.prototype.hasOwnProperty.call(inst.getMessages(), clientId), passed, `${label}: 佇列`)
                    assert.strict.deepEqual(enters.map((v) => v.id), passed ? [clientId] : [], `${label}: clientEnter`)
                }
            }
        })

        //完成條件3: execFun略過輪詢(L12)——放行之輪詢得到w-serv-broadcast之陣列回覆, 而非資料通道的invalid input/invalid token
        it('execFun略過[sys:polling]: 放行時回覆為廣播之陣列, 且其後之廣播可被取走', async function() {
            let { inst, calls } = mk({ sysFuncsPublic: ['[sys:polling]'] })
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: true, v: [] })
            inst.broadcast({ n: 1 })
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: true, v: [{ mode: 'broadcast', data: { n: 1 } }] })
            assert.strict.deepEqual(calls, ['tokU1', 'tokU1'], '每輪輪詢反查恰1次')
        })

        //execFun略過輪詢: 被拒絕時只發一則error事件(execFun若回傳被拒絕之pm, execute監聽器之catch會多發一則)
        it('輪詢被拒絕時只發一則error事件, 且回覆為固定訊息', async function() {
            let { inst, errs } = mk({ sysFuncsPublic: ['[sys:getFuncList]'] }) //嚴格設定: 空身分之輪詢被拒
            let r = await poll(inst, 'c1', '')
            assert.strict.deepEqual(r, { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.equal(errs.length, 1)
        })

        //w-serv-broadcast 1.1.11: token不進入clientEnter之data
        it('clientEnter之data不含__sysToken__', async function() {
            let { inst, enters } = mk()
            await poll(inst, 'c1', 'tokU1')
            assert.strict.deepEqual(enters, [{ id: 'c1', data: { clientId: 'c1' } }])
        })

        //原則§二7: 輪詢會建立在線身分並取走廣播, 匿名者(未公開時)收不到廣播, 有身分者收得到
        it('嚴格設定下匿名者收不到部署方之廣播, 有身分者收得到', async function() {
            let { inst } = mk({ sysFuncsPublic: ['[sys:getFuncList]'] })
            assert.strict.deepEqual(await poll(inst, 'cA', 'tokU1'), { ok: true, v: [] })
            inst.broadcast('secret')
            assert.strict.deepEqual(await poll(inst, 'cX', ''), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(await poll(inst, 'cX', undefined), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(await poll(inst, 'cX', 'bad'), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(Object.keys(inst.getMessages()), ['cA'], '匿名者無佇列')
            assert.strict.deepEqual(await poll(inst, 'cA', 'tokU1'), { ok: true, v: [{ mode: 'broadcast', data: 'secret' }] })
        })

        //L16: 廣播停止後, 資料通道維持回invalid token, 且不反查
        it('clearBroadcast後輪詢回invalid token且不反查', async function() {
            let { inst, calls } = mk({ sysFuncsPublic: ['[sys:polling]'] })
            inst.clearBroadcast()
            let pm = genPm()
            inst.emit('execute', '[sys:polling]', { clientId: 'c1', __sysToken__: 'tokU1' }, pm)
            assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid token' })
            pm = genPm()
            inst.emit('execute', '[sys:polling]', { clientId: 'c1' }, pm)
            assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid token' })
            assert.strict.deepEqual(calls, [])
        })

        //未建構廣播(單獨使用Exec)時, 輪詢不由本套件處理, 回invalid token
        it('單獨建構Exec時[sys:polling]回invalid token', async function() {
            let calls = []
            let inst = evem()
            new WServWebdataServerExec(inst, { getUserIdByToken: genGetUserId(calls) })
            let pm = genPm()
            inst.emit('execute', '[sys:polling]', { clientId: 'c1', __sysToken__: 'tokU1' }, pm)
            assert.strict.deepEqual(await withTimeout(pm), { state: 'error', msg: 'invalid token' })
            assert.strict.deepEqual(calls, [])
        })
    })

    describe('R17 輪詢之clientId歸屬', function() {

        //任務範圍3: 首次輪詢綁定clientId與身分, 其後不同身分輪詢同一clientId即拒; 同身分(不同token)照常; 不同clientId互不影響
        it('不同身分輪詢同一clientId被拒絕且不取走佇列, 原身分照常, 其他clientId互不影響', async function() {
            let { inst, errs } = mk()
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: true, v: [] })
            inst.broadcast('m1')
            errs.length = 0
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(errs, [{ msg: '[sys:polling] permission denied', err: 'clientId belongs to another userId' }])
            assert.strict.deepEqual(inst.getMessages().c1, [{ mode: 'broadcast', data: 'm1' }], '被拒絕者未取走佇列')
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1b'), { ok: true, v: [{ mode: 'broadcast', data: 'm1' }] }, '同身分(另一token)照常並取得廣播')
            assert.strict.deepEqual(await poll(inst, 'c2', 'tokU2'), { ok: true, v: [] }, '其他clientId由另一身分綁定')
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(await poll(inst, 'c2', 'tokU1'), { ok: false, err: '[sys:polling] permission denied' })
        })

        //被拒絕之輪詢不刷新在線身分、不發clientEnter
        it('被拒絕之輪詢不改變原clientId之在線身分', async function() {
            let { inst, enters } = mk()
            await poll(inst, 'c1', 'tokU1')
            await poll(inst, 'c1', 'tokU2')
            assert.strict.deepEqual(enters, [{ id: 'c1', data: { clientId: 'c1' } }])
            assert.strict.equal(inst.getClients().filter((v) => v.key === 'c1').length, 1)
        })

        //匿名(公開時之空身分)亦為一種身分: 與有身分者互不可冒用
        it('公開時匿名與有身分者之間亦不可互用同一clientId', async function() {
            let { inst } = mk({ sysFuncsPublic: ['[sys:polling]'] })
            assert.strict.deepEqual(await poll(inst, 'a1', undefined), { ok: true, v: [] }, '匿名綁定')
            assert.strict.deepEqual(await poll(inst, 'a1', 'tokU1'), { ok: false, err: '[sys:polling] permission denied' }, '有身分者不可取用匿名之clientId')
            assert.strict.deepEqual(await poll(inst, 'a1', ''), { ok: true, v: [] }, '匿名(空token)仍同一身分')
            assert.strict.deepEqual(await poll(inst, 'u1', 'tokU1'), { ok: true, v: [] }, '有身分綁定')
            assert.strict.deepEqual(await poll(inst, 'u1', undefined), { ok: false, err: '[sys:polling] permission denied' }, '匿名不可取用有身分者之clientId')
        })

        //並發: 兩個身分同時以同一clientId輪詢, 恰一者綁定成功(檢查與綁定在反查之await之後同步執行)
        it('並發輪詢同一clientId時恰一個身分綁定成功', async function() {
            let { inst } = mk({
                getUserIdByToken: async (token) => {
                    await sleep(token === 'tokU1' ? 40 : 5)
                    return token === 'tokU1' ? 'u1' : 'u2'
                },
            })
            let [a, b] = await Promise.all([poll(inst, 'cc', 'tokU1'), poll(inst, 'cc', 'tokU2')])
            assert.strict.deepEqual([a.ok, b.ok], [false, true], '先完成反查者(u2)綁定')
            assert.strict.deepEqual(await poll(inst, 'cc', 'tokU2'), { ok: true, v: [] })
            assert.strict.deepEqual(await poll(inst, 'cc', 'tokU1'), { ok: false, err: '[sys:polling] permission denied' })
        })

        //綁定之生命週期: 在線逾時(w-serv-broadcast固定10秒, 期間無被放行之輪詢)發出clientLeave時解除, 其後可由其他身分重新綁定
        it('在線逾時回收後解除綁定, 其他身分可重新綁定', async function() {
            this.timeout(40000)
            let { inst } = mk()
            assert.strict.deepEqual(await poll(inst, 'cl', 'tokU1'), { ok: true, v: [] })
            assert.strict.deepEqual(await poll(inst, 'cl', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' }, '在線期間不可冒用')
            await withTimeout(new Promise((resolve) => {
                inst.on('clientLeave', (id) => {
                    if (id === 'cl') {
                        resolve({ left: true })
                    }
                })
            }), 20000).then((r) => {
                assert.strict.deepEqual(r, { left: true }, '逾時後發出clientLeave')
            })
            await sleep(30) //本套件之clientLeave監聽先於此測試掛上之監聽, 已解除
            assert.strict.deepEqual(await poll(inst, 'cl', 'tokU2'), { ok: true, v: [] }, '逾時後另一身分可綁定')
        })

        //genPollingGate單元: 停止後不再綁定; release只解除指定clientId
        it('genPollingGate: stop後回stopped且不綁定; release解除指定clientId', async function() {
            let uid = { v: 'u1' }
            let gate = genPollingGate({ getUserIdByToken: async () => uid.v, isPublic: false })
            let inp = (clientId) => {
                return { clientId, __sysToken__: 't' }
            }
            assert.strict.equal(await gate.verifyPolling(inp('c1')), true)
            assert.strict.equal(await gate.verifyPolling(inp('c2')), true)
            uid.v = 'u2'
            assert.strict.equal(await gate.verifyPolling(inp('c1')), 'clientId belongs to another userId')
            gate.release('c1')
            assert.strict.equal(await gate.verifyPolling(inp('c1')), true, 'release後可重新綁定')
            assert.strict.equal(await gate.verifyPolling(inp('c2')), 'clientId belongs to another userId', '其他clientId之綁定保留')
            assert.strict.equal(gate.isStopped(), false)
            gate.stop()
            assert.strict.equal(gate.isStopped(), true)
            assert.strict.equal(await gate.verifyPolling(inp('c3')), 'stopped')
        })

        //genPollingGate單元: 反查期間停止者不綁定(w-serv-broadcast於停止後亦不處理其結果)
        it('genPollingGate: 反查期間停止者不綁定', async function() {
            let gate = genPollingGate({
                getUserIdByToken: async () => {
                    await sleep(20)
                    return 'u1'
                },
                isPublic: false,
            })
            let pm = gate.verifyPolling({ clientId: 'c1', __sysToken__: 't' })
            gate.stop()
            assert.strict.equal(await pm, 'stopped')
        })

        //任務範圍3: 被拒絕之輪詢不得改變原綁定(外審sol #8): 同一他人身分連續多次輪詢皆被拒絕, 原身分之綁定與佇列不受影響, 其間原身分不重新輪詢
        it('同一他人身分連續多次輪詢同一clientId皆被拒絕, 原綁定與佇列不受影響', async function() {
            let { inst } = mk()
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: true, v: [] })
            inst.broadcast('m1')
            for (let i = 0; i < 3; i++) {
                assert.strict.deepEqual(await poll(inst, 'c1', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' }, `第${i + 1}次`)
            }
            assert.strict.deepEqual(inst.getMessages().c1, [{ mode: 'broadcast', data: 'm1' }], '佇列未被取走')
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU1'), { ok: true, v: [{ mode: 'broadcast', data: 'm1' }] }, '原身分仍取得廣播')
            assert.strict.deepEqual(await poll(inst, 'c1', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' }, '原身分輪詢後仍拒絕他人')
        })

        //廣播契約: 任意非空字串皆為一般識別(含__proto__、constructor、含.或[]者), 大小寫視為不同識別; 歸屬檢查不可改寫識別(外審sol #12)
        it('任意字串clientId(含__proto__、constructor、含點或括號、大小寫不同)之歸屬互不影響', async function() {
            let { inst } = mk()
            let ids = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'a.b', 'a[0]', 'length', '0', '中文id', ' ']
            for (let id of ids) {
                assert.strict.deepEqual(await poll(inst, id, 'tokU1'), { ok: true, v: [] }, `${id}: 首次綁定`)
            }
            for (let id of ids) {
                assert.strict.deepEqual(await poll(inst, id, 'tokU2'), { ok: false, err: '[sys:polling] permission denied' }, `${id}: 他人被拒`)
                assert.strict.deepEqual(await poll(inst, id, 'tokU1b'), { ok: true, v: [] }, `${id}: 同身分照常`)
            }
            //大小寫不同者為不同識別: 兩個身分各綁其一, 互不影響
            assert.strict.deepEqual(await poll(inst, 'C', 'tokU1'), { ok: true, v: [] })
            assert.strict.deepEqual(await poll(inst, 'c', 'tokU2'), { ok: true, v: [] }, '小寫c未被大寫C之綁定影響')
            assert.strict.deepEqual(await poll(inst, 'C', 'tokU2'), { ok: false, err: '[sys:polling] permission denied' })
            assert.strict.deepEqual(await poll(inst, 'c', 'tokU1'), { ok: false, err: '[sys:polling] permission denied' })
            //一般物件之原型不受污染
            assert.strict.equal(Object.prototype.u1, undefined)
            assert.strict.equal({}.polluted, undefined)
        })

        //廣播契約: clientId非非空字串者於鉤子之前即被拒絕(不反查、不建立任何狀態)
        it('clientId為空字串、非字串或缺漏時於反查之前即被拒絕', async function() {
            let { inst, calls } = mk()
            for (let id of ['', 123, null, undefined, {}, ['c1']]) {
                let r = await poll(inst, id, 'tokU1')
                assert.strict.deepEqual(r, { ok: false, err: '[sys:polling] invalid clientId' }, JSON.stringify(id))
            }
            assert.strict.deepEqual(calls, [], '不反查')
            assert.strict.equal(inst.getClients().length, 0)
        })
    })
})
