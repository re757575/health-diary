import {
  getProfile,
  listConditions,
  listEntries,
  listFoods,
  listMedications,
  listVisits,
  recordBackup,
} from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import { toDateString } from '@/domain/form'
import { shareOrDownload, type ShareResult } from './shareFile'

/** 備份檔怎麼送出去的；cancelled 是使用者關掉了分享選單，沒有備份 */
export type ExportResult = ShareResult

/** 匯出整份資料的備份檔，並記下備份時間（備份提醒依此計算）；使用者取消分享時不算備份 */
export async function exportBackup(now: Date = new Date()): Promise<ExportResult> {
  const data = {
    entries: await listEntries(),
    conditions: await listConditions(),
    medications: await listMedications(),
    foods: await listFoods(),
    visits: await listVisits(),
    profile: await getProfile(),
  }
  const file = new File([serializeBackup(data, now)], `health-diary-${toDateString(now)}.json`, {
    type: 'application/json',
  })

  const result = await shareOrDownload(file, '健康日記備份')
  if (result === 'cancelled') return result
  await recordBackup(now)
  return result
}
