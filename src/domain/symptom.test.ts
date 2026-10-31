import { describe, expect, it } from 'vitest'
import type { Entry, SymptomItem } from './entry'
import {
  PRESET_SYMPTOMS,
  addSymptom,
  collectSymptomNames,
  setSeverity,
  toggleSymptom,
} from './symptom'

const entry = (date: string, symptomItems: SymptomItem[]): Entry => ({
  date,
  meals: [],
  bowel: [],
  symptomItems,
})

describe('collectSymptomNames', () => {
  it('沒有紀錄時就是預設症狀', () => {
    expect(collectSymptomNames([])).toEqual([...PRESET_SYMPTOMS])
  })

  it('預設症狀固定在前，過去用過的其他症狀接在後面，不重複並依名稱排序', () => {
    const names = collectSymptomNames([
      entry('2026-10-28', [{ name: '耳鳴', severity: 1 }]),
      entry('2026-10-29', [
        { name: '頭痛', severity: 2 },
        { name: '手麻', severity: 1 },
        { name: '耳鳴', severity: 3 },
      ]),
    ])
    expect(names.slice(0, PRESET_SYMPTOMS.length)).toEqual([...PRESET_SYMPTOMS])
    expect(names.slice(PRESET_SYMPTOMS.length)).toEqual(
      ['耳鳴', '手麻'].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
    )
  })

  it('舊紀錄沒有 symptomItems 也沒問題', () => {
    expect(collectSymptomNames([{ date: '2026-10-01', meals: [], bowel: [] }])).toEqual([
      ...PRESET_SYMPTOMS,
    ])
  })
})

describe('toggleSymptom', () => {
  it('沒選就加入，預設輕；已選就取消，其他症狀不動', () => {
    const added = toggleSymptom([{ name: '鼻塞', severity: 2 }], '頭痛')
    expect(added).toEqual([
      { name: '鼻塞', severity: 2 },
      { name: '頭痛', severity: 1 },
    ])
    expect(toggleSymptom(added, '頭痛')).toEqual([{ name: '鼻塞', severity: 2 }])
  })
})

describe('addSymptom', () => {
  it('去掉頭尾空白後加入，預設輕', () => {
    expect(addSymptom([], '  耳鳴 ')).toEqual([{ name: '耳鳴', severity: 1 }])
  })

  it('空白或已經選過的不重複加入，也不改掉原本的程度', () => {
    const items: SymptomItem[] = [{ name: '耳鳴', severity: 3 }]
    expect(addSymptom(items, '   ')).toBe(items)
    expect(addSymptom(items, '耳鳴')).toBe(items)
  })
})

describe('setSeverity', () => {
  it('只改指定症狀的程度', () => {
    const items: SymptomItem[] = [
      { name: '頭痛', severity: 1 },
      { name: '鼻塞', severity: 1 },
    ]
    expect(setSeverity(items, '鼻塞', 3)).toEqual([
      { name: '頭痛', severity: 1 },
      { name: '鼻塞', severity: 3 },
    ])
  })
})
