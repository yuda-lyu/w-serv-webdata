import assert from 'assert'
import fs from 'fs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import checkFind, { MAX_IN, MAX_KEYS, MAX_KEY_LEN, MAX_STR } from '../src/checkFind.mjs'


//資料通道對select、delAll之find做形狀與運算子白名單(帳本R15), 規格句S1~S8見CLAUDE_rulebook.md; 每條it註解標明對應之規格句
//[重現]: 缺陷重現測試, 於修前碼(無檢核)須紅; [鎖定]: 行為鎖定測試, 於修前碼須綠
//S1 find僅可為未給(undefined)或一般物件(原型為Object.prototype或null, 無Symbol鍵與不可列舉之自有屬性)
//S2 各鍵為識別字(含組合符號), 非$開頭, 不含點, 非Object.prototype之成員名, 非length(暫行), 非prototype, 長度<=MAX_KEY_LEN, 鍵數<=MAX_KEYS
//S3 值為純量(字串<=MAX_STR且不含NUL, 有限數字, 布林)或恰含單鍵$in之物件(值為純量之密集陣列, 無額外屬性), 且整個find之$in元素總數至多MAX_IN個(跨鍵合計)
//S4 其餘一律以字串invalid find[原因碼]拒絕, 不呼叫授權函數與operOrm, 先驗後授權
//S5 通過者交授權函數與operOrm之input為全新且凍結之複本(同一份; 不同參照, 深度相等)
//S6 適用於methodsExec中之select、delAll(delAll與select同規則; requireKey選項預設關, Q11待裁示); 其餘方法不檢查(Q8另案)
//S7 __sysInputArgs__須為陣列(含kpFunExt與系統函數), 否則invalid input, 不呼叫getUserIdByToken、授權函數、operOrm與kpFunExt
//S8 第1參數之後之參數不交給授權函數與operOrm(D3)
describe('unit-checkFind', function() {

    describe('checkFind(純函數)', function() {

        //lb, 失敗時才組標籤(組標籤會讀取getter, 且BigInt、Symbol無法JSON化)
        let lb = (v) => {
            try {
                return JSON.stringify(v).slice(0, 200) //大型輸入只顯示開頭
            }
            catch (err) {
                try {
                    return String(typeof v === 'symbol' ? v.toString() : v)
                }
                catch (err2) {
                    return '(無法顯示)' //例如已撤銷之Proxy
                }
            }
        }
        let ok = (find, opt) => {
            let r = checkFind(find, opt)
            if (r.ok !== true) {
                assert.fail(`預期通過: ${lb(find)} 卻以${r.reason}拒絕`)
            }
            return r.find
        }
        let ng = (find, reason, opt) => {
            let r = checkFind(find, opt)
            if (r.ok !== false) {
                assert.fail(`預期拒絕: ${lb(find)}`)
            }
            if (r.reason !== reason) {
                assert.fail(`預期以${reason}拒絕卻得${r.reason}: ${lb(find)}`)
            }
        }
        let j = (s) => JSON.parse(s)

        //S1
        it('未給與空物件通過', function() {
            assert.strict.equal(ok(undefined), undefined)
            assert.strict.deepEqual(ok({}), {})
        })

        //S1, S4
        it('非一般物件一律拒絕(null、陣列、字串、數字、布林、二進位、Date、RegExp、Map、Set、函數、Symbol、BigInt、類別實例)', function() {
            class A {
                constructor() {
                    this.a = 1
                }
            }
            for (let v of [null, [], [{ a: 1 }], 'abc', '', 123, 0, true, false, new Uint8Array([1]), new Uint16Array([1]), new ArrayBuffer(1), new Date(0), /x/, new Map(), new Set(), () => 1, Symbol('x'), 1n, new A(), NaN]) {
                ng(v, 'notObject')
            }
        })

        //S1, S4: Symbol鍵與不可列舉之自有屬性不得被複本靜默丟棄
        it('含Symbol鍵或不可列舉自有屬性之物件拒絕', function() {
            ng({ a: 1, [Symbol('s')]: 1 }, 'notObject')
            let o = { a: 1 }
            Object.defineProperty(o, 'hidden', { value: 1, enumerable: false })
            ng(o, 'notObject')
            let v = { $in: ['a'] }
            Object.defineProperty(v, 'hidden', { value: 1, enumerable: false })
            ng({ id: v }, 'badValue')
        })

        //S3
        it('欄位等值(字串、有限數字、布林)與多欄隱含AND通過', function() {
            assert.strict.deepEqual(ok({ name: 'alpha' }), { name: 'alpha' })
            assert.strict.deepEqual(ok({ name: 'alpha', n: 1, f: false, g: 0, h: '' }), { name: 'alpha', n: 1, f: false, g: 0, h: '' })
            assert.strict.deepEqual(ok({ '中文欄': 'x', '_u': 1 }), { '中文欄': 'x', '_u': 1 })
            let kM = 'e' + String.fromCodePoint(0x301) + 'cole' //組合符號: e加U+0301, 非預組字元
            assert.strict.deepEqual(ok({ [kM]: 'x' }), { [kM]: 'x' }, '鍵含組合符號')
            assert.strict.deepEqual(ok({ id: 'a.b', n: -1.5 }), { id: 'a.b', n: -1.5 }, '值為字串時點號與負數、小數皆通過(只限制鍵)')
        })

        //S2: 識別字之\p{N}(非ASCII數字)可為非首位字元, 全形與其他書寫系統之數字亦同, 但不得為首位
        it('鍵之Unicode數字: 非首位通過(含全形與其他書寫系統數字), 首位拒絕', function() {
            let fw1 = String.fromCodePoint(0xff11) //全形1
            let ar3 = String.fromCodePoint(0x663) //阿拉伯-印度數字3
            assert.strict.deepEqual(ok({ ['欄位' + fw1]: 1 }), { ['欄位' + fw1]: 1 })
            assert.strict.deepEqual(ok({ ['欄位' + ar3]: 1 }), { ['欄位' + ar3]: 1 })
            ng({ [ar3 + '欄']: 1 }, 'badKey')
            ng({ [fw1 + '欄']: 1 }, 'badKey')
        })

        //S3: NUL不論位於字串之首、中、尾皆拒; -0與極端有限值通過; JSON原文1e999(JSON.parse得Infinity, 自寫客戶端可送)拒絕
        it('值之邊界: NUL位於首中尾皆拒絕, -0與極端有限值通過, JSON原文1e999拒絕', function() {
            let nul = String.fromCodePoint(0)
            ng({ name: nul + 'a' }, 'badValue')
            ng({ name: 'a' + nul + 'b' }, 'badValue')
            ng({ name: 'a' + nul }, 'badValue')
            ng({ id: { $in: [nul] } }, 'badIn')
            ng({ id: { $in: [nul + 'a'] } }, 'badIn')
            ok({ n: -0 })
            ok(j('{"n":-0}'))
            ok({ n: 1e21 })
            ok({ n: 5e-324 })
            ng(j('{"n":1e999}'), 'badValue')
            ng(j('{"id":{"$in":[1e999]}}'), 'badIn')
        })

        //S3: 稀疏洞與額外屬性並存時, 自有屬性計數可恰好相等, 且洞不得由Array.prototype上之值補上
        it('$in之稀疏洞與額外屬性並存、或原型鏈上有值時仍拒絕', function() {
            // eslint-disable-next-line no-sparse-arrays
            let arr = ['a', , 'c']
            arr.x = 'x'
            ng({ id: { $in: arr } }, 'badIn')
            Array.prototype[1] = 'POLLUTED' // eslint-disable-line no-extend-native
            try {
                // eslint-disable-next-line no-sparse-arrays
                let arr2 = ['a', , 'c']
                arr2.x = 'x'
                ng({ id: { $in: arr2 } }, 'badIn')
            }
            finally {
                delete Array.prototype[1]
            }
            assert.strict.equal(Array.prototype[1], undefined)
            //洞(第0項由陣列自己之原型鏈提供)與額外屬性並存: 自有字串屬性數恰為n+1, 讀值卻取得繼承值
            let a3 = new Array(1)
            let p3 = Object.create(Array.prototype)
            p3[0] = 'a'
            Object.setPrototypeOf(a3, p3)
            a3.extra = 1
            ng({ id: { $in: a3 } }, 'badIn')
        })

        //checkFind不拋出: 檢視前端所送之值時拋錯(非JSON可達, 供kpFunExt作者於行程內傳入任意值)以notObject拒絕
        it('檢視時拋錯之物件(getter拋錯、已撤銷之Proxy、Symbol.toStringTag拋錯)以notObject拒絕而不拋出', function() {
            ng({
                get a() {
                    throw new Error('x')
                }
            }, 'notObject')
            let rv = Proxy.revocable({}, {})
            rv.revoke()
            ng(rv.proxy, 'notObject')
            ng({
                get [Symbol.toStringTag]() {
                    throw new Error('y')
                }
            }, 'notObject')
            ng({
                id: {
                    get $in() {
                        throw new Error('z')
                    }
                }
            }, 'notObject')
            let arr = ['a']
            Object.defineProperty(arr, 0, {
                get() {
                    throw new Error('w')
                },
                enumerable: true
            })
            ng({ id: { $in: arr } }, 'notObject')
            ng(new Proxy({}, {
                ownKeys() {
                    throw new Error('t')
                }
            }), 'notObject')
            ng({
                id: new Proxy({}, {
                    getPrototypeOf() {
                        throw new Error('u')
                    }
                })
            }, 'notObject')
        })

        //S3
        it('$in(純量陣列)通過, 空陣列通過且保持為空陣列', function() {
            assert.strict.deepEqual(ok({ id: { $in: ['a1', 'a2'] } }), { id: { $in: ['a1', 'a2'] } })
            assert.strict.deepEqual(ok({ id: { $in: [1, 'a', true] } }), { id: { $in: [1, 'a', true] } })
            assert.strict.deepEqual(ok({ id: { $in: [] } }), { id: { $in: [] } })
            assert.strict.deepEqual(ok({ name: 'alpha', id: { $in: ['a1'] } }), { name: 'alpha', id: { $in: ['a1'] } }, '$in可與等值並存於不同欄')
            //$in不限欄位(通道不知主鍵名): 一般欄位、中文欄位、布林欄位皆可, 含空陣列
            assert.strict.deepEqual(ok({ name: { $in: ['alpha', 'beta'] } }), { name: { $in: ['alpha', 'beta'] } })
            assert.strict.deepEqual(ok({ '中文欄': { $in: ['甲', '乙'] } }), { '中文欄': { $in: ['甲', '乙'] } })
            assert.strict.deepEqual(ok({ flag: { $in: [true, false] }, n: { $in: [] } }), { flag: { $in: [true, false] }, n: { $in: [] } })
        })

        //S2, S4
        it('$開頭之鍵(含$where、$custom、$expr、$function、$or、$and、$nor、$text、$comment、$jsonSchema、未知)一律拒絕', function() {
            for (let k of ['$where', '$custom', '$expr', '$function', '$or', '$and', '$nor', '$text', '$comment', '$jsonSchema', '$unknown', '$']) {
                ng({ [k]: 'true' }, 'badKey')
                ng({ name: 'alpha', [k]: [] }, 'badKey')
            }
        })

        //S2, S4
        it('點號、空字串、含引號空白符號、數字開頭之鍵拒絕', function() {
            for (let k of ['a.b', 'name.x', '', ' ', 'a b', 'na\'me', 'na"me', 'a-b', 'a;b', 'a' + String.fromCodePoint(0) + 'b', '1abc', String.fromCodePoint(0x301) + 'abc']) { //含NUL之鍵與以組合符號開頭之鍵
                ng({ [k]: 1 }, 'badKey')
            }
        })

        //S2, S4: Object.prototype之成員名(含__proto__、constructor、toString、valueOf、hasOwnProperty、isPrototypeOf、__defineGetter__...)與prototype、length
        it('原型成員名、prototype、length之鍵拒絕', function() {
            for (let k of Object.getOwnPropertyNames(Object.prototype)) {
                ng({ [k]: 1 }, 'badKey')
            }
            for (let k of ['prototype', 'length']) {
                ng({ [k]: 1 }, 'badKey')
                ng({ [k]: 'abc' }, 'badKey')
            }
            //自有__proto__鍵(JSON.parse產生)
            ng(j('{"__proto__":{"x":1}}'), 'badKey')
            ng(j('{"name":"alpha","__proto__":{"x":1}}'), 'badKey')
        })

        //S3, S4
        it('null、巢狀物件或陣列之等值、$in以外之運算子、$in與他鍵並存、$in非純量陣列拒絕', function() {
            ng({ name: null }, 'badValue')
            ng({ name: undefined }, 'badValue')
            ng({ name: ['a', 'b'] }, 'badValue')
            ng({ name: [] }, 'badValue')
            ng({ name: {} }, 'badOperator')
            ng({ name: { x: 1 } }, 'badOperator')
            ng({ name: new Uint8Array([1]) }, 'badValue')
            ng({ name: new Date(0) }, 'badValue')
            ng({ name: /x/ }, 'badValue')
            ng({ name: NaN }, 'badValue')
            ng({ name: Infinity }, 'badValue')
            ng({ n: 1n }, 'badValue')
            for (let op of ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$nin', '$not', '$regex', '$exists', '$where', '$expr', '$size', '$elemMatch', '$unknown']) {
                ng({ name: { [op]: 'a' } }, 'badOperator')
            }
            ng({ id: { $in: ['a'], $nin: ['b'] } }, 'badOperator')
            ng({ id: { $in: ['a'], x: 1 } }, 'badOperator')
            ng({ id: { $in: 'a1' } }, 'badIn')
            ng({ id: { $in: { 0: 'a' } } }, 'badIn')
            ng({ id: { $in: [null] } }, 'badIn')
            ng({ id: { $in: [{ x: 1 }] } }, 'badIn')
            ng({ id: { $in: [['a']] } }, 'badIn')
            ng({ id: { $in: [undefined] } }, 'badIn')
            ng({ id: { $in: [NaN] } }, 'badIn')
            ng({ id: { $in: new Uint8Array([1]) } }, 'badIn')
            // eslint-disable-next-line no-sparse-arrays
            ng({ id: { $in: [, 'a'] } }, 'badIn') // 稀疏洞(刻意)
            let arr = ['a']
            arr.extra = 'x' // 陣列上之可列舉額外屬性不得被靜默丟棄
            ng({ id: { $in: arr } }, 'badIn')
            let arr2 = ['a']
            Object.defineProperty(arr2, 'hidden', { value: 1, enumerable: false }) // 陣列上之不可列舉額外屬性亦同
            ng({ id: { $in: arr2 } }, 'badIn')
            let arr3 = ['a']
            arr3[Symbol('s')] = 1 // 陣列上之Symbol鍵亦同
            ng({ id: { $in: arr3 } }, 'badIn')
        })

        //S2, S3: 上限之規格值(帳本R15: 64鍵、鍵長128、字串1024、$in 1000, 業主裁示Q5), 常數被改動即紅, 邊界測試才有意義
        it('上限常數為規格值', function() {
            assert.strict.equal(MAX_KEYS, 64)
            assert.strict.equal(MAX_KEY_LEN, 128)
            assert.strict.equal(MAX_STR, 1024)
            assert.strict.equal(MAX_IN, 1000)
        })

        //S2, S3: 邊界(通過的最大值與拒絕的最小值)
        it('鍵數、鍵長、字串長度與$in個數之上限(邊界值)', function() {
            //最大合法值須完整保留(深度相等, 含最後一個鍵與最後一個元素), 否則複本靜默丟失條件
            let o = {}
            for (let i = 0; i < MAX_KEYS; i++) o[`k${i}`] = i
            assert.strict.deepEqual(ok(o), o)
            assert.strict.equal(Object.keys(ok(o)).length, MAX_KEYS)
            o.extra = 1
            ng(o, 'tooManyKeys')
            //第MAX_KEYS個鍵若非法仍須被檢查到(不得因上限而略過最後一鍵)
            let o2 = {}
            for (let i = 0; i < MAX_KEYS - 1; i++) o2[`k${i}`] = i
            o2.constructor = 1
            ng(o2, 'badKey')
            ok({ ['x'.repeat(MAX_KEY_LEN)]: 1 })
            ng({ ['x'.repeat(MAX_KEY_LEN + 1)]: 1 }, 'badKey')
            //長度以UTF-16碼元計: 補充平面字元(2碼元)64個恰為上限, 65個超過
            let astral = String.fromCodePoint(0x1d400) //數學粗體大寫A, 屬\p{L}且位於補充平面
            ok({ [astral]: 1 })
            ok({ [astral.repeat(MAX_KEY_LEN / 2)]: 1 })
            ng({ [astral.repeat(MAX_KEY_LEN / 2 + 1)]: 1 }, 'badKey')
            ok({ name: 'x'.repeat(MAX_STR) })
            ng({ name: 'x'.repeat(MAX_STR + 1) }, 'badValue')
            ng({ name: 'a\u0000b' }, 'badValue')
            let inMax = Array.from({ length: MAX_IN }, (_, i) => `x${i}`)
            assert.strict.deepEqual(ok({ id: { $in: inMax } }), { id: { $in: inMax } })
            assert.strict.equal(ok({ id: { $in: inMax } }).id.$in.length, MAX_IN)
            ng({ id: { $in: Array.from({ length: MAX_IN + 1 }, (_, i) => `x${i}`) } }, 'tooManyIn')
            ng({ id: { $in: ['x'.repeat(MAX_STR + 1)] } }, 'badIn')
            ng({ id: { $in: ['a\u0000b'] } }, 'badIn')
        })

        //S3 (run04): 整個find之$in元素總數<=MAX_IN(跨鍵合計, 非逐鍵); 否則多鍵並存可放大成本(64鍵乘1000元素)
        it('整個find之$in元素總數上限(跨鍵合計): 恰MAX_IN放行且內容完整保留, 超過1個以tooManyIn拒絕', function() {
            let mkIn = (n, tag) => Array.from({ length: n }, (_, i) => `${tag}${i}`)
            //2鍵各600(合計1200)拒絕: 逐鍵計時各自未超過上限而放行
            ng({ id: { $in: mkIn(600, 'a') }, name: { $in: mkIn(600, 'b') } }, 'tooManyIn')
            //合計恰1000: 2鍵(600+400)與4鍵(各250)皆放行, 深度相等且各鍵元素數不變
            let f2 = { id: { $in: mkIn(600, 'a') }, name: { $in: mkIn(MAX_IN - 600, 'b') } }
            assert.strict.deepEqual(ok(f2), f2)
            assert.strict.equal(ok(f2).id.$in.length + ok(f2).name.$in.length, MAX_IN)
            let f4 = { k1: { $in: mkIn(250, 'a') }, k2: { $in: mkIn(250, 'b') }, k3: { $in: mkIn(250, 'c') }, k4: { $in: mkIn(250, 'd') } }
            assert.strict.deepEqual(ok(f4), f4)
            //合計1001拒絕(600+401; 恰MAX_IN之一鍵再加1個元素之另一鍵)
            ng({ id: { $in: mkIn(600, 'a') }, name: { $in: mkIn(MAX_IN - 600 + 1, 'b') } }, 'tooManyIn')
            ng({ id: { $in: mkIn(MAX_IN, 'a') }, name: { $in: ['x'] } }, 'tooManyIn')
            //多鍵各數個元素: 64鍵各15個(合計960)放行, 各16個(合計1024)拒絕
            let mk64 = (n) => Object.fromEntries(Array.from({ length: MAX_KEYS }, (_, i) => [`k${i}`, { $in: mkIn(n, 'v') }]))
            assert.strict.deepEqual(ok(mk64(15)), mk64(15))
            ng(mk64(16), 'tooManyIn')
            //空$in不占額度, 等值之純量值亦不計: 一鍵滿額之外加空$in與純量等值仍放行
            let fe = { id: { $in: mkIn(MAX_IN, 'a') }, n: { $in: [] }, name: 'alpha', flag: true }
            assert.strict.deepEqual(ok(fe), fe)
            //超限者先於逐元素檢查被拒(長度宣告很大之稀疏陣列不致逐一迭代)
            ng({ id: { $in: new Array(MAX_IN) }, name: { $in: [1] } }, 'badIn')
            ng({ id: { $in: mkIn(MAX_IN, 'a') }, name: { $in: new Array(1e9) } }, 'tooManyIn')
        })

        //S5
        it('通過者為全新且凍結之複本, 修改原物件不影響複本', function() {
            let src = { id: { $in: ['a1'] }, name: 'alpha' }
            let r = ok(src)
            assert.notStrictEqual(r, src)
            assert.notStrictEqual(r.id, src.id)
            assert.notStrictEqual(r.id.$in, src.id.$in)
            src.id.$in.push('zzz')
            src.name = 'changed'
            assert.strict.deepEqual(r, { id: { $in: ['a1'] }, name: 'alpha' })
            assert.ok(Object.isFrozen(r) && Object.isFrozen(r.id) && Object.isFrozen(r.id.$in), '凍結(就地修改在ESM嚴格模式下拋錯)')
            assert.throws(() => {
                r.name = 'x'
            }, TypeError)
            assert.throws(() => {
                r.id.$in.push('x')
            }, TypeError)
        })

        //S5: 頂層值與$in元素皆只讀取一次, 複本不再受其後變化影響
        it('getter只被讀取一次(頂層值、$in之元素與長度)', function() {
            let n = 0
            let src = {
                get name() {
                    n++
                    return 'alpha'
                }
            }
            let r = ok(src)
            assert.strict.equal(n, 1)
            assert.strict.deepEqual(r, { name: 'alpha' })
            let o = Object.create(null)
            o.name = 'alpha'
            assert.strict.deepEqual(ok(o), { name: 'alpha' })
            //$in本身(存取器)只讀取一次
            let cIn = 0
            let srcIn = {
                id: {
                    get $in() {
                        cIn++
                        return ['a', 'b']
                    }
                }
            }
            assert.strict.deepEqual(ok(srcIn), { id: { $in: ['a', 'b'] } })
            assert.strict.equal(cIn, 1)
            //頂層值為物件(運算子分支)時只讀取一次: 第2次讀取會得到不同內容
            let cObj = 0
            let srcObj = {
                get id() {
                    cObj++
                    return cObj === 1 ? { $in: ['first'] } : { $in: ['second'] }
                }
            }
            assert.strict.deepEqual(ok(srcObj), { id: { $in: ['first'] } })
            assert.strict.equal(cObj, 1)
            //$in陣列之length只讀取一次(迴圈不得重讀, 否則以Proxy可在檢查上限之後改變長度)
            let cLen = 0
            let px = new Proxy(['a', 'b'], {
                get(t, p, rcv) {
                    if (p === 'length') {
                        cLen++
                    }
                    return Reflect.get(t, p, rcv)
                }
            })
            assert.strict.deepEqual(ok({ id: { $in: px } }), { id: { $in: ['a', 'b'] } })
            assert.strict.equal(cLen, 1)
            //$in元素: 第1次讀為純量、其後換成物件, 複本不得含非純量
            let cnt = 0
            let arr = ['a']
            Object.defineProperty(arr, 0, {
                get() {
                    return cnt++ === 0 ? 'a' : { x: 1 }
                },
                enumerable: true
            })
            let r2 = ok({ id: { $in: arr } })
            assert.strict.deepEqual(r2, { id: { $in: ['a'] } })
            assert.strict.equal(cnt, 1)
        })

        //S6
        it('requireKey(預設關; delAll須至少1個條件之選項, Q11待裁示): 未給與空物件拒絕emptyFind, 有條件者通過', function() {
            ng(undefined, 'emptyFind', { requireKey: true })
            ng({}, 'emptyFind', { requireKey: true })
            ok({ name: 'alpha' }, { requireKey: true })
            ok({ id: { $in: [] } }, { requireKey: true })
            //預設與非true之值皆關
            ok(undefined)
            ok({})
            ok(undefined, { requireKey: false })
            ok({}, { requireKey: 'true' })
            ok(undefined, { requireKey: 'true' })
            ok(undefined, { requireKey: 1 })
            ok({}, { requireKey: 1 })
        })

    })

    describe('資料通道(evem, 不開網路)', function() {

        let fdTmp = './test/_tmp/unit-checkFind'
        let insts = []

        before(function() {
            fs.mkdirSync(fdTmp, { recursive: true })
        })
        after(function() {
            for (let inst of insts) inst.clearBroadcast()
            fs.rmSync(fdTmp, { recursive: true, force: true })
        })

        let mk = (methodsExec = ['select', 'delAll', 'insert'], authorize = () => true) => {
            let cnt = { orm: [], auth: [], kp: [], uid: 0 }
            let inst = evem()
            insts.push(inst)
            new WServWebdataServer(inst, {
                fpTableTags: `${fdTmp}/tableTags.json`,
                getUserIdByToken: (token) => {
                    cnt.uid++
                    return token === 'tok' ? 'u1' : ''
                },
                useDbOrm: true,
                kpOrm: {},
                operOrm: async (...a) => {
                    cnt.orm.push({ n: a.length, userId: a[0], tableName: a[1], methodName: a[2], input: a[3] })
                    return []
                },
                tableNamesExec: ['tabA'],
                methodsExec,
                authorizeExec: (arg) => {
                    cnt.auth.push(arg)
                    return authorize(arg)
                },
                kpFunExt: {
                    echo: (userId, ...args) => {
                        cnt.kp.push(args)
                        return args
                    },
                },
            })
            return { inst, cnt }
        }
        let exec = (inst, func, args, token = 'tok') => {
            let pm = genPm()
            inst.emit('execute', func, { __sysToken__: token, __sysInputArgs__: args }, pm)
            return pm
        }

        //S4, S6 [重現]
        it('select與delAll: 白名單外之find以invalid find字串拒絕, 不呼叫授權函數與operOrm', async function() {
            let { inst, cnt } = mk()
            let bads = [
                [[null], 'notObject'], [[[]], 'notObject'], [['abc'], 'notObject'], [[123], 'notObject'], [[true], 'notObject'],
                [[{ $where: 'true' }], 'badKey'], [[{ $or: [{ a: 1 }] }], 'badKey'], [[{ name: { $regex: '^a' } }], 'badOperator'],
                [[{ name: null }], 'badValue'], [[{ id: { $in: 'a' } }], 'badIn'], [[JSON.parse('{"__proto__":{"x":1}}')], 'badKey'],
                [[{ 'a.b': 1 }], 'badKey'], [[{ length: 1, name: 'alpha' }], 'badKey'], [[{ toString: 'x' }], 'badKey'],
            ]
            for (let func of ['tabA.select', 'tabA.delAll']) {
                for (let [args, code] of bads) {
                    let r = await exec(inst, func, args)
                    assert.strict.deepEqual(r, { state: 'error', msg: `invalid find[${code}]` }, `${func} ${JSON.stringify(args)}`)
                }
            }
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        })

        //S4: 拒絕訊息為字串且原因碼對應, 不回顯客戶端值 [重現]
        it('拒絕訊息為字串invalid find[原因碼], 不含客戶端所送之值', async function() {
            let { inst, cnt } = mk()
            let secret = 'SECRET-VALUE-9f3a'
            let cases = [
                [[null], 'notObject'],
                [[{ [secret]: 1, '$x': 1 }], 'badKey'],
                [[{ name: { $regex: secret } }], 'badOperator'],
                [[{ name: ['a', secret] }], 'badValue'],
                [[{ id: { $in: [secret, null] } }], 'badIn'],
            ]
            for (let [args, code] of cases) {
                let r = await exec(inst, 'tabA.select', args)
                assert.strict.deepEqual(r, { state: 'error', msg: `invalid find[${code}]` }, code)
                assert.strict.equal(typeof r.msg, 'string')
                assert.ok(!r.msg.includes(secret))
            }
            let o = {}
            for (let i = 0; i <= MAX_KEYS; i++) o[`k${i}`] = 1
            assert.strict.deepEqual(await exec(inst, 'tabA.select', [o]), { state: 'error', msg: 'invalid find[tooManyKeys]' })
            let r = await exec(inst, 'tabA.select', [{ id: { $in: Array.from({ length: MAX_IN + 1 }, (_, i) => `x${i}`) } }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[tooManyIn]' })
            //run04: 跨鍵合計(各鍵未超過上限而合計超過)亦以tooManyIn拒絕, 且不呼叫授權函數與operOrm
            r = await exec(inst, 'tabA.select', [{ id: { $in: Array.from({ length: 600 }, (_, i) => `a${i}`) }, name: { $in: Array.from({ length: 600 }, (_, i) => `b${i}`) } }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[tooManyIn]' })
            r = await exec(inst, 'tabA.delAll', [{ id: { $in: Array.from({ length: 600 }, (_, i) => `a${i}`) }, name: { $in: Array.from({ length: 600 }, (_, i) => `b${i}`) } }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[tooManyIn]' })
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
        })

        //S1, S3 [鎖定]
        it('select與delAll: 白名單內之find放行, 授權函數與operOrm收到深度相等且同一份之input', async function() {
            let { inst, cnt } = mk()
            for (let func of ['tabA.select', 'tabA.delAll']) {
                let finds = [{ name: 'alpha' }, { id: { $in: ['a1', 'a2'] } }, { name: 'alpha', n: 1 }]
                if (func === 'tabA.select') finds.unshift({})
                for (let f of finds) {
                    cnt.auth.length = 0
                    cnt.orm.length = 0
                    let r = await exec(inst, func, [f])
                    assert.strict.equal(r.state, 'success', `${func} ${JSON.stringify(f)}`)
                    assert.strict.equal(cnt.auth.length, 1)
                    assert.strict.equal(cnt.orm.length, 1)
                    assert.strict.deepEqual(cnt.auth[0].input, f)
                    assert.strict.deepEqual(cnt.orm[0].input, f)
                    assert.strict.equal(cnt.auth[0].input, cnt.orm[0].input, '授權所見即執行所用(同一份)')
                }
            }
            //未給參數(同步取資料之select不帶參數)
            cnt.auth.length = 0
            cnt.orm.length = 0
            let r = await exec(inst, 'tabA.select', [])
            assert.strict.equal(r.state, 'success')
            assert.strict.equal(cnt.auth[0].input, undefined)
            assert.strict.equal(cnt.orm[0].input, undefined)
        })

        //S5 [重現]
        it('授權函數與operOrm收到之input為全新且凍結之複本(非客戶端送來之原物件)', async function() {
            let { inst, cnt } = mk()
            for (let func of ['tabA.select', 'tabA.delAll']) {
                let f = { name: 'alpha', id: { $in: ['a1'] } }
                cnt.auth.length = 0
                cnt.orm.length = 0
                let r = await exec(inst, func, [f])
                assert.strict.equal(r.state, 'success', func)
                assert.notStrictEqual(cnt.orm[0].input, f, `${func}: 非客戶端送來之原物件`)
                assert.notStrictEqual(cnt.orm[0].input.id, f.id)
                assert.ok(Object.isFrozen(cnt.orm[0].input) && Object.isFrozen(cnt.orm[0].input.id) && Object.isFrozen(cnt.orm[0].input.id.$in), `${func}: 凍結`)
                assert.strict.equal(cnt.auth[0].input, cnt.orm[0].input)
            }
        })

        //S5 [重現]: 授權函數無從就地改動將交給operOrm之input(ESM嚴格模式下賦值拋TypeError, 其值原樣成為拒絕值並不呼叫operOrm)
        it('授權函數就地修改input時拋TypeError, 不呼叫operOrm', async function() {
            let { inst, cnt } = mk(['select'], ({ input }) => {
                input.name = 'hacked'
                return true
            })
            let r = await exec(inst, 'tabA.select', [{ name: 'alpha' }])
            assert.strict.equal(r.state, 'error')
            assert.ok(r.msg instanceof TypeError)
            assert.strict.equal(cnt.orm.length, 0)
        })

        //S5 [重現]: 非嚴格模式(例如CommonJS風格)之授權函數就地修改input不生效(靜默忽略, 不拋錯), operOrm收到之input仍為原值; 文件載明「改寫不生效(嚴格模式下拋TypeError)」
        it('非嚴格模式之授權函數就地修改input不生效, operOrm收到原值', async function() {
            // eslint-disable-next-line no-new-func
            let sloppy = new Function('arg', 'arg.input.name = "hacked"; arg.input.extra = 1; return true') //Function建構子產生之函數不受呼叫端模組之嚴格模式影響
            let { inst, cnt } = mk(['select'], sloppy)
            let r = await exec(inst, 'tabA.select', [{ name: 'alpha' }])
            assert.strict.equal(r.state, 'success')
            assert.strict.deepEqual(cnt.orm[0].input, { name: 'alpha' })
        })

        //S4 [重現]: 被拒形狀不發出error事件、不輸出log(同帳本L5, 授權與ORM之拒絕亦不發error事件)
        it('被拒形狀不發出error事件, 不輸出console.log/info/warn/error', async function() {
            let { inst } = mk()
            let errs = []
            inst.on('error', (err) => {
                errs.push(err)
            })
            let logs = []
            let bk = { log: console.log, info: console.info, warn: console.warn, error: console.error }
            for (let k of Object.keys(bk)) {
                console[k] = (...a) => {
                    logs.push([k, a])
                }
            }
            try {
                for (let args of [[null], [{ $where: 'true' }], [{ name: ['SECRET-LOG-7c1'] }], [{ id: { $in: 'SECRET-LOG-7c1' } }]]) {
                    for (let func of ['tabA.select', 'tabA.delAll']) {
                        let r = await exec(inst, func, args)
                        assert.strict.equal(r.state, 'error')
                        assert.ok(/^invalid find\[[A-Za-z]+\]$/.test(r.msg), r.msg)
                    }
                }
            }
            finally {
                Object.assign(console, bk)
            }
            assert.strict.equal(errs.length, 0)
            assert.strict.deepEqual(logs, [])
        })

        //S6 [鎖定]: delAll不給條件或給{}依dspec為全部(R15 S6: requireKey預設關, Q11待裁示)
        it('delAll: 未給與空物件之find放行(同select)', async function() {
            let { inst, cnt } = mk()
            for (let args of [[], [{}]]) {
                for (let func of ['tabA.delAll', 'tabA.select']) {
                    let r = await exec(inst, func, args)
                    assert.strict.equal(r.state, 'success', `${func} ${JSON.stringify(args)}`)
                }
            }
            assert.strict.equal(cnt.orm.length, 4)
        })

        //S6 [鎖定]
        it('insert、save、del、mix不經find檢查(Q8另案): 原樣放行', async function() {
            let { inst, cnt } = mk(['insert', 'save', 'del', 'mix'])
            for (let func of ['tabA.insert', 'tabA.save', 'tabA.del', 'tabA.mix']) {
                let r = await exec(inst, func, [[{ id: 'x', name: { $where: 'true' } }]])
                assert.strict.equal(r.state, 'success', func)
            }
            assert.strict.equal(cnt.orm.length, 4)
            assert.strict.deepEqual(cnt.orm[0].input, [{ id: 'x', name: { $where: 'true' } }])
        })

        //S8 (D3) [鎖定]: 第1參數之後之參數不交給授權函數與operOrm
        it('select與delAll於find之後之參數(order、sort、limit)不交給授權函數與operOrm, operOrm恆收4個參數', async function() {
            let { inst, cnt } = mk()
            for (let func of ['tabA.select', 'tabA.delAll']) {
                for (let args of [[{ name: 'a' }, { order: 'x' }], [{ name: 'a' }, { sort: { name: -1 } }, { limit: 1 }], [{ name: 'a' }, null]]) {
                    cnt.auth.length = 0
                    cnt.orm.length = 0
                    let r = await exec(inst, func, args)
                    assert.strict.equal(r.state, 'success', `${func} ${JSON.stringify(args)}`)
                    assert.strict.deepEqual(Object.keys(cnt.auth[0]).sort(), ['input', 'methodName', 'tableName', 'userId'])
                    assert.strict.deepEqual(cnt.auth[0].input, { name: 'a' })
                    assert.strict.equal(cnt.orm[0].n, 4)
                    assert.strict.deepEqual(cnt.orm[0].input, { name: 'a' })
                }
            }
        })

        //S8 (D3) [重現]: 多餘參數丟棄不代表可繞過檢核, 第1參數壞時其後之參數不改變結果
        it('find壞時即使後面接合法參數仍拒絕, find合法而後面接壞形狀之參數時放行(後者被丟棄)', async function() {
            let { inst, cnt } = mk()
            let r = await exec(inst, 'tabA.select', [{ $where: 'true' }, { name: 'alpha' }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[badKey]' })
            assert.strict.equal(cnt.orm.length, 0)
            r = await exec(inst, 'tabA.select', [{ name: 'alpha' }, { $where: 'true' }])
            assert.strict.equal(r.state, 'success')
            assert.strict.deepEqual(cnt.orm[0].input, { name: 'alpha' })
        })

        //S7 [重現]
        it('__sysInputArgs__非陣列(字串、物件、數字、null、布林)時回invalid input, 不呼叫getUserIdByToken、授權函數、operOrm與kpFunExt(含系統函數)', async function() {
            let { inst, cnt } = mk()
            for (let args of ['abc', { 0: { name: 'alpha' } }, 1, null, true]) {
                for (let func of ['tabA.select', 'tabA.delAll', 'echo', '[sys:getFuncList]', '[sys:getTableTags]']) {
                    let r = await exec(inst, func, args)
                    assert.strict.deepEqual(r, { state: 'error', msg: 'invalid input' }, `${func} ${JSON.stringify(args)}`)
                }
            }
            assert.strict.equal(cnt.uid, 0)
            assert.strict.equal(cnt.auth.length, 0)
            assert.strict.equal(cnt.orm.length, 0)
            assert.strict.equal(cnt.kp.length, 0)
            //陣列照常
            let r = await exec(inst, 'echo', [1, 2])
            assert.strict.deepEqual(r, { state: 'success', msg: [1, 2] })
            r = await exec(inst, '[sys:getFuncList]', [])
            assert.strict.equal(r.state, 'success')
            r = await exec(inst, '[sys:getTableTags]', [])
            assert.strict.equal(r.state, 'success')
        })

        //S4 [重現]: 先驗後授權之順序(授權函數一律拒絕時, 白名單外之find仍得invalid find, 而白名單內得permission denied)
        it('先驗後授權: 授權一律拒絕時, 壞find回invalid find而非permission denied, 合法find回permission denied', async function() {
            let { inst, cnt } = mk(['select'], () => false)
            let r = await exec(inst, 'tabA.select', [{ $where: 'true' }])
            assert.strict.deepEqual(r, { state: 'error', msg: 'invalid find[badKey]' })
            assert.strict.equal(cnt.auth.length, 0)
            r = await exec(inst, 'tabA.select', [{}])
            assert.strict.deepEqual(r, { state: 'error', msg: 'permission denied' })
            assert.strict.equal(cnt.auth.length, 1)
            assert.strict.equal(cnt.orm.length, 0)
        })

        //S4: 檢核不改變既有拒絕語意 [鎖定]
        it('合法find遇授權拒絕或授權函數拋錯時, 既有語意不變(permission denied字串、原拒絕值)', async function() {
            let { inst, cnt } = mk(['select'], () => Promise.reject({ key: 'errNoPermission' }))
            let r = await exec(inst, 'tabA.select', [{ name: 'alpha' }])
            assert.strict.deepEqual(r, { state: 'error', msg: { key: 'errNoPermission' } })
            assert.strict.equal(cnt.orm.length, 0)
        })

    })

})
