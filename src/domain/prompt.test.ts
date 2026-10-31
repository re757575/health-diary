import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { buildAnalysisPrompt, recentEntries } from './prompt'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

describe('recentEntries', () => {
  const entries = ['2026-10-21', '2026-10-22', '2026-10-28'].map((d) => entry(d))
  const today = new Date(2026, 9, 28)

  it('含今天往前算 N 天，邊界日期要包含', () => {
    expect(recentEntries(entries, 7, today).map((e) => e.date)).toEqual([
      '2026-10-22',
      '2026-10-28',
    ])
  })

  it('跨月也能正確計算起始日', () => {
    const nov = new Date(2026, 10, 2)
    expect(
      recentEntries([entry('2026-10-31'), entry('2026-10-30')], 3, nov).map((e) => e.date),
    ).toEqual(['2026-10-31'])
  })
})

describe('buildAnalysisPrompt', () => {
  it('沒有紀錄時回傳空字串', () => {
    expect(buildAnalysisPrompt([])).toBe('')
  })

  it('包含分析指示與紀錄期間', () => {
    const prompt = buildAnalysisPrompt([entry('2026-10-28'), entry('2026-10-26')])
    expect(prompt).toContain('請用繁體中文回答')
    expect(prompt).toContain('2026-10-26 ～ 2026-10-28（共 2 天有紀錄）')
  })

  it('每日紀錄依日期由舊到新排列', () => {
    const prompt = buildAnalysisPrompt([entry('2026-10-28'), entry('2026-10-26')])
    expect(prompt.indexOf('## 2026-10-26')).toBeLessThan(prompt.indexOf('## 2026-10-28'))
  })

  it('輸出體重、睡眠時數、餐點與排便', () => {
    const prompt = buildAnalysisPrompt([
      entry('2026-10-28', {
        weightKg: 70.5,
        sleep: { bedtime: '23:30', wakeTime: '07:00', quality: 4 },
        meals: [
          { type: 'breakfast', description: '燕麥奶' },
          { type: 'lunch', description: '   ' },
        ],
        bowel: [{ time: '08:10', bristol: 4 }],
        symptoms: '輕微腹脹',
      }),
    ])
    expect(prompt).toContain('- 體重：70.5 kg')
    expect(prompt).toContain('- 睡眠：23:30 入睡、07:00 起床，共 7.5 小時，品質 4/5')
    expect(prompt).toContain('- 早餐：燕麥奶')
    expect(prompt).not.toContain('午餐')
    expect(prompt).toContain('- 排便 1 次：08:10 布里斯托 4 型')
    expect(prompt).toContain('- 症狀：輕微腹脹')
  })

  describe('資料品質備註', () => {
    const today = new Date(2026, 9, 31)
    const complete = {
      weightKg: 68,
      waterMl: 2000,
      mood: 3,
      sleep: { bedtime: '23:30', wakeTime: '07:00' },
    }

    it('疑似填錯的睡眠時數與漏填的欄位，列在每日紀錄之前', () => {
      const prompt = buildAnalysisPrompt(
        [
          entry('2026-10-28', { ...complete, sleep: { bedtime: '11:50', wakeTime: '07:40' } }),
          entry('2026-10-29', { ...complete, weightKg: undefined }),
          entry('2026-10-30', { ...complete, weightKg: undefined, waterMl: undefined }),
        ],
        { today },
      )
      expect(prompt).toContain('# 資料品質備註')
      expect(prompt).toContain(
        '- 疑似填錯：2026-10-28 睡眠 19.8 小時（11:50 入睡、07:40 起床），可能是上午／下午填反',
      )
      expect(prompt).toContain('- 沒填：體重 2 天（2026-10-29、2026-10-30）')
      expect(prompt).toContain('- 沒填：飲水 1 天（2026-10-30）')
      expect(prompt).not.toContain('- 沒填：心情')
      expect(prompt.indexOf('# 資料品質備註')).toBeLessThan(prompt.indexOf('# 每日紀錄'))
    })

    it('資料都沒問題時不加這一段', () => {
      const prompt = buildAnalysisPrompt([entry('2026-10-28', complete)], { today })
      expect(prompt).not.toContain('資料品質備註')
    })

    it('今天的紀錄可能還在填，不算漏填；但睡眠時數有問題照樣標出', () => {
      const prompt = buildAnalysisPrompt(
        [entry('2026-10-31', { sleep: { bedtime: '11:30', wakeTime: '07:10' } })],
        { today },
      )
      expect(prompt).not.toContain('- 沒填：')
      expect(prompt).toContain('疑似填錯：2026-10-31')
    })

    it('漏填的日子太多時只列前五個，其餘用「等」帶過', () => {
      const days = ['01', '02', '03', '04', '05', '06', '07'].map((d) =>
        entry(`2026-10-${d}`, { ...complete, mood: undefined }),
      )
      const prompt = buildAnalysisPrompt(days, { today })
      expect(prompt).toContain(
        '- 沒填：心情 7 天（2026-10-01、2026-10-02、2026-10-03、2026-10-04、2026-10-05 等）',
      )
    })
  })

  it('運動分鐘與當日狀況標籤', () => {
    const prompt = buildAnalysisPrompt([
      entry('2026-10-28', { exerciseMinutes: 120, tags: ['空氣品質差', '久坐'] }),
      entry('2026-10-29', { exerciseMinutes: 0 }),
    ])
    expect(prompt).toContain('- 運動：120 分鐘')
    expect(prompt).toContain('- 當日狀況：空氣品質差、久坐')
    expect(prompt).toContain('- 運動：0 分鐘')
  })

  it('症狀：點選的項目附上輕／中／重，文字補充接在後面', () => {
    const prompt = buildAnalysisPrompt([
      entry('2026-10-28', {
        symptomItems: [
          { name: '頭痛', severity: 2 },
          { name: '鼻塞', severity: 1 },
        ],
        symptoms: '下午開車時腰椎酸痛',
      }),
      entry('2026-10-29', { symptomItems: [{ name: '腹脹', severity: 3 }] }),
    ])
    expect(prompt).toContain('- 症狀：頭痛（中）、鼻塞（輕）；下午開車時腰椎酸痛')
    expect(prompt).toContain('- 症狀：腹脹（重）')
    expect(prompt).toContain('輕／中／重是我自評的嚴重程度')
  })

  it('有填基本資料與已知疾病時，加上對應段落並算出年齡', () => {
    const prompt = buildAnalysisPrompt([entry('2026-10-28')], {
      profile: { birthday: '1990-05-20', heightCm: 175, sex: 'male' },
      conditions: [
        { id: 'c1', name: '高血壓', since: '2020-03', status: 'managed', notes: '每日服藥' },
        { id: 'c2', name: '蕁麻疹', status: 'resolved' },
      ],
      today: new Date(2026, 9, 28),
    })
    expect(prompt).toContain('# 基本資料\n- 性別：男\n- 生日：1990-05-20（36 歲）\n- 身高：175 cm')
    expect(prompt).toContain(
      '# 已知疾病\n- 高血壓（2020-03 起，穩定控制中）：每日服藥\n- 蕁麻疹（已痊癒）',
    )
    // 背景資料在每日紀錄之前，AI 才會先讀到
    expect(prompt.indexOf('# 已知疾病')).toBeLessThan(prompt.indexOf('# 每日紀錄'))
  })

  it('沒有填寫時不出現基本資料與已知疾病段落', () => {
    const prompt = buildAnalysisPrompt([entry('2026-10-28')], { profile: {}, conditions: [] })
    expect(prompt).not.toContain('# 基本資料')
    expect(prompt).not.toContain('# 已知疾病')
  })

  it('生日在未來時只列生日，不顯示年齡', () => {
    const prompt = buildAnalysisPrompt([entry('2026-10-28')], {
      profile: { birthday: '2030-01-01' },
      today: new Date(2026, 9, 28),
    })
    expect(prompt).toContain('- 生日：2030-01-01\n')
    expect(prompt).not.toContain('歲')
  })

  it('沒有排便紀錄時明確標示 0 次，讓 AI 知道是沒排便而不是漏記', () => {
    expect(buildAnalysisPrompt([entry('2026-10-28')])).toContain('- 排便：0 次')
  })
})
