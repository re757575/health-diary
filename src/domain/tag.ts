import { collectNames } from './choice'
import type { Entry } from './entry'

/** 當天的狀況標籤：會影響身體感受的環境與行為，預設七項 */
export const PRESET_TAGS = [
  '空氣品質差',
  '久坐',
  '搬重物',
  '沒午休',
  '壓力大',
  '咖啡因多',
  '飲酒',
] as const

/** 預設標籤之後，接上過去紀錄裡出現過的其他標籤 */
export function collectTagNames(entries: Entry[]): string[] {
  return collectNames(
    PRESET_TAGS,
    entries.flatMap((e) => e.tags ?? []),
  )
}

/** 點選標籤：沒選就加入，已選就取消 */
export function toggleTag(tags: string[], name: string): string[] {
  return tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name]
}

/** 自己輸入的標籤：去掉頭尾空白，空白或已選過的不重複加入 */
export function addTag(tags: string[], name: string): string[] {
  const trimmed = name.trim()
  return trimmed === '' || tags.includes(trimmed) ? tags : [...tags, trimmed]
}
