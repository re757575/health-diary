import { Button, FileButton, Group, NativeSelect, Stack, Textarea } from '@mantine/core'
import { useRef, useState } from 'react'
import { getProfile, importBackup, listConditions, listEntries } from '@/data/repository'
import { parseBackup, serializeBackup } from '@/domain/backup'
import { buildAnalysisPrompt, recentEntries } from '@/domain/prompt'
import { toDateString } from '@/domain/form'
import { Section } from './Section'
import { Status } from './Status'
import { useStatus } from './useStatus'

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
  const [status, setStatus] = useStatus()
  const resetFileRef = useRef<() => void>(null)

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

  async function handleImport(file: File | null) {
    resetFileRef.current?.() // 讓同一個檔案可以再選一次
    if (!file) return
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setStatus(`匯入失敗：${result.error}`, true)
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
      setStatus('這段期間沒有紀錄可以分析', true)
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
      setStatus('無法自動複製，請手動複製下方提示詞', true)
    }
  }

  return (
    <Section title="AI 分析與資料備份">
      <Stack gap="md">
        <Group align="flex-end">
          <NativeSelect
            label="分析範圍"
            data={RANGES.map((r) => ({ value: String(r.days), label: r.label }))}
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          <Button type="button" onClick={handleGeneratePrompt}>
            產生 AI 提示詞
          </Button>
        </Group>
        {prompt && <Textarea label="提示詞" readOnly rows={8} value={prompt} />}

        <Group>
          <Button type="button" variant="light" onClick={handleExport}>
            匯出備份
          </Button>
          <FileButton
            resetRef={resetFileRef}
            accept="application/json,.json"
            onChange={handleImport}
            inputProps={{ 'aria-label': '匯入備份' }}
          >
            {(props) => (
              <Button variant="light" {...props}>
                選擇檔案匯入
              </Button>
            )}
          </FileButton>
        </Group>
        <Status status={status} />
      </Stack>
    </Section>
  )
}
