/** 預設選項固定在前，過去用過的其他選項接在後面（不重複、依名稱排序） */
export function collectNames(presets: readonly string[], used: Iterable<string>): string[] {
  const extras = new Set<string>()
  for (const name of used) if (!presets.includes(name)) extras.add(name)
  return [...presets, ...[...extras].sort((a, b) => a.localeCompare(b, 'zh-Hant'))]
}
