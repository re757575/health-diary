import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resizePhoto, sharePhotoWithPrompt } from './photoFile'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const photo = (bytes: number, name = 'IMG_0001.heic', type = 'image/heic') =>
  new File([new Uint8Array(bytes)], name, { type })

describe('resizePhoto', () => {
  const drawImage = vi.fn()
  let canvasSize: { width: number; height: number }

  /** jsdom 沒有影像解碼與 canvas，換成假的：bitmap 的尺寸自訂，toBlob 給指定大小的 JPEG */
  function stubImage({
    width,
    height,
    jpegBytes,
  }: {
    width: number
    height: number
    jpegBytes: number
  }) {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width, height, close })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      canvasSize = { width: this.width, height: this.height }
      return { drawImage } as unknown as CanvasRenderingContext2D
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) =>
      callback(new Blob([new Uint8Array(jpegBytes)], { type })),
    )
    return { close }
  }

  beforeEach(() => drawImage.mockClear())

  it('長邊縮到上限以內，輸出 JPEG，並釋放解碼後的圖', async () => {
    const { close } = stubImage({ width: 4000, height: 3000, jpegBytes: 200_000 })

    const result = await resizePhoto(photo(5_000_000))

    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('meal.jpg')
    expect(result.size).toBe(200_000)
    expect(canvasSize).toEqual({ width: 1280, height: 960 })
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 960)
    expect(close).toHaveBeenCalled()
  })

  it('本來就小的照片不放大', async () => {
    stubImage({ width: 800, height: 600, jpegBytes: 50_000 })
    await resizePhoto(photo(900_000))
    expect(canvasSize).toEqual({ width: 800, height: 600 })
  })

  it('尺寸本來就在上限內、重新編碼後比原檔還大，就用原檔', async () => {
    stubImage({ width: 800, height: 600, jpegBytes: 90_000 })
    const original = photo(60_000, 'small.png', 'image/png')
    expect(await resizePhoto(original)).toBe(original)
  })

  it('尺寸超過上限時，即使縮完的檔案比原檔大（例如高壓縮的 PNG 截圖）也要用縮小的', async () => {
    stubImage({ width: 3000, height: 2000, jpegBytes: 90_000 })
    const result = await resizePhoto(photo(60_000, 'screen.png', 'image/png'))
    expect(result.type).toBe('image/jpeg')
    expect(canvasSize).toEqual({ width: 1280, height: 853 })
  })

  it('瀏覽器解不開這張圖時用原檔，不丟錯', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const original = photo(1000)
    expect(await resizePhoto(original)).toBe(original)
  })

  it('取不到 canvas 的 2d 環境時用原檔', async () => {
    stubImage({ width: 4000, height: 3000, jpegBytes: 1 })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const original = photo(1000)
    expect(await resizePhoto(original)).toBe(original)
  })

  it('canvas 轉不出圖（toBlob 給 null）時用原檔', async () => {
    stubImage({ width: 4000, height: 3000, jpegBytes: 1 })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    const original = photo(1000)
    expect(await resizePhoto(original)).toBe(original)
  })
})

describe('sharePhotoWithPrompt', () => {
  const PROMPT = '請看照片並回覆 JSON'

  /** 模擬手機（觸控）或電腦，以及是否支援分享檔案、剪貼簿是否可寫 */
  function stubDevice({
    touch = true,
    share,
    writeText = vi.fn(async () => {}),
  }: {
    touch?: boolean
    share?: (data: ShareData) => Promise<void>
    writeText?: (text: string) => Promise<void>
  }) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: touch && query === '(pointer: coarse)',
    }))
    vi.stubGlobal('navigator', {
      share,
      canShare: share ? () => true : undefined,
      clipboard: { writeText },
    })
    return { writeText }
  }

  it('手機上把照片與提示詞一起交給分享選單，同時複製提示詞', async () => {
    const share = vi.fn(async () => {})
    const { writeText } = stubDevice({ share })
    const file = photo(10)

    expect(await sharePhotoWithPrompt(file, PROMPT)).toEqual({ result: 'shared', copied: true })
    expect(share).toHaveBeenCalledWith({ files: [file], text: PROMPT })
    expect(writeText).toHaveBeenCalledWith(PROMPT)
  })

  it('使用者關掉分享選單算取消，提示詞照樣已複製', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    stubDevice({ share })
    expect(await sharePhotoWithPrompt(photo(10), PROMPT)).toEqual({
      result: 'cancelled',
      copied: true,
    })
  })

  it('分享時出錯算失敗，不丟錯', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    stubDevice({ share })
    expect((await sharePhotoWithPrompt(photo(10), PROMPT)).result).toBe('failed')
  })

  it('電腦上（或不支援分享檔案）不開分享選單，只複製提示詞', async () => {
    const share = vi.fn(async () => {})
    stubDevice({ touch: false, share })
    expect(await sharePhotoWithPrompt(photo(10), PROMPT)).toEqual({
      result: 'unsupported',
      copied: true,
    })
    expect(share).not.toHaveBeenCalled()
  })

  it('複製失敗時 copied 是 false，分享不受影響', async () => {
    const share = vi.fn(async () => {})
    stubDevice({ share, writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    expect(await sharePhotoWithPrompt(photo(10), PROMPT)).toEqual({
      result: 'shared',
      copied: false,
    })
  })

  it('瀏覽器沒有剪貼簿 API 時也不丟錯', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('navigator', {})
    expect(await sharePhotoWithPrompt(photo(10), PROMPT)).toEqual({
      result: 'unsupported',
      copied: false,
    })
  })
})
