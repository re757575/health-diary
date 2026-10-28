import { beforeEach, describe, expect, it } from 'vitest'
import type { Condition } from '@/domain/condition'
import type { Entry } from '@/domain/entry'
import { db } from './db'
import {
  deleteCondition,
  deleteEntry,
  getEntry,
  getProfile,
  importBackup,
  listConditions,
  listEntries,
  saveCondition,
  saveEntry,
  saveProfile,
} from './repository'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

const condition = (id: string, name: string, extra: Partial<Condition> = {}): Condition => ({
  id,
  name,
  status: 'managed',
  ...extra,
})

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.conditions.clear(), db.profile.clear()])
})

describe('紀錄', () => {
  it('依日期由新到舊列出', async () => {
    await saveEntry(entry('2026-10-26'))
    await saveEntry(entry('2026-10-28'))
    await saveEntry(entry('2026-10-27'))
    expect((await listEntries()).map((e) => e.date)).toEqual([
      '2026-10-28',
      '2026-10-27',
      '2026-10-26',
    ])
  })

  it('同一天再存會覆蓋', async () => {
    await saveEntry(entry('2026-10-28', { weightKg: 70 }))
    await saveEntry(entry('2026-10-28', { weightKg: 69 }))
    expect(await listEntries()).toHaveLength(1)
    expect((await getEntry('2026-10-28'))?.weightKg).toBe(69)
  })

  it('刪除後讀不到', async () => {
    await saveEntry(entry('2026-10-28'))
    await deleteEntry('2026-10-28')
    expect(await getEntry('2026-10-28')).toBeUndefined()
  })
})

describe('已知疾病', () => {
  it('新增後可列出，同 id 再存會更新', async () => {
    await saveCondition(condition('c1', '高血壓'))
    await saveCondition(condition('c1', '高血壓', { notes: '每日服藥' }))
    const all = await listConditions()
    expect(all).toHaveLength(1)
    expect(all[0].notes).toBe('每日服藥')
  })

  it('刪除後不再列出', async () => {
    await saveCondition(condition('c1', '高血壓'))
    await saveCondition(condition('c2', '胃食道逆流'))
    await deleteCondition('c1')
    expect((await listConditions()).map((c) => c.id)).toEqual(['c2'])
  })
})

describe('基本資料', () => {
  it('尚未填寫時回傳 undefined', async () => {
    expect(await getProfile()).toBeUndefined()
  })

  it('儲存後讀回，且不含內部使用的 id；再存會整份覆蓋', async () => {
    await saveProfile({ birthday: '1990-05-20', heightCm: 175 })
    expect(await getProfile()).toEqual({ birthday: '1990-05-20', heightCm: 175 })

    await saveProfile({ heightCm: 176 })
    expect(await getProfile()).toEqual({ heightCm: 176 })
  })
})

describe('importBackup', () => {
  it('同日期／同 id 覆蓋，其餘既有資料保留', async () => {
    await saveEntry(entry('2026-10-27', { weightKg: 70 }))
    await saveEntry(entry('2026-10-28', { weightKg: 70 }))
    await saveCondition(condition('c1', '高血壓'))
    await saveCondition(condition('c2', '胃食道逆流'))

    await importBackup({
      entries: [entry('2026-10-28', { weightKg: 68 }), entry('2026-10-29', { weightKg: 67 })],
      conditions: [condition('c1', '高血壓', { status: 'active' })],
    })

    const weights = Object.fromEntries((await listEntries()).map((e) => [e.date, e.weightKg]))
    expect(weights).toEqual({ '2026-10-27': 70, '2026-10-28': 68, '2026-10-29': 67 })
    const statuses = Object.fromEntries((await listConditions()).map((c) => [c.id, c.status]))
    expect(statuses).toEqual({ c1: 'active', c2: 'managed' })
  })

  it('備份有基本資料就覆蓋；沒有就保留現有的', async () => {
    await saveProfile({ heightCm: 170 })

    await importBackup({ entries: [], conditions: [] })
    expect(await getProfile()).toEqual({ heightCm: 170 })

    await importBackup({ entries: [], conditions: [], profile: { heightCm: 175, sex: 'female' } })
    expect(await getProfile()).toEqual({ heightCm: 175, sex: 'female' })
  })
})
