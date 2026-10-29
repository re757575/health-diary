import {
  Button,
  Divider,
  Group,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState, type FormEvent } from 'react'
import { deleteCondition, listConditions, saveCondition } from '@/data/repository'
import {
  CONDITION_STATUSES,
  CONDITION_STATUS_LABELS,
  conditionSchema,
  conditionToForm,
  emptyConditionForm,
  formToCondition,
  type Condition,
  type ConditionFormValues,
} from '@/domain/condition'
import { Section } from './Section'

export function Conditions() {
  const conditions = useLiveQuery(listConditions, [])
  const [form, setForm] = useState<ConditionFormValues>(emptyConditionForm)
  /** 正在編輯的疾病 id；null 代表新增 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const set = <K extends keyof ConditionFormValues>(key: K, value: ConditionFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function resetForm() {
    setForm(emptyConditionForm())
    setEditingId(null)
  }

  function startEdit(condition: Condition) {
    setForm(conditionToForm(condition))
    setEditingId(condition.id)
    setStatus('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = conditionSchema.safeParse(
      formToCondition(form, editingId ?? crypto.randomUUID()),
    )
    if (!parsed.success) {
      setStatus('請填寫疾病名稱，開始時間格式需為年月')
      return
    }
    await saveCondition(parsed.data)
    setStatus(`已${editingId ? '更新' : '新增'}「${parsed.data.name}」`)
    resetForm()
  }

  async function handleDelete(condition: Condition) {
    await deleteCondition(condition.id)
    // 正在編輯的那筆被刪掉時，不能再讓表單以舊 id 存回去
    if (editingId === condition.id) resetForm()
    setStatus(`已刪除「${condition.name}」`)
  }

  return (
    <Section title="已知疾病">
      {conditions?.length === 0 && <Text>尚未填寫。沒有已知疾病可略過。</Text>}
      <Stack component="ul" gap={0} p={0} m={0} mb="md" style={{ listStyle: 'none' }}>
        {conditions?.map((c, i) => (
          <Fragment key={c.id}>
            {i > 0 && <Divider component="li" />}
            <Group component="li" justify="space-between" wrap="nowrap" py="xs">
              <Text>
                {c.name}
                {` · ${CONDITION_STATUS_LABELS[c.status]}`}
                {c.since && ` · ${c.since} 起`}
                {c.notes && ` · ${c.notes}`}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Button variant="light" size="compact-sm" onClick={() => startEdit(c)}>
                  編輯 {c.name}
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="compact-sm"
                  onClick={() => handleDelete(c)}
                >
                  刪除 {c.name}
                </Button>
              </Group>
            </Group>
          </Fragment>
        ))}
      </Stack>

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <div className="fields">
            <TextInput
              label="疾病名稱"
              required
              withAsterisk={false}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：高血壓、胃食道逆流"
            />
            <TextInput
              label="開始時間"
              type="month"
              value={form.since}
              onChange={(e) => set('since', e.target.value)}
            />
            <NativeSelect
              label="狀態"
              data={CONDITION_STATUSES.map((s) => ({
                value: s,
                label: CONDITION_STATUS_LABELS[s],
              }))}
              value={form.status}
              onChange={(e) => set('status', e.target.value as ConditionFormValues['status'])}
            />
          </div>
          <Textarea
            label="疾病備註（用藥、醫囑、控制狀況等）"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
          <Group>
            <Button type="submit">{editingId ? '更新疾病' : '新增疾病'}</Button>
            {editingId && (
              <Button type="button" variant="default" onClick={resetForm}>
                取消編輯
              </Button>
            )}
          </Group>
          <Text role="status" size="sm" c="dimmed">
            {status}
          </Text>
        </Stack>
      </form>
    </Section>
  )
}
