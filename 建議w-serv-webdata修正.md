# 建議 w-serv-webdata 修正:系統函數依作用分類;確認執行身分一律經部署方反查

- 提出:全自有套件之主控(opensrcOper),2026-10-23;任務 `C:\opensrcOper\dnow\20261023213314`.
- 依據:跨套件規格 `C:\opensrcOper\dspec\w-web呼叫者身分驗證.md`(規則 4、5;待處置 C3、C4);使用者 2026-10-23 裁示.

## 一、背景與分工(使用者 2026-10-23 說明)

- 「資料通道會預設傳 token,但得要開自動檢查或反查使用者,才能確認通道給與的 token 到底是誰,而這步驟就是驗證身份.」
- 故分工為:本套件負責**傳遞** token 並在執行任何函數前呼叫部署方之 `getUserIdByToken`(反查＝驗證身分);**驗證之完整度由部署方(各 w-web-* 套件)之 `getUserIdByToken` 負責**.
- C3(請求標頭與本體 `__sysToken__` 為兩個來源)之處置:**不在本套件加兩 token 一致之比對,也不加代理設定**;改由 w-web-perm、w-web-api、w-web-task 之 `getUserIdByToken` 做與連線閘同等之完整驗證(token 有效、本系統使用者存在且啟用、部署方授權),各自另案.
- 歷史(主控查):本套件自 2021 首次上傳即由本體取 `__sysToken__`;三層(w-converhp、w-serv-hapi、本套件)之提交歷史皆無兩 token 比對之加入或移除.2026-10-14 w-web-perm 審計曾標為 C-2 而列觀察.

## 二、本套件須確認或修正者

1. **執行身分一律經反查**:除系統函數外,所有可執行之路徑(表操作、kpFunExt、其他)於執行前皆呼叫 `getUserIdByToken`,且其拒絕即拒絕執行(fail-closed).逐一列出路徑並以測試釘住;有漏者修正.
2. **系統函數依作用分類(C4)**:使用者裁示「列出函數名稱應該沒問題(如同知道 API 清單,沒有 token 沒法調用);主要是框架之各函數是否都有確認,該驗證身分就一定要用 token」.
   - 逐一列出全部系統函數(`[sys:getFuncList]`、`[sys:polling]`、`[sys:getTableTags]` 及其他),寫明其回傳、副作用與現行把關(例:`[sys:polling]` 送 `{clientId}` 不帶 `__sysToken__`、不經 `getUserIdByToken`).
   - 只回公開資訊者(函數名稱清單)可公開;會回資料(例:廣播內容、同步表時間戳)或改變狀態者,須經 `getUserIdByToken` 驗證身分,或提供讓部署方要求身分之設定.
   - 不得破壞 w-web-sso:其 `getUserIdByToken` 固定回空字串、未登入須能進登入頁(`C:\opensrc\開源-JS-411-8-w-web-sso\w-web-sso\server\WWebSso.mjs:1121-1123`).須查 sso 前端未登入時實際用到哪些系統函數.
3. 文件:`getUserIdByToken` 之 JSDoc 寫明「此即驗證身分之步驟,須完整驗證(本系統使用者存在、啟用、授權),不可只解碼或只查 id」;系統函數之身分要求.

## 三、待審計確認

- 上列各點屬實與否、改動處(檔:行)、對既有使用端之影響與升版連動(w-serv-hapi 是否須轉傳新設定;w-web-perm、api、task、sso).
