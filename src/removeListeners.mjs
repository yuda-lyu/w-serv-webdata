import each from 'lodash-es/each.js'
import isfun from 'wsemi/src/isfun.mjs'


/**
 * 盡力移除本套件掛於外部事件物件之監聽, 依序試removeListener、off, 移除失敗者略過(回滾時以原錯誤為準)
 * 前端之通訊物件已於建構時檢查具removeListener或off; 伺服端之kpOrm為使用端提供之ORM物件, 移除失敗時殘留之change監聽因同步已釋放而不作用
 *
 * @param {Array} hs 輸入監聽紀錄陣列, 各元素為{ ev, name, h }: ev為事件物件, name為事件名, h為監聽函數
 */
function removeListeners(hs) {
    each(hs, ({ ev, name, h }) => {
        try {
            if (isfun(ev.removeListener)) {
                ev.removeListener(name, h)
            }
            else if (isfun(ev.off)) {
                ev.off(name, h)
            }
        }
        catch (err) {}
    })
}


export default removeListeners
