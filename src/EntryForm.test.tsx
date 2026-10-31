import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { getEntry, saveEntry } from '@/data/repository'
import { BRISTOL_DESCRIPTIONS, MOOD_DESCRIPTIONS, SLEEP_QUALITY_DESCRIPTIONS } from '@/domain/entry'
import { emptyForm } from '@/domain/form'
import { render } from '@/test/render'
import { EntryForm } from './EntryForm'

const DATE = '2026-10-29'

beforeEach(async () => {
  await db.entries.clear()
})

const renderForm = () => render(<EntryForm initial={emptyForm(DATE)} onDateChange={() => {}} />)

const picker = (name: string) => within(screen.getByRole('group', { name }))
const option = (group: string, n: number) => picker(group).getByRole('button', { name: String(n) })

describe('EntryForm：評分按鈕', () => {
  it('睡眠品質、心情、布里斯托都是 1 到 N 的按鈕，一開始都沒選', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: '新增排便' }))

    for (const [group, max] of [
      ['睡眠品質（1–5）', 5],
      ['心情／精神（1–5）', 5],
      ['布里斯托（1–7）', 7],
    ] as const) {
      const buttons = picker(group).getAllByRole('button')
      expect(buttons.map((b) => b.textContent)).toEqual(
        Array.from({ length: max }, (_, i) => String(i + 1)),
      )
      for (const button of buttons) expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('點選後只有該數字被選取，改點別的數字會換掉', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(option('睡眠品質（1–5）', 4))
    expect(option('睡眠品質（1–5）', 4)).toHaveAttribute('aria-pressed', 'true')

    await user.click(option('睡眠品質（1–5）', 2))
    expect(option('睡眠品質（1–5）', 2)).toHaveAttribute('aria-pressed', 'true')
    expect(option('睡眠品質（1–5）', 4)).toHaveAttribute('aria-pressed', 'false')
  })

  it('再點一次已選的數字會取消選取，儲存後該欄位是空的', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(option('心情／精神（1–5）', 3))
    await user.click(option('心情／精神（1–5）', 3))
    expect(option('心情／精神（1–5）', 3)).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    expect((await getEntry(DATE))?.mood).toBeUndefined()
  })

  it('選到的值會跟著紀錄存起來，包含每一筆排便的布里斯托', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(option('睡眠品質（1–5）', 4))
    await user.click(option('心情／精神（1–5）', 5))
    await user.click(screen.getByRole('button', { name: '新增排便' }))
    await user.click(option('布里斯托（1–7）', 6))
    await user.click(screen.getByRole('button', { name: '儲存' }))

    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    const entry = await getEntry(DATE)
    expect(entry?.sleep?.quality).toBe(4)
    expect(entry?.mood).toBe(5)
    expect(entry?.bowel[0]?.bristol).toBe(6)
  })

  it('多筆排便各自獨立選取', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: '新增排便' }))
    await user.click(screen.getByRole('button', { name: '新增排便' }))

    const [first, second] = screen.getAllByRole('group', { name: '布里斯托（1–7）' })
    await user.click(within(first!).getByRole('button', { name: '3' }))

    expect(within(first!).getByRole('button', { name: '3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(second!).getByRole('button', { name: '3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('載入已存的紀錄時，對應的數字是選取狀態', () => {
    render(
      <EntryForm
        initial={{ ...emptyForm(DATE), mood: '2', sleepQuality: '5' }}
        onDateChange={() => {}}
      />,
    )

    expect(option('心情／精神（1–5）', 2)).toHaveAttribute('aria-pressed', 'true')
    expect(option('睡眠品質（1–5）', 5)).toHaveAttribute('aria-pressed', 'true')
  })

  it('滑鼠移到數字上會顯示該分數的說明', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.hover(option('睡眠品質（1–5）', 1))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(SLEEP_QUALITY_DESCRIPTIONS[0])

    await user.unhover(option('睡眠品質（1–5）', 1))
    await user.hover(option('心情／精神（1–5）', 5))
    expect(await screen.findByText(MOOD_DESCRIPTIONS[4])).toBeInTheDocument()
  })

  it('鍵盤聚焦到數字也會顯示說明，布里斯托每一型都有自己的說明', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: '新增排便' }))

    option('布里斯托（1–7）', 4).focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(BRISTOL_DESCRIPTIONS[3])
  })

  it('說明也是按鈕的無障礙描述，讀屏軟體不用靠 tooltip', () => {
    renderForm()

    expect(option('睡眠品質（1–5）', 3)).toHaveAccessibleDescription(SLEEP_QUALITY_DESCRIPTIONS[2])
  })
})

describe('EntryForm：睡眠時數', () => {
  async function fillSleep(
    user: ReturnType<typeof userEvent.setup>,
    bedtime: string,
    wakeTime: string,
  ) {
    await user.type(screen.getByLabelText('入睡時間'), bedtime)
    await user.type(screen.getByLabelText('起床時間'), wakeTime)
  }

  it('填好入睡與起床時間就即時顯示睡眠時數，缺一個時不顯示', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('入睡時間'), '23:30')
    expect(screen.queryByText(/^睡 .* 小時/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('起床時間'), '07:00')
    expect(screen.getByText('睡 7.5 小時')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('起床時間'))
    expect(screen.queryByText(/^睡 .* 小時/)).not.toBeInTheDocument()
  })

  it('12 小時以內不提示，儲存一次就成功', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillSleep(user, '22:00', '10:00')
    expect(screen.getByText('睡 12 小時')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '儲存' }))

    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    expect((await getEntry(DATE))?.sleep).toMatchObject({ bedtime: '22:00', wakeTime: '10:00' })
  })

  it('超過 12 小時會提示可能填錯，第一次儲存不寫入，確認後再按才存', async () => {
    const user = userEvent.setup()
    renderForm()

    // 入睡 23:50 誤填成 11:50（上午），算出來 19.8 小時
    await fillSleep(user, '11:50', '07:40')
    expect(screen.getByText(/睡 19\.8 小時，時間是不是填錯了/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByRole('status')).toHaveTextContent('睡眠 19.8 小時，請確認入睡與起床時間')
    expect(await getEntry(DATE)).toBeUndefined()

    await user.click(screen.getByRole('button', { name: '睡眠 19.8 小時無誤，儲存' }))
    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    expect((await getEntry(DATE))?.sleep).toMatchObject({ bedtime: '11:50', wakeTime: '07:40' })
  })

  it('警告後改正時間，就不需要再確認，一次儲存即可', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillSleep(user, '11:50', '07:40')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await getEntry(DATE)).toBeUndefined()

    await user.clear(screen.getByLabelText('入睡時間'))
    await user.type(screen.getByLabelText('入睡時間'), '23:50')
    expect(screen.getByText('睡 7.8 小時')).toBeInTheDocument()
    expect(screen.queryByText(/是不是填錯了/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    expect((await getEntry(DATE))?.sleep?.bedtime).toBe('23:50')
  })

  it('確認過之後又改了時間且仍超過 12 小時，要重新確認', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillSleep(user, '11:50', '07:40')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByRole('button', { name: '睡眠 19.8 小時無誤，儲存' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('起床時間'))
    await user.type(screen.getByLabelText('起床時間'), '07:50')
    expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await getEntry(DATE)).toBeUndefined()
  })
})

describe('EntryForm：快速輸入', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('飲水 +250 ml 從空白開始累加，也能接在手動輸入的數字後面', async () => {
    const user = userEvent.setup()
    renderForm()
    const water = screen.getByLabelText('飲水（ml）')
    const add = screen.getByRole('button', { name: '飲水加 250 ml' })

    await user.click(add)
    await user.click(add)
    expect(water).toHaveValue(500)

    await user.clear(water)
    await user.type(water, '1000')
    await user.click(add)
    expect(water).toHaveValue(1250)

    await user.click(screen.getByRole('button', { name: '儲存' }))
    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    expect((await getEntry(DATE))?.waterMl).toBe(1250)
  })

  it('「現在」按鈕把入睡、起床時間填成目前的本地時間', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 31, 7, 5))
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: '填入現在時刻：起床' }))
    expect(screen.getByLabelText('起床時間')).toHaveValue('07:05')
    expect(screen.getByLabelText('入睡時間')).toHaveValue('')

    vi.setSystemTime(new Date(2026, 9, 31, 23, 40))
    await user.click(screen.getByRole('button', { name: '填入現在時刻：入睡' }))
    expect(screen.getByLabelText('入睡時間')).toHaveValue('23:40')
  })

  it('每一筆排便各自有「現在」按鈕，只改自己那一筆', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 31, 8, 15))
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: '新增排便' }))
    await user.click(screen.getByRole('button', { name: '新增排便' }))

    await user.click(screen.getByRole('button', { name: '填入現在時刻：第 2 次排便' }))

    const times = screen.getAllByLabelText('時間')
    expect(times[0]).toHaveValue('')
    expect(times[1]).toHaveValue('08:15')
  })

  describe('複製前一天的餐點', () => {
    const copy = () => screen.getByRole('button', { name: '複製前一天的餐點' })

    it('把前一天的餐點帶進空著的餐別，不帶體重、飲水等每天不同的欄位', async () => {
      await saveEntry({
        date: '2026-10-28',
        weightKg: 68,
        waterMl: 2000,
        meals: [
          { type: 'breakfast', description: '豆漿 蛋餅' },
          { type: 'dinner', description: '白飯 青菜' },
        ],
        bowel: [{ time: '08:15', bristol: 3 }],
      })
      const user = userEvent.setup()
      renderForm()

      await user.click(copy())

      expect(screen.getByLabelText('早餐')).toHaveValue('豆漿 蛋餅')
      expect(screen.getByLabelText('晚餐')).toHaveValue('白飯 青菜')
      expect(screen.getByLabelText('午餐')).toHaveValue('')
      expect(screen.getByLabelText('體重（kg）')).toHaveValue(null)
      expect(screen.getByLabelText('飲水（ml）')).toHaveValue(null)
      expect(screen.queryByLabelText('時間')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('已帶入 2026-10-28 的 2 個餐別')
      // 帶入只是填進表單，按儲存才會寫入
      expect(await getEntry(DATE)).toBeUndefined()
    })

    it('已經打了字的餐別不會被蓋掉', async () => {
      await saveEntry({
        date: '2026-10-28',
        meals: [
          { type: 'breakfast', description: '昨天的早餐' },
          { type: 'lunch', description: '昨天的午餐' },
        ],
        bowel: [],
      })
      const user = userEvent.setup()
      renderForm()
      await user.type(screen.getByLabelText('早餐'), '今天的早餐')

      await user.click(copy())

      expect(screen.getByLabelText('早餐')).toHaveValue('今天的早餐')
      expect(screen.getByLabelText('午餐')).toHaveValue('昨天的午餐')
      expect(screen.getByRole('status')).toHaveTextContent('已帶入 2026-10-28 的 1 個餐別')
    })

    it('所有餐別都已有內容時不帶入，並說明原因', async () => {
      await saveEntry({
        date: '2026-10-28',
        meals: [{ type: 'breakfast', description: '昨天的早餐' }],
        bowel: [],
      })
      const user = userEvent.setup()
      renderForm()
      await user.type(screen.getByLabelText('早餐'), '今天的早餐')

      await user.click(copy())

      expect(screen.getByLabelText('早餐')).toHaveValue('今天的早餐')
      expect(screen.getByRole('status')).toHaveTextContent('餐點欄位都已有內容，沒有帶入')
    })

    it('前一天沒有紀錄，或只有體重沒有餐點時，說明沒有可帶入的餐點', async () => {
      const user = userEvent.setup()
      renderForm()

      await user.click(copy())
      expect(screen.getByRole('status')).toHaveTextContent('2026-10-28 沒有餐點紀錄')

      await saveEntry({ date: '2026-10-28', weightKg: 68, meals: [], bowel: [] })
      await user.click(copy())
      expect(screen.getByRole('status')).toHaveTextContent('2026-10-28 沒有餐點紀錄')
      expect(screen.getByLabelText('早餐')).toHaveValue('')
    })
  })
})

describe('EntryForm：症狀', () => {
  const symptomButton = (name: string) => screen.getByRole('button', { name, pressed: undefined })
  const severity = (symptom: string, label: string) =>
    within(screen.getByRole('group', { name: `${symptom}的嚴重程度` })).getByRole('button', {
      name: label,
    })

  it('列出預設的常用症狀，一開始都沒選，也沒有嚴重程度的選項', () => {
    renderForm()

    const group = within(screen.getByRole('group', { name: '症狀' }))
    expect(group.getAllByRole('button').map((b) => b.textContent)).toContain('頭痛')
    for (const button of group.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.queryByRole('group', { name: /的嚴重程度/ })).not.toBeInTheDocument()
  })

  it('點選症狀後預設輕，可改成中或重，再點一次症狀就取消', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(symptomButton('頭痛'))
    expect(symptomButton('頭痛')).toHaveAttribute('aria-pressed', 'true')
    expect(severity('頭痛', '輕')).toHaveAttribute('aria-pressed', 'true')

    await user.click(severity('頭痛', '重'))
    expect(severity('頭痛', '重')).toHaveAttribute('aria-pressed', 'true')
    expect(severity('頭痛', '輕')).toHaveAttribute('aria-pressed', 'false')

    await user.click(symptomButton('頭痛'))
    expect(screen.queryByRole('group', { name: '頭痛的嚴重程度' })).not.toBeInTheDocument()
  })

  it('每個症狀的嚴重程度各自獨立，儲存後連同文字補充一起存起來', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(symptomButton('頭痛'))
    await user.click(symptomButton('鼻塞'))
    await user.click(severity('鼻塞', '中'))
    await user.type(screen.getByLabelText('症狀補充'), '下午開車時腰椎酸痛')
    await user.click(screen.getByRole('button', { name: '儲存' }))

    await screen.findByText(`已儲存 ${DATE} 的紀錄`)
    const entry = await getEntry(DATE)
    expect(entry?.symptomItems).toEqual([
      { name: '頭痛', severity: 1 },
      { name: '鼻塞', severity: 2 },
    ])
    expect(entry?.symptoms).toBe('下午開車時腰椎酸痛')
  })

  it('輸入清單裡沒有的症狀：按新增或 Enter 都會加入；Enter 不會送出整張表單', async () => {
    const user = userEvent.setup()
    renderForm()
    const input = screen.getByLabelText('新增其他症狀')

    await user.type(input, '耳鳴{Enter}')
    expect(screen.getByRole('button', { name: '耳鳴' })).toHaveAttribute('aria-pressed', 'true')
    expect(input).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(await getEntry(DATE)).toBeUndefined()

    await user.type(input, '手麻')
    await user.click(screen.getByRole('button', { name: '新增' }))
    expect(screen.getByRole('button', { name: '手麻' })).toHaveAttribute('aria-pressed', 'true')

    // 重複輸入已選的症狀不會多一筆；空白不會新增
    await user.type(input, '耳鳴{Enter}')
    await user.type(input, '   {Enter}')
    expect(screen.getAllByRole('button', { name: '耳鳴' })).toHaveLength(1)
    expect(screen.getAllByRole('group', { name: /的嚴重程度/ })).toHaveLength(2)
  })

  it('自己輸入的症狀可以取消選取', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('新增其他症狀'), '耳鳴{Enter}')
    await user.click(screen.getByRole('button', { name: '耳鳴' }))

    expect(screen.queryByRole('group', { name: '耳鳴的嚴重程度' })).not.toBeInTheDocument()
  })

  it('候選清單用傳進來的 knownSymptoms（過去用過的症狀）', () => {
    render(
      <EntryForm
        initial={emptyForm(DATE)}
        onDateChange={() => {}}
        knownSymptoms={['頭痛', '耳鳴']}
      />,
    )

    const group = within(screen.getByRole('group', { name: '症狀' }))
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['頭痛', '耳鳴'])
  })

  it('載入已存的紀錄時，症狀與嚴重程度是選取狀態；舊紀錄的文字症狀留在補充欄', () => {
    render(
      <EntryForm
        initial={{
          ...emptyForm(DATE),
          symptomItems: [{ name: '頭痛', severity: 3 }],
          symptoms: '喉嚨有點痛',
        }}
        onDateChange={() => {}}
      />,
    )

    expect(symptomButton('頭痛')).toHaveAttribute('aria-pressed', 'true')
    expect(severity('頭痛', '重')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('症狀補充')).toHaveValue('喉嚨有點痛')
  })
})
