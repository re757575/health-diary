import { z } from 'zod'
import { conditionSchema, type Condition } from './condition'
import { entrySchema, type Entry } from './entry'
import { profileSchema, type Profile } from './profile'

export const BACKUP_APP = 'health-diary'
/** v1 只有 entries；v2 新增 conditions 與 profile。匯入時兩個版本都接受 */
export const BACKUP_VERSION = 2

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  entries: z.array(entrySchema),
  // 以下欄位 v1 備份沒有
  conditions: z.array(conditionSchema).default([]),
  profile: profileSchema.optional(),
})

export interface BackupData {
  entries: Entry[]
  conditions: Condition[]
  profile?: Profile
}

/** 序列化成可下載的備份 JSON，紀錄依日期由舊到新排序 */
export function serializeBackup(
  { entries, conditions, profile }: BackupData,
  now: Date = new Date(),
): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      entries: sorted,
      conditions,
      profile,
    },
    null,
    2,
  )
}

export type ParseBackupResult = ({ ok: true } & BackupData) | { ok: false; error: string }

/** 解析並驗證備份檔；任何一筆不合法就整份拒絕，避免匯入一半 */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: '檔案不是有效的 JSON' }
  }
  const result = backupSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, error: '檔案格式不符，不是本 App 匯出的備份檔' }
  }
  const { entries, conditions, profile } = result.data
  return { ok: true, entries, conditions, profile }
}
