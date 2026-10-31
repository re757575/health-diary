import { useState } from 'react'

export interface StatusMessage {
  text: string
  error: boolean
}

/**
 * 表單送出後的結果訊息；成功與失敗用不同顏色，不只靠文字區分。
 * 第三個回傳值 tryWrite 執行讀寫資料庫的動作，失敗時顯示錯誤訊息，不讓按鈕按了沒反應
 */
export function useStatus() {
  const [status, setStatus] = useState<StatusMessage>({ text: '', error: false })
  const show = (text: string, error = false) => setStatus({ text, error })

  /**
   * @param failure 失敗時訊息的開頭，例如「儲存失敗」。iPhone 上 App 在背景放久後，
   *   資料庫連線可能斷掉，重新整理頁面就會恢復，所以一律提示重新整理
   */
  async function tryWrite(action: () => Promise<void>, failure: string): Promise<void> {
    try {
      await action()
    } catch (error) {
      console.error(error)
      show(`${failure}，請重新整理頁面後再試一次`, true)
    }
  }

  return [status, show, tryWrite] as const
}
