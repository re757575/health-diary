import {
  getProfile,
  listConditions,
  listEntries,
  listMedications,
  recordBackup,
} from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import { toDateString } from '@/domain/form'

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 手機上改用系統的分享選單：可以直接存到 iCloud 雲碟、Google 雲端硬碟或傳給自己，
 * 備份才不會和資料一起留在同一台手機上。電腦上下載比較直覺，維持下載
 */
function canShareFile(file: File): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] }) === true
  )
}

/** 備份檔怎麼送出去的；cancelled 是使用者關掉了分享選單，沒有備份 */
export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/** 匯出整份資料的備份檔，並記下備份時間（備份提醒依此計算）；使用者取消分享時不算備份 */
export async function exportBackup(now: Date = new Date()): Promise<ExportResult> {
  const data = {
    entries: await listEntries(),
    conditions: await listConditions(),
    medications: await listMedications(),
    profile: await getProfile(),
  }
  const file = new File([serializeBackup(data, now)], `health-diary-${toDateString(now)}.json`, {
    type: 'application/json',
  })

  let result: ExportResult = 'downloaded'
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: '健康日記備份' })
      result = 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // 其他錯誤（例如 Safari 認為離點按太久而拒絕）就改用下載，備份照樣完成
      download(file)
    }
  } else {
    download(file)
  }
  await recordBackup(now)
  return result
}
