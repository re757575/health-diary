import { describe, expect, it } from 'vitest'
import { BACKUP_VERSION, parseBackup, serializeBackup } from './backup'
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
    expect(parseBackup(serializeBackup(data))).toEqual({ ok: true, ...data })
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
    expect(BACKUP_VERSION).toBe(3)
    expect(parseBackup(text)).toEqual({ ok: true, ...data })
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
    expect(result).toEqual({ ok: true, entries: [entry('2026-09-30')], conditions: [] })
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
