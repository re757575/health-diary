import { screen, waitFor, within } from '@testing-library/react'
import { render } from '@/test/render'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { getProfile } from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import { shiftDate, toDateString } from '@/domain/form'
import App from './App'

const openTab = (user: UserEvent, name: '今天' | '趨勢' | '設定') =>
  user.click(screen.getByRole('tab', { name }))

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.conditions.clear(), db.profile.clear()])
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
