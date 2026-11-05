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
 * 檔案才不會只留在同一台手機上。電腦上下載比較直覺，維持下載
 */
export function canShareFile(file: File): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] }) === true
  )
}

/** 檔案怎麼送出去的；cancelled 是使用者關掉了分享選單，什麼都沒送出 */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** 手機上用分享選單送出檔案，電腦上（或瀏覽器不支援分享時）下載 */
export async function shareOrDownload(file: File, title: string): Promise<ShareResult> {
  if (!canShareFile(file)) {
    download(file)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    // 其他錯誤（例如 Safari 認為離點按太久而拒絕）就改用下載，照樣送得出去
    download(file)
    return 'downloaded'
  }
}
