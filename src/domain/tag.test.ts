import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { PRESET_TAGS, addTag, collectTagNames, toggleTag } from './tag'

const entry = (date: string, tags?: string[]): Entry => ({ date, meals: [], bowel: [], tags })

describe('collectTagNames', () => {
  it('沒有紀錄時就是預設標籤', () => {
    expect(collectTagNames([])).toEqual([...PRESET_TAGS])
  })

  it('預設標籤固定在前，過去用過的其他標籤接在後面，不重複；舊紀錄沒有 tags 也沒問題', () => {
    const names = collectTagNames([
      entry('2026-10-26'),
      entry('2026-10-27', ['出差', '久坐']),
      entry('2026-10-28', ['出差']),
    ])
    expect(names).toEqual([...PRESET_TAGS, '出差'])
  })
})

describe('toggleTag', () => {
  it('沒選就加入，已選就取消，其他標籤不動', () => {
    expect(toggleTag(['久坐'], '空氣品質差')).toEqual(['久坐', '空氣品質差'])
    expect(toggleTag(['久坐', '空氣品質差'], '久坐')).toEqual(['空氣品質差'])
  })
})

describe('addTag', () => {
  it('去掉頭尾空白後加入', () => {
    expect(addTag([], ' 出差 ')).toEqual(['出差'])
  })

  it('空白或已經選過的不重複加入', () => {
    const tags = ['出差']
    expect(addTag(tags, '  ')).toBe(tags)
    expect(addTag(tags, '出差')).toBe(tags)
  })
})
