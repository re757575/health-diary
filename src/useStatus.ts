import { useState } from 'react'

export interface StatusMessage {
  text: string
  error: boolean
}

/** 表單送出後的結果訊息；成功與失敗用不同顏色，不只靠文字區分 */
export function useStatus() {
  const [status, setStatus] = useState<StatusMessage>({ text: '', error: false })
  const show = (text: string, error = false) => setStatus({ text, error })
  return [status, show] as const
}
