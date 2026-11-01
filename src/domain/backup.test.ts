import { describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  backupStatus,
  describeLastBackup,
  parseBackup,
  previewImport,
  serializeBackup,
} from './backup'
import type { Condition } from './condition'
import type { Entry } from './entry'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

const condition: Condition = {
  id: 'c1',
  name: '高血壓',
  since: '2020-03',
  status: 'managed',
  notes: '每日服藥',
}

describe('備份匯出入', () => {
  it('匯出後再匯入得到相同資料（round trip）', () => {
    const data = {
      entries: [
        entry('2026-10-27', {
          weightKg: 70.5,
          meals: [{ type: 'lunch', description: '雞胸便當' }],
        }),
        entry('2026-10-28', { sleep: { bedtime: '23:30', wakeTime: '07:00', quality: 4 } }),
      ],
      conditions: [condition],
      profile: { birthday: '1990-05-20', heightCm: 175, sex: 'male' as const },
    }
    expect(parseBackup(serializeBackup(data))).toEqual({
      ok: true,
      medications: [],
      foods: [],
      visits: [],
      ...data,
    })
  })

  it('相容 v2 備份：紀錄沒有症狀項目也能匯入，內容原樣保留', () => {
    const v2 = JSON.stringify({
      app: 'health-diary',
      version: 2,
      exportedAt: '2026-10-31T11:59:34.987Z',
      entries: [entry('2026-10-28', { symptoms: '頭有點痛' })],
      conditions: [condition],
      profile: { birthday: '1990-03-31', heightCm: 171, sex: 'male' },
    })
    const result = parseBackup(v2)
    expect(result.ok && result.entries).toEqual([entry('2026-10-28', { symptoms: '頭有點痛' })])
    expect(result.ok && result.entries[0]?.symptomItems).toBeUndefined()
  })

  it('匯出的是 v3，紀錄裡的症狀、運動、標籤匯出後再匯入不會掉', () => {
    const data = {
      entries: [
        entry('2026-10-28', {
          symptomItems: [{ name: '頭痛', severity: 2 }],
          exerciseMinutes: 120,
          tags: ['空氣品質差'],
        }),
      ],
      conditions: [],
    }
    const text = serializeBackup(data)
    expect(JSON.parse(text).version).toBe(BACKUP_VERSION)
    expect(BACKUP_VERSION).toBe(7)
    expect(parseBackup(text)).toEqual({
      ok: true,
      medications: [],
      foods: [],
      visits: [],
      ...data,
    })
  })

  it('沒有填基本資料時，匯入後 profile 為 undefined（不會蓋掉現有的）', () => {
    const result = parseBackup(serializeBackup({ entries: [], conditions: [] }))
    expect(result.ok && result.profile).toBeUndefined()
  })

  it('匯出時紀錄依日期由舊到新排序', () => {
    const text = serializeBackup({
      entries: [entry('2026-10-28'), entry('2026-10-26')],
      conditions: [],
    })
    const result = parseBackup(text)
    expect(result.ok && result.entries.map((e) => e.date)).toEqual(['2026-10-26', '2026-10-28'])
  })

  it('exportedAt 使用傳入的時間', () => {
    const text = serializeBackup(
      { entries: [], conditions: [] },
      new Date('2026-10-28T00:00:00.000Z'),
    )
    expect(JSON.parse(text).exportedAt).toBe('2026-10-28T00:00:00.000Z')
  })

  it('相容 v1 備份：沒有 conditions 與 profile 時視為空', () => {
    const v1 = JSON.stringify({
      app: 'health-diary',
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      entries: [entry('2026-09-30')],
    })
    const result = parseBackup(v1)
    expect(result).toMatchObject({
      ok: true,
      entries: [entry('2026-09-30')],
      conditions: [],
      medications: [],
    })
  })

  it('拒絕非 JSON 的內容', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: '檔案不是有效的 JSON' })
  })

  it('拒絕不是本 App 的 JSON', () => {
    const result = parseBackup(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
  })

  it('拒絕未知的版本', () => {
    const text = JSON.stringify({
      app: 'health-diary',
      version: 99,
      exportedAt: '2026-10-28T00:00:00.000Z',
      entries: [],
    })
    expect(parseBackup(text).ok).toBe(false)
  })

  it.each([
    ['紀錄', { entries: [entry('2026-10-27'), { date: 'bad', meals: [], bowel: [] }] }],
    ['疾病', { entries: [], conditions: [{ id: 'x', name: '', status: 'managed' }] }],
    ['基本資料', { entries: [], profile: { heightCm: -5 } }],
  ])('%s有任何一筆不合法就整份拒絕', (_name, extra) => {
    const text = JSON.stringify({
      app: 'health-diary',
      version: 2,
      exportedAt: '2026-10-28T00:00:00.000Z',
      ...extra,
    })
    expect(parseBackup(text).ok).toBe(false)
  })
})

describe('備份提醒', () => {
  // 本地時間 2026-10-31 中午
  const now = new Date(2026, 9, 31, 12)
  const daysAgo = (days: number) => new Date(2026, 9, 31 - days, 21).toISOString()

  it('沒有任何紀錄時不提醒', () => {
    expect(backupStatus(undefined, undefined, now)).toEqual({ daysSince: undefined, due: false })
    expect(backupStatus(daysAgo(30), undefined, now).due).toBe(false)
  })

  it('上次備份滿 7 天才提醒，以本地日期計算', () => {
    expect(backupStatus(daysAgo(6), '2026-01-01', now)).toEqual({ daysSince: 6, due: false })
    expect(backupStatus(daysAgo(7), '2026-01-01', now)).toEqual({ daysSince: 7, due: true })
  })

  it('沒備份過時從第一筆紀錄算起，剛開始記錄的前幾天不提醒', () => {
    expect(backupStatus(undefined, '2026-10-25', now)).toEqual({ daysSince: undefined, due: false })
    expect(backupStatus(undefined, '2026-10-24', now).due).toBe(true)
  })

  it('上次備份的說明', () => {
    expect(describeLastBackup(undefined, now)).toBe('還沒有備份過')
    expect(describeLastBackup(new Date(2026, 9, 31, 8).toISOString(), now)).toBe('上次備份：今天')
    expect(describeLastBackup(daysAgo(11), now)).toBe('上次備份：2026-10-20（11 天前）')
  })
})

describe('previewImport', () => {
  it('分出新增的日期與內容不同、會被覆蓋的日期，內容相同的不列入', () => {
    const existing = [entry('2026-10-01', { weightKg: 70 }), entry('2026-10-02', { weightKg: 71 })]
    const incoming = [
      entry('2026-10-03'),
      entry('2026-10-02', { weightKg: 69 }),
      entry('2026-10-01', { weightKg: 70 }),
    ]
    expect(previewImport(incoming, existing)).toEqual({
      added: ['2026-10-03'],
      replaced: ['2026-10-02'],
    })
  })

  it('匯出後原封不動匯入，沒有任何會被覆蓋的日子', () => {
    const existing = [
      entry('2026-10-01', { weightKg: 70, sleep: { bedtime: '23:00', wakeTime: '07:00' } }),
    ]
    const parsed = parseBackup(serializeBackup({ entries: existing, conditions: [] }))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(previewImport(parsed.entries, existing)).toEqual({ added: [], replaced: [] })
  })
})

describe('備份：固定用藥', () => {
  it('固定用藥與每天的沒吃、臨時用藥都會匯出再匯入', () => {
    const medications = [
      { id: 'm1', name: 'DHC 持續型維他命C', dose: '1000mg', startDate: '2026-10-20' },
    ]
    const entries = [
      entry('2026-10-28', { missedMedications: ['m1'], asNeededMedications: ['普拿疼'] }),
    ]
    const parsed = parseBackup(serializeBackup({ entries, conditions: [], medications }))
    expect(parsed).toMatchObject({ ok: true, entries, medications })
  })

  it('v4 以前的備份沒有 medications，視為沒有固定用藥', () => {
    const v4 = JSON.stringify({
      app: 'health-diary',
      version: 4,
      exportedAt: '2026-10-31T00:00:00.000Z',
      entries: [entry('2026-10-28', { noBowel: true })],
      conditions: [],
    })
    expect(parseBackup(v4)).toMatchObject({ ok: true, medications: [] })
  })
})

describe('備份：常吃的食物', () => {
  it('食物清單會匯出再匯入；v5 以前的備份沒有清單，視為空的', () => {
    const foods = ['燕麥', '無糖豆漿']
    expect(parseBackup(serializeBackup({ entries: [], conditions: [], foods }))).toMatchObject({
      ok: true,
      foods,
    })
    const v5 = JSON.stringify({
      app: 'health-diary',
      version: 5,
      exportedAt: '2026-11-01T00:00:00.000Z',
      entries: [],
      conditions: [],
      medications: [],
    })
    expect(parseBackup(v5)).toMatchObject({ ok: true, foods: [] })
  })
})

describe('備份：舊版的文字餐點', () => {
  const backupWith = (version: number, description: string) =>
    JSON.stringify({
      app: 'health-diary',
      version,
      exportedAt: '2026-11-01T00:00:00.000Z',
      entries: [{ date: '2026-10-28', meals: [{ type: 'breakfast', description }], bowel: [] }],
      conditions: [],
    })

  it('v6 以前的備份匯入時把文字餐點拆成食物', () => {
    const parsed = parseBackup(backupWith(5, '豆漿 鮪魚蛋餅'))
    expect(parsed.ok && parsed.entries[0]!.meals).toEqual([
      {
        type: 'breakfast',
        items: [
          { name: '豆漿', amount: 1, unit: '份' },
          { name: '鮪魚蛋餅', amount: 1, unit: '份' },
        ],
      },
    ])
  })

  it('v6 的備份裡只有備註的餐點是刻意的，不拆', () => {
    const parsed = parseBackup(backupWith(6, '外食 早餐店'))
    expect(parsed.ok && parsed.entries[0]!.meals).toEqual([
      { type: 'breakfast', description: '外食 早餐店' },
    ])
  })
})

describe('備份：就醫紀錄', () => {
  it('就醫紀錄會匯出再匯入；v6 以前的備份沒有，視為沒有', () => {
    const visits = [
      {
        id: 'v1',
        date: '2026-10-28',
        facility: '安心診所',
        department: '耳鼻喉科',
        diagnosis: '急性咽喉炎',
        advice: '多喝水',
        followUpDate: '2026-11-04',
      },
    ]
    expect(parseBackup(serializeBackup({ entries: [], conditions: [], visits }))).toMatchObject({
      ok: true,
      visits,
    })

    const v6 = JSON.stringify({
      app: 'health-diary',
      version: 6,
      exportedAt: '2026-10-31T00:00:00.000Z',
      entries: [],
    })
    expect(parseBackup(v6)).toMatchObject({ ok: true, visits: [] })
  })

  it('就醫紀錄有任何一筆不合法就整份拒絕', () => {
    const text = JSON.stringify({
      app: 'health-diary',
      version: 7,
      exportedAt: '2026-10-31T00:00:00.000Z',
      entries: [],
      visits: [{ id: 'v1', date: '2026-10-28', facility: '' }],
    })
    expect(parseBackup(text).ok).toBe(false)
  })
})
