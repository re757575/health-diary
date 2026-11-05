import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@/test/render'
import { PhotoFoodImport } from './PhotoFoodImport'

// jsdom 不能解碼影像也沒有 canvas：縮圖換成「縮成 200 KB 的 JPEG」，實際的縮圖邏輯在 photoFile.test.ts
const RESIZED = new File([new Uint8Array(200 * 1024)], 'meal.jpg', { type: 'image/jpeg' })
vi.mock('./photoFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./photoFile')>()),
  resizePhoto: vi.fn(async () => RESIZED),
}))

const REPLY = JSON.stringify({
  items: [{ name: '燕麥粥', amount: 1, unit: '碗' }],
  note: '家裡煮',
})

const original = new File([new Uint8Array(4 * 1024 * 1024)], 'IMG_0001.jpg', {
  type: 'image/jpeg',
})

const onImport = vi.fn(() => ({ added: 1, skipped: 0 }))

beforeEach(() => {
  onImport.mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 模擬手機（觸控）且能分享檔案，或電腦；userEvent.setup() 要在這之前呼叫，否則剪貼簿會被它換掉 */
function stubShare(share: ((data: ShareData) => Promise<void>) | null) {
  const matchMedia = window.matchMedia
  vi.stubGlobal('matchMedia', (query: string) => ({
    ...matchMedia(query),
    matches: query === '(pointer: coarse)' && share !== null,
  }))
  Object.defineProperty(navigator, 'share', { value: share ?? undefined, configurable: true })
  Object.defineProperty(navigator, 'canShare', {
    value: share ? () => true : undefined,
    configurable: true,
  })
}

async function setup(knownFoods: string[] = []) {
  const user = userEvent.setup()
  render(<PhotoFoodImport knownFoods={knownFoods} activeMeal={null} onImport={onImport} />)
  await user.click(screen.getByRole('button', { name: '用照片辨識食物' }))
  return user
}

const panel = () => within(screen.getByRole('region', { name: '用照片辨識食物' }))

async function takePhoto(user: Awaited<ReturnType<typeof setup>>) {
  await user.upload(panel().getByLabelText('食物照片（相機）'), original)
  return panel().findByAltText('食物照片預覽')
}

describe('PhotoFoodImport：拍照', () => {
  it('相機欄位要求手機直接開後鏡頭，相簿欄位沒有 capture；兩者都只收圖片', async () => {
    stubShare(null)
    await setup()

    const camera = panel().getByLabelText('食物照片（相機）')
    expect(camera).toHaveAttribute('capture', 'environment')
    expect(camera).toHaveAttribute('accept', 'image/*')
    const library = panel().getByLabelText('食物照片（相簿）')
    expect(library).not.toHaveAttribute('capture')
    expect(library).toHaveAttribute('accept', 'image/*')
  })

  it('按「拍照」會打開相機欄位，「選擇照片」打開相簿欄位', async () => {
    stubShare(null)
    const user = await setup()
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      expect(this.getAttribute('aria-label')).toBe(clicked)
    })
    let clicked = '食物照片（相機）'
    await user.click(panel().getByRole('button', { name: '拍照' }))
    clicked = '食物照片（相簿）'
    await user.click(panel().getByRole('button', { name: '選擇照片' }))
    expect(click).toHaveBeenCalledTimes(2)
    click.mockRestore()
  })

  it('拍完顯示縮小後的預覽與檔案大小', async () => {
    stubShare(null)
    const user = await setup()
    expect(panel().queryByAltText('食物照片預覽')).not.toBeInTheDocument()

    const preview = await takePhoto(user)
    expect(preview).toHaveAttribute('src', 'blob:photo')
    expect(panel().getByText('200 KB')).toBeVisible()
  })

  it('移除照片後預覽消失，並釋放預覽網址', async () => {
    stubShare(null)
    const user = await setup()
    await takePhoto(user)

    await user.click(panel().getByRole('button', { name: '移除照片' }))
    expect(panel().queryByAltText('食物照片預覽')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo')
  })

  it('匯入食物後照片一併清掉，下次打開是空的', async () => {
    stubShare(null)
    const user = await setup()
    await takePhoto(user)
    await user.click(panel().getByLabelText('貼上 AI 的回覆'))
    await user.paste(REPLY)
    await user.click(panel().getByRole('button', { name: '解析回覆' }))
    await user.click(panel().getByRole('button', { name: '匯入 1 項' }))

    await user.click(screen.getByRole('button', { name: '用照片辨識食物' }))
    expect(panel().queryByAltText('食物照片預覽')).not.toBeInTheDocument()
  })
})

describe('PhotoFoodImport：分享給 AI App', () => {
  it('手機上分享：照片與提示詞（含常吃的食物）一起交給分享選單，提示詞也複製到剪貼簿', async () => {
    const share = vi.fn(async () => {})
    stubShare(share)
    const user = await setup(['燕麥'])
    await takePhoto(user)

    await user.click(panel().getByRole('button', { name: '分享給 AI App' }))

    expect(share).toHaveBeenCalledTimes(1)
    const [data] = share.mock.calls[0] as unknown as [ShareData]
    expect(data.files).toEqual([RESIZED])
    expect(data.text).toContain('"items"')
    expect(data.text).toContain('燕麥')
    expect(await navigator.clipboard.readText()).toBe(data.text)
    expect(await panel().findByRole('status')).toHaveTextContent('已分享照片；提示詞也複製了')
  })

  it('還沒有照片就沒有分享按鈕', async () => {
    stubShare(vi.fn(async () => {}))
    await setup()
    expect(panel().queryByRole('button', { name: '分享給 AI App' })).not.toBeInTheDocument()
  })

  it('關掉分享選單只顯示已取消，不算錯誤', async () => {
    stubShare(vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')))
    const user = await setup()
    await takePhoto(user)

    await user.click(panel().getByRole('button', { name: '分享給 AI App' }))
    expect(await panel().findByRole('status')).toHaveTextContent('已取消分享，提示詞已複製')
  })

  it('分享出錯時改請使用者自己貼照片，提示詞已複製', async () => {
    stubShare(vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')))
    const user = await setup()
    await takePhoto(user)

    await user.click(panel().getByRole('button', { name: '分享給 AI App' }))
    expect(await panel().findByRole('status')).toHaveTextContent(
      '無法分享照片，已複製提示詞，請自己把照片貼給 AI',
    )
  })

  it('電腦上不顯示分享按鈕，說明改用「複製提示詞」再貼照片', async () => {
    stubShare(null)
    const user = await setup()
    await takePhoto(user)

    expect(panel().queryByRole('button', { name: '分享給 AI App' })).not.toBeInTheDocument()
    expect(panel().getByText(/這裡無法直接分享照片/)).toBeVisible()
    expect(panel().getByRole('button', { name: '複製提示詞' })).toBeVisible()
  })
})

describe('PhotoFoodImport：貼上並解析', () => {
  it('讀剪貼簿的內容，填進輸入框並直接解析，不用再按「解析回覆」', async () => {
    stubShare(null)
    const user = await setup()
    await navigator.clipboard.writeText(`好的：\n\`\`\`json\n${REPLY}\n\`\`\``)

    await user.click(panel().getByRole('button', { name: '貼上並解析' }))

    expect(await panel().findByLabelText('辨識結果第 1 項的名稱')).toHaveValue('燕麥粥')
    expect(panel().getByLabelText('貼上 AI 的回覆')).toHaveDisplayValue(/燕麥粥/)
    expect(panel().getByLabelText('辨識結果備註')).toHaveValue('家裡煮')
    expect(panel().getByRole('button', { name: '匯入 1 項' })).toBeEnabled()
  })

  it('剪貼簿不是食物 JSON 時顯示錯誤，也不留下舊的辨識結果', async () => {
    stubShare(null)
    const user = await setup()
    await navigator.clipboard.writeText(REPLY)
    await user.click(panel().getByRole('button', { name: '貼上並解析' }))
    expect(await panel().findByRole('button', { name: '匯入 1 項' })).toBeVisible()

    await navigator.clipboard.writeText('抱歉，我看不到照片')
    await user.click(panel().getByRole('button', { name: '貼上並解析' }))
    await waitFor(() => expect(panel().getByRole('status')).toHaveTextContent('找不到 JSON'))
    expect(panel().queryByRole('button', { name: /^匯入 / })).not.toBeInTheDocument()
  })

  it('讀不到剪貼簿（沒有權限）時請使用者手動貼上', async () => {
    stubShare(null)
    const user = await setup()
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(new Error('denied'))

    await user.click(panel().getByRole('button', { name: '貼上並解析' }))
    await waitFor(() =>
      expect(panel().getByRole('status')).toHaveTextContent('無法讀取剪貼簿，請長按下方輸入框貼上'),
    )
    expect(panel().queryByRole('button', { name: /^匯入 / })).not.toBeInTheDocument()
  })

  it('匯入時帶出解析的食物與備註', async () => {
    stubShare(null)
    const user = await setup()
    await navigator.clipboard.writeText(REPLY)
    await user.click(panel().getByRole('button', { name: '貼上並解析' }))

    await user.click(await panel().findByRole('button', { name: '匯入 1 項' }))
    expect(onImport).toHaveBeenCalledWith(
      expect.any(String),
      [{ name: '燕麥粥', amount: '1', unit: '碗' }],
      '家裡煮',
    )
  })
})

describe('PhotoFoodImport：在輸入框貼上', () => {
  const reply = () => panel().getByLabelText('貼上 AI 的回覆')

  it('貼上後自動解析，不用按「解析回覆」', async () => {
    stubShare(null)
    const user = await setup()

    await user.click(reply())
    await user.paste(`好的：\n\`\`\`json\n${REPLY}\n\`\`\``)

    expect(panel().getByLabelText('辨識結果第 1 項的名稱')).toHaveValue('燕麥粥')
    expect(panel().getByLabelText('辨識結果備註')).toHaveValue('家裡煮')
    expect(reply()).toHaveDisplayValue(/燕麥粥/)
    expect(panel().getByRole('button', { name: '匯入 1 項' })).toBeEnabled()
  })

  it('貼的不是食物 JSON 時顯示錯誤，內容仍留在輸入框', async () => {
    stubShare(null)
    const user = await setup()

    await user.click(reply())
    await user.paste('抱歉，我看不到照片')

    expect(panel().getByRole('status')).toHaveTextContent('找不到 JSON')
    expect(reply()).toHaveDisplayValue('抱歉，我看不到照片')
    expect(panel().queryByRole('button', { name: /^匯入 / })).not.toBeInTheDocument()
  })

  it('插在游標處，已經有的文字不會被蓋掉，合起來一起解析', async () => {
    stubShare(null)
    const user = await setup()

    await user.click(reply())
    await user.type(reply(), '好的：')
    await user.paste(REPLY)

    expect(reply()).toHaveDisplayValue(`好的：${REPLY}`)
    expect(panel().getByLabelText('辨識結果第 1 項的名稱')).toHaveValue('燕麥粥')
  })

  it('選取一段文字再貼上，會取代選取的部分', async () => {
    stubShare(null)
    const user = await setup()

    await user.click(reply())
    await user.paste('舊的內容')
    await user.tab()
    await user.click(reply())
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(REPLY)

    expect(reply()).toHaveDisplayValue(REPLY)
    expect(panel().getByRole('button', { name: '匯入 1 項' })).toBeEnabled()
  })

  it('再貼新的回覆會換掉舊的辨識結果', async () => {
    stubShare(null)
    const user = await setup()
    await user.click(reply())
    await user.paste(REPLY)
    expect(panel().getByLabelText('辨識結果第 1 項的名稱')).toHaveValue('燕麥粥')

    await user.keyboard('{Control>}a{/Control}')
    await user.paste(JSON.stringify({ items: [{ name: '水煮蛋', amount: 2, unit: '顆' }] }))

    expect(panel().getAllByLabelText(/^辨識結果第 \d+ 項的名稱$/)).toHaveLength(1)
    expect(panel().getByLabelText('辨識結果第 1 項的名稱')).toHaveValue('水煮蛋')
  })

  it('貼上空白（沒有文字）就不解析', async () => {
    stubShare(null)
    const user = await setup()

    await user.click(reply())
    await user.paste('   ')

    expect(panel().queryByRole('status')).not.toBeInTheDocument()
    expect(panel().queryByRole('button', { name: /^匯入 / })).not.toBeInTheDocument()
  })
})
