import { CONDITION_STATUS_LABELS, type Condition } from './condition'
import { MEAL_LABELS, sleepHours, type Entry } from './entry'
import { SEX_LABELS, ageOn, type Profile } from './profile'
import { toDateString } from './form'

const INSTRUCTIONS = `你是一位細心的健康數據分析助理。以下是我的每日飲食與健康紀錄，請協助分析：

1. 找出飲食、睡眠、排便、體重、心情／症狀之間可能的關聯與規律（例如某些食物後隔天的排便或症狀變化）。若有提供「基本資料」與「已知疾病」，請納入考量。
2. 指出值得留意的異常或趨勢，並說明你判斷的依據（引用日期與數值）。
3. 資料不足以下結論的地方請明說，不要臆測。
4. 提出可以進一步追蹤或調整的具體建議，以及需要補充記錄的項目。
5. 你的分析僅供參考，若有持續或嚴重的症狀，請提醒我諮詢醫師。

請用繁體中文回答。`

function formatEntry(entry: Entry): string {
  const lines: string[] = [`## ${entry.date}`]

  if (entry.weightKg !== undefined) lines.push(`- 體重：${entry.weightKg} kg`)

  const hours = sleepHours(entry.sleep)
  if (entry.sleep && (hours !== undefined || entry.sleep.quality !== undefined)) {
    const parts: string[] = []
    if (entry.sleep.bedtime && entry.sleep.wakeTime) {
      parts.push(`${entry.sleep.bedtime} 入睡、${entry.sleep.wakeTime} 起床`)
    }
    if (hours !== undefined) parts.push(`共 ${hours} 小時`)
    if (entry.sleep.quality !== undefined) parts.push(`品質 ${entry.sleep.quality}/5`)
    lines.push(`- 睡眠：${parts.join('，')}`)
  }

  for (const meal of entry.meals) {
    if (meal.description.trim()) {
      lines.push(`- ${MEAL_LABELS[meal.type]}：${meal.description.trim()}`)
    }
  }

  if (entry.waterMl !== undefined) lines.push(`- 飲水：${entry.waterMl} ml`)

  if (entry.bowel.length > 0) {
    const items = entry.bowel.map((b) =>
      [b.time, b.bristol !== undefined ? `布里斯托 ${b.bristol} 型` : undefined, b.note]
        .filter(Boolean)
        .join(' '),
    )
    lines.push(`- 排便 ${entry.bowel.length} 次：${items.join('；')}`)
  } else {
    lines.push('- 排便：0 次')
  }

  if (entry.mood !== undefined) lines.push(`- 心情／精神：${entry.mood}/5`)
  if (entry.symptoms?.trim()) lines.push(`- 症狀：${entry.symptoms.trim()}`)
  if (entry.notes?.trim()) lines.push(`- 備註：${entry.notes.trim()}`)

  return lines.join('\n')
}

/** 取 `today` 往前算 `days` 天（含今天）內的紀錄 */
export function recentEntries(entries: Entry[], days: number, today: Date): Entry[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const startDate = toDateString(start)
  return entries.filter((e) => e.date >= startDate)
}

function formatCondition(condition: Condition): string {
  const details = [
    condition.since ? `${condition.since} 起` : undefined,
    CONDITION_STATUS_LABELS[condition.status],
  ].filter(Boolean)
  const notes = condition.notes?.trim()
  return `- ${condition.name}（${details.join('，')}）${notes ? `：${notes}` : ''}`
}

function formatProfile(profile: Profile | undefined, today: Date): string | undefined {
  if (!profile) return undefined
  const lines: string[] = []
  if (profile.sex) lines.push(`- 性別：${SEX_LABELS[profile.sex]}`)
  if (profile.birthday) {
    const age = ageOn(profile.birthday, today)
    lines.push(`- 生日：${profile.birthday}${age !== undefined ? `（${age} 歲）` : ''}`)
  }
  if (profile.heightCm !== undefined) lines.push(`- 身高：${profile.heightCm} cm`)
  return lines.length > 0 ? `# 基本資料\n${lines.join('\n')}` : undefined
}

export interface PromptOptions {
  /** 已知疾病；有填寫才會加上「已知疾病」段落 */
  conditions?: Condition[]
  /** 基本資料；全部沒填就不會加上「基本資料」段落 */
  profile?: Profile
  /** 計算年齡的基準日，預設為現在 */
  today?: Date
}

/**
 * 產生可直接貼給 AI 的分析提示詞。
 * @param entries 要分析的紀錄（任意順序，輸出依日期由舊到新）
 */
export function buildAnalysisPrompt(
  entries: Entry[],
  { conditions = [], profile, today = new Date() }: PromptOptions = {},
): string {
  if (entries.length === 0) return ''
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const range = `${sorted[0].date} ～ ${sorted[sorted.length - 1].date}（共 ${sorted.length} 天有紀錄）`
  const profileSection = formatProfile(profile, today)
  return [
    INSTRUCTIONS,
    ...(profileSection ? [profileSection] : []),
    ...(conditions.length > 0 ? [`# 已知疾病\n${conditions.map(formatCondition).join('\n')}`] : []),
    `# 紀錄期間\n${range}`,
    '# 每日紀錄',
    sorted.map(formatEntry).join('\n\n'),
  ].join('\n\n')
}
