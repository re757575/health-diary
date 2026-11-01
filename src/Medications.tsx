import { Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState, type FormEvent } from 'react'
import { deleteMedication, listMedications, saveMedication } from '@/data/repository'
import { toDateString } from '@/domain/form'
import {
  emptyMedicationForm,
  formatPeriod,
  formToMedication,
  isActiveOn,
  medicationSchema,
  medicationToForm,
  type Medication,
  type MedicationFormValues,
} from '@/domain/medication'
import { Section } from './Section'
import { ShowMoreButton } from './ShowMoreButton'
import { Status } from './Status'
import { useStatus } from './useStatus'

/**
 * 固定服用的藥物與保健食品：登記一次，期間內每天都當作有吃，
 * 哪天沒吃再到當天的紀錄標出。停吃時填「最後一天」，保留期間讓 AI 分析前後差異
 */
export function Medications() {
  const medications = useLiveQuery(listMedications, [])
  const today = toDateString(new Date())
  const [form, setForm] = useState<MedicationFormValues>(() => emptyMedicationForm(today))
  /** 正在編輯的藥 id；null 代表新增 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus, tryWrite] = useStatus()
  /** 剛刪除的藥，讓使用者能復原；做了別的操作就清掉 */
  const [deleted, setDeleted] = useState<Medication | null>(null)
  const [showStopped, setShowStopped] = useState(false)

  const set = <K extends keyof MedicationFormValues>(key: K, value: MedicationFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function resetForm() {
    setForm(emptyMedicationForm(toDateString(new Date())))
    setEditingId(null)
  }

  function startEdit(medication: Medication) {
    setForm(medicationToForm(medication))
    setEditingId(medication.id)
    setDeleted(null)
    setStatus('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = medicationSchema.safeParse(
      formToMedication(form, editingId ?? crypto.randomUUID()),
    )
    if (!parsed.success) {
      setStatus('請填寫名稱與開始日期；最後一天不能早於開始日期', true)
      return
    }
    await tryWrite(async () => {
      await saveMedication(parsed.data)
      setDeleted(null)
      setStatus(`已${editingId ? '更新' : '新增'}「${parsed.data.name}」`)
      resetForm()
    }, '儲存失敗')
  }

  async function handleDelete(medication: Medication) {
    await tryWrite(() => deleteAndOfferUndo(medication), '刪除失敗')
  }

  async function deleteAndOfferUndo(medication: Medication) {
    await deleteMedication(medication.id)
    // 正在編輯的那筆被刪掉時，不能再讓表單以舊 id 存回去
    if (editingId === medication.id) resetForm()
    setDeleted(medication)
    setStatus(`已刪除「${medication.name}」`)
  }

  async function handleUndo() {
    if (!deleted) return
    await tryWrite(async () => {
      await saveMedication(deleted)
      setDeleted(null)
      setStatus(`已復原「${deleted.name}」`)
    }, '復原失敗')
  }

  const current = (medications ?? []).filter((m) => !m.endDate || m.endDate >= today)
  const stopped = (medications ?? []).filter((m) => m.endDate && m.endDate < today)

  function renderList(items: Medication[]) {
    return (
      <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
        {items.map((m, i) => (
          <Fragment key={m.id}>
            {i > 0 && <Divider component="li" />}
            <Group component="li" justify="space-between" wrap="nowrap" py="xs">
              <div>
                <Text fw={600} c={isActiveOn(m, today) ? undefined : 'dimmed'}>
                  {m.name}
                </Text>
                <Text size="sm" c="dimmed">
                  {[
                    m.dose,
                    formatPeriod(m),
                    m.endDate && m.endDate < today && '已停吃',
                    m.startDate > today && '還沒開始',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
              <Group gap="xs" wrap="nowrap">
                <Button
                  variant="light"
                  size="compact-md"
                  aria-label={`編輯 ${m.name}`}
                  onClick={() => startEdit(m)}
                >
                  編輯
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="compact-md"
                  aria-label={`刪除 ${m.name}`}
                  onClick={() => handleDelete(m)}
                >
                  刪除
                </Button>
              </Group>
            </Group>
          </Fragment>
        ))}
      </Stack>
    )
  }

  return (
    <Section title="藥物與保健食品">
      <Text size="sm" c="dimmed" mb="xs">
        每天固定吃的登記在這裡，之後每天都當作有吃；哪天沒吃，在當天的紀錄點一下標出。停吃時填「最後一天」。
      </Text>
      {medications?.length === 0 && <Text>還沒有登記。</Text>}
      {/* 已停吃的藥會一直累積，預設收起來；還在吃（或還沒開始）的照常列出 */}
      {renderList(current)}
      {stopped.length > 0 && (
        <>
          <ShowMoreButton
            expanded={showStopped}
            onToggle={() => setShowStopped(!showStopped)}
            moreLabel={`已停吃（${stopped.length}）`}
          />
          {showStopped && renderList(stopped)}
        </>
      )}
      <div style={{ marginBottom: 'var(--mantine-spacing-md)' }} />

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <div className="fields">
            <TextInput
              label="名稱"
              required
              withAsterisk={false}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：DHC 持續型維他命C"
            />
            <TextInput
              label="劑量／用法"
              value={form.dose}
              onChange={(e) => set('dose', e.target.value)}
              placeholder="例如：1000mg，每天 2 粒"
            />
          </div>
          <div className="fields">
            <TextInput
              label="開始日期"
              type="date"
              required
              withAsterisk={false}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
            <TextInput
              label="最後一天（停吃時填）"
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
          <Group>
            <Button type="submit">{editingId ? '更新藥物' : '新增藥物'}</Button>
            {editingId && (
              <Button type="button" variant="default" onClick={resetForm}>
                取消編輯
              </Button>
            )}
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Status status={status} />
            {deleted && (
              <Button type="button" variant="light" size="compact-md" onClick={handleUndo}>
                復原
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Section>
  )
}
