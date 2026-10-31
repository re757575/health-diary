import type { Entry, SymptomItem, SymptomSeverity } from './entry'

/** 預設的常用症狀；順序固定，點選的位置才不會變 */
export const PRESET_SYMPTOMS = [
  '頭痛',
  '鼻塞',
  '喉嚨痛',
  '腰痠',
  '腹脹',
  '胃痛',
  '噁心',
  '疲倦',
] as const

/** 預設症狀之後，接上過去紀錄裡出現過的其他症狀（依名稱排序） */
export function collectSymptomNames(entries: Entry[]): string[] {
  const extras = new Set<string>()
  for (const entry of entries) {
    for (const { name } of entry.symptomItems ?? []) {
      if (!(PRESET_SYMPTOMS as readonly string[]).includes(name)) extras.add(name)
    }
  }
  return [...PRESET_SYMPTOMS, ...[...extras].sort((a, b) => a.localeCompare(b, 'zh-Hant'))]
}

/** 點選症狀：沒選就加入（預設輕），已選就取消 */
export function toggleSymptom(items: SymptomItem[], name: string): SymptomItem[] {
  return items.some((i) => i.name === name)
    ? items.filter((i) => i.name !== name)
    : [...items, { name, severity: 1 }]
}

/** 自己輸入的症狀：名稱去掉頭尾空白，空白或已選過的不重複加入 */
export function addSymptom(items: SymptomItem[], name: string): SymptomItem[] {
  const trimmed = name.trim()
  if (trimmed === '' || items.some((i) => i.name === trimmed)) return items
  return [...items, { name: trimmed, severity: 1 }]
}

export function setSeverity(
  items: SymptomItem[],
  name: string,
  severity: SymptomSeverity,
): SymptomItem[] {
  return items.map((i) => (i.name === name ? { ...i, severity } : i))
}
