# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

格式:每條寫[情境 → 事實(附證據) → 做法],日期一律絕對日期.

## 一、資料通道之拒絕語意與序列化

### E01 前端收到的拒絕值長什麼樣,以實測為準(2026-10-12)

- 情境:評估「授權函數拋錯原樣轉出,使用端可回語系鍵」是否成立.
- 事實:經真 WConverhpServer/Client 實測——reject 字串 → 前端得原字串;reject 物件 → 原物件;`throw new Error('k')` → 前端得字串 `'Error: k'`.原因是 wsemi `obj2stru8arr.mjs:123-124` 對 Error 以 `toString()` 轉字串,不是 w-converhp 之 `canonProtocolValue`.
- 做法:要讓前端拿到語系鍵,一律 reject 字串;套件自己的固定拒絕訊息(如 `'permission denied'`)也必須 reject 字串,不可 `throw new Error`.

### E02 同一通道內各關卡之拒絕路徑曾經不一致(2026-10-12 已修)

- 情境:w-web-perm、w-web-task 之 `getUserIdByToken` 以 `Promise.reject('<語系鍵>')` 表達查無使用者.
- 事實:修正前 execFun 未攔此拒絕,交外層 catch 以 `err.message` 組字串,前端收到 `execFun func[...] has an error: undefined`;reject undefined 時 catch 內再拋 TypeError,回應永不送出(請求懸置).表操作與 kpFunExt 則經 pm2resolve 原樣轉出.
- 做法:新增或修改任何關卡時,先問「它的拒絕值走哪條路徑到前端」,與 pm2resolve 同規則(原樣);且先 `pm.resolve` 再 `emit('error')`,確保回應不因事件處理拋錯而懸置.

## 二、開放面與名稱

### E03 wsemi `haskey` 會認繼承屬性(2026-10-12 已修)

- 事實:`haskey.mjs:30` 為 `return (key in obj)`.函數查找原用 `haskey(funcs, func)`,前端呼叫 `constructor` 竟回 success(`Object(userId)`),`toString`、`hasOwnProperty` 等亦可觸發.
- 做法:判斷「是否為已註冊、可對外開放之名稱」一律用自有屬性(`Object.prototype.hasOwnProperty.call`)或自有鍵清單;`haskey` 只用於判斷協定鍵是否存在.

### E04 函數名衝突要用前端的命名語意判斷(2026-10-13 兩度修正)

- 事實:伺服端以精確字串派發,前端依名稱之路徑綁定,兩邊語意不同.第一版只比對「同名或點號前綴」,漏了 `tabA[select]`、`[tabA]`、守衛名與 `[sys:`;第二版改用 toPath 後,三方審查又找出:不同名稱解析成同一路徑(`a.b` 與 `a["b"]`)、互為前綴(`a` 與 `a.b`;表名 `a` 與 `a.select`)、lodash `get` 會優先取字面鍵(`["a.b"].other` 建出之字面鍵 `a.b` 遮蔽路徑 a.b)、lodash `set` 沿繼承屬性前進(表名 `toString` 時把 select 寫到 `Object.prototype.toString` 上).
- 做法:解析、綁定、取值、衝突檢查集中於 `src/funcPath.mjs`,前後端共用;綁定與取值只沿自有屬性、一律以路徑陣列而非字串;後端以路徑樹一次檢查全部函數名之別名與前綴衝突.表名之頂層命名空間保留給表操作;系統函數另以 `kpFunSys` 傳入.

## 三、建構與事件

### E05 execute 事件有多個監聽者,建構順序不可對調

- 事實:WServBroadcastServer 處理 `[sys:polling]`;Exec 亦對每個 func 處理.同一 pm 先 resolve 者勝.2026-10-24 起(w-serv-broadcast 1.1.11、帳本 R17)廣播注入 verifyPolling 後其回覆為**非同步**,Exec 同步回覆會搶先,故 execFun 對運作中之 `[sys:polling]` 只略過(不回應);廣播已停止(clearBroadcast)後才由 Exec 回 invalid token(L16).建構順序仍維持廣播先於 Exec.
- 做法:不可把 Exec 移到 Broadcast 之前;execFun 略過輪詢時**不可回傳 pm**(`return pm`):async 函數回傳 pm 會跟隨其狀態,廣播以 `pm.reject` 拒絕輪詢時,execute 監聽器之 `.catch` 會多發一則 error 事件(測試「輪詢被拒絕時只發一則error事件」守之);設定檢查已改為無副作用之 parseOpt,於建構任何元件之前完成(E06).

### E06 設定錯誤要在任何副作用之前拋出(2026-10-13 第三輪定案)

- 事實:元件會就地擴充傳入之事件物件(WSyncWebdataServer、WServBroadcastServer)、啟動計時器、寫時間戳檔、在使用端 kpOrm 掛匿名監聽.第二輪只在拋錯前停計時器,仍留下使用端 ORM 上無法移除之監聽與時間戳檔(w-serv-hapi 實際碰到).
- 做法:各模組擁有無副作用之檢查函數(Exec `parseOpt`、Sync `checkOpt`),WServWebdataServer 之 `parseOpt` 在建構任何元件之前呼叫它們;建構時改用解析結果之快照.執行期異常(genTag、kpOrm.on 拋錯)才會走到 try/catch(停計時器、Sync 回滾已掛之監聽、全部成功才寫檔).測試以建構前後比對自有鍵、方法參照、監聽數、計時器數、既有檔案內容與 genTag 呼叫數來證明「無副作用」,而非只看有無拋錯.

## 四、測試與範例

### E07 不開網路測資料通道

- 做法:`let inst = evem(); new WServWebdataServer(inst, opt)`,再以 `inst.emit('execute', func, { __sysToken__, __sysInputArgs__ }, pm)` 模擬 w-converhp 派發;`pm` 用 wsemi `genPm`.測完對每個實體 `clearBroadcast()`,否則 mocha 不結束.
- 經 HTTP 驗前端所見(含序列化形狀)時用真 WConverhpServer/Client,伺服器埠固定(目前 9000 為 api-servdata、8301 為 api-authorizeExec).

### E08 既有測試與範例會改寫追蹤中的檔案

- 事實:`test/api-servdata.test.mjs` 與 `srv.mjs` 寫入 repo 根之 `db.json`、`tableTags.json`(皆入版控),每次執行都會改寫 tableTags 之時間戳.
- 做法:只為驗證而跑時,跑完 `git -C <repo> checkout -- tableTags.json` 還原,讓改動範圍保持乾淨;使用者提交或發布期間不要跑.

### E09 WConverhpClient 不讀 FormData(2026-10-12 已移除 form-data)

- 事實:w-converhp 2.1.6 之 `WConverhpClient.mjs` 全檔沒有 FormData/form-data/multipart(2.1.7 同,2026-10-13 第六輪複查),選項只讀 url、apiName、getToken、tokenType、sizeSlice、timeout、retry*,請求以 `application/octet-stream` 或 `application/json` 送出.舊範例傳入之 `FormData` 為無效選項.
- 做法:Node 端直接 `new WConverhpClient({ url })`;form-data 仍是 axios 的遞移依賴,`npm ls form-data` 看得到屬正常.

### E10 eslint 與刻意寫法

- 事實:專案 eslint 為 standard 系;測試刻意 `throw '字串'` 會觸發 no-throw-literal.
- 做法:刻意者加 `// eslint-disable-next-line no-throw-literal` 並註明目的,不改寫成繞規則的寫法.

## 五、上下游與發布

### E11 w-serv-hapi 如何使用本套件(2026-10-13 讀其工作區)

- 事實:w-serv-hapi 已改為選項整包轉傳、不另訂預設與檢核(`src/WServHapiServer.mjs:289-290`、`:355-360`),並同步建構本套件,設定錯誤直接拋給使用端;其前端對 getServerMethods、recvData 未給時補空函數,四個回呼原樣轉傳.四個使用端(2026-10-12 讀碼):sso 為 `useDbOrm:false`,perm/api/task 為 true 且直接傳 procOrm.
- 做法:本套件新增或收緊設定檢查時,hapi 不必改碼即同步生效;仍要盤點使用端之設定(kpFunExt 名稱與值、表名、同步表)是否會被新檢查擋下,並在回報寫明.

### E12 版號(使用者 2026-10-13 指示)

- 事實:本套件與上下游皆為自有套件,使用者一律連動修改到好為止;`toolg/addVersion.mjs` 只把 patch 加一.
- 做法:不提醒版號或 semver;破壞性變更只在回報與規則帳本〈破壞性變更紀錄〉寫明使用端須配合之處.版號與發布由使用者執行,不列為 agent 待辦.

### E13 在 C:\opensrc 盤點依賴者

- 事實:對 `C:\opensrc` 全域 Glob/rg 會逾時(20 秒).
- 做法:用 shell glob 限定深度,例如 `grep -l '"w-serv-webdata"' /c/opensrc/*/*/package.json`.

### E15 w-converhp 之事件監聽器不可為 async(2026-10-13 已修)

- 事實:`WConverhpServer.mjs:663`(2.1.6;2.1.7 移至 :681)明載「監聽器須為同步函數,不可為async函數、亦不可回傳promise」,其 rejection 即 unhandledRejection 而使行程崩潰.原 execute 監聽器為 async,getUserIdByToken `reject()` 或 error 監聽者自己拋錯時即觸發(複審實測:無處理器時 exit 1).
- 做法:監聽器寫成同步函數,內部 `execFun(...).catch(...)`;catch 內先 settle pm 再發事件;事件經 wsemi `evEmit`(隔離監聽者之拋錯並以 console.error 通報);訊息以 wsemi `getErrorMessage` 組字,不讀 `err.message`.

### E16 通訊只支援可序列化格式,這是設計要求(業主 2026-10-13 定性)

- 事實:回傳值或拒絕值為循環參照、BigInt 等不支援之格式時,w-converhp 回 `'output can not be serialized'`,前端重試 3 次(約 6 秒)後仍失敗,伺服端同一關卡被執行 4 次.
- 做法:這是「本來就不支援」的格式,失敗是預期結果,不列為問題、也不列為限制;規則帳本記為〈設計要求〉D1.排查時看到上述訊息與多次執行,先確認是否傳了不支援之格式.

### E19 列為「問題」之前,先確認不是本來就不支援或設計如此(2026-10-13)

- 事實:我曾把三項列為「其他套件的問題」,查證後無一成立——w-converhp 對不支援格式失敗屬設計要求;w-serv-broadcast 之 clientId 為前端產生之 32 字元隨機值且不對外提供,實際無從冒用;w-serv-hapi 轉傳 authorizeExec 是配合本套件改版之必要調整,不是缺陷.
- 做法:每個候選問題先逐一回答三件事——①輸入是否在設計支援的範圍內 ②觸發條件在現實中是否做得到(例如攻擊者拿不拿得到該值)③是缺陷,還是配合改版的必要調整.三者皆成立才列為問題,其餘分別記為設計要求、非問題或使用端須配合.

### E17 驗證新測試確實能抓到缺陷

- 做法:把新測試放到上一版提交之 src 上跑——`git -C <repo> archive HEAD src | tar -x -C ./tmp/redcheck`,再複製測試檔到 `./tmp/redcheck/test/` 執行;新測試應恰好在舊碼上紅、其餘仍綠,紅因須是缺陷本身(逐條看訊息).跑完刪除 `./tmp/redcheck`.

### E18 自審的輸入空間表一定有洞(2026-10-13)

- 事實:自建之表 A–D 交獨立複審後,被補出整類漏軸:事件監聽器之上游契約、前端綁定之命名語意、建構副作用與失敗回收、序列化後形狀、thenable 處理.共同形狀是「只看本套件內的程式,沒有看接縫兩側(w-converhp 契約、前端 lodash 行為)」.
- 做法:建表時把接縫兩側的契約列為軸(上游監聽器規範、下游綁定語意、序列化層);複審結果逐條對源碼核對再採納,不整批接受,且依 E19 區分問題與設計要求.

### E20 前端「綁定前收到廣播」之時序陷阱(2026-10-13)

- 事實:前端首次輪詢(預設 2 秒後)成功即觸發 openOnce,接著以 `[sys:getFuncList]` 取函數清單再綁定;此往返若較慢(例如 getUserIdByToken 查外部服務),其間之同步廣播會在綁定前抵達.若此時以空資料結束 pm,w-sync-webdata 會記下時間戳,綁定後 `[sys:getTableTags]` 帶回同一時間戳而不再重抓,該表一直是空的.原方案即如此,三位審查者皆實測重現.
- 做法:綁定完成前略過同步廣播(綁定後之 getTableTags 帶回全部時間戳,不遺漏);只有「已綁定而缺表或缺 select」才以空資料結束 pm(2026-10-13 配合 w-sync-webdata 1.1.7 改為 reject,見 E22).前端時序測試以記憶體假通訊層相連(不開埠),首次 getToken 延遲 3.5 秒、2.4 秒時觸發資料變更即可重現.這類測試要同時是行為鎖定(舊碼綠、新碼仍綠),不只是缺陷重現.

### E21 多 AI 獨立審查之實務(2026-10-13)

- 事實:以 dispatch-claude(claude-opus-5-5 max)×2、dispatch-codex(gpt-6.1-sol max)×1 審同一份方案,各約 25～30 分鐘;三份報告對最嚴重之缺陷(E20)結論一致,其餘各有獨到之格(路徑別名與字面鍵為 sol 獨有,建構期前端 emit、使用端回呼拋錯三方皆提).Codex 依提示以 `rg -n '^'` 讀中文檔無亂碼.
- 做法:派工前先以相同權限與限制句做能力探測(讀中文行＋寫檔);各審查者用獨立輸出目錄與互不重疊之埠;正式派工 detached＋分段等待,任一份完成即叫醒以便先複審;收回後驗產物(報告存在、讀檔證明、git 狀態未被改動),再逐條對源碼核對採納,依 E19 剔除非問題.

### E22 下層套件升版時,重審為迴避其舊行為而寫的變通(2026-10-13,w-sync-webdata 1.1.7)

- 事實:前端 refreshTable 原以 `resolve([])` 結束失敗,註解寫「避免自動同步中斷」——1.1.6 之 `Promise.all(pms)` 直接等原始 pm,任一表 reject 即整批中斷.1.1.7 改為每表之等待恆 resolve、reject 時不推進時間戳並發帶表名之 error,變通之前提消失,剩下的只有副作用(清空前端該表、記下時間戳、到該表下次變動前不重抓,且 select 失敗只 console.log).同版 Server 新增 clearSync,文件明載上層掛於外部物件之監聽須自行移除,對應本套件 L13.
- 做法:①升版前先把舊版 `node_modules/<套件>/src` 快照到 `./tmp/`(本機套件目錄未必是 git repo,升版後就沒得比);②逐檔比對後,對本套件每個「因下層行為而寫」的變通與已知限制(帳本 L 系列)逐條問前提是否仍成立;③下層新增之釋放函數若明載不處理上層之外部監聽,就在掛監聽的那層包裝它,且包裝要裝在其後可能失敗的步驟之前;④改了失敗語意要同時改測試的預期(R43 由 resolve([]) 改 reject)並補「再收到同一時間戳時重抓」之斷言,證明時間戳確實沒推進.
- 自有套件安裝:先 `npm view <套件> version time.modified` 確認 registry 已有,再 `npm i <套件>@<版>`;本次 15 秒完成,不需輪詢.
- 回驗(2026-10-13 第六輪):裝好後以各套件 repo 之 `git ls-files src` 逐檔比對 node_modules(去 CR 後 md5),版號與內容皆一致才算裝到新版;node_modules 之版號可能早於 package.json 範圍(本次 wsemi 已為 1.9.14 而範圍仍為 ^1.9.12),此時只改範圍,仍要比對下層新版用到之函數(w-serv-broadcast 1.1.8 用 wsemi 1.9.14 之 alive.clear).

### E23 下層把檢查前移到建構時,本套件要把同一組檢查前移到建構任何元件之前(2026-10-13,w-serv-broadcast 1.1.7)

- 事實:w-serv-broadcast 1.1.7 前端於建構時檢查 execute,本套件前端「未給就改建 evem」之退路因而必拋下層訊息;拋錯時 WSyncWebdataClient 已擴充傳入之物件.探針另查出無 on 之物件會在 w-serv-broadcast 啟動輪詢後才於註冊監聽時拋 TypeError,殘留輪詢計時器——這格不在建議書內,是比對「下層用到哪些方法」才找到的.同版伺服端 clearBroadcast 改用 off 移除監聽,而本套件建構失敗之 catch 會呼叫它,缺 off 會在 catch 內再拋而蓋掉原錯誤.
- 做法:①列出整個堆疊(本套件＋各下層)在建構與停止時呼叫傳入物件的每個方法(emit、on、off、execute),全數於建構任何元件之前檢查;訊息與下層一致,先檢查物件再檢查 opt.②測試同時斷言「訊息、物件未被擴充(clearSync/clearBroadcast 未掛)、計時器未增加」三者,舊碼之紅因要逐案以探針確認(測試在第一個失敗案例即停).③停止語意變更要實測「只做一半」的狀態(本次:clearBroadcast 後未 stop,前端輪詢收到資料通道之 'invalid token' 而靜默,見 L16;w-serv-broadcast 1.1.8 起改為每輪發輪詢失敗之 error,2026-10-13 第六輪改寫文件第 9 點),寫進文件之停止順序.④真 HTTP 驗收時,前端之 error 事件會混雜 w-converhp 每次重試之字串與 w-serv-broadcast 之 `{msg, err}`,斷言要以 msg 找特定來源,不可取第一則.
- npm 偵測:11:14 以 `--prefer-online` 查 1.1.7 為 404,背景每 2 分鐘迴圈之第一輪(11:15)即查到並安裝;偵測與安裝寫在同一迴圈,裝好即回 DONE.

### E14 檔案格式

- 事實:工作樹之換行混用(2026-10-13 第六輪以 `file` 實查:`src/WServWebdataClient.mjs`、`src/pickTables.mjs` 為 CRLF,其餘多為 LF);`core.autocrlf=true`,提交時一律正規化為 LF(`git ls-files --eol` 之 i/lf),故工作樹之換行不影響提交內容.git-bash 之 grep 以文字模式讀檔會先去掉 CR,`grep -c $'\r$'` 恆為 0,不能用來判斷.npm 改寫 package.json 時會把 devDependencies 依字母排序並補檔尾換行,另同步 package-lock 之根版本.
- 做法:改檔後以 `file <檔>`(看有無「with CRLF line terminators」或「CRLF, LF」混用字樣)或 `git ls-files --eol <檔>` 確認未混換行;npm 之正規化屬預期,不手動還原.

### E25 下層加了停止閘門後,本層要對稱地加(2026-10-13 第六輪,w-serv-broadcast 1.1.8 與 w-serv-hapi 之建議書)

- 情境:w-serv-hapi 回報前端停止後仍呼叫 getServerMethods 並發 error.下層兩者(w-serv-broadcast 1.1.8 之 clearBroadcast、w-sync-webdata 1.1.7 之 clearSync)於停止後皆不再派發事件,唯本套件前端無停止狀態——openOnce 觸發之 async 流程在每個 await 之後照常續行.
- 事實:修正前之碼上以記憶體假通訊層重現 7 種情形(openOnce 內停止、getServerMethods 內停止、取時間戳在途成功／失敗、select 在途、只停其一);真 HTTP 以子行程量測:取得函數清單後停止前端再停伺服器,舊碼停止後 5 則 error、行程於伺服器停止後 11 秒才結束,新碼 0 則、3 毫秒結束;在途時才停止者新碼剩 w-converhp 自身 4 則(無中止能力,L17).
- 做法:①包裝下層之停止函數(先設旗標再呼叫下層,同伺服端 Sync 包裝 clearSync 之形),閘門放在「呼叫使用端函數／發 error／送出本套件請求」之前一刻,並收斂到 callHook、emitError 兩個單一擁有者,其餘只在每個 await 或使用端回調之後檢查一次;②測試之主要觀察值是「送出之請求清單」(假通訊層記錄 sent)與各回調之呼叫次數,不只看 error——停止後續送之請求在 clearSync 之後是無作用的,只看事件會漏;③真 HTTP 驗收時 w-converhp 之 stop 走 hapi 預設 5 秒寬限,要製造「停止後在途請求失敗」須讓伺服端延遲超過 5 秒(本次以 getToken 於 getServerMethods 後改回 'slow'、伺服端 getUserIdByToken 對 'slow' 延遲 8 秒);行程結束時間以子行程之 `process.on('exit')` 量測,另掛 unref 之看門狗;④同一驗收腳本對新碼與修正前之 src 快照各跑一次,對照組才證明差異來自修正(腳本:2026-10-13 之 `tmp/upd118/acc-child.mjs`、`acc-run.mjs`,tmp 不入版控且可能已被清除,依本條重寫即可);⑤加閘門時連帶檢查「重建」:下層允許停止後於同一事件物件重建,本層只閘門而不移除監聽時,舊實體之監聽會先於新實體處理同一事件(本次 refreshTable 以字串拒絕新實體之取資料)——閘門與移除監聽要成對.
- 補記(2026-10-13 第七輪):③之「伺服端延遲須超過 5 秒」以停伺服器製造失敗;中止生效後本套件在途請求於停止當下即結束,此前提不再需要——真 HTTP 停止驗收改以通訊物件 `timeout` 配伺服端延遲製造失敗、伺服器不停,已入 `npm test`(`test/api-clientStop.test.mjs`,見 E29、E32).

### E26 寫建議書前先查族內是否已有人提出(2026-10-13)

- 事實:本套件之建議書第 2 點請「與 w-converhp 協調中止能力」,而 w-serv-hapi 已於其 repo 根目錄之 `建議w-converhp修正.md` 第 2 點提出同一件事.
- 做法:寫 `建議{套件名}修正.md` 之前先 `ls /c/opensrc/*/*/建議*.md`(深度限定,見 E13),已有者只在回報中引用並補自己之實測,不重複撰寫.

### E27 停止語意之獨立審查與變異測試(2026-10-13 第六輪)

- 事實:自認完整之全盤表(時機 14 列×輸出 10 欄)交獨立審查(Agent opus,約 30 分鐘,環境不允許其寫檔而由我代存其報告)後補出 14 條,其中屬實而改碼者 6 條:使用端監聽先於本套件註冊之軸(w-serv-hapi useWaitToken=true 時為常態)、停止後回調拋錯被吞、等待 getToken 之請求仍送出(我原以「後果同已送出之請求」為由不修——理由錯:未交給通訊層者送不送是自己的選擇)、建構未檢查停止時要用的 removeListener/off、伺服端 changeTableTags 監聽未移除、測試輔助把可選回調全部預設給值而使「未給」路徑失去覆蓋.審查者之變異工具顯示:openOnce 入口閘門拿掉後測試全綠.
- 事實:加了「取得 token 後檢查停止」之後,openOnce 入口閘門在「請求」層面變成冗餘(沒有它請求也不送),變異仍存活;兩者之差別只在「停止後是否仍呼叫使用端之 getToken」.
- 做法:①停止類規格之觀察值要列到最細一層——送出之請求、各回調(含 getToken)之呼叫次數、error 事件、console 輸出——閘門互相遮蔽時,只有更細之觀察值能區分;②新增防線後重跑變異測試,確認既有閘門仍可被某條測試觀察到,否則刪掉冗餘閘門或加觀察值;③測試輔助不可把可選參數一律預設給值,另給一個顯式之 extraHooks;④「後果同某已知限制」不是不修的理由,先問「這一格是否在我手上就能決定」;⑤子代理寫不了檔時,要求其把報告全文放在最後回覆,由主責代存並註明.

### E24 本套件對事件物件之要求寬於下層(2026-10-13,由全自有套件之主控 agent 核對 `建議w-serv-broadcast調整.md` 時移入)

- 事實:JSDoc 寫「須為具emit、on、off函數之事件物件」(`src/WServWebdataServer.mjs:174`),下層則要求 eventemitter3(w-serv-broadcast `src/WServBroadcastServer.mjs:16`、wsemi `src/evEmit.mjs:36`).Node 原生 EventEmitter 符合前者、不符後者:它有 newListener 事件,且無監聽時 emit('error') 會拋錯.帳本 L8 所舉之「newListener 觀察者拋錯」即由此縫隙進入;eventemitter3 沒有 newListener,其 `on` 只在 listener 不是函數時拋錯.
- 做法:用字對齊為 eventemitter3(例如 evem 或 WConverhpServer 所建立者),不要求下層去容納 Node 原生 EventEmitter.(2026-10-13 第六輪已改兩端 JSDoc 之 @param.)
- 另:E19 對 w-serv-broadcast 之 clientId 的結論只涵蓋「冒用他人」;前端本來就能自訂自己的 clientId,以 `__proto__` 輪詢會使 w-serv-broadcast 1.1.7 之廣播對所有客戶端遺失(主控實測),屬 w-serv-broadcast 之缺陷,已列入其調整任務(1.1.8 已改以 Map 存放各 clientId 之佇列、非字串 clientId 拒絕,2026-10-13 讀其原始碼確認).

## 六、停止與中止(2026-10-13 起,採用 w-converhp 2.1.8 之 opt.signal)

### E28 建議書引用之實測可能早於本套件現版,先以現行碼重測該情境(2026-10-13 審計 run01)

- 事實:`建議w-serv-webdata調整.md` §1、§4.1 之「取得函數清單後立即停止→停伺服器,5 則、5998ms」是 1.1.10 時之量測(同數字見 dhist 之 `建議w-serv-webdata修正.md` 第 5、17 行);1.1.11 起 getServerMethods 內停止即不送取時間戳,現行碼同情境 0 則、0 毫秒.照建議書情境寫測試會在舊碼與新碼都綠.
- 做法:建議書所附之實測與驗證情境,一律先在現行碼上重跑;若已不重現,找出仍能區分新舊碼之情境(本例為「本套件請求**在途時**停止」:C0 取函數清單、C2 取時間戳、C3 select 皆 4 則、約 11 秒),並於回應中標明「過時」及出處.

### E29 真 HTTP 停止驗收之探針設計(2026-10-13 審計 run01)

- 伺服端放父行程、前端放子行程:前端行程之自然結束時間(`process.on('exit')` 減停止時刻)才不會被伺服端之延遲計時器(例如 getUserIdByToken 對某 token 延遲數秒)拖住.
- 子行程停止後不可再有自己之計時器:延後停伺服器等動作改由子行程印一行指令(`CMD stopServerIn 50`)交父行程排程,否則 exitDelay 量到的是自己的計時器(曾因此量到 3003ms 之假象).
- 停止後之 error 依來源分類:字串＝w-converhp 每次嘗試失敗;`{msg:'[sys:polling] error'}`＝w-serv-broadcast;`{msg:'can not get table data: x'}`＝w-sync-webdata;w-converhp 之重試訊息經 console.log(攔截計數).另以伺服端之 execute 觀察者(不結算 pm)記錄停止後收到之請求.
- 伺服器先停時輪詢幾乎必在重試鏈中(每條約 6 秒、間隔 2 秒且不重疊),「停止後 0 則」會被 w-serv-broadcast 1.1.8 之輪詢污染(C6:3 則、5980ms);要隔離本套件之請求,改以通訊物件 `timeout`(例如 1000ms)配伺服端延遲製造在途請求之失敗,伺服器不停、輪詢照常成功.此法亦適合正式測試(可共用測試伺服器與固定埠、不受 hapi stop 之 5 秒寬限影響).
- 探針腳本:`./tmp/run01/probe/run.mjs`、`child.mjs`(tmp 可能已被清除,依本條重寫即可).

### E30 本套件資料通道之錯誤不觸發 w-converhp 重試(2026-10-13)

- 事實:`src/WServWebdataServerExec.mjs` 之各關卡失敗皆 `pm.resolve({ state: 'error', msg })`(例如 getUserIdByToken 拒絕 `:284`),w-converhp 視為成功回應(output 為 `{state:'error'}`),不重試、不發 error;前端 `executeShell` 才轉為 reject.
- 做法:要製造「通訊物件重試與逐次 error」只能靠傳輸層失敗(連不上、逾時、斷線、5xx);以業務錯誤製造不出來.

### E31 中止之拒絕值與執行環境(2026-10-13 審計 run01)

- 事實:`abort(reason)` 與 `signal.reason` 於 Node v17.2.0/v16.14.0 才有(Node 官方 globals 頁之版本表);不支援者 w-converhp 補 name 為 AbortError 之錯誤(`abortScope.mjs:21-33`).Node v24 下共用一個 AbortSignal 給 30 個並發呼叫不發 MaxListeners 警告(一般 EventTarget 11 個即警告;Node 文件載 AbortSignal 預設不警告).
- 做法:要讓「停止」之拒絕值與其他停止路徑一致,用 `abort(msgStop)`;不要在 catch 以停止狀態一律改寫拒絕值(P1n)——通訊物件不支援 opt.signal 時,會把停止後之真實失敗改寫掉(既有測試「select在途時停止」之只 clearBroadcast 子情境即紅).
- 另:新增參數(如 execute 之第 4 參數)時,既有假通訊層若只取前幾個參數,既有測試在新碼上會全綠而看不到變更(本次 95 條全綠).**但不要把該假通訊層整體改成依新契約**:它正代表「不支援新參數之通訊物件」(w-converhp ≤2.1.7、族內 w-converws、w-conversi 之 execute 皆 3 參數),既有閘門(`:313`、`:369`、callHook 入口)只靠它觀察——獨立複審之變異實測顯示整體改寫後此三閘門之變異 22/22 全綠存活.作法:兩種假通訊層並存(舊者守閘門、新者驗新行為),共用之輔助移至 `test/tools/`,改完重跑變異確認每個閘門各至少紅 1 條(同 E27 ②).
- 另:`test/unit-WServWebdataClient.test.mjs` 單獨即約 1m13s,為 `npm test` 之最長檔(2026-10-13 實測);新增之長時測試另立新檔才不拉長總時.

### E32 中止之實作、雙假通訊層與變異驗證(2026-10-13 第七輪)

- 情境:依主控裁決實作 P1r(每實體一個 AbortController、SELF 請求帶 signal、兩包裝 `abort(msgStop)`),帳本先行.`src/WServWebdataClient.mjs` +22/-13 行.
- 事實:①AbortController 建於建構檢查之後、建構下層之前——刪除全域 AbortController 實測:設定錯誤仍先拋 `invalid opt.…`,設定正確時 ReferenceError 而通訊物件未擴充、計時器 0;②共用輔助搬至 `test/tools/clientHarness.mjs` 時,`run` 依賴 describe 內之 `cleans` 與被測建構子,以工廠 `genRun(WServWebdataClient, cleans)` 搬移即可不動各測試本體(既有檔 diff +4/-93,無 it/assert 行變動),並以修前之 src 快照重跑 22/22 證明等價;③新行為之測試另立新檔(既有單元檔單獨 1m13s 為最長檔),`npm test` 由 95 增至 107 條而總時仍約 1m12s;④「先於本套件註冊之使用端 broadcast/getData 監聽內停止」兩條使 updateSyncTable、callHook 入口兩閘門不依賴晚到之請求即可被觀察(linkCtl 之 poll 選項回傳 `[{mode:'broadcast', data}]` 製造推播);⑤變異腳本 `tmp/run02/mut/runMut.mjs`:替換錨點先以 CRLF→LF 正規化並檢查恰出現一次,單元變異並行 3 個、真 HTTP 變異因共用固定埠循序;8 閘門與 5 個中止相關變異各至少紅 1,真 HTTP 另抓拿掉 abort、不帶 signal、全帶 signal.
- 做法:實作中止類變更時,(a)新增之子行程真 HTTP 測試以通訊物件 timeout 製造失敗、伺服器不停,RESULT 另記停止當下在途之輪詢數供判讀;(b)紅綠檢查以 `git archive HEAD src` 取修前快照,新測試依帳本 R11 分「缺陷重現(修前紅)」與「行為鎖定(修前綠)」回報,行為鎖定之分辨力另以變異證明;(c)讀變異結果時 grep 樣式要涵蓋含數字之變體名(`^[A-Za-z0-9-]+: code=`),曾因 `^[a-zA-Z-]+:` 漏看 m313 等 5 列而誤以為未跑.

### E33 下層新增建構檢查(w-serv-broadcast 1.1.9 之 AbortController)之連動(2026-10-14 第七輪)

- 事實:w-serv-broadcast 1.1.9 前端於建構時檢查 AbortController 並拋 `AbortController is not available`(其 `src/WServBroadcastClient.mjs:67-70`).本套件先建構 WSyncWebdataClient(擴充傳入之物件)才建構它——若只靠下層之檢查,缺 AbortController 之環境會在通訊物件已被擴充後才拋(修前碼配 1.1.9 實測:clearSync 已掛上);本套件之 `new AbortController()` 雖先擋在前面而無副作用,卻以 ReferenceError `AbortController is not defined` 拋出,訊息與下層不一致.依 E23 與帳本 R12 ⓪ 之原則,加同訊息之明確檢查,置於 opt 之檢查之後、建立 acSelf 與建構任何元件之前;新增之測試以「同步範圍內刪除並還原全域 AbortController」驗證,於修前碼紅在副作用、於只有 new 之版本紅在訊息.
- 事實:升 1.1.9 後探針 C6(伺服器先停、停止當下輪詢在途)把兩方之貢獻分開:修前碼剩本套件取時間戳之 4 則、約 9 秒,定稿 0 則、2 毫秒;1.1.8 時定稿仍有輪詢之 3 則、約 6 秒.
- 事實:主控通知發布後(00:11:33),npm 於 00:17:29 才查得到(約 6 分鐘);`npm i` 之 install-scripts 警告(core-js postinstall)為 npm 之新核准機制提示,與本套件無關.
- 做法:下層升版時,除比對 E22 之「因下層行為而寫之變通」外,另逐一檢查下層「新增之建構時拋錯點」是否可能在本套件已建構其他元件之後才觸發,有則把同一檢查(同訊息)前移;改完以刪除全域物件之方式於同步範圍內實測,並放到修前碼上確認測試紅在副作用本身.

## 七、資料通道 find 白名單(2026-10-17 起,run02 審查與 run03 實作)

### E34 lodash `each`/`map` 作用於「使用端物件」時,具非負整數 `length` 之物件被當陣列樣迭代(2026-10-17,run02 實證)

- 事實:w-serv-orm 之 `castIdFind`/`castIdCond`/`adjustData` 以 lodash `each` 迭代並以 `r[k]=v` 複製使用端物件——`{length:1,name:'alpha'}` 成 `{0:undefined}`(select 回全表、delAll 全刪 3/3 列),含整數 `length` 欄之列經 insert 整列遺失且主鍵被改;自有 `__proto__` 鍵被吞.reladb 之 `cvFind.mjs` 檔頭早已自述同缺陷.此為他套件缺陷(另案修正中),本套件白名單因此**暫行**拒絕鍵 `length`(帳本 R15 S2、L20).
- 做法:迭代使用端物件一律 `Object.keys`,複製不用 `r[k]=v` 對 `__proto__` 設原型;白名單鍵檢核用 `k in Object.prototype` 而非窄名單,並把 `length` 列入暫行拒絕.

### E35 探測語料必含 JS 特殊屬性名,且兩側都要記錄(2026-10-17,E18 的再現)

- 事實:run02 自建之 80 案無 `length`,是獨立審查者從讀 lodash 行為補出的;只比對「授權函數所見 vs operOrm 所收」會漏——須在 ORM 邊界(`wo.select` spy)再記一次「ORM 實際收到」,才看得到 `{0:undefined}`.
- 做法:輸入空間表之鍵語料固定含 `length`、`__proto__`、`constructor`、`toString`、`prototype`、空字串、超長、含 NUL;每個接縫(授權函數、operOrm、ORM)各記一份實參.

### E36 嚴格化提議先以既有測試試行(2026-10-17)

- 事實:「多餘參數拒絕」與「delAll 須帶條件」兩項看似合規格精神,試行即各使既有 `unit-authorizeExec.test.mjs` 之「授權函數與operOrm皆只收到前端第1個參數」與「methodName原樣傳入授權函數(含mix、delAll)」(delAll 傳 `[]`)紅;已列為選項(`checkFind` 之 `requireKey` 保留、預設關),Q11 待使用者裁示.
- 做法:提議嚴格化前,先查既有測試是否已把現況鎖為設計,再決定列預設或選項.

### E37 外審者無回應時的替代(2026-10-17,run02)

- 事實:muse 三次探測(派工腳本 100 s、`opencode run` 90 s/100 s)皆無輸出且 `opencode auth list` 為 0 credentials;改 Agent 子代理(前景、約 22 分),審查包用「唯讀副本目錄+任務書+只准寫 out/」;子代理與主責同模型家族,獨立性有限,但「找漏格+逐條對原始碼」之任務書抓到最重要缺陷(`length`).

### E38 `$in` 成本與 `MAX_IN`(2026-10-17,run02 實測)

- 事實:mingo 系 `$in` 每列重建 HashMap,成本 ∝ 列數×元素數:8000 列×10000 元素 4.85 s、×1000 元素 216 ms(自建 lowdb 夾具、行程內直呼 `wo.select`、元素皆不命中);深度巢狀 `$not` 1500 層單次占用事件迴圈約 400 ms,1900 層由傳輸層 `invalid request packet` 拒收.上限 1000 依此訂,不開 opt.

### E39 實作 R15 之經驗:測試字元的表達、變異首輪存活、lint、與帳本不受版控(2026-10-17,run03)

- 事實:①Edit 工具會把 `new_string` 內的 `\uXXXX` 還原為實際字元(實測:試圖寫 `'́abc'` 結果檔內成了實際組合符號,再改寫 `\\u0301` 則成了兩個反斜線),肉眼也分不出預組字元與「e + U+0301」;「鍵含組合符號」測試首輪未抓到變異 M10(識別字不含 `\p{M}`),推論為所用 `école` 是預組字元(`\p{L}` 即通過;未回頭驗首輪檔之位元組).改以 `String.fromCodePoint(0x301)`、`String.fromCodePoint(0)` 組字元,檔內不留任何實際組合符號(`grep -c` 其位元組 `\314\201` 為 0 確認).②首輪 47 個變異存活 2 個(M10;M43 `opt.requireKey` 以真值判斷——只測了 `requireKey:false` 與 `'true'` 配 `{}`,未測未給之 find 配真值但非 true),補強後整組重跑存活 0——變異結果要在最終版測試檔上再跑一次.③專案 eslint(standard + stroustrup brace-style + quote-props consistent)對測試檔亦生效:一行式 `{ n++; return 'alpha' }`、`"na'me"`、混用引號之物件鍵皆觸發;`eslint --fix` 只改格式,刻意的稀疏陣列 `[, 'a']` 須手加 `// eslint-disable-next-line no-sparse-arrays`.④`.gitignore` 含 `CLAUDE*.md`、`tmp`、`test/_tmp`:帳本與經驗檔不受版控,`git status` 看不到其改動,不能以 diff 審帳本.⑤w-serv-orm 工作樹(未提交)已含 `mapOwn`(R-OBJ-01,不用 lodash `each`、`Object.fromEntries` 建自有屬性、select/delAll 擋自有 `__proto__` 鍵)之修正,但本套件 `length` 之暫行拒絕依業主裁示保留至另行裁示.
- 做法:①測試內需要的特殊字元(NUL、組合符號、孤立代理字元)一律以 `String.fromCodePoint` 組成,不在原始碼內留字面字元或 `\u` 跳脫;②紅綠檢查之替身:修前快照內放一個只匯出常數的 `src/checkFind.mjs`,讓測試檔可載入,純函數測試因修前無該模組不列入紅綠統計;③新檢核類測試於每條 `it` 註解標 `[重現]`/`[鎖定]` 與規格句(`R15 S<n>`),紅綠結果須與標註逐條相符(本次資料通道與真 HTTP 共 27 條:16 紅 11 綠,即 api 7 紅 6 綠、unit 資料通道 9 紅 5 綠).

### E40 聚焦外審之派工與收回(2026-10-17,run03)

- 事實:①派 opus(`claude-opus-5-5`、`--effort xhigh`、`--output-format stream-json --verbose` 使過程有輸出可監看,19.5 分,10 條)與 gpt-6.1-sol(`--config model_reasoning_effort="max"`、`--json`,23.8 分,9 條),皆 `timeoutMs` 3600000、detached 啟動、同時進行;審查包為 diff 與新檔之副本(`tmp/run03/review/pkg/`)加規格句檔,提示詞要求第一行原文引用 `checkFind.mjs` 第 1 行作能力探測(兩者皆通過),探測限在各自輸出目錄之副本.②收回後以 `git status` 核對本 repo、三個下游與 w-serv-orm 無非預期改動(w-serv-orm 之既有未提交改動屬他任務).③兩位審查者共 19 條,合併後 13 格(契約 3、文件 3、測試漏洞 7),測試漏洞類除「缺經真 procOrm 之測試」(本套件無 w-serv-orm 相依,未補)外皆以「新增變異於外審前之測試存活」自行證實(M47～M59 於 39 條全綠之舊測試存活),功能面無一條是會經 JSON 往返放行有害形狀者;實質產出是 (a) `checkFind` 對非 JSON 可達之敵意物件的契約(不拋出、洞與額外屬性並存)、(b) 文件缺漏(id 數字轉型、operOrm/鉤子亦收凍結複本、嚴格模式措辭、方法名精確比對)、(c) 測試補強.④殘留之 `codex.exe`(VS Code ChatGPT 擴充之 app-server,建於 2026/10/14)非本次派出,以 CommandLine 與建立時間確認,未動.
- 做法:①外審提示詞須同時給「已定案不要當缺陷」清單,否則會重提設計要求;②審查者提出之測試漏洞,以「新增變異於舊測試存活、於新測試被抓」逐條證實,不憑其敘述採納;③`MUT_TEST_DIR`、`MUT_IDS` 環境變數可讓 `tmp/run03/mut.mjs` 以舊測試重跑指定變異;④審查者的 stream-json 日誌可達 1.5 MB,不整份讀,以輸出目錄是否出現 `review.md` 與 `result.json` 判斷完成.

### E41 `$in` 上限由逐鍵改為整個 find 合計(2026-10-17,run04)

- 事實:外審 opus 實測 2000 列、各條件皆命中:1 鍵×1000 元素 54 ms、64 鍵×1000 元素 2896 ms(約 54 倍),逐鍵 1000 之上限實際讓單次 find 可帶 64,000 元素;業主裁示改為整個 find 之 `$in` 元素總數 ≤1000(原因碼仍 `tooManyIn`).實作為單點:`checkFind` 內 `total += n` 於逐元素檢查之前累加並與 `MAX_IN` 比較,故宣告長度很大之稀疏陣列不致被迭代;同一 find 內先前鍵已滿額時,後鍵即使為 `new Array(1e9)` 亦先得 `tooManyIn`.空 `$in` 與等值純量不占額度.
- 做法:邊界測試須同時驗「合計恰 MAX_IN 放行且各鍵元素數與內容完整保留」(2 鍵 600+400、4 鍵各 250、64 鍵各 15)與「合計 MAX_IN+1 拒絕」(600+401、滿額一鍵再加 1 元素之另一鍵、64 鍵各 16);變異須含「改回逐鍵計」「以鍵數代元素數」「單鍵計數封頂」「起算差一」.

### E42 系統函數之身分關卡與輪詢(2026-10-24,webdata-run01,w-serv-broadcast 1.1.11)

- 事實:①`[sys:polling]` 輸入為 `{ clientId, __sysToken__ }`,不是資料通道之 `{ __sysInputArgs__, __sysToken__ }`,由 w-serv-broadcast 在資料通道之前處理,審計(inv01)時完全不經 `getUserIdByToken`;1.1.11 起其 `opt.verifyPolling`(伺服端,嚴格回傳 `true` 才放行,其他值、拋錯、reject 一律以固定訊息 `[sys:polling] permission denied` 拒絕,原因只經其 error 事件 `{msg, err}`)與前端 `opt.getToken`(每輪輪詢前呼叫,放於 `__sysToken__`)即為正式鉤子,本套件不再取出其 execute 監聽(審計原型之作法已棄).②有鉤子時其回覆為非同步,同一事件物件上於其後註冊且同步回應 `[sys:polling]` 之監聽(本套件 Exec 原會回 invalid token/invalid input)會搶先結算,故 Exec 須略過(E05).③clientId 由前端自訂,不綁定身分則知道他人 clientId 者可取走其佇列之廣播;綁定 = 首次放行時記 clientId→userId,生命週期同在線身分(clientLeave 解除,clearBroadcast 清除),被拒絕之輪詢不建立或刷新.④w-serv-broadcast 之 error 派發經 1ms 計時器、clientEnter 經在線偵測(50ms),測試斷言事件前須等待(單元測試輪詢輔助等 120ms).⑤真 HTTP 下前端 `error` 事件混雜 w-converhp 每次嘗試失敗之字串(如 `[sys:polling] permission denied`)與 w-serv-broadcast 之 `{msg:'[sys:polling] error', err}`,斷言以 `msg` 找特定來源(同 E24 ④).⑥前端 `WServWebdataClient` 的 `getToken` 直接交給 w-serv-broadcast 前端,輪詢每輪亦呼叫之;測試輔具 `genRun` 的 `nToken` 於通訊物件見輪詢時扣回,各〈停止〉測試之語意不變.
- 做法:①新增「系統函數 × token 狀態 × sysFuncsPublic 設定」之表驅動測試時,預期值寫成人工列出之 pub 表(不由程式推導),避免與實作互為同義反覆.②輪詢之身分關卡獨立成 `src/genPollingGate.mjs`(鉤子與綁定同處),可直接單元測試其綁定/解除/停止;伺服端組裝處(WServWebdataServer)只接線.③變異驗證(於 `./tmp` 副本逐一施變異,不動 repo 之 src):拿掉鉤子注入、拿掉歸屬檢查、sysFuncsPublic 全公開,以及其他項,結果見帳本〈測試對照〉.變異腳本之坑:a.`find` 若只是原行之**前綴**,取代後尾端殘留文字會變成程式碼(如行尾註解被切掉)而造成語法錯誤,變異「被抓到」只是載入失敗——腳本須於施變異後 `node --check`,find 取整行;b.CRLF 檔(本套件僅 `WServWebdataClient.mjs` 為 CRLF,其餘 LF)之多行 find 須轉換換行;c.bash 的 `grep -c $'\r'` 在此環境不可靠,換行判斷用 node 讀檔數 `\r\n`.
- 事實(外審 sol,2026-10-24,12 條):屬實並改碼 2 條(sysFuncsPublic 須先取快照再檢查——自訂迭代器使索引檢查與展開不同〔#4〕;clientLeave 監聽須在 try 內註冊,註冊失敗時由 catch 停止已建構之廣播〔#6〕)、改設計 1 條(輪詢「無 token 鍵不反查」之例外與「反查 reject 一律拒絕」不一致,改為無鍵以空字串反查,每輪恰 1 次〔#3〕)、補測試 6 條(預設 getUserIdByToken 實際呼叫三系統函數〔#7〕、同一他人身分連續被拒不得誤刪原綁定〔#8〕、falsy 拒絕值〔#9〕、sysFuncsPublic 8 個子集〔#10〕、任意字串 clientId 與大小寫〔#12〕、非字串 token〔#1〕)、修既有測試 1 條(#11,見下)、文件限定 1 條(歸屬為先到先綁〔#5〕)、實測屬實並記為已知限制 1 條(#2,離線後至佇列被修剪前〔≤1 秒〕他人可重新綁定並取得離線者遺留之廣播,見 L22 ③,根治在 w-serv-broadcast).
- 做法(#11 的教訓):以「第 N 次 getToken 呼叫」製造時序的既有測試(綁定前廣播),下層新增呼叫 getToken 之處(輪詢每輪)後會**默默失去原本要製造的情境而仍綠**;凡以呼叫次數計時序之測試,下層行為變動後須以變異(拿掉被守護之閘門)確認仍會紅.

