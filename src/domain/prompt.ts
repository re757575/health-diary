import { CONDITION_STATUS_LABELS, type Condition } from './condition'
import { MEAL_LABELS, SEVERITY_LABELS, sleepHours, type Entry } from './entry'
import { formatPeriod, medicationsDuring, type Medication } from './medication'
import { SEX_LABELS, ageOn, type Profile } from './profile'
import { toDateString } from './form'
import { findLongSleeps, missingFields } from './quality'
import { findSuspectWeights, weightOn } from './weight'

const INSTRUCTIONS = `你是一位細心的健康數據分析助理。以下是我的每日飲食與健康紀錄，請協助分析：

1. 找出飲食、睡眠、排便、體重、用藥、心情／症狀之間可能的關聯與規律（例如某些食物後隔天的排便或症狀變化）。症狀後括號內的輕／中／重是我自評的嚴重程度。若有提供「基本資料」、「已知疾病」與「固定服用的藥物與保健食品」，請納入考量。
2. 指出值得留意的異常或趨勢，並說明你判斷的依據（引用日期與數值）。
3. 資料不足以下結論的地方請明說，不要臆測。
4. 提出可以進一步追蹤或調整的具體建議，以及需要補充記錄的項目。
5. 你的分析僅供參考，若有持續或嚴重的症狀，請提醒我諮詢醫師。

請用繁體中文回答。`

/**
 * @param history 全部紀錄，當天沒量體重時沿用之前最近一次的數值
 * @param medicationNames 固定用藥 id → 名稱，用來寫出哪天沒吃；已刪除的藥查不到就略過
 */
function formatEntry(entry: Entry, history: Entry[], medicationNames: Map<string, string>): string {
  const lines: string[] = [`## ${entry.date}`]

  if (entry.weightKg !== undefined) {
    lines.push(`- 體重：${entry.weightKg} kg`)
  } else {
    const carried = weightOn(history, entry.date)
    if (carried) {
      lines.push(`- 體重：${carried.kg} kg（當天沒量，沿用 ${carried.measuredOn} 的數值）`)
    }
  }

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
  if (entry.exerciseMinutes !== undefined) lines.push(`- 運動：${entry.exerciseMinutes} 分鐘`)
  if (entry.tags && entry.tags.length > 0) lines.push(`- 當日狀況：${entry.tags.join('、')}`)

  if (entry.bowel.length > 0) {
    const items = entry.bowel.map((b) =>
      [b.time, b.bristol !== undefined ? `布里斯托 ${b.bristol} 型` : undefined, b.note]
        .filter(Boolean)
        .join(' '),
    )
    lines.push(`- 排便 ${entry.bowel.length} 次：${items.join('；')}`)
  } else {
    // 沒有排便紀錄可能是沒排便、也可能是忘了填，只有使用者確認過才說 0 次
    lines.push(entry.noBowel ? '- 排便：0 次（確認當天沒有排便）' : '- 排便：未記錄')
  }

  if (entry.mood !== undefined) lines.push(`- 心情／精神：${entry.mood}/5`)
  const symptoms = [
    entry.symptomItems?.map((i) => `${i.name}（${SEVERITY_LABELS[i.severity]}）`).join('、'),
    entry.symptoms?.trim(),
  ].filter(Boolean)
  if (symptoms.length > 0) lines.push(`- 症狀：${symptoms.join('；')}`)
  const missed = (entry.missedMedications ?? []).flatMap((id) => medicationNames.get(id) ?? [])
  if (missed.length > 0) lines.push(`- 固定用藥沒吃：${missed.join('、')}`)
  if (entry.asNeededMedications?.length) {
    lines.push(`- 臨時用藥：${entry.asNeededMedications.join('、')}`)
  }
  if (entry.notes?.trim()) lines.push(`- 備註：${entry.notes.trim()}`)

  return lines.join('\n')
}

/** 取 `today` 往前算 `days` 天（含今天）內的紀錄 */
export function recentEntries(entries: Entry[], days: number, today: Date): Entry[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const startDate = toDateString(start)
  return entries.filter((e) => e.date >= startDate)
}

/** 列出日期；太多時只列前幾個，其餘用「等」帶過 */
function formatDates(dates: string[], max = 5): string {
  return dates.length > max ? `${dates.slice(0, max).join('、')} 等` : dates.join('、')
}

/**
 * 自動檢查出的資料問題：疑似填錯的睡眠時數，以及漏填的核心欄位。
 * 今天的紀錄可能還在填，不算漏填；沒有任何問題時回傳 undefined
 */
function formatQuality(entries: Entry[], history: Entry[], today: Date): string | undefined {
  const lines: string[] = []

  for (const s of findLongSleeps(entries)) {
    lines.push(
      `- 疑似填錯：${s.date} 睡眠 ${s.hours} 小時（${s.bedtime} 入睡、${s.wakeTime} 起床），可能是上午／下午填反`,
    )
  }

  for (const w of findSuspectWeights(entries, history)) {
    const basis = w.previous
      ? `前一次 ${w.previous.measuredOn} 是 ${w.previous.kg} kg`
      : '不在一般體重的範圍'
    lines.push(`- 疑似填錯：${w.date} 體重 ${w.kg} kg（${basis}），可能是打錯`)
  }

  const todayDate = toDateString(today)
  const missing = new Map<string, string[]>()
  for (const entry of entries) {
    if (entry.date === todayDate) continue
    for (const label of missingFields(entry, history)) {
      missing.set(label, [...(missing.get(label) ?? []), entry.date])
    }
  }
  for (const [label, dates] of missing) {
    lines.push(`- 沒填：${label} ${dates.length} 天（${formatDates(dates.sort())}）`)
  }

  return lines.length > 0
    ? `# 資料品質備註\n以下是自動檢查出的問題。請不要把「疑似填錯」的數值當作真實數據，並在回答中提醒我補正；沒填的日子請不要推測數值。\n${lines.join('\n')}`
    : undefined
}

/** 固定用藥段落：期間內每天都當作有吃，例外寫在每日紀錄；沒有就不加這一段 */
function formatMedications(medications: Medication[]): string | undefined {
  if (medications.length === 0) return undefined
  const lines = medications.map(
    (m) => `- ${m.name}${m.dose ? `（${m.dose}）` : ''}：${formatPeriod(m)}`,
  )
  return `# 固定服用的藥物與保健食品\n以下在列出的期間內每天都有吃；每日紀錄寫「固定用藥沒吃」的那天例外。\n${lines.join('\n')}`
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
  /** 固定用藥；分析期間內有在吃的才列出 */
  medications?: Medication[]
  /** 已知疾病；有填寫才會加上「已知疾病」段落 */
  conditions?: Condition[]
  /** 基本資料；全部沒填就不會加上「基本資料」段落 */
  profile?: Profile
  /** 計算年齡的基準日，預設為現在 */
  today?: Date
  /**
   * 全部紀錄（不只要分析的期間），當天沒量體重時從這裡找之前最近一次的數值；
   * 預設只用要分析的紀錄，期間第一天之前量的體重就沿用不到
   */
  history?: Entry[]
}

/**
 * 產生可直接貼給 AI 的分析提示詞。
 * @param entries 要分析的紀錄（任意順序，輸出依日期由舊到新）
 */
export function buildAnalysisPrompt(
  entries: Entry[],
  {
    conditions = [],
    medications = [],
    profile,
    today = new Date(),
    history = entries,
  }: PromptOptions = {},
): string {
  if (entries.length === 0) return ''
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const range = `${sorted[0].date} ～ ${sorted[sorted.length - 1].date}（共 ${sorted.length} 天有紀錄）`
  const profileSection = formatProfile(profile, today)
  const qualitySection = formatQuality(sorted, history, today)
  const medicationNames = new Map(medications.map((m) => [m.id, m.name]))
  const medicationSection = formatMedications(
    medicationsDuring(medications, sorted[0].date, sorted[sorted.length - 1].date),
  )
  return [
    INSTRUCTIONS,
    ...(profileSection ? [profileSection] : []),
    ...(conditions.length > 0 ? [`# 已知疾病\n${conditions.map(formatCondition).join('\n')}`] : []),
    ...(medicationSection ? [medicationSection] : []),
    `# 紀錄期間\n${range}`,
    ...(qualitySection ? [qualitySection] : []),
    '# 每日紀錄',
    sorted.map((entry) => formatEntry(entry, history, medicationNames)).join('\n\n'),
  ].join('\n\n')
}
