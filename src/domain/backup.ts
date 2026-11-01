import { z } from 'zod'
import { conditionSchema, type Condition } from './condition'
import { entrySchema, type Entry } from './entry'
import { convertLegacyMeal } from './legacy-meal'
import { medicationSchema, type Medication } from './medication'
import { toDateString } from './form'
import { profileSchema, type Profile } from './profile'
import { daysBetween } from './trend'
import { visitSchema, type Visit } from './visit'

export const BACKUP_APP = 'health-diary'
/**
 * v1 只有 entries；v2 新增 conditions 與 profile；v3 的紀錄多了 symptomItems（症狀與嚴重程度）、exerciseMinutes 與 tags；
 * v4 的紀錄多了 noBowel（確認當天沒有排便）；v5 新增 medications（固定用藥），紀錄多了 missedMedications 與 asNeededMedications；
 * v6 新增 foods（常吃的食物清單），餐點改成一項項的食物與份量（舊版的文字餐點匯入時會自動拆開）；
 * v7 新增 visits（就醫紀錄）。
 * 匯入時各版本都接受：舊備份沒有的欄位都是選填
 */
export const BACKUP_VERSION = 7

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  exportedAt: z.string(),
  entries: z.array(entrySchema),
  // 以下欄位 v1 備份沒有
  conditions: z.array(conditionSchema).default([]),
  // v5 之前的備份沒有
  medications: z.array(medicationSchema).default([]),
  // v6 之前的備份沒有
  foods: z.array(z.string().trim().min(1)).default([]),
  // v7 之前的備份沒有
  visits: z.array(visitSchema).default([]),
  profile: profileSchema.optional(),
})

export interface BackupData {
  entries: Entry[]
  conditions: Condition[]
  /** 固定用藥；沒給視為沒有 */
  medications?: Medication[]
  /** 常吃的食物清單；沒給視為沒有 */
  foods?: string[]
  /** 就醫紀錄；沒給視為沒有 */
  visits?: Visit[]
  profile?: Profile
}

/** 序列化成可下載的備份 JSON，紀錄依日期由舊到新排序 */
export function serializeBackup(
  { entries, conditions, medications = [], foods = [], visits = [], profile }: BackupData,
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
      medications,
      foods,
      visits,
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
  const { version, conditions, medications, foods, visits, profile } = result.data
  // v6 之前的餐點是整段文字，拆成一項項的食物；v6 之後只有備註的餐點是刻意的，不能再拆
  const entries =
    version < 6
      ? result.data.entries.map((e) => ({ ...e, meals: e.meals.map(convertLegacyMeal) }))
      : result.data.entries
  return { ok: true, entries, conditions, medications, foods, visits, profile }
}

export interface ImportPreview {
  /** 這台裝置上還沒有的日期 */
  added: string[]
  /** 這台裝置上已有、但內容和備份不同的日期；匯入後會被備份的內容取代 */
  replaced: string[]
}

/** 序列化成可比較的字串：物件的鍵排序過，同樣內容不會因為欄位順序不同而被當成不一樣 */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

/** 匯入前比對備份與現有紀錄，日期由舊到新。內容完全相同的日子不列入，匯入也不會有變化 */
export function previewImport(incoming: Entry[], existing: Entry[]): ImportPreview {
  const current = new Map(existing.map((e) => [e.date, canonical(e)]))
  const added: string[] = []
  const replaced: string[] = []
  for (const entry of [...incoming].sort((a, b) => a.date.localeCompare(b.date))) {
    const stored = current.get(entry.date)
    if (stored === undefined) added.push(entry.date)
    else if (stored !== canonical(entry)) replaced.push(entry.date)
  }
  return { added, replaced }
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
