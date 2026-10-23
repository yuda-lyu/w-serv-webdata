import isestr from 'wsemi/src/isestr.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import haskey from 'wsemi/src/haskey.mjs'


/**
 * 產生輪詢([sys:polling])之身分關卡, 供注入w-serv-broadcast(1.1.11起)之opt.verifyPolling, 使輪詢與其他函數一樣先驗證身分
 *
 * 輪詢之輸入為{ clientId, __sysToken__ }(前端opt.getToken之值放於固定鍵__sysToken__), 不是資料通道之{ __sysInputArgs__, __sysToken__ }, 由w-serv-broadcast於資料通道之前處理,
 * 故身分關卡不在資料通道(Exec)的execFun內, 而經鉤子注入; execFun對[sys:polling]只略過(不回應), 見Exec
 *
 * 關卡依序: ①帶token鍵者以getUserIdByToken(token)反查userId(即驗證身分之步驟), 每輪恰1次, 拋錯或reject一律拒絕(含公開者); 未帶token鍵者(已發布之舊前端元件)未出示token, 以空身分處理而不反查; ②userId為空字串者, 須[sys:polling]列於sysFuncsPublic(預設即列入)方放行;
 * ③clientId須歸屬該身分: 首次放行時綁定clientId與userId, 其後以不同userId輪詢同一clientId即拒(clientId由前端自訂, 否則知道他人clientId者可取走其廣播)
 * 「歸屬」之保證為綁定存活期間內userId一致, 先到先綁: 並非證明初次輪詢者原本擁有該clientId(連線識別由伺服端產生並綁定已驗證身分者才有此保證, 本套件沿用前端自訂clientId之既有協定)
 *
 * 綁定之生命週期: 首次放行時建立; 該clientId逾時離線(w-serv-broadcast在線逾時固定10秒, 期間無任何一次被放行之輪詢, 發出clientLeave)時解除(release), 此後可由不同身分重新綁定;
 * 伺服端clearBroadcast時全部解除(stop)並不再綁定; 被拒絕之輪詢不建立、不刷新綁定(亦不刷新在線身分), 故身分改變(例如登出再以他人登入而前端clientId未變)者須待舊綁定逾時, 期間輪詢被拒絕
 *
 * @param {Object} opt 輸入設定物件
 * @param {Function} opt.getUserIdByToken 輸入以token反查userId之函數(sync或async皆可), 回傳非字串視為空字串, 拋錯或reject時拒絕
 * @param {Boolean} opt.isPublic 輸入是否公開[sys:polling](即sysFuncsPublic含之), 公開時反查得空字串(或未帶token)亦放行
 * @returns {Object} 回傳物件: verifyPolling(輪詢驗證鉤子, 嚴格true為放行, 拒絕時回傳描述字串供w-serv-broadcast發出error事件, 前端只見其固定訊息)、release(clientId)(解除綁定)、stop(停止)、isStopped(是否已停止)
 */
function genPollingGate({ getUserIdByToken, isPublic }) {

    //bindings, clientId → userId(公開時匿名者為空字串); 用Map: clientId為前端可控之字串, 一般物件時__proto__等名稱會有特殊語意
    let bindings = new Map()

    //stopped
    let stopped = false

    //verifyPolling, input為w-serv-broadcast交入之輸入快照(深複製, 其clientId已確認為非空字串)
    let verifyPolling = async (input) => {

        //clientId
        let clientId = input.clientId

        //userId, 帶__sysToken__鍵者(含空字串; 非字串以cstr轉換, 同資料通道)反查恰1次, 拋錯或reject一律拒絕(含公開者)
        //未帶該鍵者為已發布之舊前端元件(輪詢輸入恰為{ clientId }): 未出示任何token, 以空身分處理而不反查(公開時放行, 否則拒絕); 預設公開輪詢下須如此, 否則getUserIdByToken對空token拒絕(fail-closed)之部署會使舊前端輪詢失敗
        //拋錯或reject不在此攔截, 由w-serv-broadcast視為拒絕並發出error事件(內容含原拒絕值)
        let userId = ''
        if (haskey(input, '__sysToken__')) {
            userId = await getUserIdByToken(cstr(input.__sysToken__))
            if (!isestr(userId)) {
                userId = ''
            }
        }

        //check, 反查期間已停止者不綁定(w-serv-broadcast於停止後亦不處理其結果)
        if (stopped) {
            return 'stopped'
        }

        //check, 空身分須公開方放行
        if (userId === '' && !isPublic) {
            return 'empty userId'
        }

        //check, clientId須歸屬該身分; 首次放行時綁定, 檢查與綁定同步執行(反查之await之後), 並發之輪詢不會同時綁定
        if (bindings.has(clientId)) {
            if (bindings.get(clientId) !== userId) {
                return 'clientId belongs to another userId'
            }
        }
        else {
            bindings.set(clientId, userId)
        }

        return true
    }

    //release, 解除clientId之綁定(該clientId逾時離線)
    let release = (clientId) => {
        bindings.delete(clientId)
    }

    //stop, 解除全部綁定並不再綁定
    let stop = () => {
        stopped = true
        bindings.clear()
    }

    //isStopped
    let isStopped = () => {
        return stopped
    }

    return { verifyPolling, release, stop, isStopped }
}


export default genPollingGate
