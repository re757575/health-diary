import { getProfile, listConditions, listEntries, recordBackup } from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import { toDateString } from '@/domain/form'

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 下載整份資料的備份檔，並記下備份時間（備份提醒依此計算） */
export async function exportBackup(now: Date = new Date()): Promise<void> {
  const data = {
    entries: await listEntries(),
    conditions: await listConditions(),
    profile: await getProfile(),
  }
  download(`health-diary-${toDateString(now)}.json`, serializeBackup(data, now))
  await recordBackup(now)
}
