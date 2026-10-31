import { act, screen, waitFor, within } from '@testing-library/react'
import { render } from '@/test/render'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { loadDraft } from '@/data/draft'
import { getProfile } from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import type { Entry } from '@/domain/entry'
import { shiftDate, toDateString } from '@/domain/form'
import App from './App'

// service worker 的更新狀態由測試控制；預設沒有新版本
const appUpdate = vi.hoisted(() => ({ updateReady: false, applyUpdate: vi.fn() }))
vi.mock('./useAppUpdate', () => ({ useAppUpdate: () => appUpdate }))

const openTab = (user: UserEvent, name: '今天' | '趨勢' | '設定') =>
  user.click(screen.getByRole('tab', { name }))

beforeEach(async () => {
  appUpdate.updateReady = false
  appUpdate.applyUpdate.mockClear()
  await Promise.all([
    db.entries.clear(),
    db.conditions.clear(),
    db.profile.clear(),
    db.meta.clear(),
  ])
})

describe('App', () => {
  it('儲存今天的紀錄後出現在歷史紀錄', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('早餐'), '燕麥奶')
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeInTheDocument()
    await openTab(user, '趨勢')
    const history = await screen.findByRole('region', { name: '歷史紀錄' })
    expect(await within(history).findByText('70.5 kg')).toBeInTheDocument()
  })

  it('沒有紀錄時產生提示詞會提示無資料', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.click(await screen.findByRole('button', { name: '產生 AI 提示詞' }))

    expect(await screen.findByText('這段期間沒有紀錄可以分析')).toBeInTheDocument()
  })

  it('匯入備份後出現在歷史紀錄', async () => {
    const user = userEvent.setup()
    render(<App />)

    const backup = serializeBackup({
      entries: [{ date: '2026-01-02', weightKg: 65, meals: [], bowel: [] }],
      conditions: [],
    })
    const file = new File([backup], 'backup.json', { type: 'application/json' })
    await openTab(user, '設定')
    await user.upload(await screen.findByLabelText('匯入備份'), file)

    expect(await screen.findByText('已匯入 1 筆紀錄')).toBeInTheDocument()
    await openTab(user, '趨勢')
    expect(await screen.findByText('2026-01-02')).toBeInTheDocument()
    expect(screen.getByText('65 kg')).toBeInTheDocument()
  })

  describe('匯入會覆蓋內容不同的紀錄時', () => {
    const importFile = async (user: UserEvent, entries: Entry[]) => {
      const backup = serializeBackup({ entries, conditions: [] })
      await openTab(user, '設定')
      await user.upload(
        await screen.findByLabelText('匯入備份'),
        new File([backup], 'backup.json', { type: 'application/json' }),
      )
    }
    const day = (date: string, weightKg: number): Entry => ({
      date,
      weightKg,
      meals: [],
      bowel: [],
    })

    it('先列出會被覆蓋的日期請使用者確認；取消就完全不匯入', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      await db.entries.put(day('2026-01-02', 70))
      render(<App />)

      await importFile(user, [day('2026-01-02', 65), day('2026-01-03', 66)])

      expect(await screen.findByText('已取消匯入，資料沒有變動')).toBeInTheDocument()
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('有 1 天（2026-01-02）'))
      expect((await db.entries.get('2026-01-02'))?.weightKg).toBe(70)
      expect(await db.entries.get('2026-01-03')).toBeUndefined()
      confirm.mockRestore()
    })

    it('確認後才以備份內容覆蓋', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      await db.entries.put(day('2026-01-02', 70))
      render(<App />)

      await importFile(user, [day('2026-01-02', 65)])

      expect(await screen.findByText('已匯入 1 筆紀錄')).toBeInTheDocument()
      expect((await db.entries.get('2026-01-02'))?.weightKg).toBe(65)
      confirm.mockRestore()
    })

    it('只新增或內容相同時不用確認', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm')
      await db.entries.put(day('2026-01-02', 70))
      render(<App />)

      await importFile(user, [day('2026-01-02', 70), day('2026-01-03', 66)])

      expect(await screen.findByText('已匯入 2 筆紀錄')).toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
      confirm.mockRestore()
    })
  })

  it('匯入格式錯誤的檔案會顯示錯誤，不改動資料', async () => {
    const user = userEvent.setup()
    render(<App />)

    const file = new File(['{"foo":1}'], 'bad.json', { type: 'application/json' })
    await openTab(user, '設定')
    await user.upload(await screen.findByLabelText('匯入備份'), file)

    expect(await screen.findByText(/匯入失敗/)).toBeInTheDocument()
    expect(await db.entries.count()).toBe(0)
  })
})

describe('分頁', () => {
  it('預設在「今天」，只看得到每日紀錄', async () => {
    render(<App />)

    expect(await screen.findByRole('region', { name: '每日紀錄' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '今天' })).toHaveAttribute('aria-selected', 'true')
    for (const name of ['歷史紀錄', '已知疾病', '基本資料', 'AI 分析與資料備份']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
    }
  })

  it('各分頁放的區塊：趨勢有趨勢圖與歷史紀錄，設定有疾病、基本資料、備份與關於', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '趨勢')
    expect(await screen.findByRole('region', { name: '最近 30 天趨勢' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '歷史紀錄' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '每日紀錄' })).not.toBeInTheDocument()

    await openTab(user, '設定')
    for (const name of ['已知疾病', '基本資料', 'AI 分析與資料備份', '關於']) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: '歷史紀錄' })).not.toBeInTheDocument()
  })

  it('切換分頁不會丟掉還沒儲存的輸入', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('早餐'), '燕麥奶')
    await openTab(user, '設定')
    await openTab(user, '今天')

    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70.5)
    expect(screen.getByLabelText('早餐')).toHaveValue('燕麥奶')
  })

  it('在歷史紀錄按「編輯」會切回「今天」並載入那一天', async () => {
    const user = userEvent.setup()
    await db.entries.put({ date: '2026-01-02', weightKg: 65, meals: [], bowel: [] })
    render(<App />)

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: '編輯 2026-01-02' }))

    expect(screen.getByRole('tab', { name: '今天' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByLabelText('日期')).toHaveValue('2026-01-02')
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(65)
  })

  it('切換分頁會回到頁面頂端', async () => {
    const user = userEvent.setup()
    window.scrollTo = vi.fn()
    render(<App />)

    await openTab(user, '設定')

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })
})

describe('漏填提示', () => {
  const today = toDateString(new Date())
  const twoDaysAgo = shiftDate(today, -2)
  const yesterday = shiftDate(today, -1)

  it('最近有沒填完的日子時，在「今天」分頁列出，整天沒記錄的也算', async () => {
    await db.entries.bulkPut([
      { date: twoDaysAgo, meals: [], bowel: [], weightKg: 68 },
      { date: today, meals: [], bowel: [] },
    ])
    render(<App />)

    const notice = await screen.findByRole('region', { name: '未填完的紀錄' })
    expect(notice).toHaveTextContent('最近有 2 天的紀錄沒填完')
    expect(notice).toHaveTextContent('整天沒有紀錄')
    expect(notice).toHaveTextContent('沒填：飲水、睡眠時間、心情')
  })

  it('按「補填」載入那一天的紀錄，補完存檔後該天就不再提示', async () => {
    const user = userEvent.setup()
    await db.entries.put({
      date: yesterday,
      meals: [],
      bowel: [],
      weightKg: 68,
      waterMl: 2000,
      sleep: { bedtime: '23:30', wakeTime: '07:00' },
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: `補填 ${yesterday}` }))
    expect(await screen.findByLabelText('日期')).toHaveValue(yesterday)
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(68)

    await user.click(
      within(screen.getByRole('group', { name: '心情／精神（1–5）' })).getByRole('button', {
        name: '3',
      }),
    )
    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(`已儲存 ${yesterday} 的紀錄`)

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '未填完的紀錄' })).not.toBeInTheDocument(),
    )
  })

  it('還沒有任何紀錄時不提示', async () => {
    render(<App />)

    await screen.findByLabelText('體重（kg）')
    expect(screen.queryByRole('region', { name: '未填完的紀錄' })).not.toBeInTheDocument()
  })
})

describe('備份提醒', () => {
  const today = toDateString(new Date())

  it('第一筆紀錄滿 7 天還沒備份過時提醒；在提醒上匯出後就消失，設定頁顯示今天備份過', async () => {
    const user = userEvent.setup()
    URL.createObjectURL = vi.fn(() => 'blob:backup')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await db.entries.put({ date: shiftDate(today, -7), weightKg: 65, meals: [], bowel: [] })
    render(<App />)

    const notice = await screen.findByRole('region', { name: '備份提醒' })
    expect(notice).toHaveTextContent('還沒有備份過紀錄')
    await user.click(within(notice).getByRole('button', { name: '匯出備份' }))

    expect(click).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '備份提醒' })).not.toBeInTheDocument(),
    )
    await openTab(user, '設定')
    expect(await screen.findByText(/上次備份：今天/)).toBeInTheDocument()
    click.mockRestore()
  })

  it('剛開始記錄、或最近 7 天內備份過時不提醒', async () => {
    // 等漏填提示出現，代表紀錄已載入，這時沒有備份提醒才算數
    await db.entries.put({ date: shiftDate(today, -6), meals: [], bowel: [] })
    const { unmount } = render(<App />)
    await screen.findByRole('region', { name: '未填完的紀錄' })
    expect(screen.queryByRole('region', { name: '備份提醒' })).not.toBeInTheDocument()
    unmount()

    await db.entries.put({ date: shiftDate(today, -30), meals: [], bowel: [] })
    await db.meta.put({ key: 'lastBackupAt', value: new Date().toISOString() })
    render(<App />)
    await screen.findByRole('region', { name: '未填完的紀錄' })
    expect(screen.queryByRole('region', { name: '備份提醒' })).not.toBeInTheDocument()
  })
})

describe('過了午夜回到 App', () => {
  // 只假造 Date，不動計時器（Dexie 與 RTL 都靠真的計時器）
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 30, 23, 50))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const comeBackNextMorning = () => {
    vi.setSystemTime(new Date(2026, 9, 31, 8, 0))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  it('原本停在今天、沒有未儲存的修改，就換成新的今天', async () => {
    render(<App />)
    expect(await screen.findByLabelText('日期')).toHaveValue('2026-10-30')

    comeBackNextMorning()

    await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue('2026-10-31'))
  })

  it('有未儲存的修改時留在原本那天，輸入還在', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('體重（kg）'), '70')

    comeBackNextMorning()

    expect(screen.getByLabelText('日期')).toHaveValue('2026-10-30')
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70)
  })

  it('正在看別天時不跳走', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByLabelText('日期')
    await user.click(screen.getByRole('button', { name: '前一天' }))
    await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue('2026-10-29'))

    comeBackNextMorning()

    expect(screen.getByLabelText('日期')).toHaveValue('2026-10-29')
  })
})

describe('體重沒填時沿用上一次', () => {
  const today = toDateString(new Date())

  it('體重欄位提示會沿用之前最近一次量的數值；之前沒量過就不提示', async () => {
    const user = userEvent.setup()
    await db.entries.bulkPut([
      { date: shiftDate(today, -5), weightKg: 68.5, meals: [], bowel: [] },
      { date: shiftDate(today, -3), meals: [], bowel: [] },
    ])
    render(<App />)

    await waitFor(() =>
      expect(screen.getByLabelText('體重（kg）')).toHaveAttribute('placeholder', '沿用 68.5'),
    )
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: '前一天' }))
    await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(shiftDate(today, -5)))
    expect(screen.getByLabelText('體重（kg）')).not.toHaveAttribute('placeholder')
  })

  it('AI 提示詞沿用分析期間之前量的體重', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await db.entries.bulkPut([
      { date: shiftDate(today, -40), weightKg: 71, meals: [], bowel: [] },
      { date: shiftDate(today, -2), mood: 3, meals: [], bowel: [] },
    ])
    render(<App />)

    await openTab(user, '設定')
    await user.click(await screen.findByRole('button', { name: '產生 AI 提示詞' }))

    const prompt = await screen.findByLabelText<HTMLTextAreaElement>('提示詞')
    expect(prompt.value).toContain(
      `- 體重：71 kg（當天沒量，沿用 ${shiftDate(today, -40)} 的數值）`,
    )
  })
})

describe('新版本', () => {
  const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }
  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('沒有新版本時不顯示提示', async () => {
    render(<App />)
    await screen.findByLabelText('體重（kg）')
    expect(screen.queryByRole('region', { name: '新版本' })).not.toBeInTheDocument()
  })

  it('新版本就緒、沒有未儲存的修改：切到背景時自動更新', async () => {
    appUpdate.updateReady = true
    render(<App />)
    expect(await screen.findByRole('region', { name: '新版本' })).toHaveTextContent(
      '切到背景時會自動更新',
    )

    setVisibility('hidden')

    expect(appUpdate.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('有未儲存的修改時，切到背景不自動更新；手動更新不用確認，修改已存成草稿', async () => {
    const user = userEvent.setup()
    appUpdate.updateReady = true
    const confirm = vi.spyOn(window, 'confirm')
    render(<App />)
    await user.type(await screen.findByLabelText('體重（kg）'), '70')

    setVisibility('hidden')
    expect(appUpdate.applyUpdate).not.toHaveBeenCalled()
    setVisibility('visible')

    const notice = screen.getByRole('region', { name: '新版本' })
    expect(notice).toHaveTextContent('重新開啟後會自動還原')
    await user.click(within(notice).getByRole('button', { name: '更新' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(appUpdate.applyUpdate).toHaveBeenCalledTimes(1)
    expect(loadDraft(toDateString(new Date()))?.form.weightKg).toBe('70')
    confirm.mockRestore()
  })
})

describe('切換日期', () => {
  it('用前一天、後一天切換日期時，載入的是那一天的紀錄，不是上一天的', async () => {
    const user = userEvent.setup()
    const today = toDateString(new Date())
    const yesterday = shiftDate(today, -1)
    await db.entries.bulkPut([
      { date: today, weightKg: 70, meals: [], bowel: [] },
      { date: yesterday, weightKg: 65, meals: [], bowel: [] },
    ])
    render(<App />)
    expect(await screen.findByLabelText('體重（kg）')).toHaveValue(70)

    await user.click(screen.getByRole('button', { name: '前一天' }))
    await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(yesterday))
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(65)

    await user.click(screen.getByRole('button', { name: '後一天' }))
    await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(today))
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70)
  })

  describe('有未儲存的修改時', () => {
    const today = toDateString(new Date())
    const yesterday = shiftDate(today, -1)

    it('切換前先確認；取消就留在原本那天，輸入還在', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<App />)

      await user.type(await screen.findByLabelText('體重（kg）'), '70')
      await user.click(screen.getByRole('button', { name: '前一天' }))

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining(`${today} 有尚未儲存的修改`))
      expect(screen.getByLabelText('日期')).toHaveValue(today)
      expect(screen.getByLabelText('體重（kg）')).toHaveValue(70)
      confirm.mockRestore()
    })

    it('確認後才切換，沒儲存的輸入不會寫入', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<App />)

      await user.type(await screen.findByLabelText('體重（kg）'), '70')
      await user.click(screen.getByRole('button', { name: '前一天' }))

      await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(yesterday))
      expect(screen.getByLabelText('體重（kg）')).toHaveValue(null)
      expect(await db.entries.count()).toBe(0)
      // 捨棄的修改不留草稿，回到那天不會又還原
      expect(loadDraft(today)).toBeUndefined()
      confirm.mockRestore()
    })

    it('從歷史紀錄按「編輯」時也要確認，取消就不切到那一天', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      await db.entries.put({ date: '2026-01-02', weightKg: 65, meals: [], bowel: [] })
      render(<App />)

      await user.type(await screen.findByLabelText('早餐'), '燕麥奶')
      await openTab(user, '趨勢')
      await user.click(await screen.findByRole('button', { name: '編輯 2026-01-02' }))

      expect(confirm).toHaveBeenCalled()
      expect(screen.getByRole('tab', { name: '趨勢' })).toHaveAttribute('aria-selected', 'true')
      await openTab(user, '今天')
      expect(screen.getByLabelText('日期')).toHaveValue(today)
      expect(screen.getByLabelText('早餐')).toHaveValue('燕麥奶')
      confirm.mockRestore()
    })

    it('儲存後切換日期不用確認', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm')
      render(<App />)

      await user.type(await screen.findByLabelText('體重（kg）'), '70')
      await user.click(screen.getByRole('button', { name: '儲存' }))
      await screen.findByText(`已儲存 ${today} 的紀錄`)
      await user.click(screen.getByRole('button', { name: '前一天' }))

      await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(yesterday))
      expect(confirm).not.toHaveBeenCalled()
      confirm.mockRestore()
    })

    it('關閉或重新整理頁面前，瀏覽器會詢問', async () => {
      const user = userEvent.setup()
      render(<App />)

      const before = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(before)
      expect(before.defaultPrevented).toBe(false)

      await user.type(await screen.findByLabelText('體重（kg）'), '70')
      const after = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(after)
      expect(after.defaultPrevented).toBe(true)
    })
  })
})

describe('刪除紀錄', () => {
  const today = toDateString(new Date())

  it('刪除後從歷史紀錄消失，按「復原」內容完整回來', async () => {
    const user = userEvent.setup()
    const entry = {
      date: '2026-01-02',
      weightKg: 65,
      meals: [{ type: 'lunch' as const, description: '便當' }],
      bowel: [],
    }
    await db.entries.put(entry)
    render(<App />)

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: '刪除 2026-01-02' }))

    expect(await screen.findByText('已刪除 2026-01-02 的紀錄')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('65 kg')).not.toBeInTheDocument())
    expect(await db.entries.get('2026-01-02')).toBeUndefined()

    await user.click(screen.getByRole('button', { name: '復原' }))
    expect(await screen.findByText('已復原 2026-01-02 的紀錄')).toBeInTheDocument()
    expect(await db.entries.get('2026-01-02')).toEqual(entry)
    expect(screen.queryByRole('button', { name: '復原' })).not.toBeInTheDocument()
  })

  it('刪除正在編輯的那天：表單跟著清空，復原後又載入，都不算未儲存的修改', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    await db.entries.put({ date: today, weightKg: 70, meals: [], bowel: [] })
    render(<App />)
    expect(await screen.findByLabelText('體重（kg）')).toHaveValue(70)

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: `刪除 ${today}` }))
    await openTab(user, '今天')
    await waitFor(() => expect(screen.getByLabelText('體重（kg）')).toHaveValue(null))

    await openTab(user, '趨勢')
    await user.click(screen.getByRole('button', { name: '復原' }))
    await openTab(user, '今天')
    await waitFor(() => expect(screen.getByLabelText('體重（kg）')).toHaveValue(70))

    await user.click(screen.getByRole('button', { name: '前一天' }))
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('表單有未儲存的修改時，刪除那天不會洗掉正在輸入的內容', async () => {
    const user = userEvent.setup()
    await db.entries.put({ date: today, weightKg: 70, meals: [], bowel: [] })
    render(<App />)
    await user.type(await screen.findByLabelText('早餐'), '燕麥奶')

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: `刪除 ${today}` }))
    await screen.findByText(`已刪除 ${today} 的紀錄`)
    await openTab(user, '今天')

    expect(screen.getByLabelText('早餐')).toHaveValue('燕麥奶')
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70)
  })
})

describe('表單與資料同步', () => {
  it('匯入的備份包含正在顯示的那天、表單沒有修改時，表單換成匯入的內容', async () => {
    const user = userEvent.setup()
    const today = toDateString(new Date())
    render(<App />)
    await screen.findByLabelText('體重（kg）')

    const backup = serializeBackup({
      entries: [{ date: today, weightKg: 64, meals: [], bowel: [] }],
      conditions: [],
    })
    await openTab(user, '設定')
    await user.upload(
      await screen.findByLabelText('匯入備份'),
      new File([backup], 'backup.json', { type: 'application/json' }),
    )
    await screen.findByText('已匯入 1 筆紀錄')
    await openTab(user, '今天')

    await waitFor(() => expect(screen.getByLabelText('體重（kg）')).toHaveValue(64))
  })
})

describe('趨勢圖', () => {
  it('還沒有紀錄時顯示空狀態，儲存體重與睡眠後圖立刻出現', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '趨勢')
    expect(await screen.findByText('最近 30 天還沒有體重紀錄')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /折線圖/ })).not.toBeInTheDocument()

    await openTab(user, '今天')
    await user.type(screen.getByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('入睡時間'), '23:30')
    await user.type(screen.getByLabelText('起床時間'), '07:00')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)

    await openTab(user, '趨勢')
    expect(
      await screen.findByRole('img', { name: '體重趨勢折線圖，共 1 筆紀錄' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '睡眠時數趨勢折線圖，共 1 筆紀錄' })).toBeInTheDocument()
    expect(screen.getByText(/最新 7\.5 小時/)).toBeInTheDocument()
  })
})

describe('已知疾病', () => {
  it('新增 → 編輯 → 刪除', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    expect(await screen.findByText('尚未填寫。沒有已知疾病可略過。')).toBeInTheDocument()

    await user.type(screen.getByLabelText('疾病名稱'), '高血壓')
    await user.type(screen.getByLabelText(/疾病備註/), '每日服藥')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    expect(await screen.findByText('已新增「高血壓」')).toBeInTheDocument()
    expect(await screen.findByText('穩定控制中 · 每日服藥')).toBeInTheDocument()
    // 送出後表單清空，回到新增模式
    expect(screen.getByLabelText('疾病名稱')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: '編輯 高血壓' }))
    expect(screen.getByLabelText('疾病名稱')).toHaveValue('高血壓')
    await user.selectOptions(screen.getByLabelText('狀態'), '治療中／有症狀')
    await user.click(screen.getByRole('button', { name: '更新疾病' }))
    expect(await screen.findByText('治療中／有症狀 · 每日服藥')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(1) // 更新而不是新增一筆

    await user.click(screen.getByRole('button', { name: '刪除 高血壓' }))
    expect(await screen.findByText('已刪除「高血壓」')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(0)
  })

  it('刪除後可以復原，疾病的內容與原本一致', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.type(await screen.findByLabelText('疾病名稱'), '高血壓')
    await user.type(screen.getByLabelText('開始時間'), '2020-03')
    await user.type(screen.getByLabelText(/疾病備註/), '每日服藥')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    await user.click(await screen.findByRole('button', { name: '刪除 高血壓' }))
    expect(await screen.findByText('已刪除「高血壓」')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: '復原' }))

    expect(await screen.findByText('已復原「高血壓」')).toBeInTheDocument()
    expect(await screen.findByText('穩定控制中 · 2020-03 起 · 每日服藥')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(1)
    // 復原後不能再復原一次
    expect(screen.queryByRole('button', { name: '復原' })).not.toBeInTheDocument()
  })

  it('連續刪除兩筆時，復原的是最後刪除的那一筆', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    for (const name of ['高血壓', '胃食道逆流']) {
      await user.type(await screen.findByLabelText('疾病名稱'), name)
      await user.click(screen.getByRole('button', { name: '新增疾病' }))
      await screen.findByText(`已新增「${name}」`)
    }
    await user.click(screen.getByRole('button', { name: '刪除 高血壓' }))
    await user.click(await screen.findByRole('button', { name: '刪除 胃食道逆流' }))
    await screen.findByText('已刪除「胃食道逆流」')

    await user.click(screen.getByRole('button', { name: '復原' }))

    expect(await screen.findByText('已復原「胃食道逆流」')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '編輯 胃食道逆流' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '編輯 高血壓' })).not.toBeInTheDocument()
  })

  it('刪除後做了別的操作，復原按鈕就會消失', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.type(await screen.findByLabelText('疾病名稱'), '高血壓')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    await user.click(await screen.findByRole('button', { name: '刪除 高血壓' }))
    expect(await screen.findByRole('button', { name: '復原' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('疾病名稱'), '胃食道逆流')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))

    expect(await screen.findByText('已新增「胃食道逆流」')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '復原' })).not.toBeInTheDocument()
  })

  it('刪除正在編輯的疾病後，表單回到新增模式', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.type(await screen.findByLabelText('疾病名稱'), '高血壓')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    await user.click(await screen.findByRole('button', { name: '編輯 高血壓' }))
    await user.click(screen.getByRole('button', { name: '刪除 高血壓' }))

    expect(await screen.findByRole('button', { name: '新增疾病' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消編輯' })).not.toBeInTheDocument()
  })

  it('已填寫的疾病與基本資料會出現在 AI 提示詞', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.type(await screen.findByLabelText('疾病名稱'), '高血壓')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    await user.type(screen.getByLabelText('身高（cm）'), '175')
    await user.click(screen.getByRole('button', { name: '儲存基本資料' }))
    await openTab(user, '今天')
    await user.type(screen.getByLabelText('體重（kg）'), '70')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)

    await openTab(user, '設定')
    await user.click(screen.getByRole('button', { name: '產生 AI 提示詞' }))

    const prompt = (await screen.findByLabelText('提示詞')) as HTMLTextAreaElement
    expect(prompt.value).toContain('- 高血壓（穩定控制中）')
    expect(prompt.value).toContain('- 身高：175 cm')
  })

  it('匯入含疾病的備份後顯示在清單', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    const backup = serializeBackup({
      entries: [],
      conditions: [{ id: 'c1', name: '胃食道逆流', status: 'active' }],
    })
    await user.upload(
      await screen.findByLabelText('匯入備份'),
      new File([backup], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('已匯入 0 筆紀錄與 1 項疾病')).toBeInTheDocument()
    // 狀態選單裡也有同名選項，所以只在清單裡找
    const item = await screen.findByRole('listitem')
    expect(within(item).getByText('胃食道逆流')).toBeInTheDocument()
    expect(within(item).getByText('治療中／有症狀')).toBeInTheDocument()
  })
})

describe('基本資料', () => {
  it('儲存生日、身高、性別', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '設定')
    await user.type(await screen.findByLabelText('生日'), '1990-05-20')
    await user.type(screen.getByLabelText('身高（cm）'), '175.5')
    await user.selectOptions(screen.getByLabelText('性別'), '女')
    await user.click(screen.getByRole('button', { name: '儲存基本資料' }))

    expect(await screen.findByText('已儲存基本資料')).toBeInTheDocument()
    expect(await getProfile()).toEqual({ birthday: '1990-05-20', heightCm: 175.5, sex: 'female' })
  })

  it('開啟時載入已儲存的資料', async () => {
    const user = userEvent.setup()
    await db.profile.put({ id: 'me', birthday: '1990-05-20', heightCm: 175 })
    render(<App />)

    await openTab(user, '設定')
    expect(await screen.findByLabelText('生日')).toHaveValue('1990-05-20')
    expect(screen.getByLabelText('身高（cm）')).toHaveValue(175)
  })

  it('匯入備份覆蓋基本資料時，表單跟著更新', async () => {
    const user = userEvent.setup()
    await db.profile.put({ id: 'me', heightCm: 170 })
    render(<App />)
    await openTab(user, '設定')
    expect(await screen.findByLabelText('身高（cm）')).toHaveValue(170)

    const backup = serializeBackup({ entries: [], conditions: [], profile: { heightCm: 180 } })
    await user.upload(
      screen.getByLabelText('匯入備份'),
      new File([backup], 'backup.json', { type: 'application/json' }),
    )

    await screen.findByText(/已匯入/)
    expect(await screen.findByDisplayValue('180')).toBeInTheDocument()
  })
})
