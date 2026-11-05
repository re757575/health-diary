import { PHOTO_MAX_SIDE, fitWithin } from '@/domain/photo-meal'
import { canShareFile } from './shareFile'

const JPEG_QUALITY = 0.85

/**
 * 把照片縮成長邊 PHOTO_MAX_SIDE 以內的 JPEG：手機原圖常有好幾 MB，AI 認食物用不到那麼大。
 * 任何一步失敗（瀏覽器解不開、不支援 canvas）都回傳原檔，不擋住使用者；尺寸沒變、重新編碼反而更大時也維持原檔
 */
export async function resizePhoto(file: File): Promise<File> {
  try {
    // createImageBitmap 預設依照片的 EXIF 方向轉正，直式照片不會躺著
    const bitmap = await createImageBitmap(file)
    const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_SIDE)
    const downscaled = width < bitmap.width || height < bitmap.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob || (!downscaled && blob.size >= file.size)) return file
    return new File([blob], 'meal.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** 先複製到剪貼簿；失敗（沒權限、不支援）回傳 false，不丟錯 */
function copyText(text: string): Promise<boolean> {
  try {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  } catch {
    return Promise.resolve(false)
  }
}

export interface PhotoShareOutcome {
  /** shared：送出了；cancelled：使用者關掉分享選單；unsupported：這裡不能分享檔案；failed：分享時出錯 */
  result: 'shared' | 'cancelled' | 'unsupported' | 'failed'
  /** 提示詞有沒有同時複製到剪貼簿 */
  copied: boolean
}

/**
 * 用系統的分享選單把照片和提示詞一起送給 AI App。
 * 有些 App 收到圖片會丟掉文字，所以同時把提示詞複製到剪貼簿，讓使用者在輸入框貼上。
 * 分享與複製都要在使用者點按的同一時間開始，所以兩個都先發動，再等結果
 */
export async function sharePhotoWithPrompt(
  photo: File,
  prompt: string,
): Promise<PhotoShareOutcome> {
  const copying = copyText(prompt)
  if (!canShareFile(photo)) return { result: 'unsupported', copied: await copying }
  let result: PhotoShareOutcome['result'] = 'shared'
  try {
    await navigator.share({ files: [photo], text: prompt })
  } catch (error) {
    result = error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
  return { result, copied: await copying }
}
