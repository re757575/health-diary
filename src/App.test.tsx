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

const openTab = (user: UserEvent, name: '今天' | '趨勢' | '報告' | '設定') =>
  user.click(screen.getByRole('tab', { name }))

beforeEach(async () => {
  appUpdate.updateReady = false
  appUpdate.applyUpdate.mockClear()
  await Promise.all([
    db.entries.clear(),
    db.conditions.clear(),
    db.profile.clear(),
    db.meta.clear(),
    db.medications.clear(),
    db.foods.clear(),
  ])
})

describe('App', () => {
  it('儲存今天的紀錄後出現在歷史紀錄', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('早餐備註'), '燕麥奶')
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
    for (const name of [
      '歷史紀錄',
      '已知疾病',
      '藥物與保健食品',
      '基本資料',
      'AI 分析與資料備份',
    ]) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
    }
  })

  it('各分頁放的區塊：趨勢有趨勢圖與歷史紀錄，設定有疾病、用藥、基本資料、備份與關於', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openTab(user, '趨勢')
    expect(await screen.findByRole('region', { name: '最近 30 天趨勢' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '歷史紀錄' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '每日紀錄' })).not.toBeInTheDocument()

    await openTab(user, '設定')
    for (const name of [
      '已知疾病',
      '藥物與保健食品',
      '常吃的食物',
      '基本資料',
      'AI 分析與資料備份',
      '關於',
    ]) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: '歷史紀錄' })).not.toBeInTheDocument()
  })

  it('切換分頁不會丟掉還沒儲存的輸入', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('早餐備註'), '燕麥奶')
    await openTab(user, '設定')
    await openTab(user, '今天')

    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70.5)
    expect(screen.getByLabelText('早餐備註')).toHaveValue('燕麥奶')
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
    // 每換一天表單會重新載入，等載入完再按下一次
    for (let i = 1; i <= 5; i++) {
      await user.click(await screen.findByRole('button', { name: '前一天' }))
      await waitFor(() => expect(screen.getByLabelText('日期')).toHaveValue(shiftDate(today, -i)))
    }
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

      await user.type(await screen.findByLabelText('早餐備註'), '燕麥奶')
      await openTab(user, '趨勢')
      await user.click(await screen.findByRole('button', { name: '編輯 2026-01-02' }))

      expect(confirm).toHaveBeenCalled()
      expect(screen.getByRole('tab', { name: '趨勢' })).toHaveAttribute('aria-selected', 'true')
      await openTab(user, '今天')
      expect(screen.getByLabelText('日期')).toHaveValue(today)
      expect(screen.getByLabelText('早餐備註')).toHaveValue('燕麥奶')
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
    await user.type(await screen.findByLabelText('早餐備註'), '燕麥奶')

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: `刪除 ${today}` }))
    await screen.findByText(`已刪除 ${today} 的紀錄`)
    await openTab(user, '今天')

    expect(screen.getByLabelText('早餐備註')).toHaveValue('燕麥奶')
    expect(screen.getByLabelText('體重（kg）')).toHaveValue(70)
  })
})

describe('資料庫寫入失敗', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('刪除紀錄失敗時顯示錯誤，紀錄還在', async () => {
    const user = userEvent.setup()
    await db.entries.put({ date: '2026-01-02', weightKg: 65, meals: [], bowel: [] })
    vi.spyOn(db.entries, 'delete').mockRejectedValue(new Error('Connection lost'))
    render(<App />)

    await openTab(user, '趨勢')
    await user.click(await screen.findByRole('button', { name: '刪除 2026-01-02' }))

    expect(await screen.findByText('刪除失敗，請重新整理頁面後再試一次')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '復原' })).not.toBeInTheDocument()
  })

  it('匯入失敗時顯示錯誤，資料沒有變動', async () => {
    const user = userEvent.setup()
    vi.spyOn(db.entries, 'bulkPut').mockRejectedValue(new Error('Connection lost'))
    render(<App />)

    const backup = serializeBackup({
      entries: [{ date: '2026-01-02', weightKg: 65, meals: [], bowel: [] }],
      conditions: [],
    })
    await openTab(user, '設定')
    await user.upload(
      await screen.findByLabelText('匯入備份'),
      new File([backup], 'backup.json', { type: 'application/json' }),
    )

    expect(
      await screen.findByText('匯入失敗，資料沒有變動，請重新整理頁面後再試一次'),
    ).toBeInTheDocument()
    expect(await db.entries.count()).toBe(0)
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
    // 「報告」分頁也有同樣的圖（隱藏著），只看趨勢分頁裡的
    const trends = screen.getByRole('region', { name: '最近 30 天趨勢' })
    expect(within(trends).getByText(/最新 7\.5 小時/)).toBeInTheDocument()
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

describe('藥物與保健食品', () => {
  const today = toDateString(new Date())

  it('在設定登記後，每日紀錄出現並預設有吃；標沒吃後 AI 提示詞會寫出來', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<App />)

    await openTab(user, '設定')
    const section = await screen.findByRole('region', { name: '藥物與保健食品' })
    expect(within(section).getByText('還沒有登記。')).toBeInTheDocument()
    await user.type(within(section).getByLabelText('名稱'), 'DHC 持續型維他命C')
    await user.type(within(section).getByLabelText('劑量／用法'), '1000mg')
    await user.click(within(section).getByRole('button', { name: '新增藥物' }))
    expect(await within(section).findByText('已新增「DHC 持續型維他命C」')).toBeInTheDocument()
    expect(within(section).getByText(`1000mg · ${today} 起`)).toBeInTheDocument()

    await openTab(user, '今天')
    const med = await screen.findByRole('button', { name: 'DHC 持續型維他命C' })
    expect(med).toHaveAttribute('aria-pressed', 'true')
    await user.click(med)
    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(`已儲存 ${today} 的紀錄`)

    await openTab(user, '設定')
    await user.click(screen.getByRole('button', { name: '產生 AI 提示詞' }))
    const prompt = await screen.findByLabelText<HTMLTextAreaElement>('提示詞')
    expect(prompt.value).toContain(`- DHC 持續型維他命C（1000mg）：${today} 起`)
    expect(prompt.value).toContain('- 固定用藥沒吃：DHC 持續型維他命C')
  })

  it('停吃後（最後一天在今天之前），每日紀錄不再出現；編輯、刪除與復原', async () => {
    const user = userEvent.setup()
    await db.medications.put({ id: 'm1', name: '魚油', startDate: '2026-01-01' })
    render(<App />)
    expect(await screen.findByRole('button', { name: '魚油' })).toBeInTheDocument()

    await openTab(user, '設定')
    const section = screen.getByRole('region', { name: '藥物與保健食品' })
    await user.click(await within(section).findByRole('button', { name: '編輯 魚油' }))
    await user.type(within(section).getByLabelText('最後一天（停吃時填）'), '2026-02-01')
    await user.click(within(section).getByRole('button', { name: '更新藥物' }))
    expect(await within(section).findByText(/2026-01-01～2026-02-01 · 已停吃/)).toBeInTheDocument()

    await openTab(user, '今天')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '魚油' })).not.toBeInTheDocument(),
    )

    await openTab(user, '設定')
    await user.click(within(section).getByRole('button', { name: '刪除 魚油' }))
    expect(await within(section).findByText('已刪除「魚油」')).toBeInTheDocument()
    expect(await db.medications.count()).toBe(0)
    await user.click(within(section).getByRole('button', { name: '復原' }))
    expect(await within(section).findByText('已復原「魚油」')).toBeInTheDocument()
    expect(await db.medications.get('m1')).toMatchObject({ endDate: '2026-02-01' })
  })

  it('最後一天早於開始日期時不能儲存', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openTab(user, '設定')
    const section = await screen.findByRole('region', { name: '藥物與保健食品' })

    await user.type(within(section).getByLabelText('名稱'), '鈣片')
    await user.type(within(section).getByLabelText('最後一天（停吃時填）'), '2020-01-01')
    await user.click(within(section).getByRole('button', { name: '新增藥物' }))

    expect(
      await within(section).findByText('請填寫名稱與開始日期；最後一天不能早於開始日期'),
    ).toBeInTheDocument()
    expect(await db.medications.count()).toBe(0)
  })
})

describe('常吃的食物', () => {
  it('貼上清單匯入，重複的略過；每日紀錄點選早餐時列出，常吃的排前面；可以移除', async () => {
    const user = userEvent.setup()
    await db.entries.put({
      date: '2026-01-02',
      meals: [
        {
          type: 'lunch',
          items: [
            { name: '地瓜', amount: 1, unit: '份' },
            { name: '雞胸肉', amount: 1, unit: '份' },
          ],
        },
      ],
      bowel: [],
    })
    render(<App />)

    await openTab(user, '設定')
    const section = await screen.findByRole('region', { name: '常吃的食物' })
    await user.type(within(section).getByLabelText('貼上食物清單'), '燕麥、香蕉\n地瓜，香蕉')
    await user.click(within(section).getByRole('button', { name: '匯入清單' }))
    expect(await within(section).findByText('已加入 3 項（1 項重複，已略過）')).toBeInTheDocument()
    expect(within(section).getByText('目前 3 項（點一下移除）')).toBeInTheDocument()

    await user.type(within(section).getByLabelText('貼上食物清單'), '香蕉、蘋果')
    await user.click(within(section).getByRole('button', { name: '匯入清單' }))
    expect(await within(section).findByText('已加入 1 項（1 項重複，已略過）')).toBeInTheDocument()

    await openTab(user, '今天')
    const chipNames = (meal: string) =>
      within(screen.getByRole('group', { name: `常吃的食物：${meal}` }))
        .getAllByRole('button')
        .map((b) => b.textContent)
    // 午餐吃過地瓜，午餐的地瓜排最前；早餐沒吃過，照匯入的順序
    await user.click(await screen.findByLabelText('新增食物：午餐'))
    expect(chipNames('午餐')).toEqual(['地瓜', '燕麥', '香蕉', '蘋果'])
    await user.click(screen.getByLabelText('新增食物：早餐'))
    expect(chipNames('早餐')).toEqual(['燕麥', '香蕉', '地瓜', '蘋果'])

    await openTab(user, '設定')
    await user.type(within(section).getByLabelText('搜尋清單'), '蕉')
    expect(within(section).getByText('符合 1 項（共 4 項，點一下移除）')).toBeInTheDocument()
    expect(
      within(within(section).getByRole('group', { name: '常吃的食物清單' })).getAllByRole('button'),
    ).toHaveLength(1)
    await user.click(within(section).getByRole('button', { name: '移除 香蕉' }))
    expect(await within(section).findByText('已移除「香蕉」')).toBeInTheDocument()
    expect(await db.foods.count()).toBe(3)
  })

  it('匯出清單：一行一個的文字檔，可以再匯入；清單是空的時不能匯出', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((_file: Blob) => 'blob:foods')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await openTab(user, '設定')
    const section = await screen.findByRole('region', { name: '常吃的食物' })
    expect(within(section).getByRole('button', { name: '匯出清單' })).toBeDisabled()

    await user.type(within(section).getByLabelText('貼上食物清單'), '燕麥、魯肉飯（小）')
    await user.click(within(section).getByRole('button', { name: '匯入清單' }))
    await within(section).findByText('已加入 2 項')
    await user.click(within(section).getByRole('button', { name: '匯出清單' }))

    expect(await within(section).findByText('已匯出 2 項')).toBeInTheDocument()
    expect(click).toHaveBeenCalled()
    const file = createObjectURL.mock.calls[0]![0] as File
    expect(file.name).toMatch(/^health-diary-foods-\d{4}-\d{2}-\d{2}\.txt$/)
    expect(await file.text()).toBe('燕麥\n魯肉飯（小）\n')
    click.mockRestore()
  })

  it('從 .txt 檔匯入；檔案裡沒有食物名稱時說明格式', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openTab(user, '設定')
    const section = await screen.findByRole('region', { name: '常吃的食物' })

    await user.upload(
      within(section).getByLabelText('從檔案匯入食物清單'),
      new File(['燕麥\n香蕉\n'], 'foods.txt', { type: 'text/plain' }),
    )
    expect(await within(section).findByText('已加入 2 項')).toBeInTheDocument()

    await user.upload(
      within(section).getByLabelText('從檔案匯入食物清單'),
      new File(['\n  \n'], 'empty.txt', { type: 'text/plain' }),
    )
    expect(
      await within(section).findByText('沒有找到食物名稱，請一行一個，或用逗號、頓號分隔'),
    ).toBeInTheDocument()
  })
})

describe('就醫報告', () => {
  const today = toDateString(new Date())
  const day = (n: number) => shiftDate(today, -n)

  it('預設最近 30 天：基本資料、未痊癒的疾病、用藥、期間摘要、趨勢與有狀況的日子', async () => {
    const user = userEvent.setup()
    await db.profile.put({ id: 'me', sex: 'male', heightCm: 171 })
    await db.conditions.bulkPut([
      { id: 'a', name: '過敏性鼻炎', status: 'managed', since: '2004-10' },
      { id: 'b', name: '扭傷', status: 'resolved' },
    ])
    await db.medications.put({ id: 'c', name: '維他命C', dose: '1000mg', startDate: day(60) })
    await db.entries.bulkPut([
      { date: day(40), meals: [], bowel: [], weightKg: 80 }, // 範圍外
      {
        date: day(5),
        meals: [],
        bowel: [{ bristol: 7 }],
        weightKg: 70,
        sleep: { bedtime: '23:00', wakeTime: '07:00' },
        mood: 4,
      },
      {
        date: day(2),
        meals: [],
        bowel: [{ bristol: 4 }],
        weightKg: 69.5,
        mood: 2,
        symptomItems: [{ name: '頭痛', severity: 3 }],
        asNeededMedications: ['普拿疼'],
        missedMedications: ['c'],
      },
    ])
    render(<App />)
    await openTab(user, '報告')

    const header = await screen.findByRole('region', { name: '健康紀錄報告' })
    expect(header).toHaveTextContent(`${day(29)}～${today}（30 天，有紀錄 2 天）`)
    expect(header).toHaveTextContent('男，身高 171 cm')
    const conditions = screen.getByRole('region', { name: '已知疾病' })
    expect(conditions).toHaveTextContent('過敏性鼻炎（穩定控制中，2004-10 起）')
    expect(conditions).not.toHaveTextContent('扭傷')
    const meds = screen.getByRole('region', { name: '用藥' })
    expect(meds).toHaveTextContent(`維他命C（1000mg）：${day(60)} 起，服藥 29／30 天（沒吃 1 天）`)
    expect(meds).toHaveTextContent('臨時用藥：普拿疼，1 天')

    const rows = within(screen.getByRole('table', { name: '期間摘要' }))
      .getAllByRole('row')
      .map((r) => r.textContent)
    expect(rows[0]).toMatch(/^體重70 → 69\.5 kg（−0\.5 kg，/)
    expect(rows).toContain('睡眠平均 8 小時（1 晚），睡不到 6.5 小時 0 晚')
    expect(rows).toContain('心情平均 3／5（2 天）')
    expect(rows).toContain('排便平均每天 1 次；硬便 0 天、腹瀉 1 天（2 天有記錄）')

    expect(screen.getByRole('img', { name: /^體重趨勢折線圖，共 2 筆紀錄/ })).toBeInTheDocument()
    const days = screen.getByRole('region', { name: '有狀況的日子' })
    expect(days).toHaveTextContent(`${day(5)}`)
    expect(days).toHaveTextContent('排便：布里斯托 7 型')
    expect(days).toHaveTextContent('症狀：頭痛（重）')
    expect(days).toHaveTextContent('臨時用藥：普拿疼')
    expect(days).toHaveTextContent('固定用藥沒吃：維他命C')
  })

  it('快速選擇期間；開始晚於結束時說明原因且不能列印；列印呼叫瀏覽器的列印', async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    window.print = print
    render(<App />)
    await openTab(user, '報告')

    await user.click(await screen.findByRole('button', { name: '最近 7 天' }))
    expect(screen.getByLabelText('開始')).toHaveValue(day(6))
    expect(screen.getByRole('region', { name: '健康紀錄報告' })).toHaveTextContent(
      '（7 天，有紀錄 0 天）',
    )
    expect(screen.getByText('這段期間沒有可以摘要的紀錄。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '列印／存成 PDF' }))
    expect(print).toHaveBeenCalled()

    await user.clear(screen.getByLabelText('開始'))
    await user.type(screen.getByLabelText('開始'), shiftDate(today, 1))
    expect(screen.getByRole('alert')).toHaveTextContent('開始日期不能晚於結束日期')
    expect(screen.getByRole('button', { name: '列印／存成 PDF' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: '健康紀錄報告' })).not.toBeInTheDocument()
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
