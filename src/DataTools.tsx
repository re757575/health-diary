import { Button, FileButton, Group, NativeSelect, Stack, Text, Textarea } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import {
  getLastBackupAt,
  getProfile,
  importBackup,
  listConditions,
  listEntries,
} from '@/data/repository'
import { describeLastBackup, parseBackup, previewImport } from '@/domain/backup'
import { buildAnalysisPrompt, recentEntries } from '@/domain/prompt'
import { exportBackup } from './exportBackup'
import { Section } from './Section'
import { Status } from './Status'
import { useStatus } from './useStatus'

const RANGES = [
  { label: '最近 7 天', days: 7 },
  { label: '最近 14 天', days: 14 },
  { label: '最近 30 天', days: 30 },
  { label: '全部', days: Infinity },
]

/** 列出日期；太多時只列前幾個 */
const formatDates = (dates: string[], max = 3) =>
  dates.length > max ? `${dates.slice(0, max).join('、')} 等` : dates.join('、')

export function DataTools() {
  const [days, setDays] = useState(7)
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useStatus()
  const resetFileRef = useRef<() => void>(null)
  // 包一層物件區分「載入中」與「沒備份過」
  const lastBackup = useLiveQuery(async () => ({ at: await getLastBackupAt() }), [])

  async function handleExport() {
    const result = await exportBackup()
    const messages = {
      shared: '已匯出備份',
      downloaded: '已匯出備份檔',
      cancelled: '已取消匯出，這次沒有備份',
    }
    setStatus(messages[result])
  }

  async function handleImport(file: File | null) {
    resetFileRef.current?.() // 讓同一個檔案可以再選一次
    if (!file) return
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setStatus(`匯入失敗：${result.error}`, true)
      return
    }
    // 匯入會以備份為準覆蓋同一天的紀錄；用舊備份蓋掉較新的內容就救不回來，所以先確認
    const { replaced } = previewImport(result.entries, await listEntries())
    if (
      replaced.length > 0 &&
      !window.confirm(
        `備份檔中有 ${replaced.length} 天（${formatDates(replaced)}）和這台裝置上的紀錄不同，` +
          '匯入後會改成備份檔的內容，目前的內容將遺失。確定要匯入嗎？',
      )
    ) {
      setStatus('已取消匯入，資料沒有變動')
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
    const history = await listEntries()
    const entries = recentEntries(history, days, new Date())
    if (entries.length === 0) {
      setPrompt('')
      setStatus('這段期間沒有紀錄可以分析', true)
      return
    }
    const text = buildAnalysisPrompt(entries, {
      conditions: await listConditions(),
      profile: await getProfile(),
      history,
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

        {lastBackup && (
          <Text size="sm" c="dimmed">
            {describeLastBackup(lastBackup.at, new Date())}。資料只存在這台裝置，建議定期匯出備份
          </Text>
        )}
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
