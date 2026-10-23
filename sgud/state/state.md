# 狀態(現況)

本檔只記現況(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證),過程寫入 `sgud/exp/experience.md`.接續工作先讀本檔;完成一項功能或結束一輪工作時更新.

- 更新:2026-10-24(webdata-run01,系統函數與輪詢之身分關卡).
- 套件版本:`package.json` 為 1.1.15(本輪未改版號,發布由使用者);相依 `w-serv-broadcast ^1.1.11`(node_modules 為 1.1.11)、`w-sync-webdata ^1.1.8`、`wsemi ^1.9.21`.本輪改動**尚未提交、尚未發布**(由主控以本機檢查點提交).

## 一、功能現況

| 功能 | 現況 | 規則帳本 | 測試檔 | 缺口/待辦 |
|---|---|---|---|---|
| 資料通道表操作授權(authorizeExec 預設拒絕) | 已完成 | R1、R4 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 設定檢查(建構任何元件之前拋錯、無副作用) | 已完成,含 `sysFuncsPublic` | R2、R3、R5 | `unit-WServWebdataServer`、`unit-authorizeExec` | — |
| 拒絕值原樣成為前端拒絕值、回應必送出一次 | 已完成 | R7、R8、R9 | `unit-authorizeExec`、`api-authorizeExec` | — |
| 資料同步(時間戳、廣播)與釋放 | 已完成 | R12、R13 | `unit-WServWebdataServer`、`unit-WServWebdataClient`、`api-servdata` | — |
| 前端停止與中止(clearBroadcast、clearSync、opt.signal) | 已完成;輪詢帶 token 後 `nToken` 於測試輔具扣回 | R14 | `unit-WServWebdataClient`、`unit-WServWebdataClientAbort`、`api-clientStop` | — |
| find 白名單(select/delAll) | 已完成 | R15 | `unit-checkFind`、`api-checkFind` | 待裁示 Q11、L21(併排程第 59 項) |
| **系統函數之身分關卡(`sysFuncsPublic`)** | 已完成:預設只公開 `[sys:getFuncList]`;`[sys:getTableTags]`、`[sys:polling]` 須非空 userId,否則 `permission denied`+error 事件;反查 reject 一律拒絕;表操作/kpFunExt 之空 userId 語意不變 | R16 | `unit-sysFuncs`〈R16〉、`unit-WServWebdataServer`、`api-sysFuncs` | 下游:w-web-sso 須設三者;w-serv-hapi 須補 JSDoc 與測試伺服器設定(見修正報告) |
| **輪詢之身分關卡與 clientId 歸屬** | 已完成:w-serv-broadcast 1.1.11 `verifyPolling`(`src/genPollingGate.mjs`)+前端 `getToken`;首次放行綁定 clientId→userId,逾時離線/clearBroadcast 解除;execFun 對運作中之輪詢只略過 | R17、L16、L22、D4 | `unit-sysFuncs`〈R17〉、`unit-WServWebdataServer`〈釋放〉、`unit-WServWebdataClient`〈輪詢帶token〉、`api-sysFuncs` | — |
| 文件(身分驗證責任、系統函數、Upgrade Notes) | 已完成:類別/參數 JSDoc、README〈Identity verification〉〈Data channel: system functions〉〈Upgrade Notes〉 | R16、R17、L10 | — | `docs/`(產製物)、`dist/` 隨發布自動產製,不在本輪 |

## 二、下游連動(主控另輪)

- w-web-sso:`optHapi` 須設 `sysFuncsPublic: ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']`;`WWebSso.mjs` 之 `getUserIdByToken` 註解與 spec 記 ADR.
- w-web-perm/api/task:`getUserIdByToken` fail-closed、前端 `useWaitToken:true`,不須設定;升相依與文件.
- w-serv-hapi:轉傳碼不須改(`{ ...opt }`);JSDoc 須補 `@param opt.sysFuncsPublic`(`unit-optDoc` 以本套件 JSDoc 對照,升相依後轉紅);測試伺服器用預設或回空字串之 `getUserIdByToken` 者須補設定;升相依下限(清單見 `C:\opensrcOper\dnow\20261023213314\agent-out\webdata-run01-修正報告.md`).
- 新增測試埠 9003(perm 型)、9004(sso 型已設)、9005(sso 型預設),待主控登記.

## 三、最近一次驗證(2026-10-24)

- 本套件 `npm test`:198 passing(約 1m17s;基準 155);新增 43 條於修前碼紅 30 綠 13.
- 變異 37 個全被抓到(存活 0);外審 sol 12 條已逐條處置;C 類外審(beam-free、nemotron)額度用盡未派.
- w-serv-hapi 測試複本:基準 111 綠;本套件最終 src 100 綠 11 紅;補設定後 111 綠.
- 細節見 `C:\opensrcOper\dnow\20261023213314\agent-out\webdata-run01-修正報告.md` 與規則帳本〈測試對照〉2026-10-24 段.
