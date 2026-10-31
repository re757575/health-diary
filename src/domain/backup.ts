import { z } from 'zod'
import { conditionSchema, type Condition } from './condition'
import { entrySchema, type Entry } from './entry'
import { toDateString } from './form'
import { profileSchema, type Profile } from './profile'
import { daysBetween } from './trend'

export const BACKUP_APP = 'health-diary'
/**
 * v1 只有 entries；v2 新增 conditions 與 profile；v3 的紀錄多了 symptomItems（症狀與嚴重程度）、exerciseMinutes 與 tags。
 * 匯入時三個版本都接受：舊備份沒有的欄位都是選填
 */
export const BACKUP_VERSION = 3

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
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

/** 距離上次備份（沒備份過就從第一筆紀錄算起）幾天以上就提醒備份 */
export const BACKUP_REMINDER_DAYS = 7

export interface BackupStatus {
  /** 上次備份是幾天前（以本地日期計，當天為 0）；沒備份過為 undefined */
  daysSince?: number
  /** 該提醒備份了：有紀錄，且上次備份（或第一筆紀錄）已超過 BACKUP_REMINDER_DAYS 天 */
  due: boolean
}

/**
 * @param lastBackupAt 上次匯出備份的時間（ISO 字串）
 * @param firstEntryDate 最早一筆紀錄的日期；沒有任何紀錄時不提醒
 */
export function backupStatus(
  lastBackupAt: string | undefined,
  firstEntryDate: string | undefined,
  now: Date,
): BackupStatus {
  const today = toDateString(now)
  const daysSince = lastBackupAt
    ? daysBetween(toDateString(new Date(lastBackupAt)), today)
    : undefined
  if (firstEntryDate === undefined) return { daysSince, due: false }
  const elapsed = daysSince ?? daysBetween(firstEntryDate, today)
  return { daysSince, due: elapsed >= BACKUP_REMINDER_DAYS }
}

/** 顯示在備份區塊的「上次備份」說明 */
export function describeLastBackup(lastBackupAt: string | undefined, now: Date): string {
  const { daysSince } = backupStatus(lastBackupAt, undefined, now)
  if (lastBackupAt === undefined || daysSince === undefined) return '還沒有備份過'
  if (daysSince === 0) return '上次備份：今天'
  return `上次備份：${toDateString(new Date(lastBackupAt))}（${daysSince} 天前）`
}
