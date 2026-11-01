import type { FormValues } from '@/domain/form'

/**
 * 每日紀錄表單還沒儲存的內容（草稿），依日期各存一份。
 * 安裝成 App 後切到別的 App 時常被系統關掉，表單內容只在記憶體裡就會消失。
 * 用 localStorage 是因為它是同步寫入：被關掉前一定寫得完，IndexedDB 不保證
 */
// v2：餐點改成一項項的食物，舊格式的草稿不再讀取
const KEY = 'health-diary:drafts:v2'

/** 太久以前的草稿多半不會再用，存檔時順便清掉 */
const MAX_AGE_DAYS = 30

export interface Draft {
  form: FormValues
  /** 最後一次寫入的時間（ISO 字串） */
  savedAt: string
}

function readAll(): Record<string, Draft> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Draft>) : {}
  } catch {
    return {}
  }
}

function writeAll(drafts: Record<string, Draft>) {
  try {
    if (Object.keys(drafts).length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(drafts))
  } catch {
    // 空間不足或瀏覽器禁止時就不存草稿，不影響正常使用
  }
}

/** 某天的草稿；格式不對（例如舊版留下的）當作沒有 */
export function loadDraft(date: string): Draft | undefined {
  const draft = readAll()[date]
  if (!draft || typeof draft.form !== 'object' || typeof draft.savedAt !== 'string')
    return undefined
  return draft
}

export function saveDraft(form: FormValues, now: Date = new Date()): void {
  const oldest = now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const kept = Object.fromEntries(
    Object.entries(readAll()).filter(([, d]) => Date.parse(d.savedAt) >= oldest),
  )
  writeAll({ ...kept, [form.date]: { form, savedAt: now.toISOString() } })
}

export function clearDraft(date: string): void {
  const drafts = readAll()
  if (!(date in drafts)) return
  delete drafts[date]
  writeAll(drafts)
}
