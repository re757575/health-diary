import type { BackupData } from '@/domain/backup'
import type { Condition } from '@/domain/condition'
import type { Entry } from '@/domain/entry'
import type { Medication } from '@/domain/medication'
import type { Profile } from '@/domain/profile'
import { PROFILE_ID, db } from './db'

/** 全部紀錄，日期由新到舊 */
export async function listEntries(): Promise<Entry[]> {
  return db.entries.orderBy('date').reverse().toArray()
}

export async function getEntry(date: string): Promise<Entry | undefined> {
  return db.entries.get(date)
}

/** 同一天只有一筆，已存在就覆蓋 */
export async function saveEntry(entry: Entry): Promise<void> {
  await db.entries.put(entry)
}

export async function deleteEntry(date: string): Promise<void> {
  await db.entries.delete(date)
}

/** 全部已知疾病，依名稱排序 */
export async function listConditions(): Promise<Condition[]> {
  const conditions = await db.conditions.toArray()
  return conditions.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
}

/** 新增或更新（id 相同就覆蓋） */
export async function saveCondition(condition: Condition): Promise<void> {
  await db.conditions.put(condition)
}

export async function deleteCondition(id: string): Promise<void> {
  await db.conditions.delete(id)
}

/** 全部固定用藥，依開始日期排序 */
export async function listMedications(): Promise<Medication[]> {
  const meds = await db.medications.toArray()
  return meds.sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, 'zh-Hant'),
  )
}

/** 新增或更新（id 相同就覆蓋） */
export async function saveMedication(medication: Medication): Promise<void> {
  await db.medications.put(medication)
}

export async function deleteMedication(id: string): Promise<void> {
  await db.medications.delete(id)
}

export async function getProfile(): Promise<Profile | undefined> {
  const stored = await db.profile.get(PROFILE_ID)
  if (!stored) return undefined
  const { id: _id, ...profile } = stored
  return profile
}

/** 整份覆蓋；全部欄位都清空時等同刪除 */
export async function saveProfile(profile: Profile): Promise<void> {
  await db.profile.put({ ...profile, id: PROFILE_ID })
}

/**
 * 匯入備份：同日期／同 id 以備份內容覆蓋，其餘既有資料保留；
 * 備份有基本資料才覆蓋現有的，沒有則維持不變。
 * 所有資料表在同一個交易內寫入，失敗時不會只匯入一半。
 */
export async function importBackup({
  entries,
  conditions,
  medications = [],
  profile,
}: BackupData): Promise<void> {
  await db.transaction('rw', [db.entries, db.conditions, db.medications, db.profile], async () => {
    await db.entries.bulkPut(entries)
    await db.conditions.bulkPut(conditions)
    await db.medications.bulkPut(medications)
    if (profile) await db.profile.put({ ...profile, id: PROFILE_ID })
  })
}

const LAST_BACKUP_KEY = 'lastBackupAt'

/** 上次匯出備份的時間（ISO 字串）；沒備份過回傳 undefined */
export async function getLastBackupAt(): Promise<string | undefined> {
  return (await db.meta.get(LAST_BACKUP_KEY))?.value
}

export async function recordBackup(at: Date): Promise<void> {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at.toISOString() })
}
