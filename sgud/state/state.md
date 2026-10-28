# 狀態(現況)

本檔只記現況(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證),過程寫入 `sgud/exp/experience.md`.接續工作先讀本檔;完成一項功能或結束一輪工作時更新.

- 更新:2026-10-28(webdata-run01 第二個,診斷輸出 R18;前次 2026-10-24 webdata-run02,預設改為相容).
- 套件版本:`package.json` 為 1.1.17(版號與發布由使用者／發布工具處理);相依 `w-serv-broadcast ^1.1.13`(node_modules 為 1.1.13)、`w-sync-webdata ^1.1.9`(node_modules 為 1.1.9)、`wsemi ^1.9.25`.本輪改動**尚未提交**(由主控以本機檢查點提交).

## 一、功能現況

| 功能 | 現況 | 規則帳本 | 測試檔 | 缺口/待辦 |
|---|---|---|---|---|
| 資料通道表操作授權(authorizeExec 預設拒絕) | 已完成 | R1、R4 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 設定檢查(建構任何元件之前拋錯、無副作用) | 已完成,含 `sysFuncsPublic` | R2、R3、R5 | `unit-WServWebdataServer`、`unit-authorizeExec` | — |
| 拒絕值原樣成為前端拒絕值、回應必送出一次 | 已完成 | R7、R8、R9 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 資料同步(時間戳、廣播)與釋放 | 已完成 | R12、R13 | `unit-WServWebdataServer`、`unit-WServWebdataClient`、`api-servdata` | — |
| 前端停止與中止(clearBroadcast、clearSync、opt.signal) | 已完成;輪詢帶 token 後 `nToken` 於測試輔具扣回 | R14 | `unit-WServWebdataClient`、`unit-WServWebdataClientAbort`、`api-clientStop` | — |
| find 白名單(select/delAll) | 已完成 | R15 | `unit-checkFind`、`api-checkFind` | 待裁示 Q11、L21(併排程第 59 項) |
| **系統函數之身分關卡(`sysFuncsPublic`)** | 已完成:**預設三者皆公開(相容既有行為,主控 Q1②)**;顯式設定時列於其中者空 userId 放行、未列者須非空 userId 否則 `permission denied`＋error 事件;建議使用端於前端改用帶 token 之元件後設為只公開 `[sys:getFuncList]`(嚴格設定);反查 reject 一律拒絕;表操作/kpFunExt 之空 userId 語意不變 | R16 | `unit-sysFuncs`〈R16〉、`unit-WServWebdataServer`、`api-sysFuncs` | 各 w-web-* 之嚴格設定排入其連動輪;w-web-sso 不得採嚴格設定 |
| **輪詢之身分關卡與 clientId 歸屬** | 已完成:w-serv-broadcast 1.1.11 `verifyPolling`(`src/genPollingGate.mjs`)+前端 `getToken`;帶鍵者每輪反查 1 次(reject 一律拒),**未帶鍵之舊前端元件不反查、以空身分處理(預設放行/嚴格拒絕)**;首次放行綁定 clientId→userId,逾時離線/clearBroadcast 解除;execFun 對運作中之輪詢只略過 | R17、L16、L22、D4 | `unit-sysFuncs`〈R17〉、`unit-WServWebdataServer`〈釋放〉、`unit-WServWebdataClient`〈輪詢帶token〉、`api-sysFuncs` | L22 ③(離線後至佇列修剪前縫隙)待 w-serv-broadcast 修正(broadcast-run03) |
| **診斷輸出(`logDetail`、`funLog`,單一出口 `src/getDiag.mjs`)** | 已完成:`src/` 實際會執行之 console 只剩 `getDiag.mjs` 內 2 行(console.error／console.log);前端停止後回調拋錯(`callHook`)預設只輸出 `('[w-serv-webdata] callback error after stop', { hook, errType, errCode })`,不含錯誤訊息文字;伺服端「非有效物件」提示仍為同一固定文字,改經 `diag`,移到 `parseOpt` 之後;`logDetail:true` 還原 `(標籤, 錯誤)`;`funLog(label, safe, detail)` 取代 console 收完整細節(錯誤之拷貝);**token 一律遮罩為 `[token]`**(已知 token〔前端 `getToken` 包裝只記錄〕、鍵名含 token/authorization、Bearer、`token=`／`"__sysToken__":"…"` 樣式);型別錯誤拋 `invalid opt.logDetail`／`invalid opt.funLog`;瀏覽器相容(不引用 Node 內建);回傳與事件契約不變 | R18、L24 | `unit-diaglog`(41)、`api-diaglog`(3,埠 9008~9010)、`unit-WServWebdataClient`〈停止〉R56 條更新 | 下層(w-serv-broadcast `genEeEmit.mjs:40`、w-sync-webdata `genEmit.mjs:53`)於無 error 監聽者時 console.error 輸出 error 事件內容,可能含 `getUserIdByToken` 拒絕值(L24 ①),待主控裁示是否通報下層;w-serv-hapi 之 JSDoc 須補 `@param opt.logDetail`、`opt.funLog`(`unit-optDoc`,伺服端與前端兩處) |
| 文件(身分驗證責任、系統函數、診斷輸出、Upgrade Notes) | 已完成:類別/參數 JSDoc(含 WServWebdataServer 第 12 點)、README〈Identity verification〉〈Data channel: system functions〉〈Diagnostic output〉〈Upgrade Notes〉 | R16、R17、R18、L10 | — | `docs/`(產製物)、`dist/` 隨發布自動產製,不在本輪 |

## 二、下游連動(主控另輪)

- 診斷輸出(2026-10-28):w-web-* **不須**傳 `funLog`(預設已不含個資,選項為可選);w-serv-hapi 整包轉傳 `{ ...opt }`,碼不須改,但其伺服端與前端 JSDoc 須補 `@param opt.logDetail`、`opt.funLog`(`unit-optDoc` 以本套件 JSDoc 對照,伺服端 `WServHapiServer.mjs` 與前端 `WServHapiClient.mjs` 兩處,否則轉紅);使用端對回傳之事件物件掛 `error` 監聽,避免下層以 console.error 輸出事件內容(L24).

- w-web-sso:維持預設(或顯式列出三者),**不得**採嚴格設定.
- w-web-perm/api/task:於前端改用本版元件之同一版本，設 `sysFuncsPublic: ['[sys:getFuncList]']`(排入各自連動輪).
- w-serv-hapi:轉傳碼不須改(`{ ...opt }`);JSDoc 須補 `@param opt.sysFuncsPublic`(`unit-optDoc` 以本套件 JSDoc 對照,否則轉紅);`api-sync-authorize` 以「中途變更 token」模擬無權限,同一 clientId 的輪詢因歸屬被拒,須改以授權函數(旗標)模擬;其餘測試未補任何設定即綠(複本實測).
- 測試埠:9003~9007 已登記於規則帳本 R11 埠表.

## 三、最近一次驗證(2026-10-28 webdata-run01 第二個,診斷輸出 R18)

見 `C:\opensrcOper\dnow\20261028054319\agent-out\webdata-run01-修正報告.md`:`npm test` 250 passing(基準 206 + 新增 44〔unit-diaglog 41、api-diaglog 3〕);修前紅 21／綠 23(綠者為模組單元與行為鎖定);變異 69 個被抓 66(存活 M13、M60、M61 皆為等價或防禦性,見報告);外審 terra(gpt-6.1-terra max)兩輪共 52 條逐條核對;修前／修後並排實測回調引數、getToken 14 種回傳型態、輪詢微任務序列與停止競態逐項相同.

前次(2026-10-24 webdata-run02):見 `C:\opensrcOper\dnow\20261023213314\agent-out\webdata-run02-修正報告.md`:本套件全部測試、修前紅/修後綠、變異、w-serv-hapi 測試複本結果、真實舊前端元件之相容實跑.
