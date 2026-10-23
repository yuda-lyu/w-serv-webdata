# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

- 盤點指令一律於 repo 根執行;`git grep` 只搜追蹤中檔案,避開 node_modules 與資料目錄.
- 跑單一測試檔:`npx mocha --no-parallel "test/<檔名>" --timeout 180000`;全部:`npm test`.
- 站點判準三種:已套/未套/刻意不套(附理由).

## 0. 軸(輸入空間)

| 軸 | 成員 | 取得方式 |
|---|---|---|
| func 類別 | 表操作(`表名.方法`,方法為 methodsExec 所列,如 select/insert/save/del/delAll/mix)、kpFunExt、系統函數(`[sys:getFuncList]` 於 Exec 處理、`[sys:getTableTags]` 由 kpFunSys 提供、`[sys:polling]` 屬 w-serv-broadcast,身分關卡經其 verifyPolling 鉤子,見 R16、R17)、不存在之名稱、Object.prototype 繼承名 | `git grep -n "sys:" -- src`;`node_modules/w-serv-broadcast/src/WServBroadcastServer.mjs` |
| 關卡(依序) | 通訊層 verifyConn(w-converhp/w-serv-hapi,非本套件)→ 協定鍵 `__sysToken__`/`__sysInputArgs__` → getUserIdByToken →(系統函數)須身分除非列於 sysFuncsPublic(R16)→ authorizeExec(僅表操作)→ operOrm 或 kpFunExt 之函數;`[sys:polling]` 另走:verifyConn → 廣播之 verifyPolling(getUserIdByToken、sysFuncsPublic、clientId 歸屬,R17) | `src/WServWebdataServerExec.mjs` 之 execFun 與 buildFuncs;`src/genPollingGate.mjs` |
| 系統函數身分(R16、R17) | 系統函數{getFuncList、getTableTags、polling}×token 狀態{有效、空字串、無效〔反查得空〕、反查回非字串、反查 reject、反查同步拋錯、未帶鍵〔僅輪詢,舊前端〕}×sysFuncsPublic{未給、null、空陣列、各子集、三者}×輪詢 clientId 歸屬{身分 A/B/匿名}×{首次、其後、並發、逾時離線、clearBroadcast、反查期間停止} | `test/unit-sysFuncs.test.mjs` 之 configs、tokenStates;`git grep -n "sysFuncsPublic\|verifyPolling" -- src` |
| 拒絕值型別 | 字串、物件、Error、null、undefined、不可序列化(見 D1)、`{reason:'cancelled'}` | R7 |
| 建構設定 | 每個 opt 鍵 × {未給、有給且有效、有給但無效(外層型別/元素/值)} × useDbOrm{未指定、false、true} × 同步是否啟用 | `src/WServWebdataServer.mjs` 之 parseOpt、Exec 之 parseOpt、Sync 之 checkOpt |
| 通訊物件 | 伺服端{非有效物件(改建 evem)、無 emit、無 on、無 off、有效};前端{未給或非有效物件、無 emit、無 on、無 execute、有效} | 兩建構子開頭之檢查;下層各自之檢查(`node_modules/w-serv-broadcast/src/*.mjs`、`node_modules/w-sync-webdata/src/*.mjs` 之 check 段) |
| 副作用(設定錯誤時皆須為無) | 傳入之事件物件被擴充或掛監聽、廣播計時器、時間戳檔寫入、呼叫使用端 genTag、使用端 kpOrm 被掛監聽 | R2 |
| 函數名路徑 | 可綁定與否(空、空段、守衛名)、保留前綴、表名命名空間、別名(不同名同路徑)、前綴(葉與父)、字面鍵、以 Object.prototype 名為父節點 | `src/funcPath.mjs` |
| 前端時序 | 綁定前／後收到同步廣播、綁定前使用端直接呼叫 updateTableTags、已綁定而缺表／缺 select、select 成功／失敗、失敗後再收到同一時間戳、使用端回呼拋錯 | `src/WServWebdataClient.mjs` |
| 生命週期(伺服端) | 建構成功(同步啟用／未啟用)、設定錯誤、執行期異常(Exec、Sync 之 genTag／kpOrm.on／註冊 changeTableTags／initTableTags)、停止(clearBroadcast、clearSync、重複 clearSync、釋放後 kpOrm 之變更、只 clearBroadcast 而未停通訊服務) × 資源(廣播計時器、w-sync-webdata 之待推播與時間戳檔、kpOrm 監聽) | `src/WServWebdataServer.mjs` 之 try/catch、`src/WServWebdataServerSync.mjs` |
| 生命週期(前端) | 停止呼叫{只 clearBroadcast、只 clearSync、兩者任意順序、重複} × 時機{首次輪詢成功前、openOnce 內、取函數清單在途、getServerMethods 內、取時間戳在途(成功／失敗)、select 在途(成功／失敗)、本套件請求於通訊物件內之階段(等待其 getToken、HTTP 在途、失敗後退避、於其 error 監聽器內重入、回應已到而續行未執行)、先於本套件註冊之使用端監聽(openOnce/broadcast/getData 等)內、停止後之推播、停止後使用端呼叫 updateTableTags 或 $fapi、停止後於同一通訊物件重建} × 輸出{本套件掛於通訊物件之監聽、各回調函數、本套件之 error、w-sync-webdata 之事件(含無 error 監聽者時之 console.error)、w-serv-broadcast 之事件、w-converhp 逐次 error 與重試訊息、停止後送出之本套件請求(含重試)、行程存活(停止至行程自然結束)、$fapi 之結算} | `src/WServWebdataClient.mjs` 之 isStopped、acSelf(R14);各下層之 clear 函數 |
| 通訊物件之種類與本套件請求之身分(前端) | execute 支援 opt.signal(w-converhp ≥2.1.8)／不支援(w-converhp ≤2.1.7、w-converws、w-conversi 之 execute 只收 3 參數,第 4 參數被忽略);本套件請求之身分 `this === SELF`／使用端替換 getServerMethods 所給物件之函數(同步 select 不再被視為本套件之請求,R14 ⑧) | 各通訊物件 `src/*Client.mjs` 之 execute 簽名;`src/WServWebdataClient.mjs` 之 `SELF` |
| find 輸入形狀(資料通道 select/delAll,R15) | 方法{select、delAll、其餘}×參數位置{`__sysInputArgs__` 之型別、args[0]=find、args[1..]多餘參數、授權函數所見之 input、operOrm 所收之 input}×形狀群{W 白名單內、N 非條件物件(null/陣列/字串/數字/布林/二進位)、O 頂層運算子鍵($where/$expr/$or…)、F 欄位層運算子($regex/$gt/$nin…)、V 值與鍵形狀及規模(`length`、Object.prototype 成員名、自有 `__proto__`、點號、超長字串、NUL、`$in` 邊界、重複混型)、P 協定與位置}×JSON 往返後可到達之型別(undefined/函數/Symbol 之鍵消失、Date→字串、NaN→null、二進位標記還原、自有 `__proto__` 鍵)×ORM 後端{lmdb、level、lowdb、mongodb、reladb、postgresql、mdb} | run02 審查之 87 案×5 後端實跑(`tmp/vin02/cases.mjs`、`tmp/vin02/out/`,暫存不入版控);下游實際用法:`git grep` w-web-perm/api/task 之資料通道設定(皆 `methodsExec:['select']`、授權函數不讀 input、客戶端只送無參數 `select()`) |
| 其他 | 並發、前端參數個數、input 參照、error 事件 | — |

## 1. 規則

### R1 表操作預設拒絕授權

- 規則:buildFuncs 所建之每個表操作函數,呼叫 operOrm 前必 `await authorizeExec({ userId, tableName, methodName, input })`,僅回傳值 `=== true` 放行;否則 `return Promise.reject('permission denied')`(必為字串).`select`、`delAll` 之 input 於授權之前先經 R15 之 find 白名單(授權函數與 operOrm 收到者為檢核後之凍結複本).
- 單一擁有者:`src/WServWebdataServerExec.mjs` buildFuncs.
- 盤點:`git grep -n "operOrm(" -- src` → 只應有 buildFuncs 內一處呼叫,且其前為授權判斷.
- 站點:buildFuncs 之 operOrm 呼叫(已套).
- 測試:`test/unit-authorizeExec.test.mjs`〈授權流程〉全部;`test/api-authorizeExec.test.mjs` 前 5 條.

### R2 設定錯誤於建構任何元件之前拋錯,不留副作用

- 規則:
  - WServWebdataServer 先以 `parseOpt` 解析並檢查全部設定,通過後才依序建構 WSyncWebdataServer → WServBroadcastServer → Exec → Sync(execute 監聽器之順序須廣播先於 Exec).設定錯誤時:不擴充傳入之事件物件、不註冊監聽、不寫時間戳檔、不呼叫使用端 genTag、不在使用端 kpOrm 掛監聽.建構使用 parseOpt 之結果(陣列為快照),不重讀原始 opt.
  - 檢查內容:未指定 useDbOrm(非布林)卻給了 operOrm、tableNamesExec、methodsExec、authorizeExec、kpOrm、tableNamesSync 任一者;`useDbOrm=true` 時 operOrm、authorizeExec 須為函數,tableNamesExec 須為陣列,kpOrm 須為物件,methodsExec(未給或 null 取預設 select/insert/save/del)、tableNamesSync 有給須為陣列,三份清單之元素須為非空字串;同步啟用時各同步表須在 kpOrm 中且有 `on` 函數,並須在 tableNamesExec 中且 methodsExec 含 select(只認經授權之表操作,kpFunExt 提供之 select 不算);getUserIdByToken、genTag 有給須為函數;fpTableTags 有給須為非空字串;kpFunExt 有給須為純物件、其值皆須為函數;sysFuncsPublic 有給須為陣列且元素須為三個系統函數名之一(R16,與 useDbOrm 無關);函數名規則見 R5.明示 `useDbOrm:false` 時不檢查資料通道與同步之設定.
  - 訊息格式:型別或格式錯誤用 `invalid opt.<對外參數名>[<索引或鍵>][ when useDbOrm=true]`;同步表之事件物件沿用 `invalid kpOrm[<表>]`／`kpOrm[<表>] can not listen to change events`;函數名衝突用描述式(見 R5).
  - 執行期異常(使用端 genTag 拋錯或回傳非非空字串、kpOrm 之 on 拋錯):Sync 先算時間戳並檢查,再逐表掛監聽並註冊 changeTableTags(任一失敗即移除已掛者),全部成功才寫時間戳檔;WServWebdataServer 之 try/catch 依序 clearBroadcast、clearSync(見 R13).此時傳入之事件物件已被擴充,文件註明不可再以同一事件物件重建.
- 單一擁有者:資料通道之規則在 Exec 之 `parseOpt`;同步之規則在 Sync 之 `checkOpt`(同步是否啟用亦由其回傳);跨兩者之規則(useDbOrm、kpOrm、tableNamesSync 型別、同步表須有 select)與 fpTableTags、genTag 在 WServWebdataServer 之 `parseOpt`.Exec、Sync 建構時仍呼叫自己的檢查函數(同一函數,非重寫).
- 盤點:`git grep -n "throw new Error" -- src`;`git grep -n "parseOpt\|checkOpt" -- src`;`git grep -n "clearBroadcast" -- src`.
- 站點:上列各檢查(已套);`src/WServWebdataServerSync.mjs` checkOpt 之 `if (!iseobj(kpOrm)) return false`(刻意不套:kpOrm 為內部函數之一般參數,空物件代表無同步事件物件而不需同步,業主裁示);instWConverServer 非物件時改建 evem(刻意不套:既有設計,有 log,w-sync-webdata 1.1.7 與 w-serv-broadcast 1.1.8 之伺服端仍同型;evem 可作不連線之伺服端,與前端不同,見 R12 ⓪);instWConverServer 須有 emit、on 與 off 函數(已套;off 供 w-serv-broadcast 之 clearBroadcast 移除監聽,缺者原會於停止或建構失敗之 catch 內拋 TypeError,後者蓋掉原錯誤並略過 clearSync;w-serv-broadcast 1.1.8 起其伺服端亦於建構時、副作用之前檢查同三者,但本套件先建構之 WSyncWebdataServer 已擴充傳入之物件,故本套件之前移檢查仍必要).
- 測試:`test/unit-WServWebdataServer.test.mjs`〈設定錯誤於建構任何元件之前拋錯且不留副作用〉(以建構前後比對自有鍵、方法參照、execute 監聽數、計時器數、使用端 ORM 監聽數、既有時間戳檔內容,並斷言 genTag 0 次)、〈資料同步〉;`test/unit-authorizeExec.test.mjs`〈建構檢查〉.

### R3 useDbOrm 預設 false

- 規則:WServWebdataServer 與 Exec 之預設一致為 false;開啟資料通道須使用端明示(未指定卻給設定時拋錯,見 R2).
- 盤點:`git grep -n "useDbOrm = " -- src` → 兩處皆 false.
- 測試:「未給opt時不拋錯且無表操作」、「useDbOrm未給或非布林且未給資料通道設定時視同false」、「useDbOrm未給或非布林卻給了資料通道或資料同步之設定時拋錯」、「useDbOrm=false時…皆不拋錯」、「明示useDbOrm=false時不檢查」.

### R4 授權只作用於表操作

- 規則:authorizeExec 只在 buildFuncs 之表操作內呼叫.系統函數無授權函數,其身分要求見 R16(sysFuncsPublic)、R17(輪詢).
- 站點:表操作(已套);kpFunExt(刻意不套:逐一手寫之明示開放,各自把關,含函數層級之角色或成員檢查);`[sys:getFuncList]`、`[sys:getTableTags]`(刻意不套 authorizeExec:系統函數,改依 R16 之身分關卡);`[sys:polling]`(刻意不套 authorizeExec,改依 R17 之身分關卡).
- 測試:「kpFunExt與系統函數不經授權函數」;api「kpFunExt不經授權函數」.

### R5 函數名之路徑規則(前後端共用單一模組)

- 規則:前端依函數名之路徑把後端函數綁成物件(例如 `tabA.select` 綁為 `$fapi.tabA.select`).解析(lodash `toPath`)、綁定與取值(只沿自有屬性,不讀寫繼承屬性)、衝突檢查全部集中在 `src/funcPath.mjs`,前端 bindFuncs／refreshTable 與後端檢查共用.後端對全部表操作與 kpFunExt 檢查:①路徑不得為空、不得有空段、各段不得為 `__proto__`、`constructor`、`prototype`;②kpFunExt 不得以 `[sys:` 開頭;③kpFunExt 之頂層名不得為任一表操作之頂層名(表名),`tabA`、`tabA.count`、`tabA[select]` 皆不可;④不同函數名不得解析為同一路徑(例如 `a.b` 與 `a["b"]`、`tools.run` 與 `tools[run]`),亦不得互為前綴(例如 `a` 與 `a.b`;表名 `a` 與 `a.select` 時其 select 互為前綴),完全同名者視為同一函數.系統函數以 `kpFunSys` 傳入,不受②～④限制.
- 理由:③防止 kpFunExt 覆蓋或看似表操作而不經授權;④前端綁定時後者會覆蓋前者,或同步取錯表;只沿自有屬性是避免以 Object.prototype 之名稱(例如 `toString`)為父節點時把函數寫到內建函數上,並避免字面鍵(例如 `["a.b"].other`)遮蔽路徑.
- 訊息:`table operation[<名>] can not be bound by the client`、`kpFunExt[<名>] can not be bound by the client`、`kpFunExt[<名>] can not use the reserved prefix [sys:`、`kpFunExt[<名>] conflicts with the table operations of table[<表>]`、`<table operation|kpFunExt>[<後者>] conflicts with <table operation|kpFunExt>[<前者>] on the client binding path`.
- 單一擁有者:`src/funcPath.mjs`(解析、綁定、取值、衝突);Exec 之 parseOpt 呼叫之.
- 盤點:`git grep -n "funcPath" -- src`;`git grep -n "lodash-es/set\|lodash-es/toPath" -- src`(只應出現於 funcPath.mjs).
- 站點(2026-10-13 讀碼):perm、api、task 之 kpFunExt 皆為扁平名稱,不與表名同名,彼此不互為前綴(已套,不會拋錯);sso 為 useDbOrm false.
- 測試:`test/unit-WServWebdataServer.test.mjs`〈函數名之路徑衝突〉;`test/unit-WServWebdataClient.test.mjs`〈函數名之路徑綁定〉;`test/unit-authorizeExec.test.mjs`〈建構檢查〉命名相關.

### R6 前端可呼叫者只限 funcs 之自有屬性

- 規則:函數查找用 `Object.prototype.hasOwnProperty.call(funcs, func)`;不可用 wsemi `haskey`(其為 `key in obj`,含繼承屬性).
- 盤點:`git grep -n "haskey(" -- src`.
- 站點:Exec 函數查找(已套);Exec `haskey(input, '__sysToken__')`、`haskey(input, '__sysInputArgs__')`(刻意不套:判斷協定鍵是否存在);WServWebdataServer/Client `haskey(inst, 'emit')`(刻意不套:判斷事件物件).
- 測試:「Object.prototype之名稱不可呼叫」(unit 6 名、api 3 名).

### R7 各關卡之拒絕值原樣成為前端拒絕值

- 規則:getUserIdByToken 以 try/catch 攔下後 `pm.resolve({ state: 'error', msg: err })`;authorizeExec、operOrm、kpFunExt 經 pm2resolve.套件自訂之拒絕訊息一律字串.getUserIdByToken 不可改用 pm2resolve(其把同步 `throw null` 視為成功,會以空字串 userId 繼續執行).
- 序列化後前端所見(實測):字串 → 原字串;物件 → 原物件;Error → `'Error: 訊息'`(wsemi `obj2stru8arr.mjs:123-124`);undefined → undefined;null → null.不支援之格式見 D1.
- 盤點:`git grep -n "pm.resolve(" -- src/WServWebdataServerExec.mjs`.
- 站點:getUserIdByToken 之 catch(已套);函數呼叫之 pm2resolve(已套);內層 catch(刻意:只由 pm2resolve 同步拋錯或參數展開失敗觸發);外層 catch(防禦性,無已知來源).
- 測試:〈授權流程〉reject 各型別;〈getUserIdByToken之拒絕〉全部;api tabKey、tabErr、getUserIdByToken.

### R8 回應必送出一次,事件監聽器不可 reject

- 規則:依 w-converhp 契約(2.1.7 之 `WConverhpServer.mjs:681` @returns;2.1.6 為 :663),execute 監聽器為同步函數;各分支皆 settle pm(例外:廣播運作中之 `[sys:polling]` 由 w-serv-broadcast 以 verifyPolling 非同步結算,execFun 只略過、不回應、不回傳 pm,R17 ⑤);先 settle 再發事件;本套件之 error 事件一律經 wsemi `evEmit`(隔離監聽者之拋錯);訊息組字一律 wsemi `getErrorMessage`.
- 單一擁有者:Exec 之監聽器與 execFun;前端之 `emitError`.
- 盤點:`git grep -n "on('execute'" -- src`;`git grep -n "\.emit('error'" -- src`(應為 0);`git grep -n "err.message" -- src`(應為 0).
- 站點:Exec 之 execute 監聽器(已套);前端各 error(已套).
- 測試:〈execute監聽器之契約〉2 條;「reject undefined時仍回應error而不懸置」.

### R9 getUserIdByToken 之取值

- 規則:`userId = await getUserIdByToken(token)`(原生 Promise 與其他 thenable 一致);非字串一律視為 ''.
- 測試:「回傳非原生Promise之thenable時以其結果為userId」、「getUserIdByToken取不到userId或回傳非字串時…」.

### R10 範例與文件同步

- 規則:伺服端設定於 `srv.mjs`、README 伺服端範例、`src/WServWebdataServer.mjs` JSDoc 範例、`test/api-servdata.test.mjs` 四處一致(`useDbOrm: true`＋`authorizeExec` 只開放 select);Node 前端於 `scl.mjs`、README Node 範例、`src/WServWebdataClient.mjs` JSDoc 範例三處一致(`new WConverhpClient({ url })`).停止段落一律伺服端 `clearBroadcast()`→`clearSync()`→`stop()`、前端 `clearBroadcast()`→`clearSync()`(含 web.html 與 README web 範例、兩支 api 測試).資料通道之授權、拒絕、命名、設定錯誤與停止之規則集中寫於 WServWebdataServer 之類別說明;前端之設定檢查、同步時序、取資料失敗與停止寫於 WServWebdataClient 之類別說明.
- 盤點:`git grep -n "authorizeExec" -- srv.mjs README.md src/WServWebdataServer.mjs test/api-servdata.test.mjs`;`git grep -n "FormData\|form-data" -- . ':!package-lock.json'`;`git grep -n -A1 "clearBroadcast()" -- README.md srv.mjs scl.mjs web.html src test/api-*.mjs`(每處下一行須為 clearSync,src 內另含建構失敗之 catch).
- 站點:web.html 與 README web 範例之 `// FormData,`(已註解,刻意保留).

### R11 測試配置

- 規則:檔名前綴 `unit-`/`api-`;`npm test` 為 mocha --parallel;伺服器埠固定(api-servdata 9000、api-authorizeExec 8301、api-clientStop 9001、api-checkFind 9002,新增者另取 ≥8000 之固定埠,由主控登記避免與他套件衝突;8300–8399 為 w-converhp 測試之區段,新增者不取,本套件 8301 為既有);前端時序測試以記憶體假通訊層相連,不開埠;假通訊層兩種並存且只定義一次(`test/tools/clientHarness.mjs`):`linkCtl` 只取 func、忽略 execute 之第 4 參數,代表不支援 opt.signal 之通訊物件,為停止閘門(R14)之觀察者,既有〈停止〉各條一律用之;`linkSig` 依 w-converhp 2.1.8 之契約處理 `opt.signal`(呼叫時已中止者以 `signal.reason` 拒絕且不記入 sent;在途時中止者立即以 reason 拒絕),中止之新行為用之——不可把 `linkCtl` 整體改為依 signal,否則 `:313` 等閘門之變異存活(2026-10-13 獨立審查之變異實測);測試輔助(`run`、`extraHooks` 等)一律取自同檔,不在測試檔內另寫近似實作;暫存落 `test/_tmp/<案名>/`(含 WConverhpServer 之 `pathUploadTemp`),after 刪除;以 evem 建構之實體與前端於 after `clearBroadcast()`(前端時序測試另 `clearSync()`).缺陷重現測試須於舊碼紅(以逾時競賽避免懸置),行為鎖定測試須於舊碼綠.需量測「停止後行程自然結束」者以子行程執行前端(伺服端在測試行程,其延遲計時器不影響量測),輔助檔放 `test/tools/`(不帶 `.test.`).
- **埠表**(本套件測試用固定埠之登記;新增者續取下一號並登記於此,避開 8300–8399 與他套件):

| 埠 | 測試檔 | 用途 |
|---|---|---|
| 8301 | `api-authorizeExec` | 授權與拒絕語意 |
| 9000 | `api-servdata` | 範例回歸 |
| 9001 | `api-clientStop` | 前端停止(前端於子行程) |
| 9002 | `api-checkFind` | find 白名單 |
| 9003 | `api-sysFuncs` | perm 型,嚴格設定(只公開 `[sys:getFuncList]`) |
| 9004 | `api-sysFuncs` | sso 型,顯式列出三者 |
| 9005 | `api-sysFuncs` | sso 型,未設 `sysFuncsPublic`(預設;新、舊前端元件) |
| 9006 | `api-sysFuncs` | sso 型,嚴格設定(前端不綁定) |
| 9007 | `api-sysFuncs` | perm 型,未設 `sysFuncsPublic`(預設;`getUserIdByToken` 對空 token 拒絕;新、舊前端元件) |

- 站點:`test/unit-*.test.mjs`、`test/api-authorizeExec.test.mjs`、`test/api-clientStop.test.mjs`(已套);`test/api-servdata.test.mjs` 與 `srv.mjs` 寫 repo 根之 `db.json`、`tableTags.json`、`./uploadTemp`(未套,既有).

### R12 前端之設定檢查與同步時序

- 規則:⓪instWConverClient 須為有效物件、具 emit 與 on、具 removeListener 或 off、具 execute,違反即於建構任何元件之前依序拋 `instWConverClient is not an effective object`／`instWConverClient is not an EventEmitter`／`instWConverClient.execute is not a function`(與 w-serv-broadcast 前端同訊息,1.1.8 起其亦於建構時檢查 on;removeListener 或 off 為本套件停止時移除監聽所需,2026-10-13 第六輪加;本套件之檢查須先於 WSyncWebdataClient 之建構,且先於 opt 之檢查);不改用 evem(前端無 execute 即無法輪詢);①getServerMethods、recvData 必須為函數,getToken 與 getRefreshState、getRefreshTable、getBeforeUpdateTableTags、getAfterUpdateTableTags 有給須為函數,違反即於建構任何元件(含輪詢)之前拋 `invalid opt.<名>`;①'執行環境須內建 AbortController(本套件之 acSelf 與 w-serv-broadcast 1.1.9 起之輪詢中止皆需要),缺者於 opt 之檢查之後、建立 acSelf 與建構任何元件之前拋 `AbortController is not available`(與 w-serv-broadcast 1.1.9 前端同訊息;2026-10-13 第七輪,配合 1.1.9);②函數清單綁定完成前略過同步廣播,綁定後 core 以 `[sys:getTableTags]` 取得當下全部時間戳;③refreshTable 之失敗路徑(缺表、缺 select、select 失敗)一律 `input.pm.reject(...)`:缺表／缺 select 以字串 `invalid kpExec[<表>]`／`kpExec[<表>].select is not a function`,select 失敗以原拒絕值;由 w-sync-webdata 發出一則 `{msg:'can not get table data: <表>', err, tableName, timeTag}` 之 error 並不推進該表時間戳,本套件不另發 error;禁止以 `resolve([])` 結束失敗;④使用端回呼一律經 `callHook`(拋錯改發 error,不中斷同步;停止後不呼叫,見 R14);⑤`updateTableTags` 之回傳 promise 接 catch(w-sync-webdata 1.1.7 起恆 resolve,保留為防禦).
- 理由:⓪原於未給時印「改用事件物件」並改建 evem,w-serv-broadcast 1.1.7 起其前端於建構時檢查 execute 而拋下層訊息,此時 WSyncWebdataClient 已擴充傳入之物件;無 on 者則於 w-serv-broadcast 前端啟動輪詢後才在註冊監聽時拋 TypeError,殘留輪詢計時器(2026-10-13 探針實測,1.1.7);下層之檢查須全數前移至本套件建構任何元件之前(1.1.8 起下層亦於建構時檢查 on,但 WSyncWebdataClient 先擴充之事實不變,前移仍必要).①'w-serv-broadcast 1.1.9 起其前端於建構時檢查 AbortController(其 `src/WServBroadcastClient.mjs:67-70`),若只靠它,缺者會在 WSyncWebdataClient 擴充傳入之物件之後才拋;本套件之 acSelf 雖已先 `new AbortController()` 而以 ReferenceError 擋在前面(無副作用),訊息與下層不一致——依 ⓪ 同一原則改為同訊息之明確檢查;置於 opt 之檢查之後,使設定錯誤之訊息不被環境錯誤蓋過(同 2026-10-13 獨立審查 R14 之理由).②改為 reject 後早到之廣播不再遺失資料,閘門改為避免綁定前之無謂請求與 error(原理由:以空資料結束會記下時間戳而綁定後不再重抓,三位審查者實測);③w-sync-webdata 1.1.7 起每表之等待恆 resolve、批次必發 afterUpdateTableTags,reject 不會中斷同步(1.1.6 之 `Promise.all(pms)` 直接等原始 pm,reject 會使整批中斷,此即原碼 `resolve([])` 之理由);以空資料結束則會清空前端該表並記下時間戳,到該表下次變動前不重抓(對標 TanStack Query、SWR:失敗保留舊資料另報錯).
- 單一擁有者:`src/WServWebdataClient.mjs`.
- 盤點:`git grep -n "isBound\|callHook\|emitError" -- src/WServWebdataClient.mjs`;`git grep -n "input.pm.resolve(\[\])\|input.pm.reject(" -- src/WServWebdataClient.mjs`(前者應為 0,後者 3 處:缺表、缺 select、select 失敗).
- 測試:`test/unit-WServWebdataClient.test.mjs` 全部;①' 見 `test/unit-WServWebdataClientAbort.test.mjs`〈建構檢查〉(刪除全域 AbortController 後建構:設定錯誤仍先拋 `invalid opt.getServerMethods`,設定正確時拋 `AbortController is not available` 且通訊物件未擴充、未啟動輪詢;修前碼配 w-serv-broadcast 1.1.9 紅在通訊物件已被擴充,只有 `new AbortController()` 之版本紅在訊息為 `AbortController is not defined`).

### R13 釋放(停止與建構之執行期異常)

- 規則:①Sync 於掛 kpOrm 監聽並註冊 changeTableTags 成功後、寫時間戳檔之前,包裝實例之 `clearSync`:先移除本套件掛於 kpOrm 之 change 監聽與掛於通訊物件之 changeTableTags 監聽(只移除自己掛的,使用端既有之監聽保留;後者 2026-10-13 第六輪依獨立審查 F4 加),再呼叫 w-sync-webdata 之 clearSync(取消待推播、未落檔者寫入、之後不作用);可重複呼叫.②回滾與釋放共用 `removeListeners`(`src/removeListeners.mjs`,紀錄為 `{ev, name, h}`,依序試 removeListener、off,失敗略過;前端停止移除通訊物件上之監聽亦用之,見 R14).③WServWebdataServer 建構之執行期異常 catch 依序 `clearBroadcast()`、`clearSync()` 再拋錯.④未啟用同步時不包裝(沿用 w-sync-webdata 之 clearSync).
- 理由:w-sync-webdata 1.1.7 之 clearSync 文件明載「上層掛於ORM等外部物件之監聽須由上層自行移除」「重建前須先呼叫clearSync」;掛的人負責移除(對標 VS Code IDisposable、RxJS unsubscribe).包裝裝在寫檔之前,使其後之異常(實務上 initTableTags 不拋錯,屬防禦)亦可經 clearSync 釋放.
- 單一擁有者:`src/WServWebdataServerSync.mjs`(包裝);`src/removeListeners.mjs`(容錯移除,2026-10-13 第六輪自 Sync 移出供前後端共用);`src/WServWebdataServer.mjs`(catch).
- 盤點:`git grep -n "removeListeners\|clearSync" -- src`.
- 站點:Sync 之回滾與包裝(已套);WServWebdataServer 之 catch(已套);w-serv-broadcast 掛於傳入事件物件之 execute 監聽與在線偵測(由其 clearBroadcast 移除與釋放,1.1.7 起;1.1.8 起停止後不再派發其事件,含已排定者,補發 clientLeave 以已送達之 clientEnter 為準);Exec 之 execute 監聽(刻意不移除:不可以同一事件物件重建,見 L8);本機 7 個 w-orm-*(level、lmdb、lowdb、mongodb、postgresql、reladb、mdb)皆回傳 eventemitter3 實例,具 removeListener(2026-10-13 讀碼).
- 測試:`test/unit-WServWebdataServer.test.mjs`〈釋放〉4 條.

### R14 前端停止(clearBroadcast、clearSync)後本套件不再作用

- 規則:①前端之監聽(openOnce、broadcast、refreshState、refreshTable、getData、beforeUpdateTableTags、afterUpdateTableTags 共 7 個)一律經 `on` 註冊並記錄;於建構下層(WSyncWebdataClient、WServBroadcastClient)之後、註冊監聽之前包裝回傳物件之 `clearBroadcast`、`clearSync`:先設 `isStopped = true`、以 removeListeners 移除已記錄之監聽,再呼叫下層同名函數;任一被呼叫即停止本套件,可重複、依任意順序呼叫;兩者不互相連帶呼叫.②停止後本套件不再呼叫任何使用端之函數(各回調與 getToken)、不再發 error、不再送出自身之請求:callHook 不呼叫;emitError 不發;core 於 bindFuncs 之後(含於 getServerMethods 內停止)不再取時間戳;updateSyncTable 不交付同步;於同一次派發中已停止者(監聽雖已移除仍走完該次,eventemitter3 依派發開始時之清單;例如使用端之監聽先於本套件註冊而於其中停止)openOnce 不啟動、refreshTable 不送出 select 而以字串 `'stopped by clearBroadcast or clearSync'` reject;本套件自身之請求(取得函數清單、時間戳、同步表之 select,一律以 `SELF` 為 this 呼叫 executeShell 所建之函數)於等待 getToken 期間已停止者不送出,以同一字串 reject;**已交給通訊物件者一併中止**(2026-10-13 第七輪):於建構檢查之後、建構下層之前建立本實體專用之 AbortController(`acSelf`),本套件自身之請求以 `execute(func, input, fprog, { signal: acSelf.signal })` 送出,使用端之 `$fapi` 給 undefined;兩包裝於 `isStopped = true` 之後、移除監聽之前呼叫 `acSelf.abort(msgStop)`.停止之拒絕值一律為常數 `msgStop`(`'stopped by clearBroadcast or clearSync'`):等待 getToken 期間停止、refreshTable 內停止與中止之 reason 三處同值.③通訊物件支援 opt.signal(w-converhp ≥2.1.8)時,停止時在途之本套件請求被中止:通訊物件不再為其重試、不再發出其各次嘗試失敗之 error、不再印重試訊息、不再為其呼叫通訊物件之 getToken,以 msgStop 拒絕(執行環境不支援 `abort(reason)` 者由 w-converhp 補 name 為 AbortError 之錯誤),core 經 emitError(已停止)結束而不綁定;中止前已發出之 error 不收回,伺服端已開始之處理照常完成而結果忽略.不支援者(w-converhp ≤2.1.7、w-converws、w-conversi 之 execute 只收 3 參數)忽略第 4 參數:停止前已交給它之請求照常結算而結果忽略(函數清單照常綁定而不呼叫 getServerMethods;取時間戳成功不交付同步、失敗不發 error),其重試與逐次 error 照常(L17).④使用端自行呼叫之函數($fapi)不受停止影響(仍呼叫 getToken、不帶 signal,照常完成或依通訊物件之重試失敗).⑤停止前已被呼叫之回調於停止後才拋錯者,改以 `console.error('[w-serv-webdata] callback error after stop', err)` 輸出.⑥只呼叫其一時,另一下層依其自身規則:只 clearBroadcast 時,停止時在途之同步表 select 被中止(通訊物件支援 opt.signal 者),w-sync-webdata 以 msgStop 為 err 發一則帶表名之 error(使用端無 error 監聽者時為其 console.error;業主 2026-10-13 裁示 Q1 接受此行為改變);不支援者,停止前已送出之 select 於停止後失敗時由其以原失敗值發 error;w-sync-webdata 停止後才派發之取資料因無監聽者由其以 `no listener for event[refreshTable]` 結束並發 error;只 clearSync 時輪詢續行.⑦兩者皆呼叫後可於同一通訊物件重建(新實體有自己之 acSelf,不受舊實體之中止影響);只呼叫其一即重建時,未停止之下層仍屬舊實體而與新實體並存(舊輪詢無從停止、或舊實體在途之結果進到新實體),不支援.⑧本套件自身之請求之身分以 `this === SELF` 判定,同步表之 select 取自交給使用端之物件(getServerMethods 所提供者);使用端替換其函數者,該表之同步請求不再視為本套件之請求(停止時不中止、等待 getToken 期間停止仍送出),JSDoc 載明而不改碼(業主 2026-10-13 裁示 Q6 (a):內部函數表會使使用端刻意替換之 select 被同步忽略).
- 理由:下層停止後皆不再派發事件(w-serv-broadcast 1.1.8 之 clearBroadcast 含已排定與在途之輪詢結果,1.1.9 起並以其自身之 AbortController 中止在途之輪詢請求;w-sync-webdata 1.1.7 之 clearSync 含在途之取資料結果),本套件原無停止狀態,停止前已啟動之 openOnce 流程於停止後照常呼叫 getServerMethods、發 error、續送請求(w-serv-hapi 之 `建議w-serv-webdata修正.md` 實測一、二;2026-10-13 記憶體測試、真 HTTP 與經 w-serv-hapi 實跑皆重現).移除監聽:掛的人負責移除(同 R13);下層皆允許停止後於同一事件物件重建(兩者 JSDoc「重建前須先呼叫 clear…」),舊實體之監聽若留著會先於新實體處理同一事件——修正前舊實體之回調於重建後照常被呼叫、請求加倍;只加閘門而不移除時,舊實體之 refreshTable 監聽先註冊而以字串拒絕新實體之取資料,新實體同步失敗(2026-10-13 探針實測).等待 getToken 者不送出:請求尚未交給通訊物件,送不送是本套件之選擇;送出則伺服器已停時與建議書實測二同型(獨立審查 F5).停止後回調拋錯改 console.error:停止後不發 error,但使用端程式之錯誤不可無聲(同 w-serv-broadcast 1.1.8 之 genEeEmit;獨立審查 F2).任一觸發:同 w-serv-hapi 前端「等待 token 期間呼叫任一即取消」.不互相連帶:停止本套件與停止下層是兩件事——部分停止時本套件已停止,未被停止之下層依其自身文件繼續(例如只 clearSync 時 w-serv-broadcast 之輪詢與使用端自掛之 broadcast 監聽照常),本套件不代為停止,以免改變下層各函數之語意;文件規定停止時兩者皆呼叫(原載「部分停止不是支援之續行模式」與「保留各自之文件語意」並列而被獨立審查 F8 指為矛盾,2026-10-13 改寫為此).④對稱伺服端:停止廣播與同步後資料通道照常至通訊服務停止.中止(②③,2026-10-13 第七輪):w-converhp 2.1.8 起前端之 execute 接受 opt.signal(其 `src/WConverhpClient.mjs` @returns 之「中止」段),L17 之前提(無中止能力)消失(E22 作法);真 HTTP 實測取時間戳在途時停止,中止前停止後 4 則 error、約 11 秒才結束,中止後 0 則、2-3 毫秒(`建議w-serv-webdata調整.md` 之審計 run01).每實體一個 controller:本套件之請求同生同滅,重建者另有自己的;共用一個 signal 不累積監聽(w-converhp 每次呼叫掛 1 個、結束即移除;Node 24 實測 30 個並發無警告,Node 文件載 AbortSignal 預設不警告),每請求各一個(P2)無可觀察之益處.建立於建構檢查之後:缺 AbortController 之環境不蓋過設定檢查之訊息(獨立審查 R14).reason 用既有停止字串:同一語意同一值(業主裁示 Q2);不在 catch 以停止狀態改寫拒絕值(P1n),否則不支援 opt.signal 之通訊物件於停止後之真實失敗被改寫(既有測試即紅).使用端之 `$fapi` 不中止:可為寫入,中止即「結果未知」;同 TanStack Query 未使用 signal 者照常完成.對標見〈對標摘要〉.
- 單一擁有者:`src/WServWebdataClient.mjs` 之 `isStopped`、`acSelf`、`msgStop`、`on`、`SELF`;閘門 8 處:emitError、callHook 入口、callHook 之 catch(改 console.error)、executeShell 於取得 token 後(限 SELF)、updateSyncTable、openOnce 入口、core 之 bindFuncs 後、refreshTable 之 select 前(皆為「呼叫使用端函數／發 error／送出本套件之請求」之前一刻);中止 1 處:兩包裝內之 `acSelf.abort(msgStop)`;移除用 `src/removeListeners.mjs`.
- 盤點:`git grep -n "isStopped" -- src/WServWebdataClient.mjs` → 程式碼 10 行(宣告 1、設定 1、閘門 8;註解提及者另計,以實作後之盤點為準);`git grep -n "acSelf" -- src/WServWebdataClient.mjs` → 程式碼 3 處(宣告、abort、execute 帶 signal);`git grep -n "stopped by clearBroadcast" -- src` → 只有 `msgStop` 之定義 1 處(JSDoc 另提及);`git grep -n "call(SELF)" -- src/WServWebdataClient.mjs` → 3 處(取得函數清單、時間戳、select);`git grep -n "\.execute(" -- src/WServWebdataClient.mjs` → 1 處(executeShell,本套件請求之單一出口);`git grep -n "instWConverClient.on(" -- src/WServWebdataClient.mjs` → 只有 `on` 內 1 處與 JSDoc 範例 1 處(新增監聽一律經 `on`);新增任何呼叫使用端函數、發 error 或送出本套件請求之處,須經 callHook／emitError、以 SELF 呼叫或自行檢查 isStopped.
- 站點:上列(已套);停止前已交給通訊物件之本套件請求(已套,2026-10-13 第七輪:以 acSelf 中止;通訊物件不支援 opt.signal 者仍依其重試,L17);使用端自行呼叫之函數(刻意不套:④);使用端替換 getServerMethods 所給物件之函數(刻意不套:⑧,文件載明);使用端自己掛於回傳物件之監聽(例如 error,刻意不移除:非本套件所掛).
- 測試:`test/unit-WServWebdataClient.test.mjs`〈停止〉共 15 條(R50 12、R52 1、R55 1、R56 1;另 R51 1 條為伺服端第 9 點之半停止,見 L16;「select 在途」一條含 4 子情境、「等待 getToken」一條含 2 子情境),用 `linkCtl`(不支援 opt.signal 之通訊物件),各條另斷言 getToken 之呼叫次數(nToken)使每一閘門皆可觀察;〈設定檢查〉R54 驗 removeListener/off.`test/unit-WServWebdataClientAbort.test.mjs`(2026-10-13 第七輪):以 `linkSig` 驗中止(本套件請求帶 signal 而 `$fapi` 不帶、停止當下即中止(兩者/只其一)、只 clearBroadcast 時 select 被中止之 error、取函數清單在途、`$fapi` 照常、重建),以 `linkCtl` 驗先於本套件註冊之使用端 broadcast/getData 監聽內停止(守 updateSyncTable、callHook 入口兩閘門,不依賴晚到之請求).`test/api-clientStop.test.mjs`(真 HTTP,埠 9001,前端於子行程):停止後通訊物件之 error 0 則、無重試訊息、行程於停止後 500ms 內自然結束(取時間戳在途、select 在途;取得函數清單後即停止與 `$fapi` 照常為行為鎖定).變異測試:2026-10-13 第六輪(`tmp/upd118/review/mut.mjs`)拿掉任一閘門、移除監聽、SELF 檢查、console.error 分支、建構檢查或 callHook 之 isfun,皆至少一條紅;第七輪重跑結果見〈測試對照〉下之紀錄.

### R15 資料通道對 select/delAll 之 find 做形狀與運算子白名單,授權所見即交給 ORM 者

- 規則:資料通道是 input 來自不可信客戶端之唯一處(procOrm 同時服務伺服端程式,不宜放客戶端白名單),故 buildFuncs 對 `methodsFind = ['select', 'delAll']` 之表操作,於 `authorizeExec` **之前**以 `src/checkFind.mjs` 之 `checkFind` 檢核 find(`__sysInputArgs__[0]`);通過者以全新複本取代之,授權函數與 operOrm 收到同一份.白名單為固定集合,不開 opt(需要更豐富查詢者走 kpFunExt,自行呼叫 procOrm 並把關).規格句(測試註解以 `R15 S<n>` 標註):
  - **S1** find 僅可為未給(`undefined`)或一般物件(原型為 `Object.prototype` 或 `null`,無 Symbol 鍵、無不可列舉之自有屬性);`null`、陣列、字串、數字、布林、二進位、Date、RegExp、Map、Set、函數、Symbol、BigInt、類別實例一律拒絕(理由:非條件物件在 lmdb/level/lowdb/reladb 被當成無條件而回全表,違反 dspec〈一之一〉).
  - **S2** 鍵須為識別字(`/^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u`),長度 ≤128,故 `$` 開頭(`$where`、`$expr`、`$function`、`$or`、`$custom`…)、點號、空白、符號、數字開頭皆拒;**不得為 `Object.prototype` 之成員名**(`k in Object.prototype`:含 `__proto__`、`constructor`、`toString`、`hasOwnProperty`…,與 reladb `cvFind.mjs` 同法)、不得為 `prototype`、**暫行不得為 `length`**(w-serv-orm 之 `castIdFind` 以 lodash `each` 迭代使用端物件,具整數 `length` 者被當陣列樣物件而條件整個消失:select 回全表、delAll 全刪、寫入列遺失且主鍵被改;該缺陷另案修正中,**本暫行規則保留至另行裁示**,移除須同時升 w-serv-orm 相依下限,屬下游 w-web-* 之事);鍵數 ≤64.
  - **S3** 值須為純量(字串 ≤1024 字元且不含 NUL、**有限**數字、布林;**不含 null**)或「恰含單鍵 `$in` 之物件,其值為純量之密集陣列(無額外屬性、無稀疏洞),且**整個 find 之 `$in` 元素總數 ≤1000**(跨鍵合計,不逐鍵計;超過以 `tooManyIn` 拒絕,2026-10-17 run04 由逐鍵計改為合計)」;`$in` 不限欄位(通道不知主鍵名);巢狀物件/陣列之等值、`$in` 以外之運算子、`$in` 與他鍵並存、非純量元素一律拒;空 `{}` 與空 `$in:[]` 通過(空 `$in` 不占額度,等值之純量值亦不計).元素總數上限 1000 依實測:mingo 系 `$in` 成本 ∝ 列數×元素數(8000 列×10000 元素 4.85 s;×1000 元素 216 ms),且逐鍵計時 64 鍵並存可達 64,000 元素(外審 opus 實測 2000 列各條件皆命中:1 鍵×1000 元素 54 ms,64 鍵×1000 元素 2896 ms,約 54 倍),故以合計封頂.
  - **S4** 不合者以**字串** `invalid find[<原因碼>]` 拒絕(`Promise.reject`,原因碼:notObject、badKey、badOperator、badValue、badIn、tooManyKeys、tooManyIn;不回顯客戶端值),不呼叫授權函數與 operOrm;**先驗後授權**(授權函數只見白名單形狀,未授權者僅多得到不含資料之 `invalid find[…]`).被拒形狀不發 error 事件、不輸出 log(同 L5;`unit-checkFind` 以 `inst.on('error')` 計數與攔截 console 驗證);日後若加結構化 log,不得含客戶端值.`checkFind` 不拋出:檢視客戶端所送之值時拋錯(getter 拋錯、已撤銷之 Proxy、反射陷阱拋錯,皆非 JSON 可達,供 kpFunExt 作者於行程內傳入任意值之契約)一律以 `notObject` 拒絕.
  - **S5** 通過者交授權函數與 operOrm 之 input 為**全新且凍結**之複本(同一份;頂層值與 `$in` 之元素各只讀一次,故 getter/Proxy 無從在檢核與使用之間換值);授權所見即交給 ORM 者(**ORM 邊界以內**:operOrm 收到同一份;其下 w-serv-orm 之 procOrm 對字串型主鍵之 `id` 條件把有限數字(含 `$in` 元素)轉為字串(`getMapOrm.mjs` 之 `castIdValue`,R-ID-02,文件 `WServOrm.mjs:20`)才交後端,授權函數收到的仍是數字,故依 `id` 判斷之授權函數須以 `String()` 正規化後比較——為 w-serv-orm 既有且有意之正規化,不在本套件處理,README 與 JSDoc 載明).複本為凍結物件:就地修改不生效(嚴格模式下拋 TypeError,非嚴格模式靜默忽略),operOrm 與 w-serv-orm 之 `addFunCheck`、`addFunPreProcessing` 收到之亦為此複本,需補條件須建新物件.
  - **S6** 適用於 methodsExec 中之 `select`、`delAll`,**delAll 與 select 同規則**(未給與 `{}` 放行;`checkFind` 之 `requireKey` 選項保留但**預設關**,供「delAll 須至少 1 個條件」之政策取捨——Q11 已由使用者 2026-10-17 裁示不採: delAll 與後端一致,不給條件即全刪,不另加通道專屬限制,見〈delAll 通道語意〉);其餘方法暫不檢(insert/save/del/mix 之形狀檢核與「未給 methodsExec 之預設改 `['select']`」為破壞性,另立排程第 59 項).
  - **S7** `__sysInputArgs__` 須為陣列(對所有函數,含 kpFunExt 與系統函數),否則 `{state:'error', msg:'invalid input'}`,不呼叫 getUserIdByToken 與任何下游(原字串被展開成逐字參數,物件/數字/null 以內部錯誤文字回應).
  - **S8** 第 1 參數之後之參數不交給授權函數與 operOrm(D3,維持丟棄,不拒絕).
- 理由:run02 審查以真 HTTP 經本套件、真 w-serv-orm、五個真後端實送 87 案(435 格),最小白名單外 63 案通道拒收 0.MongoDB 後端會執行客戶端字串 `$where`/`$function`(delAll `{$where:'true'}` 刪 3/3 列);mingo 系 `$regex`/`$expr` 被接受;`$in` 與深度巢狀為同步阻塞成本;`length` 使條件消失.授權函數若依 input 判斷,則「授權所見」須等於「ORM 所收」才有意義,故以凍結複本取代.白名單**不統一各後端語意**(陣列欄位包含、數字字串、大小寫由各後端決定,dspec 一),授權函數若以嚴格字串比對 input 須知此差異.
- 單一擁有者:`src/checkFind.mjs`(純函數,回傳 `{ok, find|reason}`,常數 `MAX_KEYS`、`MAX_KEY_LEN`、`MAX_STR`、`MAX_IN`、`REG_KEY`、`KEYS_DENY` 隨檔匯出;可由 `w-serv-webdata/src/checkFind.mjs` 引用,供 kpFunExt 作者重用,Q12);`src/WServWebdataServerExec.mjs` 之 `methodsFind`、buildFuncs 函數首段(S4–S6)、execFun 於 `input = input.__sysInputArgs__` 之後(S7).
- 盤點:`git grep -n "checkFind\|methodsFind" -- src`(Exec 內:import 1、`methodsFind` 宣告 1、buildFuncs 內 `includes` 與呼叫各 1);`git grep -n "operOrm(" -- src`(仍只 1 處,其前依序為 find 類方法之 checkFind 與 authorizeExec);`git grep -n "Array.isArray(input)" -- src/WServWebdataServerExec.mjs`(S7,1 處);`git grep -n "invalid find\[" -- src`(S4 組字,1 處);`git grep -n "\.\.\.input" -- src/WServWebdataServerExec.mjs`(展開處只在 S7 之後).
- 站點全集與判準:
  - select、delAll(已套).
  - insert、save、del、mix(刻意不套:Q8,下游只開 select、w-serv-orm 已檢各列須為物件;形狀檢核與預設值改動排程第 59 項;測試以行為鎖定標註).
  - methodsExec 文件所列(select、insert、save、del、delAll,另有 mix)以外之方法名,例如 w-orm-* 實例另有之 `selectByPk`、`insertBulk`(2026-10-17 讀 `w-orm-lowdb/src/WOrmLowdb.mjs:1053-1060`;w-serv-orm 的 procOrm 只認 select/insert/save/del/delAll/mix,故只有使用端自訂 operOrm 才可達):刻意不套,其 input 非 find 條件,與 insert 類同屬 Q8 另案.
  - kpFunExt(刻意不套:R4 逐一手寫之明示開放,各自把關;checkFind 可由 `src/checkFind.mjs` 重用,kpFunExt 收到原始 `...input` 為旁路).
  - 系統函數(`[sys:getFuncList]`、`[sys:getTableTags]`;find 檢核不適用,S7 之陣列檢查已套).
  - 同步表之 select(前端不帶參數,`__sysInputArgs__=[]`,find 為未給,通過).
  - find 以外之參數(order、sort、limit 等):D3 丟棄,不可達 ORM(`getMapOrm.mjs` 只傳 find 給 `wo.select`).
- 測試:`test/unit-checkFind.test.mjs`(純函數 + evem 不開網路)、`test/api-checkFind.test.mjs`(真 HTTP 埠 9002,自寫客戶端以 `WConverhpClient.execute` 直送,驗 JSON/二進位往返後之形狀);既有 `test/unit-authorizeExec.test.mjs`、`test/api-authorizeExec.test.mjs` 之斷言不變.缺陷重現者於舊碼紅、行為鎖定者於舊碼綠(紅綠與變異結果見 run03 修正報告與〈測試對照〉).

### R16 系統函數之身分關卡(sysFuncsPublic)

- 依據:跨套件原則 `C:\opensrcOper\dspec\使用者身分驗證原則.md` §二2(getUserIdByToken 即驗證身分之步驟)、§二7(系統函數:只回公開資訊者可公開,會回資料或改變狀態者須身分);使用者 2026-10-23 裁示(函數名稱清單可公開,其餘框架函數應驗身分者一律 token);主控裁定 Q1(webdata-run01 原採①預設只公開 `[sys:getFuncList]`;**2026-10-24 改裁②:預設三者皆公開、嚴格設定由使用端顯式 `['[sys:getFuncList]']`**,理由:已發布之 w-web-perm/api/task/sso 前端建置檔用舊前端元件〔輪詢不帶 token〕,預設收緊會使其即時同步失效、sso 登入頁不可用;跨套件原則:框架預設多為放行,使用方須自行設定;見 decisions.tsv `webdata-run01-receipt`)、Q3(因無身分被拒時發 error 事件);審計 `C:\opensrcOper\dnow\20261023213314\agent-out\webdata-inv01-審計報告.md`.
- 規則:
  - ①系統函數全集 `sysFuncs = ['[sys:getFuncList]', '[sys:getTableTags]', '[sys:polling]']`(Exec 模組常數;亦是 `sysFuncsPublic` 元素之合法集合,與 R5 ② 之保留前綴 `[sys:` 對應).
  - ②`opt.sysFuncsPublic`(**預設 `['[sys:getFuncList]', '[sys:polling]', '[sys:getTableTags]']`**,即升級前行為;建議使用端在前端改用帶 token 之元件後設為 `['[sys:getFuncList]']`):列於其中之系統函數,`getUserIdByToken` 得空字串亦放行;未列者須得非空字串 userId,否則回 `{state:'error', msg:'permission denied'}`(固定鍵、不回顯 token)、不執行,並發 error 事件 `{ msg:'permission denied', func }`(系統函數無使用端授權函數可記錄,error 事件為唯一觀察點).
  - ③反查拋錯或 reject 一律拒絕(含公開者與表操作、kpFunExt):拒絕值原樣成為回應之 msg,error 事件為原拒絕值(R7 不變).
  - ④`sysFuncsPublic` 只放寬系統函數之空 userId.**表操作與 kpFunExt 之空 userId 語意不變**(交 authorizeExec 或函數自行把關;sso 全部 kpFunExt 依賴此語意).
  - ⑤設定檢核同 R2:有給須為陣列,元素須為三個系統函數名之一,否則於建構任何元件之前拋 `invalid opt.sysFuncsPublic`／`invalid opt.sysFuncsPublic[<索引>]`;快照(建構後修改原陣列不生效);與 useDbOrm 無關(不列入「未指定 useDbOrm 卻給設定」之檢查).
  - ⑥協定鍵缺漏(無 `__sysToken__`/`__sysInputArgs__`)、參數非陣列於反查之前即拒絕(不變,B5).不存在之函數名亦先反查再判斷(不變).
- 單一擁有者:Exec 之 `parseOpt`(檢核、預設與快照)與 execFun 之身分檢查(單點);WServWebdataServer 之 `parseOpt` 只讀取並轉交給 Exec 之 `parseOpt`.
- 盤點:`git grep -n "sysFuncsPublic" -- src`;`git grep -n "sysFuncs\b" -- src/WServWebdataServerExec.mjs`.
- 站點全集(系統函數 3 × 預設公開/建議須身分):`[sys:getFuncList]` 預設公開、建議亦公開(已套;內容只含函數名稱,L2);`[sys:getTableTags]` 預設公開(相容)、建議嚴格設定時須身分(回同步表名與時間戳);`[sys:polling]` 預設公開(相容)、建議嚴格設定時須身分(經 R17 之鉤子).下游設定:w-web-sso(`getUserIdByToken` 固定回空字串、`useDbOrm:false`,未登入前端依序呼叫此三者〔審計實測〕)維持預設或顯式列出三者,**不得**採嚴格設定;w-web-perm/api/task(`getUserIdByToken` fail-closed、前端 `useWaitToken:true`)於前端改用本版元件之同一版本設為嚴格設定(排入各自連動輪);w-serv-hapi 之測試伺服器因預設相容,未補任何設定即可(`unit-optDoc` 仍須其 JSDoc 補 `@param opt.sysFuncsPublic`,見修正報告).
- 測試:`test/unit-sysFuncs.test.mjs`〈R16 系統函數之身分關卡〉15 條(矩陣:2 系統函數×9 token 狀態×11 設定〔sysFuncsPublic 之 8 個子集＋未給＋null＋重複〕;預設相容、嚴格設定、舊前端元件之相容);`test/unit-WServWebdataServer.test.mjs`〈設定錯誤…〉2 條(含自訂迭代器之快照順序);`test/api-sysFuncs.test.mjs`(perm 型嚴格/預設、sso 型三者/預設/嚴格,新舊前端元件).

### R17 輪詢([sys:polling])之身分關卡、略過與 clientId 歸屬

- 依據:同 R16;主控裁定 Q2 採 2c(不取出 w-serv-broadcast 之監聽,改用其 1.1.11 起之正式鉤子 `verifyPolling` 與前端 `getToken`);L12(提供鉤子後其輪詢回覆為非同步,同一事件物件上同步回應輪詢之監聽會搶先結算).
- 規則:
  - ①輪詢輸入為 `{ clientId, __sysToken__ }`(非資料通道之協定),由 w-serv-broadcast 在資料通道之前處理;本套件以 `opt.verifyPolling` 注入身分關卡(`src/genPollingGate.mjs`),execute 監聽器數量與順序不變(廣播先於 Exec).
  - ②鉤子:**輸入有 `__sysToken__` 鍵者**(含空字串;非字串以 `cstr` 轉換,同資料通道)每輪呼叫 `getUserIdByToken` 恰 1 次;**無該鍵者〔已發布之舊前端元件,輪詢輸入恰為 `{ clientId }`〕未出示 token,以空身分處理而不反查**(公開時放行,嚴格設定時回 `'empty userId'`):webdata-run01 曾因外審 sol #3 改為「無鍵以空字串反查」,webdata-run02 因預設改為三者公開〔主控改裁 Q1②〕須相容舊前端——perm/api/task 之 `getUserIdByToken` 對空 token fail-closed 地 reject,若無鍵亦反查,舊前端輪詢會被拒而即時同步失效;無鍵不構成繞過(無鍵＝無身分＝與反查得空字串同,是否放行只看 `sysFuncsPublic`);反查拋錯或 reject(含 falsy 值 undefined、null、false、0、空字串)→ 鉤子拋出(廣播以固定訊息 `[sys:polling] permission denied` 拒絕,error 事件為 `{ msg:'[sys:polling] verifyPolling error', err:<原拒絕值> }`);回傳非字串視為空字串;空字串且 `[sys:polling]` 未列於 sysFuncsPublic → 回 `'empty userId'`(拒絕);廣播要求嚴格 `true` 才放行,拒絕時回描述字串(`'empty userId'`、`'clientId belongs to another userId'`、`'stopped'`)供其 error 事件 `{ msg:'[sys:polling] permission denied', err }` 稽核,前端只見固定訊息.
  - ③clientId 歸屬:首次放行時綁定 clientId→userId(公開時匿名者為空字串,匿名亦為一種身分),其後以不同 userId 輪詢同一 clientId 即拒.檢查與綁定在反查之 await 之後同步執行(並發時先完成者勝).保證範圍為**綁定存活期間內 userId 一致、先到先綁**,並非證明初次輪詢者原本擁有該 clientId(連線識別由伺服端產生並綁定已驗證身分者才有該保證,對標 Socket.IO、SignalR;本套件沿用前端自訂 clientId 之既有協定,外審 sol #5);clientId 為任意非空字串,大小寫視為不同,`__proto__`、`constructor`、含點或括號者皆為一般識別(綁定用 Map).
  - ④綁定之生命週期:放行時建立;該 clientId 逾時離線(w-serv-broadcast 在線逾時固定 10 秒內無被放行之輪詢,發出 `clientLeave`)時由本套件掛於事件物件之 clientLeave 監聽解除;`clearBroadcast` 時全部解除並不再綁定(反查期間停止者亦不綁定);被拒絕之輪詢不建立或刷新綁定與在線身分.前端身分改變而 clientId 未變者,輪詢被拒絕至舊綁定逾時(約 10 秒)(D4).
  - ⑤execFun 對 `[sys:polling]`:廣播運作中**只略過**(不回應,且不可回傳 pm:async 函數回傳 pm 會跟隨其狀態,廣播 `pm.reject` 時 execute 監聽器之 catch 會多發一則 error);廣播已停止(包裝後之 clearBroadcast 已呼叫)或未建構(單獨建構 Exec)回 `{state:'error', msg:'invalid token'}`,不反查(L16).
  - ⑥前端:`WServWebdataClient` 把 `getToken` 交給 w-serv-broadcast 前端(`new WServBroadcastClient(inst, { getToken })`),輪詢每輪呼叫並放於 `__sysToken__`;不加停止閘門(輪詢之生命週期依 w-serv-broadcast,R14 ⑥:只 clearSync 時輪詢續行而仍帶 token).
  - ⑦伺服端 `clearBroadcast` 為包裝:先 `gate.stop()`、移除本套件掛於事件物件之 clientLeave 監聽(R13:掛的人負責移除),再呼叫廣播之 clearBroadcast;建構之執行期異常之 catch 亦經之.
- 單一擁有者:`src/genPollingGate.mjs`(鉤子、綁定、解除、停止);`src/WServWebdataServer.mjs`(接線、clearBroadcast 包裝、clientLeave 監聽);Exec(略過,`isSysPollingActive` 內部選項);Client(getToken 交付).
- 盤點:`git grep -n "verifyPolling\|genPollingGate\|isSysPollingActive\|clientLeave" -- src`;`git grep -n "sys:polling" -- src`;`git grep -n "new WServBroadcast" -- src`(Server 傳 verifyPolling、Client 傳 getToken,各 1 處).
- 站點:鉤子注入(已套);Exec 略過(已套);前端 getToken 交付(已套);clearBroadcast 包裝(已套).
- 測試:`test/unit-sysFuncs.test.mjs`〈R17 輪詢之身分關卡〉7 條(矩陣:10 token 狀態〔含無鍵〕×10 設定)、〈R17 輪詢之clientId歸屬〉10 條;`test/unit-WServWebdataServer.test.mjs`〈釋放〉clientLeave 監聽 2 條(移除、註冊失敗時停止廣播);`test/unit-WServWebdataClient.test.mjs`〈輪詢帶token〉1 條;`test/api-sysFuncs.test.mjs`.變異驗證見〈測試對照〉.

## 2. 測試對照

| 測試檔 | 區塊 | 條數 | 對應規則 |
|---|---|---|---|
| `test/unit-authorizeExec.test.mjs` | 建構檢查 | 18 | R2、R3、R5、R6 |
| 同上 | 授權流程 | 12 | R1、R4、R7、R9 |
| 同上 | getUserIdByToken之拒絕 | 8 | R7、R8、R9 |
| 同上 | execute監聽器之契約 | 2 | R8 |
| 同上 | 可呼叫之函數 | 4 | R6、既有行為 |
| `test/unit-WServWebdataServer.test.mjs` | 設定錯誤不留副作用 | 9(含 sysFuncsPublic 無效／合法各 1) | R2、R16 |
| 同上 | 函數名之路徑衝突 | 4 | R5 |
| 同上 | 資料同步 | 5 | R2(含業主裁示之行為鎖定、執行期回滾) |
| 同上 | 釋放 | 6(含 clientLeave 監聽之移除與註冊失敗時停止廣播各 1) | R13、R17 ⑦ |
| `test/unit-WServWebdataClient.test.mjs` | 設定檢查／同步／路徑綁定 | 7 | R12、R5 |
| 同上 | 停止 | 15 | R14(14 條)、L16(1 條,伺服端第 9 點) |
| 同上 | 輪詢帶token | 1 | R17 ⑥(輪詢輸入恰為 clientId 與 `__sysToken__`、每輪重新取得、sync/async/非字串/未給) |
| `test/unit-WServWebdataClientAbort.test.mjs` | 中止(linkSig)／建構檢查(AbortController)／先註冊之使用端監聽內停止(linkCtl) | 9 | R14 ②③④⑥⑦、R12 ①' |
| `test/api-authorizeExec.test.mjs` | (真 HTTP,埠 8301) | 8 | R1、R4、R6、R7 |
| `test/api-clientStop.test.mjs` | (真 HTTP,埠 9001,前端於子行程) | 4 | R14 ②③④ |
| `test/api-servdata.test.mjs` | 範例回歸(埠 9000) | 1 | R10 |
| `test/unit-checkFind.test.mjs` | checkFind(純函數) | 19 | R15 S1、S2、S3(含 `$in` 元素總數合計上限)、S5、S6(requireKey) |
| 同上 | 資料通道(evem,不開網路) | 14 | R15 S4～S8、R1(先驗後授權、既有拒絕語意不變) |
| `test/api-checkFind.test.mjs` | (真 HTTP,埠 9002,真 w-orm-lowdb;自寫客戶端直送加官方客戶端 `$fapi`) | 14 | R15 S1～S8、D2、D3 |
| `test/unit-sysFuncs.test.mjs` | R16 系統函數之身分關卡(evem,不開網路) | 15 | R16(含預設三者公開、嚴格設定、預設 getUserIdByToken、舊前端元件相容、falsy 拒絕值) |
| 同上 | R17 輪詢之身分關卡 | 7 | R17 ①②⑤、R16 |
| 同上 | R17 輪詢之clientId歸屬 | 10 | R17 ③④(含 10 秒在線逾時回收、genPollingGate 單元、連續被拒、任意字串 clientId、非字串 clientId) |
| `test/api-sysFuncs.test.mjs` | (真 HTTP,埠 9003~9007,見 R11 埠表) | 14 | R16、R17(輪詢實際帶 token;嚴格設定下持標頭 token 之匿名者、他人身分與舊前端元件被拒;sso 型三者/預設可綁定、嚴格設定不綁定;perm 型預設下新、舊前端元件皆可綁定同步) |

輔助(不帶 `.test.`):`test/tools/clientHarness.mjs`(前端測試共用之 `sleep`、`hookNames`、`extraHooks`、`zeros`、`genRun`、`linkCtl`、`linkSig`;2026-10-24 起 `genRun` 之 `nToken` 於通訊物件見 `[sys:polling]` 時扣回——w-serv-broadcast 1.1.11 前端輪詢每輪亦呼叫 getToken,`nToken` 只計本套件自身與使用端之請求,各〈停止〉測試之語意不變;`linkCtl` 另回傳 `inputs`〔與 `sent` 同序之輸入〕)、`test/tools/clientStopChild.mjs`(真 HTTP 停止測試之前端子行程).

2026-10-13:`npm test` 80 passing(配合 w-sync-webdata 1.1.7 與 w-serv-broadcast 1.1.7 後).
2026-10-13(第六輪):`npm test` 95 passing(配合 w-serv-broadcast 1.1.8、w-converhp 2.1.7、w-package-tools 1.1.17、wsemi 1.9.14 與前端停止之修正後).真 HTTP 之停止驗收原不入 `npm test`(子行程量測行程結束時間,每情境約 3～14 秒),作法見 E25.
2026-10-13(第七輪,中止):原載「真 HTTP 之停止驗收不入 `npm test`」改為入:中止後停止即可結束,每情境約 2-3 秒,以 `test/api-clientStop.test.mjs`(埠 9001)納入;`npm test` 結果見下行.
2026-10-13(第七輪):`npm test` 107 passing、1m12s(新增 unit-WServWebdataClientAbort 8 條、api-clientStop 4 條;既有 95 條之斷言不變,其輔助改取自 `test/tools/clientHarness.mjs`,於修前之 src 快照仍 22/22 綠).分辨力:新增 12 條於修前之 src 快照(`git archive HEAD src`)紅 7 綠 5——紅者皆為中止之新行為(本套件請求帶 signal、取函數清單在途／取時間戳在途／select 在途時停止當下即中止、重建之新實體自帶 signal、真 HTTP 取時間戳與 select 在途時停止後 4 則 `timeout of 1000ms exceeded`),綠者皆為行為鎖定(`$fapi` 照常、先註冊之使用端 broadcast／getData 監聽內停止、取得函數清單後即停止、真 HTTP 之 `$fapi`).變異測試(`tmp/run02/mut/runMut.mjs`,以定稿為底):8 個閘門(executeShell 取得 token 後、updateSyncTable、core 綁定後、openOnce 入口、refreshTable 之 select 前、emitError、callHook 入口、callHook 之 catch)與中止相關 5 個(拿掉 abort、abort 不給 reason、不帶 signal、`$fapi` 亦帶 signal、控制器移至模組層)之變異各至少一條紅;另以 api-clientStop 跑拿掉 abort、不帶 signal(各紅 2)、全帶 signal(紅 1).
2026-10-14(第七輪,配合 w-serv-broadcast 1.1.9):相依升至 ^1.1.9(node_modules 之 3 個 src 檔與其 repo 提交 `6d64700` 逐檔相同);升級後現行碼 `npm test` 107 passing;依 R12 ①' 加 AbortController 之檢查(訊息同下層)並新增〈建構檢查〉1 條後 108 passing、1m12s.單元變異於 1.1.9 下重跑結果見 run03 之報告(`tmp/run03/mut-run.log`).探針 C6(伺服器先停、停止當下輪詢在途):定稿 0 則、0 行重試訊息、停止後 2 毫秒結束(1.1.8 時為輪詢之 3 則、約 6 秒);修前碼剩本套件取時間戳之 4 則、約 9 秒.

2026-10-17(第八輪 run03,資料通道 find 白名單,R15):`npm test` 153 passing、1m12s(新增 unit-checkFind 32 條、api-checkFind 13 條;既有 108 條之斷言不變).分辨力:新增 45 條於修前之 src 快照(`git archive HEAD src`,另放替身 `src/checkFind.mjs` 提供常數使測試檔可載入;純函數 18 條因修前無 `checkFind` 不適用)中,資料通道與真 HTTP 之 27 條紅 16 綠 11——紅者皆為缺陷本身(白名單外之 find 放行、非陣列參數放行、顯式 undefined 放行、先驗後授權、複本與凍結、授權函數可就地改 input、官方客戶端送白名單外之 find 未被拒),綠者皆為行為鎖定(白名單內放行並得到正確之列、`{}`/未給之 delAll、條件值 undefined 之鍵消失、多餘參數丟棄、insert 類不檢、既有授權拒絕語意).變異測試(`tmp/run03/mut.mjs`,對正式 src,最終 60 個變異:沿用 run02 之 32 個並依正式碼更新錨點、新增 28 個含上限常數、陣列自有屬性、拒絕值型別、陣列檢查之位置與範圍、requireKey 之判斷方式、原因碼、拒絕訊息回顯,以及外審後補之 M47～M59):第一輪存活 2 個(M10 識別字不含組合符號——推論為測試所用字元是預組字元而未真正測到組合符號,改以 `String.fromCodePoint(0x301)` 組字;M43 requireKey 以真值判斷——未測未給之 find 配真值但非 true 者),補強測試後重跑存活 0.聚焦外審(opus、sol)指出之測試漏洞(首位 NUL、非 ASCII 數字、`$in` 與 `length` 讀一次、最大合法值之完整保留、非 id 欄位之 `$in`、`[sys:getTableTags]` 之 S7、被拒時之 error/log、洞與額外屬性並存、檢視時拋錯)以 M47～M59 共 13 個變異證實:於外審前之測試(39 條全綠)全數存活,補強後(45 條)全數被抓,最終 60 個變異存活 0.

2026-10-17(第九輪 run04,`$in` 元素總數合計封頂,R15 S3/L18/B6):`npm test` 155 passing、1m13s(基準 108,run03 後 153;新增 unit-checkFind 純函數 1 條、api-checkFind 1 條,另延伸既有資料通道 1 條之斷言).修前紅:新測試於逐鍵計之舊碼 3 紅(純函數「整個 find 之 `$in` 元素總數上限」、資料通道「拒絕訊息」含 2 鍵各 600 於 select/delAll、真 HTTP「整個 find 之 `$in` 元素總數上限」)44 綠.變異 64 個(M22 改為 `total >= MAX_IN`;新增 M60 改回逐鍵計、M61 以含 `$in` 之鍵數計、M62 單鍵最多計 400、M63 起算差一)存活 0.

2026-10-24(webdata-run01,系統函數與輪詢之身分關卡,R16、R17,配合 w-serv-broadcast 1.1.11):`npm test` 198 passing、約 1m17s(基準 155〔換裝 1.1.11、src 未動時同為 155 綠〕;新增 unit-sysFuncs 29、api-sysFuncs 9、unit-WServWebdataServer 4、unit-WServWebdataClient 1 條,共 43;既有 155 條斷言不變,僅 `clientHarness` 之 `nToken` 於見輪詢時扣回〔11 條〈停止〉測試之語意不變〕,與「綁定完成前收到同步廣播」一條改以第 2 次 getToken 呼叫製造延遲〔輪詢已占第 1 次〕).分辨力:新增 43 條於修前之 src(`git archive HEAD src`,另放替身 `src/genPollingGate.mjs` 使測試可載入)紅 30 綠 13——紅者皆為新行為(系統函數須身分與預設、sysFuncsPublic 設定與檢核、輪詢身分關卡與歸屬、鉤子注入、execFun 略過、clearBroadcast 後 invalid token、真 HTTP 輪詢帶 token 與被拒、clientLeave 監聽移除),綠者皆為行為鎖定(表操作與 kpFunExt 空 userId 語意、反查 reject 不執行、協定鍵缺漏、不存在之函數、函數清單內容、clientEnter 之 data 不含 token、非字串 clientId、部署方 broadcast 由已驗證前端收到、標頭 token 錯誤由通訊層拒絕、其他系統函數於本體 token 無效時被拒、sso 型已設 sysFuncsPublic 可綁定、合法 sysFuncsPublic 可建構).變異 37 個(`tmp/webdata-run01/mut/runMut.mjs`,於 `./tmp` 副本施變異,每個變異先 `node --check`;已隨修正報告附件留存)存活 0:含任務指定之拿掉鉤子注入〔M01〕、拿掉 clientId 歸屬檢查〔M02〕、sysFuncsPublic 改全公開〔M03〕,及 execFun 不略過輪詢、空身分放行、公開時反查 reject 放行、falsy 拒絕值視為匿名、release/stop/快照/型別/元素檢查、預設值、前端不交 getToken、clientLeave 監聽於 try 外註冊、isBound 閘門等.外審 sol(gpt-6.1-sol max)12 條逐條核對:6 條補測試、2 條改碼、1 條改設計、1 條實測屬實並記 L22 ③、1 條文件限定、1 條修既有測試(詳修正報告〈外審評分表〉).w-serv-hapi 測試複本(src 與 test 複製自其 repo,node_modules/w-serv-webdata 換成本套件最終 src,hapi repo 未動):基準(HEAD src)111 綠;本套件最終 src 100 綠 11 紅〔api-client-stop 4、api-error-listener 1、api-options 3、api-sync-authorize 2、unit-optDoc 1〕;依修正報告〈w-serv-hapi 須補設定之測試〉補設定後 111 綠.

2026-10-24(webdata-run02,預設改為三者皆公開〔主控改裁 Q1②〕、未帶鍵之舊前端元件相容,R16、R17 ②):`npm test` 206 passing、約 1m17s 測試時間(基準 198;unit-sysFuncs 29→32、api-sysFuncs 9→14;其餘不變).修前紅:對 webdata-run01 檢查點(HEAD,預設收緊)之 `src` 跑本輪新增/改寫之 15 條(unit-sysFuncs 9、api-sysFuncs 6)紅 8 綠 7——紅者為預設相容(矩陣、預設三者公開、未給 getUserIdByToken、舊前端元件〔unit 與 perm 預設、sso 預設〕、輪詢矩陣之無鍵不反查、嚴格設定下舊前端元件之拒絕原因為 `empty userId`),綠者皆為行為鎖定(顯式嚴格設定之既有拒絕語意).變異 40 個(M01~M40;含 M13「預設改回只公開 `[sys:getFuncList]`」、M39/M40「預設缺 polling/缺 getTableTags」、M16「無鍵亦反查」、M38「無鍵一律拒絕」)存活 0.真實舊前端元件(`git archive 3259a8d src` 之 `WServWebdataClient`,輪詢輸入恰為 `{clientId}`)對最終碼伺服端真 HTTP 實跑:perm 預設(getUserIdByToken 對空 token reject)可綁定、同步、收廣播,sso 預設可綁定並呼叫 getWebInfor,嚴格設定下被拒而不綁定.w-serv-hapi 測試複本(hapi repo 未動,未補任何設定):109 綠 2 紅〔`api-sync-authorize` 1:測試中途換 token 使身分改變,同一 clientId 輪詢因歸屬被拒;`unit-optDoc` 1:其 JSDoc 缺 `@param opt.sysFuncsPublic`〕,僅改此二處後 111 綠(見修正報告).

## 3. 設計要求(非問題、非限制)

- D1 通訊內容須為可序列化之格式(JSON 可表達之值,以及 Uint8Array;經 w-converhp 以 wsemi obj2u8arr 傳輸),含各關卡之回傳值與拒絕值、前端傳入之參數.不支援之格式(例如循環參照、BigInt)本就不在設計範圍內,傳了前端必然失敗——w-converhp 回應 `'output can not be serialized'`,前端依其重試設定重送後仍失敗(實測重試 3 次、該次各關卡被執行 4 次),屬預期結果,不列為問題或限制(業主 2026-10-13 定性).

- D2 資料通道之 JSON 不攜帶 `undefined`(同 D1 屬序列化性質,業主 2026-10-17 裁示 Q1):`undefined`、函數、Symbol 之物件鍵於序列化時消失,陣列內之 `undefined` 成為 `null`.故客戶端 `select({ ownerId: v })` 於 `v === undefined` 時伺服端只見 `{}`(select 之上界本即全表;`delAll({ ownerId: v })` 同理即全刪,客戶端作者勿傳 `undefined` 之條件值,README 與 JSDoc 載明);顯式 `select(undefined)` 成為 `[null]`,find 為 null 依 R15 S1 以 `invalid find[notObject]` 拒絕(通道無從區分顯式 undefined 與 null).**不在客戶端剔除尾端 `undefined` 參數**:`delAll(undefined)` 會變成 `delAll()`(全刪),而現況 `delAll(null)` 被 w-serv-orm 擋下(`invalid find of delAll, need an object`),剔除反使其由擋下變全刪.白名單對此無從防.
- D3 表操作函數只收前端第 1 個參數,其後之參數(order、sort、limit 等)丟棄,不交給授權函數與 operOrm,亦不可達 ORM(業主 2026-10-17 裁示 Q7,維持丟棄而非拒絕;`test/unit-authorizeExec.test.mjs`「授權函數與operOrm皆只收到前端第1個參數」鎖定,R15 S8).

- D4 輪詢帶 token 並反查(2026-10-24,R17):前端每輪輪詢多一次 `getToken`,伺服端每輪多一次 `getUserIdByToken`(驗證成本約為通訊層 verifyConn 之兩倍);本套件不快取(撤銷延遲之取捨由使用方決定,可於其 `getUserIdByToken` 內快取);前端身分改變而 clientId 未變者,輪詢被拒絕至舊綁定逾時(約 10 秒),重建前端(新 clientId)則無此延遲.屬設計結果,不列問題.

## 4. 已知限制(刻意不修或範圍外)

- L1 布林授權只能放行或拒絕整次呼叫,無法逐筆過濾或限制欄位;同步表之 select 不帶參數,須對所有連線者放行,被拒絕之前端取不到該表資料且每次重抓皆發 error.(原載「前端 select 失敗時以空資料結束並記下時間戳,該表被清空,到下次資料變動前不重抓」,2026-10-13 配合 w-sync-webdata 1.1.7 改為 reject 後不成立,見 R12.)
- L2 `[sys:getFuncList]` 列出全部函數名,不依授權過濾;預設即為公開(`sysFuncsPublic` 預設,R16;函數名稱清單可公開,使用者 2026-10-23 裁示,無 token 仍無法呼叫函數).
- L3 時間戳廣播對所有通過輪詢身分關卡之連線(只含中繼資料,取資料仍經授權);**預設(`sysFuncsPublic` 三者皆公開)匿名亦可輪詢並取得時間戳與部署方 `broadcast()` 內容**(相容既有行為,R17;與升級前同,通訊層 verifyConn 仍把關);採建議之嚴格設定 `['[sys:getFuncList]']` 者須 `getUserIdByToken` 得非空 userId 方可輪詢.
- L4 授權與 operOrm 之執行非原子.
- L5 authorizeExec、operOrm、kpFunExt 之拒絕不發 error 事件;使用端函數之 bug 只表現為前端收到錯誤字串.
- L6 (已改列〈設計要求〉D1,2026-10-13).
- L7 (已依業主決定改為拋錯,見 R2,2026-10-13).
- L8 執行期異常(genTag 拋錯、kpOrm 之 on 拋錯)時,傳入之事件物件已被擴充且仍有資料通道之 execute 監聽(廣播之 execute 監聽 w-serv-broadcast 1.1.7 起由 clearBroadcast 移除),不可再以同一事件物件重建.(原另載「w-serv-broadcast 建構中途失敗(例如事件物件之 newListener 觀察者拋錯)時其計時器無從回收(他套件範圍)」,2026-10-13 配合 w-serv-broadcast 1.1.8 移除:其伺服端先檢查 emit/on/off,再依序指派屬性、註冊 execute 監聽、最後建立計時器,中途失敗不留計時器與監聽;WSyncWebdataServer 建構只掛函數、無計時器與監聽;另 newListener 屬 Node 原生 EventEmitter,不在 eventemitter3 之支援範圍,見 E24.)
- L9 (經查證非問題,已移除,2026-10-13).
- L10 getUserIdByToken 之 token 取自請求內容,與通訊層驗證者不同源;使用端須完整驗證——此即驗證身分之步驟(token 有效、本系統使用者存在且啟用、部署方授權),不可只解碼或只查 id(跨套件原則 §二2;JSDoc 第 6 點、`@param opt.getUserIdByToken`、README〈Identity verification〉已載).
- L11 (已依業主決定改為拋錯,見 R2,2026-10-13).
- L12 kpFunExt 同步 `throw null` 被 pm2resolve 視為成功(wsemi 行為,只影響 kpFunExt).
- L13 (已解決:clearSync 移除本套件掛於 kpOrm 之監聽與掛於通訊物件之 changeTableTags 監聽,見 R13,2026-10-13).釋放後傳入之事件物件上仍有資料通道之 execute 監聽,不可以同一事件物件重建(同 L8).(原載「仍有廣播與資料通道之 execute 監聽」,廣播之監聽 w-serv-broadcast 1.1.7 起由 clearBroadcast 移除;changeTableTags 監聽原亦殘留(不作用),第六輪依獨立審查 F4 改由 clearSync 移除;2026-10-13 更正.)
- L14 w-sync-webdata 之 refreshTags 事件本套件不處理(未開 autoPolling,無觸發路徑);使用端若自行呼叫 pollingTableTags,w-sync-webdata 1.1.7 起因無監聽者而以 error 事件結束(原為懸置).
- L15 清單內完全重複之項目不拋錯(表操作同名覆寫為同一函數;同步重複監聽經 debounce 合併).
- L16 伺服端只呼叫 clearBroadcast 而未停止通訊服務時,前端之 `[sys:polling]` 改由資料通道回應 `{state:'error', msg:'invalid token'}`(2026-10-24 起經 `isSysPollingActive`:包裝後之 clearBroadcast 標記停止,execFun 回此值且不反查,輸入帶 `__sysToken__` 時亦然,R17 ⑤);w-serv-broadcast 1.1.8 起前端要求輪詢回應為陣列且元素為具字串 mode 之物件,故每輪(約 2 秒)發出 `{msg:'[sys:polling] error', err:{state:'error', msg:'invalid token'}}` 之 error 並轉為未連線(不發 open),收不到推播(2026-10-13 記憶體假通訊層測試 R51 與真 HTTP 實測).刻意不修:停止須依序 clearBroadcast、clearSync、停止通訊服務(文件第 9 點),無「暫停廣播」之需求.(原載「非陣列,w-serv-broadcast 前端略過而不發 error,前端靜默收不到推播」,為 1.1.7 之行為,2026-10-13 改寫.)
- L17 前端停止時仍不中止之在途請求:①使用端自行呼叫之函數(刻意,R14 ④);②通訊物件不支援 opt.signal 時(w-converhp ≤2.1.7、w-converws、w-conversi)之本套件請求與 w-serv-broadcast 之輪詢.此二者之重試照常並於同一事件物件逐次發出 error,Node 行程須待重試結束.通訊物件支援 opt.signal 時(w-converhp ≥2.1.8),本套件自身之請求(R14 ②③,2026-10-13 第七輪)與 w-serv-broadcast 之輪詢(1.1.9 起由其 clearBroadcast 中止,其 `src/WServBroadcastClient.mjs:92`、`:111-112`、`:137`)皆於停止時中止,兩者皆呼叫後整個通訊物件除使用端之請求外不再發出 error、不再持有計時器與在途之請求.實測(2026-10-13～14,真 HTTP 子行程,伺服端在父行程):取時間戳在途時停止再停伺服器,中止前(1.1.11)停止後 4 則 error——socket hang up 1、ECONNREFUSED 3——行程於停止後約 11 秒結束(含 hapi 停止之 5 秒寬限),中止後 0 則、2-3 毫秒;伺服器先停而停止當下輪詢在途時,w-serv-broadcast 1.1.8 仍有輪詢之 3 則、約 6 秒,1.1.9 起 0 則、2 毫秒(探針 C6).本套件於停止後忽略未中止者之結果、不另發 error(R14).(原載「前端停止前已交給通訊物件之請求…無法中止:w-converhp 前端無中止方法」,2026-10-13 第七輪配合 w-converhp 2.1.8 改寫;①之輪詢 2026-10-14 配合 w-serv-broadcast 1.1.9 移出.)

- L18 白名單內之形狀對單次查詢成本仍無上限:`select({})` 回全表,`$in` 元素於大表之成本 ∝ 列數×元素數(100k 列約 2.7 s 為外推,**推論**).`MAX_IN` 原逐鍵計,64 鍵並存可達 64,000 元素(外審 opus 實測 2000 列、各條件皆命中:1 鍵×1000 元素 54 ms,64 鍵×1000 元素 2896 ms,約 54 倍;任一條件不命中則短路),業主 2026-10-17 裁示(run04)改為**整個 find 之 `$in` 元素總數 ≤1000**(R15 S3),此放大已封;封頂後單次 find 之 `$in` 成本上界同「1 鍵×1000 元素」.其餘(全表讀取、列數×1000 之乘積)屬容量與限流議題(L1、w-converhp 之 `sizeMsg`),不在 R15.
- L19 白名單通過不等於後端安全:字串值之語意不由通道把關,例如 postgresql 之 `{ c: '$x$' }` 被當欄引用(排程第 44 項,靠 w-orm-postgresql 自身 fail-closed),通道不特判(業主 2026-10-17 裁示 Q9).
- L21 R15 之 find 檢核依方法名**精確比對** `methodsFind = ['select', 'delAll']`:methodsExec 若列入文件所列以外之方法名(含大小寫或空白變體如 `'Select'`、`'select '`,以及 w-orm-* 另有之帶條件方法如 w-orm-mongodb 之 `delAllGfs`),其 input 不經檢核而原樣交授權函數與 operOrm(外審 opus 以 `methodsExec:['Select']` 實測;w-serv-orm 之 procOrm 對未知 mode 回 `invalid mode`,故下游三套不受影響,但自訂 operOrm 以 `wo[methodName](input)` 分派者可達);JSDoc 與 README 載明,建議只列文件所列之方法.是否於 parseOpt 驗證 methodsExec 之元素須為已知方法名(破壞性),併入排程第 59 項(寫入類方法形狀檢核與預設值)一併裁示.
- L20 R15 之 `length` 鍵暫行拒絕待 w-serv-orm 修正發布後另議是否移除(移除須同時升 w-serv-orm 相依下限,屬下游 w-web-* 之事,本套件無 w-serv-orm 相依,故規則保留至另行裁示);delAll 不給條件之語意已由使用者 2026-10-17 裁示與後端一致(全刪),放行 `{}` 與未給(R15 S6、〈delAll 通道語意〉).
- L22 clientId 綁定(R17 ④)依 `clientLeave` 事件解除:①本套件之監聽於建構中掛上,通常先於使用端之監聽;若使用端在建構本套件**之前**已於同一事件物件掛 `clientLeave` 監聽且其拋錯,依 EventEmitter 規範同一次派發中其後之監聽(含本套件)不被呼叫,該 clientId 之綁定殘留至 `clearBroadcast`(此後該 clientId 僅原身分可輪詢;clientId 通常為前端隨機產生,影響僅限該 clientId 之身分轉換).②在線偵測已發出 leave、本套件之派發(w-serv-broadcast 以 1ms 計時器延後)尚未到達之間隙內,若同一 clientId 之輪詢恰完成反查並放行,其綁定可能被該 leave 事件解除一次(之後由下一次放行之輪詢重新綁定);間隙約 1ms,屬時序縫隙,窗口內他人須恰好知道該 clientId 且同時送出輪詢,刻意不修.③**離線後至佇列被修剪前(≤約 1 秒)之縫隙**(外審 sol #2,2026-10-24 以探針實測屬實,探針見修正報告附錄:clientLeave 發出時綁定即解除,但 w-serv-broadcast 以每 1 秒之計時器才修剪離線者之佇列(`WServBroadcastServer.mjs:333-340`),期間 `broadcast()` 仍推入該佇列;此時另一身分以該 clientId 輪詢可重新綁定並取得離線者尚未取走之廣播(實測 clientLeave 後 0ms 即取得)。廣播內容本即對所有在線連線(`broadcast()` 無收件人概念),縫隙內多得者仍是通過身分關卡之連線,故嚴重度為低到中;根治須 w-serv-broadcast 於離線時先刪佇列再發 clientLeave(下層,列入連動建議)。④見 R17 ③:歸屬為先到先綁之一致性,非連線所有權之證明。
- L23 輪詢之反查拒絕值不回傳前端:前端只見固定訊息 `[sys:polling] permission denied`(w-serv-broadcast 1.1.11 之設計),原因僅在伺服端 error 事件;使用端無法經輪詢回自己語系鍵(其他函數仍可,R7).

## 5. 破壞性變更紀錄

- 2026-10-12(提交 `bf7c36e`):useDbOrm 預設 true → false;useDbOrm=true 時 authorizeExec 必填;kpFunExt 與表操作或表名同名改為拋錯;getUserIdByToken 拒絕時前端收到原拒絕值;Object.prototype 之名稱不再可呼叫;範例不再傳 FormData,移除 devDependency form-data.
- 2026-10-13(提交 `1ed0da8`):kpFunExt 之頂層名不得為表名;kpFunExt 不得以 `[sys:` 開頭;函數路徑含守衛名拋錯;methodsExec 有給但非陣列拋錯;`invalid opt.tableNames …` 改為 `invalid opt.tableNamesExec …`;execute 監聽器改為同步;getUserIdByToken 改以 await 取值;建構失敗時停止廣播計時器;kpOrm 非物件改為拋錯;未指定 useDbOrm 卻給設定改為拋錯.
- 2026-10-13(第三輪,依 w-serv-hapi 建議書與三方獨立審查):設定錯誤改於建構任何元件之前拋錯(不再擴充傳入之事件物件);新增檢查——getUserIdByToken、genTag 有給須為函數,fpTableTags 有給須為非空字串,kpFunExt 有給須為純物件且值皆為函數,tableNamesExec、methodsExec、tableNamesSync 之元素須為非空字串,useDbOrm=true 時 tableNamesSync 有給須為陣列,同步表須有經授權之表操作 select(**原可由 kpFunExt 提供 `<表>.select` 同步,改為拋錯**),不同函數名不得解析為同一路徑或互為前綴(含 kpFunExt 彼此),路徑不得有空段,genTag 須回傳非空字串;instWConverServer 須有 on;前端 getServerMethods／recvData 缺漏由建構中 emit 改為拋錯,getToken 與四個回呼有給須為函數;前端綁定前略過同步廣播;前端綁定改只沿自有屬性.
- 2026-10-13(第四輪,配合 w-sync-webdata 1.1.7):前端取資料失敗(缺表、缺 select、select 被拒絕或傳輸失敗)**不再以空資料呼叫 recvData**,前端既有資料維持、該表時間戳不推進,再收到同一時間戳時重抓;error 事件由前端自發之字串(`invalid kpExec[<表>]`、`kpExec[<表>].select is not a function`;select 失敗原本只 console.log)改為 w-sync-webdata 發出之 `{msg, err, tableName, timeTag}`(err 為原字串或原拒絕值);伺服端 clearSync 一併移除 kpOrm 監聽,建構之執行期異常亦呼叫 clearSync;範例停止段落加 clearSync.
- 2026-10-13(第五輪,配合 w-serv-broadcast 1.1.7 與其建議書):前端 instWConverClient 未給或非有效物件時**不再改用 evem**,改於建構任何元件之前拋 `instWConverClient is not an effective object`;無 on 拋 `instWConverClient is not an EventEmitter`、無 execute 拋 `instWConverClient.execute is not a function`(原皆於建構下層元件後才拋);伺服端 instWConverServer 無 off 改為拋 `instWConverServer is not an EventEmitter`.下層行為(非本套件改動):伺服端 clearBroadcast 起移除輪詢之監聽並釋放在線偵測(補發 clientLeave);前後端 w-serv-broadcast 之 error 事件改為 `{msg, err}`(輪詢失敗為 `msg:'[sys:polling] error'`).
- 2026-10-13(第六輪,配合 w-serv-broadcast 1.1.8 等四相依與 w-serv-hapi 之 `建議w-serv-webdata修正.md`):前端呼叫 clearBroadcast 或 clearSync 任一後,本套件不再呼叫各回調函數、不再發出本套件之 error、不再送出本套件之請求(原於停止前已啟動之流程照常呼叫 getServerMethods、recvData 等、發 error 並續送請求);停止時移除本套件掛於通訊物件之 7 個監聽,兩者皆呼叫後可於同一通訊物件重建(原舊實體之監聽留著,重建後舊實體之回調照常被呼叫、請求加倍);**前端通訊物件須具 removeListener 或 off,缺者建構時拋 `instWConverClient is not an EventEmitter`**(原不檢查);本套件自身之請求於等待 getToken 期間已停止者不送出(原於 token 回來後照常送出);停止前已被呼叫之回調於停止後才拋錯者改以 console.error 輸出(原發 error 事件);伺服端 clearSync 一併移除 Sync 掛於通訊物件之 changeTableTags 監聽(原殘留而不作用);只呼叫 clearSync 時其後之 openOnce 不再取得函數清單(原會綁定並呼叫 getServerMethods);只呼叫 clearBroadcast 時停止後才派發之取資料不送出 select,由 w-sync-webdata 以無監聽者結束並發 error(原會送出 select 並呼叫 recvData).伺服端:Sync 之 removeListeners 移至 `src/removeListeners.mjs` 共用(行為不變);JSDoc 之事件物件用字對齊 eventemitter3.下層行為(非本套件改動):伺服端只 clearBroadcast 而未停通訊服務時,前端由靜默改為每輪發輪詢失敗之 error;兩端 clearBroadcast 後不再派發 w-serv-broadcast 之事件(含已排定與在途);w-serv-broadcast 之 error 於無監聽者時改以 console.error 輸出;前端 timePolling 只收正整數(本套件不傳,取預設).使用端須配合:無(w-serv-hapi 前端之停止轉呼叫本套件之同名函數,其 `kpClear` 於建構後取得者即為包裝後之函數;族內前端皆以 WConverhpClient 建立通訊物件,其為 eventemitter3 而具 removeListener 與 off;2026-10-13 經 w-serv-hapi 原始碼實跑 H1-H4 確認).
- 2026-10-13(第七輪,配合 w-converhp 2.1.8 之 opt.signal 與 `建議w-serv-webdata調整.md`;業主裁示 Q1、Q2、Q6):前端停止時本套件自身之在途請求(取得函數清單、時間戳、同步表之 select)一併中止(原只忽略其結果,通訊物件照常重試、逐次發 error,Node 行程須待重試結束);**只呼叫 clearBroadcast 時,停止時在途之同步表 select 改為被中止,由 w-sync-webdata 發一則 err 為 `'stopped by clearBroadcast or clearSync'` 之帶表名 error**(使用端無 error 監聽者時為 w-sync-webdata 之 console.error;原多半照常完成而無 error);**建構須執行環境提供 AbortController**(瀏覽器端產物之轉譯目標 `'defaults'` 皆內建;Node ≥15;缺者於 opt 之檢查之後、建構任何元件之前拋 `AbortController is not available`,與 w-serv-broadcast 1.1.9 前端同訊息);通訊物件之 execute 須接受第 4 參數 opt.signal 方能中止(w-converhp ≥2.1.8;不支援者忽略之,行為同前);停止之拒絕值收斂為常數(值不變);相依 w-serv-broadcast 升至 ^1.1.9(下層行為:clearBroadcast 起中止其在途之輪詢,伺服器已停時停止後不再有輪詢之重試與 error;前端建構時檢查 AbortController).使用端須配合:無(族內前端以 WConverhpClient 建立通訊物件,升至 w-converhp 2.1.8 即生效;w-serv-hapi 之停止轉呼叫本套件之同名函數,不須改碼).
- 2026-10-17(第八輪 run03,依 run02 審查與主控複審;**對「自寫客戶端直送非白名單 find」者**,官方客戶端只送無參數 `select()` 不受影響):資料通道對 `select`、`delAll` 之 find 加形狀與運算子白名單(R15),不合者以字串 `invalid find[<原因碼>]` 拒絕且不呼叫授權函數與 operOrm.
  - B1 非條件物件 find(`null`、`[]`、字串、數字、布林、二進位)reject(原 lmdb/level/lowdb/reladb 回全表,mongodb 已 reject):依賴「傳 null 取全表」者須改傳 `{}` 或不傳.
  - B2 運算子 reject(`$or/$and/$nor`、`$eq/$ne/$gt/$gte/$lt/$lte/$nin/$not/$regex/$options/$exists`、`$expr`、`$where`、`$custom`…)與非 `$in` 之物件值(原依各後端支援集合接受):這類查詢須改走 kpFunExt(伺服端自行呼叫 procOrm,可重用 `src/checkFind.mjs`).
  - B3 值為 `null`、巢狀物件、陣列(等值)、`$in` 內含 null 或非純量 reject(原後端不一,多為 0 列).
  - B4 顯式 `select(undefined)` 經 JSON 成為 `[null]` 而 reject(原 lmdb 等視為全表,mongodb 已 reject),見 D2.
  - B5 `__sysInputArgs__` 非陣列 reject(`{state:'error', msg:'invalid input'}`,所有函數含 kpFunExt 與系統函數;原字串被展開成逐字參數、其他型別以內部錯誤文字回應).
  - B6 鍵數 >64、鍵長 >128、字串 >1024 字元或含 NUL、整個 find 之 `$in` 元素總數 >1000(跨鍵合計,非逐鍵;run04 自逐鍵計改)reject(原無上限,僅 100MB 本體上限).
  - B7 授權函數與 operOrm 收到之 input 為全新且凍結之複本(原為客戶端送來之原物件):授權函數若就地修改 input(ESM 嚴格模式下拋 TypeError,非嚴格模式靜默忽略)或以參照比對則受影響;operOrm 與 w-serv-orm 之 `addFunCheck`、`addFunPreProcessing` 若就地補條件(例如 `input.ownerId = userId`)同樣拋 TypeError 或不生效,須改建新物件(庫內 w-web-perm/api/task 三份授權函數皆不讀 input、不改寫 input,三者皆未註冊 addFunCheck/addFunPreProcessing,2026-10-17 外審 opus 讀碼核對).
  - B8 欄名語法:僅 Unicode 字母/組合符號/數字/底線且非數字開頭,含連字號、空白、點號、`length`(暫行)、`Object.prototype` 成員名之欄名不可作條件鍵(原依各後端解讀):有此類欄名者須改走 kpFunExt.
  - B9 被拒形狀不經授權函數(授權函數所掛之審計或限流鉤子看不到).
  - B10 錯誤文字:原 ORM 層之固定字串 `failed to select data` 改為通道層 `invalid find[<原因碼>]`(以訊息字串比對之客戶端須配合).
  - 使用端須配合:w-web-perm/api/task 之資料通道只送無參數 `select()`、授權函數不讀 input,2026-10-17 讀其 repo 核對全數通過,不須改碼;未變:第 1 參數之後之參數仍丟棄(D3)、delAll 不給條件仍為全部(S6)、insert/save/del/mix 不檢(Q8 另案).
- 使用端須配合(非缺陷):w-serv-hapi 已改為整包轉傳並同步建構(其工作區 `src/WServHapiServer.mjs:353-360`);w-web-perm/api/task 提供 authorizeExec;各使用端之 kpFunExt、表名經盤點不受新檢查影響.
- 2026-10-24(webdata-run01,依 inv01 審計與主控裁定 Q1～Q3、使用者 2026-10-23 裁示;**對 `getUserIdByToken` 使用預設或固定回空字串者**):系統函數之身分關卡(R16、R17).
  - B1 新選項 `sysFuncsPublic`:列於其中之系統函數,`getUserIdByToken` 得空字串亦放行;未列者須得非空字串 userId,否則回 `permission denied`.**預設三者皆公開(2026-10-24 webdata-run02 起;webdata-run01 原預設只公開 `[sys:getFuncList]`,主控同日改裁 Q1②),即升級前行為,既有部署不必改設定**;建議使用端在前端改用帶 token 之元件後設為 `['[sys:getFuncList]']`(嚴格設定);w-web-sso 維持預設或顯式列出三者.
  - B2 `[sys:polling]` 經身分關卡:前端輪詢帶 `__sysToken__`(`getToken` 每輪輪詢前亦被呼叫);伺服端對帶鍵者以 `getUserIdByToken` 反查,拒絕時前端只見固定訊息 `[sys:polling] permission denied`(原因經伺服端 error 事件);**未帶該鍵之已發布舊前端元件於預設(公開)下不反查而放行**,嚴格設定時被拒絕(既有分頁於伺服端升級並採嚴格設定後失去推播,重新整理並更新前端後恢復).
  - B3 輪詢 clientId 歸屬:同一 clientId 以不同身分輪詢被拒絕(原不檢查,可取走他人佇列之廣播並建立在線身分).
  - B4 新 error 事件:系統函數因無身分被拒為 `{ msg:'permission denied', func }`;輪詢被拒絕由 w-serv-broadcast 發 `{ msg:'[sys:polling] permission denied', err }`／`{ msg:'[sys:polling] verifyPolling error', err }`.
  - B5 相依 w-serv-broadcast 升至 `^1.1.11`(verifyPolling、getToken 鉤子).
  - B6 文件:`getUserIdByToken` 即驗證身分之步驟,須完整驗證(使用者存在、啟用、授權),不可只解碼或只查 id;JSDoc 與 README 加〈身分驗證責任〉、〈系統函數〉與 Upgrade Notes.
  - 使用端須配合:預設相容,**無須設定**(w-serv-hapi 之測試伺服器、w-web-sso 皆維持原樣);採嚴格設定者(各 w-web-* 於前端改用本版元件之同一版本)才須注意 sso 不可採;w-serv-hapi 之 JSDoc 須補 `@param opt.sysFuncsPublic`(其 `unit-optDoc` 以本套件 JSDoc 對照,升相依後轉紅);升 w-serv-broadcast 下限.未變:表操作與 kpFunExt 之空 userId 語意、資料通道 find 白名單、execute 監聽器數量與順序.

## 6. 對標摘要

- 把關位置:同 Supabase(RLS 管 anon/authenticated,service_role 略過)、Firestore(Security Rules 管 client SDK,Admin SDK 略過)、Hasura(依角色,admin 略過)——只管前端直打,伺服端程式(procOrm)不受約束.
- 預設拒絕:三者皆是.粒度差異:三者皆有列級過濾,本套件為布林(L1).
- 自訂函數:kpFunExt 直接呼叫 procOrm,內部沒有任何表層授權,性質近 Supabase 之 SECURITY DEFINER 函數或 Firebase 以 Admin SDK 實作之 callable 函數,須自行把關.
- 外部事件物件上之監聽:VS Code `IDisposable`、RxJS `Subscription.unsubscribe()` 皆由掛的人負責移除且可重複呼叫;本套件 Sync 掛、Sync 包裝之 clearSync 移除(R13).
- 同步資料取得失敗:TanStack Query、SWR 皆保留上次成功之資料、另設 error,下次觸發再抓;本套件 2026-10-13 起同此(R12 ③).
- 前端停止:RxJS `Subscription.unsubscribe()` 後不再遞送 next/error、React effect cleanup(`ignore` 旗標)與 TanStack Query 移除 observer 後不再呼叫回調、Apollo Client `stop()` 停止輪詢並拒絕在途查詢——皆為停止後不再呼叫回調、晚到之結果忽略;族內 w-serv-broadcast 1.1.8 之 clearBroadcast、w-sync-webdata 1.1.7 之 clearSync 同.本套件 2026-10-13 起同此(R14).傳輸層之中止:2026-10-13 第七輪起以 w-converhp 2.1.8 之 opt.signal 中止本套件自身之在途請求——對標 React effect cleanup(「the cleanup function should either abort the fetch or ignore its result」)、TanStack Query(每個 queryFn 一個 AbortSignal,query inactive 時中止;未使用 signal 者照常完成)、axios(「You can cancel several requests with the same cancel token/abort controller」);使用端之請求不中止(同 TanStack Query 之未使用 signal 者);仍不中止者見 L17.
- 前端查詢形狀之把關:Firestore 之客戶端查詢只能由 SDK 組成固定運算子集合(不接受原始查詢語言),PostgREST 之篩選亦為固定運算子集合而不收原始 SQL;本套件資料通道採同向,以固定白名單(欄位等值純量、單鍵 `$in`、`{}`)取代「把客戶端物件原樣交給 ORM」(R15),需要更豐富查詢者由伺服端以 kpFunExt 自行組成.
- 系統函數與輪詢之身分:對標 Socket.IO(連線時以 middleware 驗證,`socket.id` 由伺服端產生)、SignalR(Hub 以 `[Authorize]` 要求身分,connectionId 由伺服端產生並於連線時對應已驗證之使用者)——兩者之連線識別皆由伺服端產生並綁定已驗證身分;本套件沿用前端自訂 clientId 之既有協定(w-serv-broadcast),故於伺服端加「首次放行綁定、不同身分即拒」之歸屬檢查(R17 ③),以補不能由伺服端產生識別之差距.公開與否:函數名稱清單屬公開資訊(類比 API 目錄／OpenAPI 文件可公開而呼叫須 token),會回資料或改變狀態者(同步表時間戳、廣播佇列、在線身分)須身分,預設拒絕,公開以明列設定(R16).以上為依各產品文件所載之概括比較,非逐項實測.
- 設定檢查時機:hapi 於 Core 建構子第一步以 `@hapi/validate` 驗證伺服器選項(`lib/core.js:117`、`:671-676`、`lib/config.js:15-24`),其 schema 不對外匯出;Fastify 以 `lib/initialConfigValidation.js` 驗證初始化選項並拋 `FST_ERR_INIT_OPTS_INVALID`,驗證器亦不對外.本套件同採「建構時先驗證、不對外提供驗證函數」.

## 〔delAll 通道語意(使用者裁示)〕

- 使用者 2026-10-17:經資料通道呼叫之 `delAll` **與後端語意一致**(不給條件即全刪),**不另加通道專屬限制**(原第 57 項 Q11「delAll 須至少 1 個條件」不採),避免用法歧異造成開發者誤解.
- `checkFind` 之 `requireKey` 選項通道不使用;是否移除(避免他人誤用成另一種語意)併排程第 59 項.
- **JSDoc 須載明 delAll 使用須知**:不給條件即刪除全部、傳非條件物件會 reject、白名單外形狀會 reject、須審慎使用非必要不用(併第 59 項;全文見 `C:\opensrcOper\dspec\w-orm系列條件語法支援盤點.md`〈一之三〉).
- **狀態:已套**(2026-10-19,第 33 項批 3;方案 `C:\opensrcOper\dnow\20261017093849\agent-out\run01-審計與方案.md` §6.2、§6.3,D13):
  - 位置: `src/WServWebdataServer.mjs` 類別 JSDoc 第 10 點(select 之 find 規則句與 delAll 使用須知句)、`@param opt.methodsExec`(列出 `delAll` 處)、`src/checkFind.mjs` JSDoc 之 `opt.requireKey` 說明;`README.md`「Data channel: find whitelist」之 delAll 條.
  - 內容: ①經資料通道呼叫之 delAll 與後端語意一致,不另加通道專屬限制,以免用法歧異;②不給條件即刪除全部數據(措辭須分清傳輸形狀,外審 sol F3: 前端省略參數或傳 `{}`,即伺服端收到之 find 為 `undefined` 或 `{}`;前端顯式傳入 `undefined` 經 JSON 成為 `null`,以 `invalid find[notObject]` 拒絕,既有句子保留);③delAll 為破壞性操作,須審慎使用、非必要不用,建議於 `authorizeExec` 限制可呼叫者;④條件須符合 w-orm 系列白名單,傳非條件物件或白名單外運算子由 ORM 整批 reject;⑤前端通道另以 `checkFind` 限縮為等值純量與單鍵 `$in`,未通過者以 `invalid find[原因碼]` 拒絕(通道最小集契約不變,D13 不重構);⑥select 之 find 規則同(§6.3).
  - 盤點指令: Grep `src/*.mjs`、`README.md` 搜 `審慎使用`(應命中 `src/WServWebdataServer.mjs` 2 行(第 10 點、methodsExec 之 `@param`)、`src/checkFind.mjs` 1 行(requireKey)、`README.md` 1 行);Grep `src/` 搜 `delAll請於authorizeExec限制`(舊句,應為 0 處).
  - 未變: 程式行為、`checkFind` 白名單與原因碼、reason code、測試斷言字串(無測試斷言 JSDoc 文字).`requireKey` 選項保留(通道不使用),其 JSDoc 補註通道不使用,避免誤以為通道有另一種 delAll 語意.
