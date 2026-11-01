import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Condition } from '@/domain/condition'
import type { Entry } from '@/domain/entry'
import { db } from './db'
import {
  deleteCondition,
  deleteEntry,
  addFoods,
  deleteFood,
  deleteMedication,
  deleteVisit,
  getEntry,
  getLastBackupAt,
  getProfile,
  importBackup,
  listConditions,
  listEntries,
  listFoods,
  listMedications,
  listVisits,
  recordBackup,
  saveCondition,
  saveEntry,
  saveMedication,
  saveProfile,
  saveVisit,
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
  await Promise.all([
    db.entries.clear(),
    db.conditions.clear(),
    db.profile.clear(),
    db.meta.clear(),
    db.medications.clear(),
    db.foods.clear(),
    db.visits.clear(),
  ])
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

describe('症狀項目與資料庫升版', () => {
  it('症狀項目存進去、讀出來內容不變', async () => {
    const symptomItems = [
      { name: '頭痛', severity: 2 as const },
      { name: '耳鳴', severity: 1 as const },
    ]
    await saveEntry(entry('2026-10-28', { symptomItems }))
    expect((await getEntry('2026-10-28'))?.symptomItems).toEqual(symptomItems)
  })

  it('資料庫版本是 8（v7 新增常吃的食物清單，v8 新增就醫紀錄）', () => {
    // Dexie 內部版本是宣告的 10 倍；verno 回傳宣告的版本
    expect(db.verno).toBe(8)
  })

  it('v2 時代存的舊資料升版後仍在，沒有症狀項目', async () => {
    db.close()
    await Dexie.delete('health-diary')
    const old = new Dexie('health-diary')
    old.version(1).stores({ entries: 'date' })
    old.version(2).stores({ entries: 'date', conditions: 'id', profile: 'id' })
    await old.table('entries').put({
      date: '2026-10-28',
      meals: [],
      bowel: [],
      symptoms: '頭有點痛',
    })
    await old.table('conditions').put({ id: 'c1', name: '過敏性鼻炎', status: 'managed' })
    old.close()

    await db.open()

    expect(await getEntry('2026-10-28')).toEqual({
      date: '2026-10-28',
      meals: [],
      bowel: [],
      symptoms: '頭有點痛',
    })
    expect(await listConditions()).toHaveLength(1)
  })
})

describe('上次備份時間', () => {
  it('沒備份過是 undefined，記錄後讀得到，再備份會覆蓋', async () => {
    expect(await getLastBackupAt()).toBeUndefined()
    await recordBackup(new Date('2026-10-20T10:00:00Z'))
    await recordBackup(new Date('2026-10-31T10:00:00Z'))
    expect(await getLastBackupAt()).toBe('2026-10-31T10:00:00.000Z')
  })
})

describe('固定用藥', () => {
  it('依開始日期排序列出；可以更新與刪除；匯入備份時一起寫入', async () => {
    await saveMedication({ id: 'b', name: '魚油', startDate: '2026-10-25' })
    await saveMedication({ id: 'a', name: '維他命C', startDate: '2026-10-20' })
    expect((await listMedications()).map((m) => m.id)).toEqual(['a', 'b'])

    await saveMedication({
      id: 'a',
      name: '維他命C',
      startDate: '2026-10-20',
      endDate: '2026-10-30',
    })
    await deleteMedication('b')
    expect(await listMedications()).toEqual([
      { id: 'a', name: '維他命C', startDate: '2026-10-20', endDate: '2026-10-30' },
    ])

    await importBackup({
      entries: [],
      conditions: [],
      medications: [{ id: 'c', name: '鈣片', startDate: '2026-11-01' }],
    })
    expect((await listMedications()).map((m) => m.id)).toEqual(['a', 'c'])
  })
})

describe('就醫紀錄', () => {
  it('由新到舊列出；可以更新與刪除；匯入備份時同 id 覆蓋、其餘保留', async () => {
    await saveVisit({ id: 'a', date: '2026-10-01', facility: '安心診所' })
    await saveVisit({ id: 'b', date: '2026-10-20', facility: '台大醫院' })
    expect((await listVisits()).map((v) => v.id)).toEqual(['b', 'a'])

    await saveVisit({ id: 'a', date: '2026-10-01', facility: '安心診所', diagnosis: '感冒' })
    await deleteVisit('b')
    expect(await listVisits()).toEqual([
      { id: 'a', date: '2026-10-01', facility: '安心診所', diagnosis: '感冒' },
    ])

    await importBackup({
      entries: [],
      conditions: [],
      visits: [
        { id: 'a', date: '2026-10-01', facility: '安心診所', diagnosis: '過敏性鼻炎' },
        { id: 'c', date: '2026-10-30', facility: '台大醫院' },
      ],
    })
    expect((await listVisits()).map((v) => [v.id, v.diagnosis])).toEqual([
      ['c', undefined],
      ['a', '過敏性鼻炎'],
    ])
  })
})

describe('常吃的食物', () => {
  it('依加入順序列出；已在清單的略過並回報實際新增幾項；可以刪除', async () => {
    expect(await addFoods(['燕麥', '香蕉'])).toBe(2)
    expect(await addFoods(['香蕉', '地瓜'])).toBe(1)
    expect(await listFoods()).toEqual(['燕麥', '香蕉', '地瓜'])

    await deleteFood('香蕉')
    expect(await listFoods()).toEqual(['燕麥', '地瓜'])
  })

  it('寫法稍有不同（全形半形、大小寫）的也算已在清單裡，保留原本的寫法', async () => {
    await addFoods(['魯肉飯（小）', 'DHC乳清'])
    expect(await addFoods(['魯肉飯(小)', 'ｄｈｃ乳清', '燕麥', '燕麥'])).toBe(1)
    expect(await listFoods()).toEqual(['魯肉飯（小）', 'DHC乳清', '燕麥'])
  })

  it('匯入備份時合併食物清單，不重複', async () => {
    await addFoods(['燕麥'])
    await importBackup({ entries: [], conditions: [], foods: ['燕麥', '雞胸肉'] })
    expect(await listFoods()).toEqual(['燕麥', '雞胸肉'])
  })
})

describe('升到 v7：舊的文字餐點自動拆成食物', () => {
  it('v6 時代整段文字的餐點，升版後變成一項項的食物，地點移到備註', async () => {
    db.close()
    await Dexie.delete('health-diary')
    const old = new Dexie('health-diary')
    old.version(6).stores({
      entries: 'date',
      conditions: 'id',
      profile: 'id',
      meta: 'key',
      medications: 'id',
    })
    await old.table('entries').put({
      date: '2026-10-28',
      meals: [
        { type: 'lunch', description: '外食：蒸餃x9 魯肉飯小' },
        { type: 'dinner', description: '白飯1碗 青菜一碗' },
      ],
      bowel: [],
    })
    old.close()

    await db.open()

    expect((await getEntry('2026-10-28'))?.meals).toEqual([
      {
        type: 'lunch',
        items: [
          { name: '蒸餃', amount: 9, unit: '份' },
          { name: '魯肉飯（小）', amount: 1, unit: '份' },
        ],
        description: '外食',
      },
      {
        type: 'dinner',
        items: [
          { name: '白飯', amount: 1, unit: '碗' },
          { name: '青菜', amount: 1, unit: '碗' },
        ],
      },
    ])
  })
})
