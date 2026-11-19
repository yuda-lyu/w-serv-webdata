# 回饋(提案紀錄)

本檔只增不改:任務中發現之自有套件、全域技能、全域設定之調整與抽提提案;處置結果另記一列並寫明承接哪一列.實際修改仍走全域設定 §5.2、§13 之通報管道.

| # | 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|---|
| 1 | 2026-11-19 | 自有套件 | wsemi | 判斷函數改為不拋錯(1.9.69)後,原借其拋錯成立之防線須以「可讀性探針」補回;w-converhp 與本套件各自寫了一份 `probeReadable`(前者深探序列化會走到之物件,後者淺探型別標籤、指定鍵之 `in`、可列舉鍵走訪),選項與細節(例如 `isfun` 對函數判型另讀 `Symbol.toStringTag` 之 `in`)各自踩坑.建議評估於 wsemi 提供共用探針(例如 `probeReadable(v, { hasKeys, ownKeys, deep })`,回空字串或原因),下游不再各寫一份 | `src/probeReadable.mjs`;`C:/opensrc/開源-JS-017-4-w-converhp/w-converhp/src/probeReadable.mjs`;wsemi `sgud/rule/rulebook_judge_nothrow.md` R-JUDGE-NOTHROW-01 規則 5;`sgud/rule/rulebook.md` R20 |
| 2 | 2026-11-19 | 全域技能 | role-coder-for-validate | Step 1 之輸入空間表已有「相依大版升級:舊版預設會自動做、新版移除者」一軸;建議再加一軸「舊版拋錯、新版回布林或預設值者」(判斷函數、轉型函數改為不拋錯之類升版),作法:以 `npm pack <舊版>` 解到 `./tmp/` 與新版並排,對同一敵意值集逐函數呼叫,只列行為改變之組合,再逐站點問「防線是否借此拋錯而成立」;本次實測出讀碼易漏之組合(`isfun` 對 `has` 陷阱、`iseobj` 與 `isobj` 之分歧、`cstr` 僅函數類) | `sgud/exp/experience.md` E47;`sgud/rule/rulebook.md` R20 站點表 #3、9、10、11 |
