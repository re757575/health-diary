import { useState, type ChangeEvent } from 'react'
import { getProfile, importBackup, listConditions, listEntries } from '@/data/repository'
import { parseBackup, serializeBackup } from '@/domain/backup'
import { buildAnalysisPrompt, recentEntries } from '@/domain/prompt'
import { toDateString } from '@/domain/form'

const RANGES = [
  { label: '最近 7 天', days: 7 },
  { label: '最近 14 天', days: 14 },
  { label: '最近 30 天', days: 30 },
  { label: '全部', days: Infinity },
]

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataTools() {
  const [days, setDays] = useState(7)
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState('')

  async function handleExport() {
    const now = new Date()
    const data = {
      entries: await listEntries(),
      conditions: await listConditions(),
      profile: await getProfile(),
    }
    download(`health-diary-${toDateString(now)}.json`, serializeBackup(data, now))
    setStatus('已匯出備份檔')
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // 讓同一個檔案可以再選一次
    if (!file) return
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setStatus(`匯入失敗：${result.error}`)
      return
    }
    await importBackup(result)
    const conditionCount = result.conditions.length
    setStatus(
      `已匯入 ${result.entries.length} 筆紀錄` +
        (conditionCount > 0 ? `與 ${conditionCount} 項疾病` : ''),
    )
  }

  async function handleGeneratePrompt() {
    const entries = recentEntries(await listEntries(), days, new Date())
    if (entries.length === 0) {
      setPrompt('')
      setStatus('這段期間沒有紀錄可以分析')
      return
    }
    const text = buildAnalysisPrompt(entries, {
      conditions: await listConditions(),
      profile: await getProfile(),
    })
    setPrompt(text)
    try {
      await navigator.clipboard.writeText(text)
      setStatus('已複製提示詞，貼給 AI 即可')
    } catch {
      setStatus('無法自動複製，請手動複製下方提示詞')
    }
  }

  return (
    <section aria-labelledby="data-tools-heading">
      <h2 id="data-tools-heading">AI 分析與資料備份</h2>
      <div className="row">
        <label>
          分析範圍
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.label} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleGeneratePrompt}>
          產生 AI 提示詞
        </button>
      </div>
      {prompt && (
        <label>
          提示詞
          <textarea readOnly rows={8} value={prompt} />
        </label>
      )}

      <div className="row">
        <button type="button" onClick={handleExport}>
          匯出備份
        </button>
        <label>
          匯入備份
          <input type="file" accept="application/json,.json" onChange={handleImport} />
        </label>
      </div>
      <p className="status" role="status">
        {status}
      </p>
    </section>
  )
}
