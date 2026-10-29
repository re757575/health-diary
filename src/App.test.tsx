import { screen, within } from '@testing-library/react'
import { render } from '@/test/render'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { getProfile } from '@/data/repository'
import { serializeBackup } from '@/domain/backup'
import App from './App'

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
    const history = await screen.findByRole('region', { name: '歷史紀錄' })
    expect(await within(history).findByText(/^\d{4}-\d{2}-\d{2} · 70\.5 kg$/)).toBeInTheDocument()
  })

  it('沒有紀錄時產生提示詞會提示無資料', async () => {
    const user = userEvent.setup()
    render(<App />)

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
    await user.upload(await screen.findByLabelText('匯入備份'), file)

    expect(await screen.findByText('已匯入 1 筆紀錄')).toBeInTheDocument()
    expect(await screen.findByText('2026-01-02 · 65 kg')).toBeInTheDocument()
  })

  it('匯入格式錯誤的檔案會顯示錯誤，不改動資料', async () => {
    const user = userEvent.setup()
    render(<App />)

    const file = new File(['{"foo":1}'], 'bad.json', { type: 'application/json' })
    await user.upload(await screen.findByLabelText('匯入備份'), file)

    expect(await screen.findByText(/匯入失敗/)).toBeInTheDocument()
    expect(await db.entries.count()).toBe(0)
  })
})

describe('趨勢圖', () => {
  it('還沒有紀錄時顯示空狀態，儲存體重與睡眠後圖立刻出現', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('最近 30 天還沒有體重紀錄')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /折線圖/ })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('體重（kg）'), '70.5')
    await user.type(screen.getByLabelText('入睡時間'), '23:30')
    await user.type(screen.getByLabelText('起床時間'), '07:00')
    await user.click(screen.getByRole('button', { name: '儲存' }))

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

    expect(await screen.findByText('尚未填寫。沒有已知疾病可略過。')).toBeInTheDocument()

    await user.type(screen.getByLabelText('疾病名稱'), '高血壓')
    await user.type(screen.getByLabelText(/疾病備註/), '每日服藥')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    expect(await screen.findByText('已新增「高血壓」')).toBeInTheDocument()
    expect(await screen.findByText('高血壓 · 穩定控制中 · 每日服藥')).toBeInTheDocument()
    // 送出後表單清空，回到新增模式
    expect(screen.getByLabelText('疾病名稱')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: '編輯 高血壓' }))
    expect(screen.getByLabelText('疾病名稱')).toHaveValue('高血壓')
    await user.selectOptions(screen.getByLabelText('狀態'), '治療中／有症狀')
    await user.click(screen.getByRole('button', { name: '更新疾病' }))
    expect(await screen.findByText('高血壓 · 治療中／有症狀 · 每日服藥')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(1) // 更新而不是新增一筆

    await user.click(screen.getByRole('button', { name: '刪除 高血壓' }))
    expect(await screen.findByText('已刪除「高血壓」')).toBeInTheDocument()
    expect(await db.conditions.count()).toBe(0)
  })

  it('刪除正在編輯的疾病後，表單回到新增模式', async () => {
    const user = userEvent.setup()
    render(<App />)

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

    await user.type(await screen.findByLabelText('疾病名稱'), '高血壓')
    await user.click(screen.getByRole('button', { name: '新增疾病' }))
    await user.type(screen.getByLabelText('身高（cm）'), '175')
    await user.click(screen.getByRole('button', { name: '儲存基本資料' }))
    await user.type(screen.getByLabelText('體重（kg）'), '70')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)

    await user.click(screen.getByRole('button', { name: '產生 AI 提示詞' }))

    const prompt = (await screen.findByLabelText('提示詞')) as HTMLTextAreaElement
    expect(prompt.value).toContain('- 高血壓（穩定控制中）')
    expect(prompt.value).toContain('- 身高：175 cm')
  })

  it('匯入含疾病的備份後顯示在清單', async () => {
    const user = userEvent.setup()
    render(<App />)

    const backup = serializeBackup({
      entries: [],
      conditions: [{ id: 'c1', name: '胃食道逆流', status: 'active' }],
    })
    await user.upload(
      await screen.findByLabelText('匯入備份'),
      new File([backup], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('已匯入 0 筆紀錄與 1 項疾病')).toBeInTheDocument()
    expect(await screen.findByText('胃食道逆流 · 治療中／有症狀')).toBeInTheDocument()
  })
})

describe('基本資料', () => {
  it('儲存生日、身高、性別', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('生日'), '1990-05-20')
    await user.type(screen.getByLabelText('身高（cm）'), '175.5')
    await user.selectOptions(screen.getByLabelText('性別'), '女')
    await user.click(screen.getByRole('button', { name: '儲存基本資料' }))

    expect(await screen.findByText('已儲存基本資料')).toBeInTheDocument()
    expect(await getProfile()).toEqual({ birthday: '1990-05-20', heightCm: 175.5, sex: 'female' })
  })

  it('開啟時載入已儲存的資料', async () => {
    await db.profile.put({ id: 'me', birthday: '1990-05-20', heightCm: 175 })
    render(<App />)

    expect(await screen.findByLabelText('生日')).toHaveValue('1990-05-20')
    expect(screen.getByLabelText('身高（cm）')).toHaveValue(175)
  })

  it('匯入備份覆蓋基本資料時，表單跟著更新', async () => {
    const user = userEvent.setup()
    await db.profile.put({ id: 'me', heightCm: 170 })
    render(<App />)
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
