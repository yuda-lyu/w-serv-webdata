# w-serv-webdata
An operator for data control and synchronization between nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![license](https://img.shields.io/npm/l/w-serv-webdata.svg?style=flat)](https://npmjs.org/package/w-serv-webdata) 
[![npm download](https://img.shields.io/npm/dt/w-serv-webdata.svg)](https://npmjs.org/package/w-serv-webdata) 
[![npm download](https://img.shields.io/npm/dm/w-serv-webdata.svg)](https://npmjs.org/package/w-serv-webdata)
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-serv-webdata.svg)](https://www.jsdelivr.com/package/npm/w-serv-webdata)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-serv-webdata/WServWebdataServer.html).

## Parts
`w-serv-webdata` includes 2 parts: 
* `w-serv-webdata-server`: for nodejs server
* `w-serv-webdata-client`: for nodejs and browser client

## Data channel: find whitelist
資料通道(`useDbOrm: true`)開放表操作給前端時，`select`、`delAll` 之 find(前端所送第1個參數，即查詢條件)來自不可信之客戶端，於呼叫 `authorizeExec` 與 `operOrm` 之前先經固定之白名單檢核(不提供放寬之設定)：
* find 須為未給或一般物件；各鍵須為識別字(Unicode 字母、組合符號、數字、底線，非數字開頭，長度不超過 128，至多 64 個鍵)，故以 `$` 開頭、含點號、為 `Object.prototype` 之成員名(例如 `__proto__`、`constructor`)、為 `prototype` 或 `length`(暫行)之鍵皆不可。
* 各值須為純量(字串不超過 1024 字元且不含 NUL、有限數字、布林，不含 `null`)，或恰含單鍵 `$in` 之物件(值為純量之陣列)，且整個 find 之 `$in` 元素總數(跨鍵合計，非逐鍵)至多 1000 個，超過以 `invalid find[tooManyIn]` 拒絕。
* 因此 `null`、陣列、字串、數字、布林、二進位等非條件物件，運算子(例如 `$or`、`$where`、`$regex`、`$gt`)與巢狀物件一律拒絕，前端收到字串 `invalid find[原因碼]`，不呼叫 `authorizeExec` 與 `operOrm`(先驗後授權)；需要更豐富之查詢者請改用 `kpFunExt` 並自行把關，可引用 `import checkFind from 'w-serv-webdata/src/checkFind.mjs'` 檢核。
* 通過者以全新且凍結之複本取代，`authorizeExec` 與 `operOrm` 收到同一份，授權所見即交給 ORM 者；`authorizeExec` 之 `input` 僅供判斷，就地修改不生效(嚴格模式下拋 `TypeError`，非嚴格模式靜默忽略)；`operOrm` 與 w-serv-orm 之 `addFunCheck`、`addFunPreProcessing` 收到之亦為此複本，需補條件請建新物件(例如 `{ ...input, ownerId: userId }`)。
* 通訊內容經 JSON 序列化，值為 `undefined` 之物件鍵會消失(例如 `{ ownerId: undefined }` 伺服端只見 `{}`，`select` 會回全表、`delAll` 會全刪)，顯式傳入 `undefined` 之 find 會成為 `null` 而被拒絕，前端勿傳 `undefined` 之條件值。
* `delAll` 與後端(w-orm-*、w-serv-orm)語意一致，不另加通道專屬限制，以免用法歧異造成誤解：不給條件(前端省略參數或傳 `{}`，即伺服端收到之 find 為 `undefined` 或 `{}`；前端顯式傳入 `undefined` 經 JSON 成為 `null` 而被拒絕，見上一條)與 `select` 同規則放行，其語意為刪除全部數據，不另行確認；`delAll` 為破壞性操作，**須審慎使用、非必要不用**(非必要請勿將 `delAll` 列入 `methodsExec`)，列入時請於 `authorizeExec` 限制可呼叫者；條件須符合 w-orm 系列白名單，傳非條件物件或白名單外運算子由 ORM 整批 reject，本通道另以上述白名單限縮為等值純量與單鍵 `$in`，未通過者以 `invalid find[原因碼]` 拒絕；`select` 之 find 規則同(省略參數或傳 `{}`，即伺服端收到之 find 為 `undefined` 或 `{}`，回傳全部數據)；`insert`、`save`、`del`、`mix` 之 `input` 不檢核形狀；第1個參數之後之參數(例如 order、limit)丟棄；前端所送之參數(`__sysInputArgs__`)須為陣列，否則回應 `{ state: 'error', msg: 'invalid input' }`。
* 檢核通過不代表後端安全：字串值之語意(例如大小寫、數字字串、陣列欄位之包含)由各 ORM 後端決定；w-serv-orm 之 `procOrm` 對字串型主鍵之 `id` 條件，會把有限數字(含 `$in` 之元素)轉為字串後才交後端，`authorizeExec` 收到的仍是數字，依 `id` 判斷時請以 `String()` 正規化後再比較。
* find 檢核依方法名精確比對 `select` 與 `delAll`(大小寫、空白皆視為不同名)；`methodsExec` 若列入文件所列以外之方法名(例如 w-orm-* 另有之帶條件方法)，其 `input` 不經檢核，須由 `authorizeExec` 或自訂之 `operOrm` 把關，建議只列文件所列之方法。

## Identity verification
身分驗證責任：本套件不驗證 token，只於各關卡呼叫使用方注入之函數；未注入時之預設為放行或無身分(`getUserIdByToken` 預設回空字串，`sysFuncsPublic` 預設三者皆公開以相容已發布之前端元件，建議使用端改用帶 token 之前端元件後設為只公開函數名稱清單)。使用方須自行完整驗證——通訊層(例如 w-converhp 之 `verifyConn`)驗連線之 token(含本系統使用者存在、啟用、部署方授權)；`getUserIdByToken` 反查執行身分，**即驗證身分之步驟**，須與通訊層同等完整(token 有效、本系統使用者存在且啟用、部署方授權)，**不可只解碼或只查 id**；`authorizeExec` 授權表操作(預設拒絕)；`apis` 路由與 `kpFunExt` 各自把關，含函數層級之角色或成員檢查。

## Data channel: system functions
資料通道有三個系統函數，依作用分類(只回公開資訊者可公開；會回資料或改變狀態者須身分)：
* `[sys:getFuncList]`：回函數名稱清單，可公開(`getUserIdByToken` 得空字串亦放行)。
* `[sys:getTableTags]`：回同步表名與時間戳，建議須身分。
* `[sys:polling]`：由 w-serv-broadcast 處理，會建立在線身分並取走該 `clientId` 佇列內之全部廣播(含同步表時間戳廣播與部署方 `broadcast()` 之內容)，建議須身分。

伺服端選項 `sysFuncsPublic` 列出無須身分即可呼叫者。**預設三者皆公開**(`['[sys:getFuncList]', '[sys:polling]', '[sys:getTableTags]']`，相容既有行為：已發布之前端元件其輪詢不帶 token，預設收緊會使其即時同步失效、未登入頁不可用；框架預設多為放行，使用方須自行設定)；**建議使用端將前端改用本版元件(輪詢帶 `__sysToken__`)後，設為 `['[sys:getFuncList]']`**，使無身分者取不到同步表時間戳與廣播。列於 `sysFuncsPublic` 者，`getUserIdByToken` 得空字串亦放行；未列者須得非空字串 userId，否則回應 `{ state: 'error', msg: 'permission denied' }`(輪詢：前端見固定訊息 `[sys:polling] permission denied`)、不執行，並發出 error 事件(`{ msg: 'permission denied', func }`；輪詢為 w-serv-broadcast 之 `{ msg: '[sys:polling] permission denied', err: 原因 }`，反查拋錯時為 `{ msg: '[sys:polling] verifyPolling error', err: 原拒絕值 }`)。`getUserIdByToken` 拋錯或 reject 一律拒絕(含列於 `sysFuncsPublic` 者)。`sysFuncsPublic` 只放寬系統函數之空 userId，表操作與 `kpFunExt` 之空 userId 語意不變(交 `authorizeExec` 或函數自行把關)。

輪詢之身分關卡以 w-serv-broadcast 1.1.11 起之 `verifyPolling` 注入：前端 `getToken` 之值於每輪輪詢放於 `__sysToken__`，伺服端以 `getUserIdByToken` 反查；**`clientId` 須歸屬該身分**——首次放行時綁定 `clientId` 與 userId，其後以不同身分輪詢同一 `clientId` 即拒；綁定於該 `clientId` 逾時離線(在線逾時固定 10 秒，期間無被放行之輪詢)或伺服端 `clearBroadcast` 時解除，故前端身分改變而 `clientId` 未變者，輪詢被拒絕至舊綁定逾時為止。「歸屬」之保證為綁定存活期間內 userId 一致、先到先綁，並非證明初次輪詢者原本擁有該 `clientId`；帶 `__sysToken__` 鍵之輪詢(含空字串)每輪恰呼叫 `getUserIdByToken` 一次，拋錯或 reject 一律拒絕(含公開者)；未帶該鍵之輪詢(已發布之舊前端元件，輸入恰為 `{ clientId }`)未出示 token，以空身分處理而不反查——公開(預設)時放行，嚴格設定時拒絕。

```alias
// 例1：預設(不設 sysFuncsPublic)，相容已發布之前端元件；getUserIdByToken 固定回空字串之部署(如 w-web-sso)，未登入前端須能呼叫三個系統函數，維持預設即可
new WServWebdataServer(inst, {
    getUserIdByToken: async () => '',
    // ...
})

// 例2：前端皆已改用帶 token 之元件後，建議之嚴格設定(只公開函數名稱清單；無身分者之輪詢與時間戳被拒)
new WServWebdataServer(inst, {
    getUserIdByToken: async (token) => { /* 須完整驗證，見上方 Identity verification */ },
    sysFuncsPublic: ['[sys:getFuncList]'],
    // ...
})
```

## Diagnostic output
本套件自身之診斷輸出皆經單一出口(`src/getDiag.mjs`)，**預設只輸出固定標籤與不含資料值、使用者 id、token 及錯誤原文之摘要**。目前共兩處：
* 前端：回調函數(`getServerMethods`、`recvData`、`getRefreshState`、`getRefreshTable`、`getBeforeUpdateTableTags`、`getAfterUpdateTableTags`)於停止後才拋錯(停止後不再發出 error 事件，改以 `console.error` 輸出，使用端程式之錯誤不可無聲)。預設輸出 `'[w-serv-webdata] callback error after stop'` 與 `{ hook, errType, errCode }`——回調函數名稱、錯誤類別(建構子名稱)與機器代碼(如 `ENOENT`、`ERR_*`、整數)，**不輸出錯誤訊息文字**(其可能夾帶資料值、使用者 id 或 token)。
* 伺服端：`instWConverServer` 非有效物件而改建事件物件時，`console.log` 固定文字(不含資料值)，時機同舊版(先於其餘設定檢查)。

兩個建構選項(前端 `WServWebdataClient` 與伺服端 `WServWebdataServer` 皆有，語意與 w-serv-orm 一致)：
* `logDetail`(布林，預設 `false`)：`true` 時 `console` 輸出還原為完整細節(含錯誤原文與其附帶之資料，供除錯)。
* `funLog(label, safe, detail)`(函數，預設無)：給予時診斷輸出只交給它而**不寫 console**；`label` 為固定標籤，`safe` 為不含資料值之摘要，`detail` 為完整細節(錯誤之拷貝，無細節者不傳)，供使用端遮罩或轉送至自己的日誌。其拋錯與回傳 promise 之 reject 皆被吞下，不影響本套件流程。

**token 一律遮罩為 `[token]`**(預設、`logDetail`、`funLog` 皆然)：
* `opt.getToken` 所得者(含輪詢所取；至多記住最近 128 個，以子字串比對，故過短之 token 也會遮罩字樣中相同的片段)。
* 鍵名含 `token`、`authorization`、`api-key` 者之值(含 Symbol 鍵、Map 之鍵)，與 `Bearer` 憑證。
* 字串內 `token=…`、`"__sysToken__":"…"`、`Authorization: Basic …`、`x-api-key=…`、引號包住含空白之值等鍵值形式之值。

保證範圍：上述三類(「最近 128 個」以最近取得或使用為準，重複取得者視為最近使用)。**無法辨識之任意文字中的其他 token 不保證**(例如不在最近 128 個內、也不以上述鍵值形式出現者；已知 token 與 `Bearer`／鍵值樣式部分重疊時以先匹配者為準)。細節為拷貝，遮罩不改動原物件；拷貝時函數、RegExp、二進位資料、過深(8 層)或過大(5000 節點)者以標記字串代替，不執行 getter(`Error` 的 `stack` 為內建存取器，取其字串，與舊版 `console.error(err)` 同樣會讀 `stack`)，原型物件不複製(原型上的資料屬性不遮罩、可變狀態與原物件共用，類別上自訂的 `nodejs.util.inspect.custom` 輸出亦不受遮罩)；遇 `Proxy` 時其陷阱仍會被觸發(`instanceof` 判型，瀏覽器無從偵測 `Proxy`)。預設摘要中的錯誤類別取建構子名稱、代碼取自有屬性 `code`(限整數或 `ENOENT`、`ERR_*` 樣式)——兩者皆由使用端程式決定，以資料動態命名類別或把使用者識別存入 `code` 者不在保證範圍(摘要內若恰等於已知 token 仍遮罩)。細節拷貝需要 ES2015 之 `Reflect.ownKeys`、`ArrayBuffer.isView`(與本套件必備之 `AbortController` 同為現代環境)，缺者細節降為 `[Uncopyable]`。

選項型別錯誤(`logDetail` 非布林、`funLog` 非函數)於建構任何元件之前拋錯(`invalid opt.logDetail`、`invalid opt.funLog`)，`null` 與 `undefined` 視為未給。診斷輸出本身不會使流程拋錯(`console` 或 `funLog` 拋錯一律吞下)。

只涵蓋本套件自身之診斷輸出，**不含**：
* 下層套件之輸出：回傳之事件物件**無 `error` 監聽者**時，w-serv-broadcast 與 w-sync-webdata 會以 `console.error` 輸出該 error 事件之內容(可能含 `getUserIdByToken` 之原拒絕值)；`error` 監聽器自身拋錯時，wsemi 亦會 `console.error` 輸出該拋出值。使用端請對回傳之事件物件掛 `error` 監聽，且監聽器不可拋錯。
* 事件、回應與 reject 之內容(契約，原錯誤值原樣交出)。
* 使用端函數之輸出，以及回調函數的非同步 reject(回調函數為同步呼叫，`async` 回調回傳之 promise 的 reject 不被本套件攔截，屬既有行為)。

```alias
// 預設：只輸出標籤與摘要
new WServWebdataClient(inst, { /* ... */ })

// 除錯：還原完整細節(token 仍遮罩)
new WServWebdataClient(inst, { logDetail: true, /* ... */ })

// 轉送至自己的日誌(自行遮罩個資)
new WServWebdataClient(inst, {
    funLog: (label, safe, detail) => {
        logger.error(label, safe) // detail 含完整細節，需要時自行遮罩後再記錄
    },
    // ...
})
```

## Observation callback (onTrace)
前端 `WServWebdataClient` 與伺服端 `WServWebdataServer` 皆有選用之觀察回調 `opt.onTrace`(函數，格式 `(e) => {}`，預設無)，供測試與診斷以**事件**(而非等待毫秒)同步：
* 本套件自身無計時器，`onTrace` **原樣轉交**所包之 w-serv-broadcast(前端、伺服端各一，1.1.14 起)，事件**不增不減**，欄位與時機以其 JSDoc 為準；**不轉交** w-sync-webdata 之 `onTrace`。
* 前端事件：`start`(輪詢計時器建立)、`tick`(計時器每次觸發)、`request`(發出第 n 輪輪詢)、`result`(第 n 輪結果)、`stop`(`clearBroadcast` 首次呼叫完成)，另有兩端共用之 `emit`(事件已排定於 1ms 後派發)、`deliver`(事件已派發而監聽器皆已呼叫完)、`report`(改以 error 事件或 `console.error` 通報)。
* 伺服端事件：`alive`(在線偵測之 `enter`／`leave`／`tick`／`stop`，種類欄位為 `evType`)、`prune`(修剪佇列)、`stop`，另有兩端共用之 `emit`、`deliver`、`report`。
* 語意：回調同步呼叫、不帶接收者；`e` 為凍結之 `{ type, ... }` 物件、欄位皆為原始值；回調拋錯與回傳之 rejection 一律忽略，不影響本套件；未給或非函數時不組事件物件，行為、時序與效能同未提供。停止後除停止當下已在進行之那次派發外不再通知。
* 經資料通道之 `execute` 所發出的 `error` 事件(拒絕表操作、系統函數等)為同步派發，不經 `emit`／`deliver`；輪詢被拒絕(`verifyPolling`)之 `error` 事件經 `emit`／`deliver`。

```alias
let events = []
let client = new WServWebdataClient(instWConverClient, {
    onTrace: (e) => {
        events.push(e) // { type: 'result', n: 1, ok: true, reason: 'ok', msgs: 0 } ...
    },
    // ...
})
```

## Upgrade Notes
使用端須配合之處：
* **新選項 `onTrace`(前端與伺服端)，無破壞性變更**：選用，未給時行為不變；相依升為 `w-serv-broadcast ^1.1.14`、`w-sync-webdata ^1.1.10`、`wsemi ^1.9.30`，無須改設定。
* **新選項 `logDetail`、`funLog`(前端與伺服端)，預設不輸出錯誤原文**：前端回調函數於停止後才拋錯時，`console.error` 原輸出 `(標籤, 錯誤本身)`，現預設只輸出 `(標籤, { hook, errType, errCode })`；需要原輸出者設 `logDetail: true`，或以 `funLog` 取得完整細節。事件、回傳值與 reject 內容不變；既有部署不必改設定。
* **新選項 `sysFuncsPublic`，預設三者皆公開(與升級前行為相同，既有部署不必改設定)**：已發布之前端元件其輪詢不帶 token，預設收緊會使其即時同步失效、未登入頁(如 w-web-sso 登入頁)不可用；框架預設多為放行，使用方須自行設定。與舊前端元件(輪詢輸入恰為 `{ clientId }`)組合時，綁定、同步、輪詢皆正常，該輪詢不反查。
* **建議**：使用端將前端改用本版元件(輪詢帶 `__sysToken__`)的同一版本中，將伺服端設為 `sysFuncsPublic: ['[sys:getFuncList]']`，使無身分者取不到同步表時間戳與廣播；此嚴格設定下，`[sys:getTableTags]`、`[sys:polling]` 須 `getUserIdByToken` 得非空字串，否則 `permission denied`，且未帶 token 之舊前端元件被拒絕(空身分)。
* **未登入須能進登入頁者(如 w-web-sso)**：維持預設，或顯式列出 `['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']`；若採嚴格設定，前端會因輪詢被拒絕而無法綁定 `$fapi`，伺服端會見到 error 事件(`func` 為 `[sys:getTableTags]`，或 `msg` 為 `[sys:polling] permission denied`)。
* **前端輪詢亦帶 token**：`getToken` 於輪詢亦被呼叫(約每 2 秒一次，每輪重新取得)；伺服端對帶 token 之輪詢每輪多一次 `getUserIdByToken`(快取與撤銷延遲之取捨由使用方決定，本套件不快取)。
* **相依 w-serv-broadcast 升為 `^1.1.11`**：輪詢由其 `verifyPolling` 與前端 `getToken` 鉤子驗證，資料通道對運作中之輪詢只略過；`execute` 監聽器仍為廣播與資料通道各 1 個。
* **`getUserIdByToken` 即驗證身分之步驟**：須完整驗證(token 有效、本系統使用者存在且啟用、部署方授權)，不可只解碼或只查 id；拒絕以 reject 表達。
* **輪詢之 `clientId` 歸屬**：不同身分輪詢同一 `clientId` 被拒絕；前端登出再以他人登入時，若 `clientId` 未變(通訊物件上自訂 `clientId` 或未重建前端)，輪詢被拒絕至舊綁定逾時(約 10 秒)，重建前端(新 `clientId`)則無此延遲。
* 未變：表操作與 `kpFunExt` 之空 userId 語意(交 `authorizeExec` 或函數自行把關)。

## Installation

### Using npm(ES6 module):
```alias
npm i w-serv-webdata
```

#### Example for w-serv-webdata-server:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srv.mjs)]
```alias
// import fs from 'fs'
import _ from 'lodash-es'
import WConverhpServer from 'w-converhp/src/WConverhpServer.mjs'
// import WOrm from 'w-orm-mongodb/src/WOrmMongodb.mjs' //自行選擇引用ORM
import WOrm from 'w-orm-lowdb/src/WOrmLowdb.mjs' //自行選擇引用ORM
import WServWebdataServer from './src/WServWebdataServer.mjs'

let ms = []

//預先刪除w-orm-lowdb資料庫
try {
    fs.unlinkSync('./db.json')
}
catch (err) {}

//optWOrm
let optWOrm = {
    // url: 'mongodb://username:password@127.0.0.1:27017',
    // db: 'servdata',
    url: './db.json',
    db: 'servdata',
    cl: '',
}

//tableNamesExec, tableNamesSync
let tableNamesExec = ['tabA', 'tabB']
let tableNamesSync = ['tabA']

//kpOrm
let kpOrm = {}
for (let k in tableNamesExec) {
    let v = tableNamesExec[k]
    let opt = { ...optWOrm, cl: v }
    let wo = new WOrm(opt)
    kpOrm[v] = wo
}
// console.log('kpOrm', kpOrm)

//saveData
let saveData = async(cl, r) => {

    //w
    let w = kpOrm[cl] //一定要由kpOrm操作, 否則傳kpOrm進去WServWebdataServer會無法收到change事件
    console.log('saveData cl', cl, r)
    ms.push({ 'saveData before': { cl, data: JSON.stringify(r) } })

    //save
    await w.save(r, { autoInsert: true })
        .then(function(msg) {
            console.log('save then', cl, msg)
            ms.push({ 'saveData after': { cl, data: JSON.stringify(msg) } })
        })
        .catch(function(err) {
            console.log('save catch', cl, err)
        })

}

let r

r = [
    {
        id: 'id-tabA-peter',
        name: 'peter',
        value: 123,
    },
    {
        id: 'id-tabA-rosemary',
        name: 'rosemary',
        value: 123.456,
    },
    {
        id: 'id-tabA-kettle',
        name: 'kettle',
        value: 456,
    },
]

await saveData('tabA', r)
console.log('saveData tabA')

r = [
    {
        id: 'id-tabB-peter',
        name: 'peter',
        value: 123,
    },
    {
        id: 'id-tabB-rosemary',
        name: 'rosemary',
        value: 123.456,
    },
]

await saveData('tabB', r)
console.log('saveData tabB')

let n = 0
let t = setInterval(async () => {
    n++
    console.log('update tabA', n)
    r = {
        id: 'id-tabA-peter',
        name: 'peter',
        value: `peter-n[${n}]`,
    }
    ms.push({ 'timer update tabA before': n, r })
    await saveData('tabA', r)
    ms.push({ 'timer update tabA after': n, r })
    if (n >= 5) {
        clearInterval(t)
    }
}, 2000)

let instWConverServer = new WConverhpServer({
    port: 9000,
})

let procCommon = async (userId, tableName, methodName, input) => {
    // console.log('procCommon call', tableName, methodName, input)
    let r = await kpOrm[tableName][methodName](input)
    // console.log('procCommon result', r)
    return r
}

instWConverServer = new WServWebdataServer(instWConverServer, {
    getUserIdByToken: async (token) => { //可使用async或sync函數
        return 'id-for-admin'
    },
    useDbOrm: true, //開啟資料通道, 此時operOrm、tableNamesExec、authorizeExec為必填
    kpOrm,
    operOrm: procCommon, //procCommon的輸入為: userId, tableName, methodName, input
    tableNamesExec,
    tableNamesSync,
    authorizeExec: async ({ userId, tableName, methodName, input }) => { //可使用async或sync函數, 預設拒絕, 回傳嚴格等於true才放行
        if (userId !== 'id-for-admin') {
            return false //取不到使用者(空字串)或非允許之使用者一律拒絕
        }
        return methodName === 'select' //此範例只開放前端讀取, 寫入一律拒絕
    },
    kpFunExt: { //接收參數第1個為userId, 之後才是前端給予參數
        uploadFile: async (userId, { name, u8a }) => {
            console.log('uploadFile', userId, name, _.size(u8a))
            ms.push({ 'uploadFile before': { name, size: _.size(u8a) } })
            // fs.writeFileSync(name, Buffer.from(u8a))
            ms.push({ 'uploadFile after': { name, size: _.size(u8a) } })
            console.log('uploadFile writeFileSync finish')
            return { name, size: _.size(u8a) }
        },
        add: (userId, input) => {
            console.log('add', input)
            let r = input.pa + input.pb
            ms.push({ 'kpFunExt add': { input: JSON.stringify(input), output: JSON.stringify(r) } })
            return r
        },
        //...
    },
    // fpTableTags: 'tableTags-serv-webdata.json',
})

//error
instWConverServer.on('error', (err) => {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverServer.clearBroadcast()
    instWConverServer.clearSync()
    instWConverServer.stop()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//     }
//   },
//   {
//     'saveData after': {
//       cl: 'tabA',
//       data: '[{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1}]'
//     }
//   },
//   {
//     'saveData before': {
//       cl: 'tabB',
//       data: '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//     }
//   },
//   {
//     'saveData after': {
//       cl: 'tabB',
//       data: '[{"n":1,"nInserted":1,"nModified":0,"ok":1},{"n":1,"nInserted":1,"nModified":0,"ok":1}]'
//     }
//   },
//   {
//     'timer update tabA before': 1,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[1]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 1,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[1]' }
//   },
//   {
//     'timer update tabA before': 2,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[2]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 2,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[2]' }
//   },
//   {
//     'timer update tabA before': 3,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[3]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 3,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[3]' }
//   },
//   {
//     'timer update tabA before': 4,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[4]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 4,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[4]' }
//   },
//   {
//     'timer update tabA before': 5,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
//   },
//   {
//     'saveData before': {
//       cl: 'tabA',
//       data: '{"id":"id-tabA-peter","name":"peter","value":"peter-n[5]"}'
//     }
//   },
//   {
//     'saveData after': { cl: 'tabA', data: '[{"n":1,"nInserted":0,"nModified":1,"ok":1}]' }
//   },
//   {
//     'timer update tabA after': 5,
//     r: { id: 'id-tabA-peter', name: 'peter', value: 'peter-n[5]' }
//   }
// ]
```

#### Example for w-serv-webdata-client in node.js:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/srv.mjs)]
```alias
import WConverhpClient from 'w-converhp/src/WConverhpClient.mjs' //編譯後axios不適合執行於nodejs, 故需引用原程式碼執行
import WServWebdataClient from './src/WServWebdataClient.mjs'

let ms = []

//instWConverClient
let instWConverClient = new WConverhpClient({
    //url: window.location.origin + window.location.pathname,
    url: 'http://localhost:9000',
})

//instWConverClient
instWConverClient = new WServWebdataClient(
    instWConverClient,
    {
        getToken: () => {
            return '' //Vue.prototype.$store.state.userToken
        },
        getServerMethods: (r) => {
            console.log('getServerMethods', r)
            //Vue.prototype.$fapi = r

            //$fapi
            let $fapi = r

            let core = async() => {

                //select tabA
                await $fapi.tabA.select(({ prog, p, m }) => {
                    console.log('select tabA', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabA.select then', res)
                        ms.push({ 'select tabA': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabA.select catch', err)
                    })

                //select tabB
                await $fapi.tabB.select(({ prog, p, m }) => {
                    console.log('select tabB', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabB.select then', res)
                        ms.push({ 'select tabB': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabB.select catch', err)
                    })

                //add
                ms.push({ 'call add before': '' })
                await $fapi.add({
                    pa: 1,
                    pb: 2.5,
                }, ({ prog, p, m }) => {
                    console.log('add', prog, p, m)
                })
                    .then((res) => {
                        console.log('add then', res)
                        ms.push({ 'call add after': res })
                    })
                    .catch((err) => {
                        console.log('add catch', err)
                    })

                //uploadFile
                ms.push({ 'call uploadFile before': '' })
                await $fapi.uploadFile({
                    name: 'zdata.b1',
                    u8a: new Uint8Array([66, 97, 115]),
                }, ({ prog, p, m }) => {
                    console.log('uploadFile', prog, p, m)
                })
                    .then((res) => {
                        console.log('uploadFile then', res)
                        ms.push({ 'call uploadFile after': res })
                    })
                    .catch((err) => {
                        console.log('uploadFile catch', err)
                    })

            }
            core()
                .catch(() => {})

        },
        recvData: (r) => {
            console.log('recvData', r)
            //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
        getRefreshState: (r) => {
            console.log('getRefreshState', 'needToRefresh', r.needToRefresh)
        },
        getRefreshTable: (r) => {
            console.log('getRefreshTable', 'tableName', r.tableName, 'timeTag', r.timeTag)
        },
        getBeforeUpdateTableTags: (r) => {
            console.log('getBeforeUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
        getAfterUpdateTableTags: (r) => {
            console.log('getAfterUpdateTableTags', 'needToRefresh', JSON.stringify(r.oldTableTags) !== JSON.stringify(r.newTableTags))
        },
    })

//error
instWConverClient.on('error', (err) => {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverClient.clearBroadcast()
    instWConverClient.clearSync()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//   },
//   {
//     'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//   },
//   { 'call add before': '' },
//   { 'call add after': 3.5 },
//   { 'call uploadFile before': '' },
//   { 'call uploadFile after': { name: 'zdata.b1', size: 3 } }
// ]
```

### In a browser(UMD module):

Add script for w-serv-webdata-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.1.19/dist/w-serv-webdata-client.umd.js"></script>
```

#### Example for w-serv-webdata-client in web:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-serv-webdata/blob/master/web.html)]
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp/dist/w-converhp-client.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/w-serv-webdata@1.1.19/dist/w-serv-webdata-client.umd.js"></script>

let ms = []

//instWConverClient
let WConverhpClient = window['w-converhp-client']

//instWConverClient
let WServWebdataClient = window['w-serv-webdata-client']

let instWConverClient = new WConverhpClient({
    // FormData,
    url: 'http://localhost:9000',
})

instWConverClient = new WServWebdataClient(
    instWConverClient,
    {
        getToken: () => {
            return '' //Vue.prototype.$store.state.token
        },
        getServerMethods: (r) => {
            console.log('getServerMethods', r)
            //Vue.prototype.$fapi = r
                
            //$fapi
            let $fapi = r

            let core = async() => {

                //select tabA
                await $fapi.tabA.select(({ prog, p, m }) => {
                    console.log('select tabA', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabA.select then', res)
                        ms.push({ 'select tabA': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabA.select catch', err)
                    })

                //select tabB
                await $fapi.tabB.select(({ prog, p, m }) => {
                    console.log('select tabB', prog, p, m)
                })
                    .then((res) => {
                        console.log('tabB.select then', res)
                        ms.push({ 'select tabB': JSON.stringify(res) })
                    })
                    .catch((err) => {
                        console.log('tabB.select catch', err)
                    })

                //add
                ms.push({ 'call add before': '' })
                await $fapi.add({
                    pa: 1,
                    pb: 2.5,
                }, ({ prog, p, m }) => {
                    console.log('add', prog, p, m)
                })
                    .then((res) => {
                        console.log('add then', res)
                        ms.push({ 'call add after': res })
                    })
                    .catch((err) => {
                        console.log('add catch', err)
                    })

                //uploadFile
                ms.push({ 'call uploadFile before': '' })
                await $fapi.uploadFile({
                    name: 'zdata.b1',
                    u8a: new Uint8Array([66, 97, 115]),
                }, ({ prog, p, m }) => {
                    console.log('uploadFile', prog, p, m)
                })
                    .then((res) => {
                        console.log('uploadFile then', res)
                        ms.push({ 'call uploadFile after': res })
                    })
                    .catch((err) => {
                        console.log('uploadFile catch', err)
                    })

            }
            core()
                .catch(() => {})

        },
        recvData: (r) => {
            console.log('sync data', r)
            //Vue.prototype.$store.commit(Vue.prototype.$store.types.UpdateTableData, r)
        },
    }
)

//error
instWConverClient.on('error', function(err) {
    console.log('error', err)
})

//sync會通過broadcast給前端還需要時間處理, 故不能於滿足條件就stop
setTimeout(() => {
    instWConverClient.clearBroadcast()
    instWConverClient.clearSync()
    console.log('ms', ms)
}, 14000)
// => ms [
//   {
//     'select tabA': '[{"id":"id-tabA-peter","name":"peter","value":123},{"id":"id-tabA-rosemary","name":"rosemary","value":123.456},{"id":"id-tabA-kettle","name":"kettle","value":456}]'
//   },
//   {
//     'select tabB': '[{"id":"id-tabB-peter","name":"peter","value":123},{"id":"id-tabB-rosemary","name":"rosemary","value":123.456}]'
//   },
//   { 'call add before': '' },
//   { 'call add after': 3.5 },
//   { 'call uploadFile before': '' },
//   { 'call uploadFile after': { name: 'zdata.b1', size: 3 } }
// ]
```