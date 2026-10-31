/**
 * 請瀏覽器把這個網站的資料設為持久保存，空間不足或久未開啟時不會被自動清掉
 * （iOS Safari 對未安裝的網站，7 天沒開就可能清除 IndexedDB）。
 * 是否同意由瀏覽器決定：Chrome 依使用頻率與是否安裝自動判斷，不會跳出詢問。
 * 回傳目前是否為持久保存；瀏覽器不支援或發生錯誤時回傳 false。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
