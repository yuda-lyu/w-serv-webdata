import get from 'lodash-es/get.js'
import getDiag from 'wsemi/src/getDiag.mjs'


//診斷輸出與遮罩一律由wsemi之getDiag提供(規則見wsemi sgud/rule/rulebook_diag.md R-DIAG-01, 跨套件規格為主控dspec〈診斷輸出與遮罩〉), 本檔只有本套件之宣告, src內除wsemi外不得直接呼叫console(R18)


//SAFE_KEYS, 本套件之safe會用到之鍵(白名單外之鍵由getDiag丟棄; errType、errCode恆含): 前端回調停止後拋錯之hook(回調函數名稱)
const SAFE_KEYS = ['hook']


function checkOptLog(opt) {
    //診斷輸出的設定之型別檢核, 供WServWebdataServer與WServWebdataClient建構時使用: 型別錯誤即拋Error, 與建構期其他設定(invalid opt.xxx)一致; undefined與null視為未給
    //logDetail: 布林(僅原生布林值), 預設false; true時console輸出還原為含資料值與錯誤原文的完整細節(供除錯), 憑證仍遮罩
    //funLog: 函數(label, safe, detail), 預設無; 給予時診斷輸出只交給它(不寫console), detail為完整細節(含資料值與錯誤原文, 憑證已遮罩), 供使用端遮罩或轉送
    //回傳固定快照{ logDetail, funLog }, 其後各路徑共用此快照, 不再讀取使用端的opt(getter可能前後不同)
    let logDetail = get(opt, 'logDetail', null)
    if (logDetail !== undefined && logDetail !== null && typeof logDetail !== 'boolean') {
        throw new Error('invalid opt.logDetail')
    }
    let funLog = get(opt, 'funLog', null)
    if (funLog !== undefined && funLog !== null && typeof funLog !== 'function') {
        throw new Error('invalid opt.funLog')
    }
    return { logDetail: logDetail === true, funLog: typeof funLog === 'function' ? funLog : null }
}


function genDiag(optLog, book) {
    //回傳wsemi之診斷輸出實例diag(label, safe, getDetail, level), 另帶diag.brief、diag.mask、diag.err、diag.copy、diag.with(見wsemi getDiag)
    //秘密為book(genTokenBook)記住之token, 每次輸出時取當下清單; 所有診斷輸出皆經此(R18), 對外之錯誤值與回給遠端之訊息亦經diag.err與diag.mask
    return getDiag(optLog, {
        secrets: () => {
            return book.secrets()
        },
        safeKeys: SAFE_KEYS,
    })
}


export { checkOptLog, genDiag }
