import assert from 'assert'
import fs from 'fs'
import vm from 'vm'
import { types } from 'util'
import corpus from 'wsemi/src/_diagCases.mjs'
import evem from 'wsemi/src/evem.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import WServWebdataClient from '../src/WServWebdataClient.mjs'
import WServWebdataServer from '../src/WServWebdataServer.mjs'
import { genDiag } from '../src/genDiag.mjs'
import genTokenBook from '../src/genTokenBook.mjs'
import { drain } from './tools/tracer.mjs'
import { genRun, linkCtl } from './tools/clientHarness.mjs'


//形態類案由wsemi之共用語料(wsemi/src/_diagCases.mjs, dspec D5)驅動: 語料之wire案以make(ctx)產生輸入, 經本套件之真實呼叫點執行, 再以語料之verify判定
//  詳細的形態(字串樣式、細節拷貝、代碼白名單、對外值規則)由wsemi自身逐案測試; 本檔確認本套件之宣告(秘密來源為token簿、safe鍵白名單、站點接線)下, 適用本套件之案例結果符合語料之期望
//  真實呼叫點: 前端callHook於停止後才拋錯(diag, funLog收safe與detail)、未停止時回調拋錯(error事件經diag.err)、伺服端回給遠端之msg(diag.mask)與固定拒絕訊息
//  本套件之秘密只有token(book.secrets = getDiagSecrets({ values })), 故語料中以ctx.sec.password為秘密之案, 以password作為前端getToken所得之token驅動
//
//wire案(20案)之適用性: 適用13案 T01、T07、K01、K09、V02、E01、E07、P01、S07(細節拷貝與文字遮罩, 經前端funLog之detail)、C01(摘要, 經前端funLog之safe)、R01、R04(對外值, 經error事件)、O15(safe鍵白名單, 經本套件之diag)、
//  R07(固定詞彙之拒絕值原樣, 以本套件自身之固定拒絕值驗證, 見unit-diagmask);
//  不適用: R02(秘密來自連線字串, 本套件秘密只有token)、R11(儲存路徑, 本套件無paths宣告)、R12(單獨帳號, 本套件無帳號)、O01(未包裝之opt, 本套件由checkOptLog正規化後才交給getDiag)、A01與A07(genDiagFunLog, 本套件不使用)
describe('unit-diagcorpus', function() {

    //cleans, 測完須停止之輪詢與廣播
    let cleans = []

    after(function() {
        for (let f of cleans) {
            f()
        }
    })

    let run = genRun(WServWebdataClient, cleans)

    let LABEL = '[w-serv-webdata] callback error after stop'

    //未處理之rejection計數(語料之判讀含unhandled)
    let nUn = 0
    let onUn = () => {
        nUn++
    }
    //fdTmp, 本測試暫存檔之專用資料夾, 測完即刪
    let fdTmp = './test/_tmp/unit-diagcorpus'
    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
        process.on('unhandledRejection', onUn)
    })
    after(function() {
        process.off('unhandledRejection', onUn)
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    let env = () => {
        return {
            util: true,
            realm: (code) => vm.runInNewContext(code),
            isNativeError: (v) => types.isNativeError(v),
            unhandled: () => nUn,
            tick: () => drain(2),
        }
    }

    let byId = (id) => {
        let c = corpus.cases.find((x) => x.id === id)
        assert.strict.notEqual(c, undefined, `語料缺案例${id}`)
        return c
    }

    //thrownAfterStop, 前端recvData於自身內停止後拋出value(走診斷輸出, funLog收到safe與detail), 回傳{ safe, detail }
    let thrownAfterStop = async(value, token) => {
        let { cl } = linkCtl()
        let calls = []
        let c = null
        let log = run(cl, {
            getToken: () => token,
            funLog: (...args) => {
                calls.push(args)
            },
            recvData: () => {
                c.clearBroadcast()
                c.clearSync()
                throw value
            },
        })
        c = log.cl
        await log.tr.wait({ type: 'hook', name: 'recvData' }) //診斷輸出於回調拋錯後同一呼叫堆疊內完成
        assert.strict.equal(calls.length, 1)
        assert.strict.equal(calls[0][0], LABEL)
        return { safe: calls[0][1], detail: calls[0][2] }
    }

    //thrownBeforeStop, 前端recvData(未停止)拋出value, 改發error事件(經diag.err), 回傳error事件之引數
    let thrownBeforeStop = async(value, token) => {
        let { cl } = linkCtl()
        let log = run(cl, {
            getToken: () => token,
            recvData: () => {
                throw value
            },
        })
        await log.tr.wait({ type: 'error' })
        log.cl.clearBroadcast()
        log.cl.clearSync()
        return log.rawErrors[0]
    }

    //細節拷貝與文字遮罩之案: 前端停止後拋出make(ctx), funLog之detail須符合語料之期望(語料原以maskDiagText或maskDiagCopy直接呼叫)
    for (let id of ['T01', 'T07', 'K01', 'K09', 'V02', 'E01', 'E07', 'P01', 'S07']) {
        it(`${id}: ${byId(id).label}(前端funLog之detail)`, async function() {
            this.timeout(30000)
            let c = byId(id)
            let ctx = corpus.mkCtx(env())
            let { detail } = await thrownAfterStop(c.make(ctx), ctx.sec.password)
            assert.strict.equal(corpus.verify(c, detail, ctx), null)
        })
    }

    it('C01: ECONNREFUSED、EAI_AGAIN、E2BIG收(前端funLog之safe)', async function() {
        this.timeout(30000)
        let c = byId('C01')
        let ctx = corpus.mkCtx(env())
        let out = []
        for (let e of c.make(ctx)) {
            let { safe } = await thrownAfterStop(e, ctx.sec.password)
            assert.strict.equal(safe.hook, 'recvData')
            delete safe.hook
            out.push(safe)
        }
        assert.strict.equal(corpus.verify(c, out, ctx), null)
    })

    it('R01: 不含憑證之錯誤回傳同一物件(前端error事件)', async function() {
        this.timeout(30000)
        let c = byId('R01')
        let ctx = corpus.mkCtx(env())
        let e = c.make(ctx)
        let got = await thrownBeforeStop(e, ctx.sec.password)
        assert.strict.equal(corpus.verify(c, [e, got], ctx), null)
    })

    it('R04: 字串reject(前端error事件)', async function() {
        this.timeout(30000)
        let c = byId('R04')
        let ctx = corpus.mkCtx(env())
        let got = await thrownBeforeStop(c.make(ctx), ctx.sec.password)
        assert.strict.equal(corpus.verify(c, got, ctx), null)
    })

    //R04於伺服端: 後端函數reject字串, 回給遠端之msg(diag.mask)
    it('R04: 字串reject(伺服端回給遠端之msg)', async function() {
        this.timeout(30000)
        let c = byId('R04')
        let ctx = corpus.mkCtx(env())
        let inst = evem()
        let srv = new WServWebdataServer(inst, {
            fpTableTags: `${fdTmp}/tags.json`,
            getUserIdByToken: async() => 'u1',
            kpFunExt: {
                boom: async() => {
                    return Promise.reject(c.make(ctx))
                },
            },
        })
        try {
            let pm = genPm()
            inst.emit('execute', 'boom', { __sysToken__: ctx.sec.password, __sysInputArgs__: [] }, pm)
            let r = await pm
            assert.strict.equal(r.state, 'error')
            assert.strict.equal(corpus.verify(c, r.msg, ctx), null)
        }
        finally {
            srv.clearBroadcast()
            srv.clearSync()
        }
    })

    it('O15: safe含白名單外之鍵password被丟棄(本套件宣告safeKeys: hook)', function() {
        let c = byId('O15')
        let ctx = corpus.mkCtx(env())
        let v = c.make(ctx)
        let calls = []
        let diag = genDiag({ logDetail: false, funLog: (...a) => calls.push(a) }, genTokenBook())
        diag('lb', { hook: 'recvData', ...v })
        assert.strict.deepEqual(calls, [['lb', { hook: 'recvData', errType: 'Error' }]], 'mode、n亦為白名單外而丟棄, 只留hook與errType')
        assert.strict.equal(JSON.stringify(calls).includes(ctx.sec.password), false)
    })

})
