# 狀態(現況)

本檔只記現況(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證),過程寫入 `sgud/exp/experience.md`.接續工作先讀本檔;完成一項功能或結束一輪工作時更新.

- 更新:2026-11-19(swd492i,連動 wsemi 1.9.69:不可讀之值與判斷函數 R20;前次 2026-10-29 mig-webdata 診斷輸出與遮罩 R18、同日 tm-servwebdata 計時器相關測試事件化 R19).
- 套件版本:`package.json` 為 1.1.46(版號與發布由使用者／發布工具處理);相依 `w-serv-broadcast ^1.1.40`、`w-sync-webdata ^1.1.37`、`wsemi ^1.9.69`、devDependencies `w-converhp ^2.1.39`、`w-orm-lowdb ^1.0.67`.本輪改動**尚未提交**(由主控以本機檢查點提交).

## 一、功能現況

| 功能 | 現況 | 規則帳本 | 測試檔 | 缺口/待辦 |
|---|---|---|---|---|
| 資料通道表操作授權(authorizeExec 預設拒絕) | 已完成 | R1、R4 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 設定檢查(建構任何元件之前拋錯、無副作用) | 已完成,含 `sysFuncsPublic` | R2、R3、R5 | `unit-WServWebdataServer`、`unit-authorizeExec` | — |
| 拒絕值原樣成為前端拒絕值、回應必送出一次 | 已完成 | R7、R8、R9 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 資料同步(時間戳、廣播)與釋放 | 已完成 | R12、R13 | `unit-WServWebdataServer`、`unit-WServWebdataClient`、`api-servdata` | — |
| 前端停止與中止(clearBroadcast、clearSync、opt.signal) | 已完成;輪詢帶 token 後 `nToken` 於測試輔具扣回 | R14 | `unit-WServWebdataClient`、`unit-WServWebdataClientAbort`、`api-clientStop` | — |
| find 白名單(select/delAll) | 已完成 | R15 | `unit-checkFind`、`api-checkFind` | Q11 已裁示不採(使用者 2026-10-17:通道 `delAll` 與後端語意一致,見規則帳本「delAll 通道語意」);L21(文件外方法名)已載於規則帳本與 JSDoc,是否於 parseOpt 驗證已知方法名待下次任務評估(主控排程第 59 項 2026-10-20 結案不改) |
| **系統函數之身分關卡(`sysFuncsPublic`)** | 已完成:**預設三者皆公開(相容既有行為,主控 Q1②)**;顯式設定時列於其中者空 userId 放行、未列者須非空 userId 否則 `permission denied`＋error 事件;建議使用端於前端改用帶 token 之元件後設為只公開 `[sys:getFuncList]`(嚴格設定);反查 reject 一律拒絕;表操作/kpFunExt 之空 userId 語意不變 | R16 | `unit-sysFuncs`〈R16〉、`unit-WServWebdataServer`、`api-sysFuncs` | 各 w-web-* 之嚴格設定排入其連動輪;w-web-sso 不得採嚴格設定 |
| **輪詢之身分關卡與 clientId 歸屬** | 已完成:w-serv-broadcast 1.1.11 `verifyPolling`(`src/genPollingGate.mjs`)+前端 `getToken`;帶鍵者每輪反查 1 次(reject 一律拒),**未帶鍵之舊前端元件不反查、以空身分處理(預設放行/嚴格拒絕)**;首次放行綁定 clientId→userId,逾時離線/clearBroadcast 解除;execFun 對運作中之輪詢只略過 | R17、L16、L22、D4 | `unit-sysFuncs`〈R17〉、`unit-WServWebdataServer`〈釋放〉、`unit-WServWebdataClient`〈輪詢帶token〉、`api-sysFuncs` | L22 ③(離線後至佇列修剪前縫隙)待 w-serv-broadcast 修正(broadcast-run03) |
| **診斷輸出與遮罩(`logDetail`、`funLog`;wsemi 1.9.31 共用模組 `getDiag` 等,宣告在 `src/genDiag.mjs`、token 簿在 `src/genTokenBook.mjs`)** | 已完成(2026-10-29 mig-webdata 遷移,自寫 `src/getDiag.mjs` 已刪):`src/` 可執行 console 為 0(只由 wsemi 輸出);診斷出口 2 處——前端停止後回調拋錯(`callHook`,level `'error'`)預設只輸出 `('[w-serv-webdata] callback error after stop', { hook, errType, errCode })`,伺服端「非有效物件」提示仍為同一固定文字;`logDetail:true` 還原細節、`funLog(label, safe, detail)` 取代 console;**憑證與 token 遮罩字樣 `***`**(原 `[token]`);**對外錯誤值遮罩**:error 事件、前端 reject、**伺服端回給遠端之 `{ state:'error', msg }`(X62,高嚴重度,修前原樣含後端 reject 值)**、輪詢 `verifyPolling` 拒絕值、建構失敗之 catch 皆經 `diag.err`／`diag.mask`(含秘密者為副本,不含者原樣),本套件自身固定詞彙拒絕值不遮(前端 `msgStop`、伺服端 `ownMsgs`);**token 簿含進行中請求之 token(hold 至請求結束,X54)**,前端與伺服端各一;選項型別檢核 `checkOptLog` 行為同舊版 | R18、L24 | `unit-diaglog`(接線)、`unit-diagmask`(16,對外錯誤值站點)、`unit-diagcorpus`(14,共用語料子集)、`api-diaglog`(4,埠 9008~9011) | **下游待同步**:w-serv-hapi 兩檔 JSDoc 字樣(`WServHapiClient.mjs`、`WServHapiServer.mjs`,`[token]`→`***`)與其 `unit-optDoc`(第 3 波);下層(w-serv-broadcast、w-sync-webdata)於無 error 監聽者時 console.error 輸出 error 事件內容(L24 ①);w-serv-broadcast 輪詢 `getToken` 失敗事件之 `err` 非本套件所遮 |
| **計時器相關測試以事件同步(`opt.onTrace`)** | 已完成:前端、伺服端各有選用 `opt.onTrace`,原樣轉交 w-serv-broadcast(本套件自身無計時器;不轉交 w-sync-webdata);測試改以事件同步(`test/tools/tracer.mjs`、`clientHarness.mjs`),`unit-WServWebdataClient`／`Abort`／`sysFuncs`／`diaglog`／`authorizeExec`、`api-sysFuncs`／`diaglog` 之固定等待與 `sleep` 同步點已改;P3／P4 案(五種回調)在 `unit-trace-client`、`unit-trace-server`;無破壞性變更 | R19 | `unit-trace-client`、`unit-trace-server`、上列各檔 | **改造後三種負載試驗未做**(改造前基準已跑:CPU 5 輪、阻塞 5 輪、重度 4 輪;因背景指令逾時失去獨佔鎖,續跑指令見報告 §8,需 `tmp/tm-servwebdata/base` 快照);保留之真實時間見 R19 ⑥(否定觀察窗、10 秒在線逾時、`unit-WServWebdataServer` 三處 `sleep(300)`、`api-servdata` 之範例計時);`api-clientStop` 之牆鐘門檻已改結構指標(R19 ⑦);w-serv-hapi 之 `unit-optDoc` 須補 `@param opt.onTrace`(伺服端與前端兩處) |
| **不可讀之值(已撤銷之 Proxy、陷阱拋錯之 Proxy、`Symbol.toStringTag` 取值拋錯之物件)與 wsemi 判斷函數之連動** | 已完成(2026-11-19 swd492i):wsemi 1.9.69 起判斷函數對此類值回 false 而不拋錯;`src/probeReadable.mjs`(淺探針:標籤、指定鍵 `in`、可列舉鍵走訪、函數判型)於 3 個失效站點明確判定並走原失敗通道——輪詢關卡(`genPollingGate`)輸入不可讀 reject、`kpOrm` 走訪即拋(有同步表名時)建構拋錯、`$fapi` 末參數不可讀 reject;另 `callHook` 改 `isGiven` 使建構後才撤銷之回調走 error 事件;`execute` 之不可讀 input／func 走 `invalid token`／`invalid func`(較早拒絕,無洩漏);其餘站點之 false 去向為拋 `invalid opt.*` 或最低權限預設,逐站點見 R20 表(17 列) | R20 | `unit-unreadable`(25)、`unit-diagmask`(改寫 1、新增 1) | 已知限制:探針與其後判斷函數非原子(有狀態 Proxy 不保證);下游 w-serv-hapi 等整包轉傳者無須改碼 |
| 文件(身分驗證責任、系統函數、診斷輸出、Upgrade Notes) | 已完成:類別/參數 JSDoc(含 WServWebdataServer 第 12 點)、README〈Identity verification〉〈Data channel: system functions〉〈Diagnostic output〉〈Upgrade Notes〉 | R16、R17、R18、L10 | — | `docs/`(產製物)、`dist/` 隨發布自動產製,不在本輪 |

## 二、下游連動(主控另輪)

- 診斷輸出(2026-10-28):w-web-* **不須**傳 `funLog`(預設已不含個資,選項為可選);w-serv-hapi 整包轉傳 `{ ...opt }`,碼不須改,但其伺服端與前端 JSDoc 須補 `@param opt.logDetail`、`opt.funLog`(`unit-optDoc` 以本套件 JSDoc 對照,伺服端 `WServHapiServer.mjs` 與前端 `WServHapiClient.mjs` 兩處,否則轉紅);使用端對回傳之事件物件掛 `error` 監聽,避免下層以 console.error 輸出事件內容(L24).

- w-web-sso:維持預設(或顯式列出三者),**不得**採嚴格設定.
- w-web-perm/api/task:於前端改用本版元件之同一版本，設 `sysFuncsPublic: ['[sys:getFuncList]']`(排入各自連動輪).
- w-serv-hapi:轉傳碼不須改(`{ ...opt }`);JSDoc 須補 `@param opt.sysFuncsPublic`(`unit-optDoc` 以本套件 JSDoc 對照,否則轉紅);`api-sync-authorize` 以「中途變更 token」模擬無權限,同一 clientId 的輪詢因歸屬被拒,須改以授權函數(旗標)模擬;其餘測試未補任何設定即綠(複本實測).
- 測試埠:9003~9007 已登記於規則帳本 R11 埠表.

## 二之二、下游連動(mig-webdata,2026-10-29)

- w-serv-hapi(第 3 波):`WServHapiClient.mjs`、`WServHapiServer.mjs` 之 JSDoc 遮罩字樣 `'[token]'` → `'***'`,其 `unit-optDoc` 須同步;轉傳碼不須改.
- 使用端:比對 `[token]` 字樣者改 `***`;伺服端回遠端之 error `msg` 與 error 事件含網址帳密、`password=`／`token=` 鍵值、伺服端收到之 token 者改為遮罩副本(README〈Breaking changes〉).
- 各 w-web-* 與 w-serv-orm 等 ORM 層之遮罩(`diag.err`)為主防線,本套件為再過一層;待其遷移後回遠端之 msg 不再含連線帳密.

## 二之一、下游連動(tm-servwebdata,2026-10-29)

- w-serv-hapi:整包轉傳 `{ ...opt }`,碼不須改;其伺服端與前端 JSDoc 須補 `@param opt.onTrace`(`unit-optDoc` 以本套件 JSDoc 對照,否則轉紅).

## 三、最近一次驗證

2026-11-19 swd492i(連動 wsemi 1.9.69,R20):見 `C:\opensrcOper\dnow\20261116102625\agent-out\swd492i-修正報告.md`——全套(`quiet-run --lock` 內 `npm test`)308 passing／0 failing(跟跑基準 281 passing／1 failing;新增 `unit-unreadable` 25 案、`unit-diagmask` 淨增 1);修前紅(HEAD 之 src 配 wsemi 1.9.69、最終測試)4 紅 38 綠,紅者即 4 個失效站點;變異 25 個(`--bail`)23 個以斷言失敗被抓、2 個〔M15、M21,「刻意不套」之釘住〕使行程懸置至逾時終止、存活 0;sonnet 唯讀複審 4 項採納 3 項(探針改 `asFun`、`callHook` 改 `isGiven`、kpOrm 探針條件與 `checkSyncOpt` 同),1 項記已知限制(探針與判斷函數非原子).

2026-10-29 mig-webdata:見 `C:\opensrcOper\dnow\20261029002013\agent-out\mig-webdata-修正報告.md`——全套(`quiet-run --lock` 內 `npm test`)281 passing／0 failing(前次紀錄 256);站點全集 26 列(R18 表)無空白格;修前紅 23／32(新測試複本跑於 HEAD 版 src)、變異 21 個全數被抓(首輪存活 M05 補案後殺死),見報告.

前一次 2026-10-29 tm-servwebdata:見 `C:\opensrcOper\dnow\20261029050859\agent-out\tm-servwebdata-修正報告.md`——全套(`quiet-run --lock` 內同 `npm test` 之 mocha 指令)256 passing／0 failing;變異 18 個(另加對照組),新測試擊殺 18／18、舊測試擊殺 16／16(另 2 個無舊測試);改造前負載基準;**改造後負載對照待續跑**(`FIX=CONTINUE`).

前一次(2026-10-28 webdata-run01 第二個,診斷輸出 R18)

見 `C:\opensrcOper\dnow\20261028054319\agent-out\webdata-run01-修正報告.md`:`npm test` 250 passing(基準 206 + 新增 44〔unit-diaglog 41、api-diaglog 3〕);修前紅 21／綠 23(綠者為模組單元與行為鎖定);變異 69 個被抓 66(存活 M13、M60、M61 皆為等價或防禦性,見報告);外審 terra(gpt-6.1-terra max)兩輪共 52 條逐條核對;修前／修後並排實測回調引數、getToken 14 種回傳型態、輪詢微任務序列與停止競態逐項相同.

前次(2026-10-24 webdata-run02):見 `C:\opensrcOper\dnow\20261023213314\agent-out\webdata-run02-修正報告.md`:本套件全部測試、修前紅/修後綠、變異、w-serv-hapi 測試複本結果、真實舊前端元件之相容實跑.
