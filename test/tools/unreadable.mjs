//unreadable, 「不可讀之值」輸入集: 已撤銷之Proxy、陷阱拋錯之Proxy、Symbol.toStringTag取值即拋錯之物件等
//  供unit-unreadable與unit-diagmask共用, 同一集合只定義一次(帳本R20)
//  背景: wsemi 1.9.69起判斷函數(isobj、iseobj、isarr、isestr、isfun、isbol、haskey)對此類值回false而不拋錯, 本套件依賴判定拋錯之站點改以src/probeReadable.mjs明確判定
//  不由wsemi之test/tools/hostileValues.mjs取用: 該檔屬wsemi之測試輔助, 不在其對外介面內


//genBoom, 產生拋錯函數, 訊息為msg(測試用以夾帶機密, 斷言不外洩)
function genBoom(msg) {
    return () => {
        throw new Error(msg)
    }
}


//revoked, 建立後立即撤銷之Proxy
function revoked(target) {
    let r = Proxy.revocable(target, {})
    r.revoke()
    return r.proxy
}


//genUnreadables, 回傳[{ name, value, tagReadable, kind }]; 每次呼叫回傳全新之值(Proxy不共用)
//  tagReadable為false者: 型別標籤(Object.prototype.toString.call)取得即拋錯, wsemi判斷函數一律回false(型別無法判定)
//  tagReadable為true者: 型別標籤可讀(判斷函數照常依型別判定), 僅其後之in判斷(kind為'has')或可列舉鍵之走訪(kind為'ownKeys')拋錯
function genUnreadables(msg = 'boom') {
    let boom = genBoom(msg)
    let allTraps = {}
    for (let k of ['get', 'set', 'has', 'ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor', 'defineProperty', 'deleteProperty', 'isExtensible', 'preventExtensions', 'setPrototypeOf', 'apply', 'construct']) {
        allTraps[k] = boom
    }
    return [
        { name: 'revoked-object-proxy', value: revoked({}), tagReadable: false, kind: 'tag' },
        { name: 'revoked-function-proxy', value: revoked(function() {}), tagReadable: false, kind: 'tag' },
        { name: 'revoked-array-proxy', value: revoked([]), tagReadable: false, kind: 'tag' },
        { name: 'all-traps-throw-object-proxy', value: new Proxy({}, allTraps), tagReadable: false, kind: 'tag' },
        { name: 'all-traps-throw-function-proxy', value: new Proxy(function() {}, allTraps), tagReadable: false, kind: 'tag' },
        {
            name: 'toStringTag-getter-throws',
            value: {
                get [Symbol.toStringTag]() {
                    throw new Error(msg)
                },
            },
            tagReadable: false,
            kind: 'tag',
        },
        { name: 'has-trap-throws-proxy', value: new Proxy({ a: 1 }, { has: boom }), tagReadable: true, kind: 'has' },
        { name: 'has-trap-throws-function-proxy', value: new Proxy(function() {}, { has: boom }), tagReadable: true, kind: 'has' },
        { name: 'ownKeys-trap-throws-proxy', value: new Proxy({ a: 1 }, { ownKeys: boom }), tagReadable: true, kind: 'ownKeys' },
        { name: 'getPrototypeOf-trap-throws-proxy', value: new Proxy({ a: 1 }, { getPrototypeOf: boom }), tagReadable: true, kind: 'ownKeys' },
        { name: 'getOwnPropertyDescriptor-trap-throws-proxy', value: new Proxy({ a: 1 }, { getOwnPropertyDescriptor: boom }), tagReadable: true, kind: 'ownKeys' },
    ]
}


export { genBoom, revoked, genUnreadables }
