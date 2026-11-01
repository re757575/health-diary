import { Button, Divider, Group, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useId, useRef, useState, type FormEvent } from 'react'
import { deleteVisit, getEntry, listVisits, saveVisit } from '@/data/repository'
import { toDateString, withWeekday } from '@/domain/form'
import {
  collectVisitNames,
  describeDaysLeft,
  describeVisit,
  emptyVisitForm,
  entrySymptomsText,
  formToVisit,
  upcomingFollowUps,
  visitDetails,
  visitSchema,
  visitToForm,
  type Visit,
  type VisitFormValues,
} from '@/domain/visit'
import { Section } from './Section'
import { Status } from './Status'
import { useStatus } from './useStatus'

/** 文字欄位，有過去填過的值可以選（原生 datalist，手機上會出現在鍵盤上方） */
function SuggestInput({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <>
      <TextInput
        label={label}
        required={required}
        withAsterisk={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={options.length > 0 ? id : undefined}
        autoComplete="off"
      />
      {options.length > 0 && (
        <datalist id={id}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  )
}

/**
 * 就醫紀錄：每次看診記一筆（症狀、診所、科別、醫師、檢查、診斷、醫囑、處方、回診日期）。
 * 會出現在就醫報告與 AI 提示詞；填了回診日期，快到時「今天」分頁會提醒
 */
export function Visits() {
  const visits = useLiveQuery(listVisits, [])
  const today = toDateString(new Date())
  const [form, setForm] = useState<VisitFormValues>(() => emptyVisitForm(today))
  /** 正在編輯的紀錄 id；null 代表新增 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus, tryWrite] = useStatus()
  // 刪除與復原在下方的清單操作，訊息顯示在清單上，不然看不到
  const [listStatus, setListStatus, tryListWrite] = useStatus()
  /** 剛刪除的紀錄，讓使用者能復原；做了別的操作就清掉 */
  const [deleted, setDeleted] = useState<Visit | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const all = visits ?? []
  const followUps = upcomingFollowUps(all, today)

  const set = <K extends keyof VisitFormValues>(key: K, value: VisitFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function resetForm() {
    setForm(emptyVisitForm(toDateString(new Date())))
    setEditingId(null)
  }

  function startEdit(visit: Visit) {
    setForm(visitToForm(visit))
    setEditingId(visit.id)
    setDeleted(null)
    setStatus('')
    setListStatus('')
    // 清單可能很長，捲回表單才看得到正在編輯的內容（jsdom 沒有 scrollIntoView）
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  async function handleFillSymptoms() {
    await tryWrite(async () => {
      const text = entrySymptomsText(await getEntry(form.date))
      if (!text) {
        setStatus(`${form.date} 的每日紀錄沒有記下症狀`, true)
        return
      }
      // 已經寫了一些就接在後面，不蓋掉
      setForm((prev) => ({
        ...prev,
        symptoms: prev.symptoms.trim() ? `${prev.symptoms.trimEnd()}\n${text}` : text,
      }))
      setStatus('')
    }, '讀取紀錄失敗')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = visitSchema.safeParse(formToVisit(form, editingId ?? crypto.randomUUID()))
    if (!parsed.success) {
      setStatus('請填寫就醫日期與診所／醫院；回診日期不能早於就醫日期', true)
      return
    }
    await tryWrite(async () => {
      await saveVisit(parsed.data)
      setDeleted(null)
      setListStatus('')
      setStatus(`已${editingId ? '更新' : '新增'} ${parsed.data.date} 的就醫紀錄`)
      resetForm()
    }, '儲存失敗')
  }

  async function handleDelete(visit: Visit) {
    await tryListWrite(async () => {
      await deleteVisit(visit.id)
      // 正在編輯的那筆被刪掉時，不能再讓表單以舊 id 存回去
      if (editingId === visit.id) resetForm()
      setDeleted(visit)
      setStatus('')
      setListStatus(`已刪除 ${visit.date} 的就醫紀錄`)
    }, '刪除失敗')
  }

  async function handleUndo() {
    if (!deleted) return
    await tryListWrite(async () => {
      await saveVisit(deleted)
      setDeleted(null)
      setListStatus(`已復原 ${deleted.date} 的就醫紀錄`)
    }, '復原失敗')
  }

  return (
    <Stack gap="md">
      {followUps.length > 0 && (
        <Section title="即將回診">
          <Stack component="ul" gap={4} m={0} pl="md">
            {followUps.map(({ visit, daysLeft }) => (
              <Text component="li" key={visit.id}>
                {withWeekday(visit.followUpDate!)}（{describeDaysLeft(daysLeft)}）：
                {describeVisit(visit)}
              </Text>
            ))}
          </Stack>
        </Section>
      )}

      <Section title="記錄就醫">
        <Text size="sm" c="dimmed" mb="xs">
          每次看診記一筆，會整理進就醫報告與 AI 提示詞；填了回診日期，快到時會在「今天」提醒。
        </Text>
        <form ref={formRef} onSubmit={handleSubmit} style={{ scrollMarginTop: '4rem' }}>
          <Stack gap="sm">
            <div className="fields">
              <TextInput
                label="就醫日期"
                type="date"
                required
                withAsterisk={false}
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
              <SuggestInput
                label="診所／醫院"
                required
                value={form.facility}
                options={collectVisitNames(all, 'facility')}
                onChange={(v) => set('facility', v)}
                placeholder="例如：台大醫院"
              />
            </div>
            <div className="fields">
              <SuggestInput
                label="科別"
                value={form.department}
                options={collectVisitNames(all, 'department')}
                onChange={(v) => set('department', v)}
                placeholder="例如：耳鼻喉科"
              />
              <SuggestInput
                label="看診醫師"
                value={form.doctor}
                options={collectVisitNames(all, 'doctor')}
                onChange={(v) => set('doctor', v)}
              />
            </div>
            <div>
              <Textarea
                label="症狀／看診原因"
                autosize
                minRows={2}
                value={form.symptoms}
                onChange={(e) => set('symptoms', e.target.value)}
                placeholder="例如：喉嚨痛三天、晚上咳嗽"
              />
              <Button
                type="button"
                variant="subtle"
                size="compact-sm"
                mt={4}
                onClick={handleFillSymptoms}
              >
                帶入這天每日紀錄的症狀
              </Button>
            </div>
            <Textarea
              label="檢查／檢驗"
              autosize
              minRows={1}
              value={form.examinations}
              onChange={(e) => set('examinations', e.target.value)}
              placeholder="例如：抽血、X 光，與結果"
            />
            <Textarea
              label="診斷"
              autosize
              minRows={1}
              value={form.diagnosis}
              onChange={(e) => set('diagnosis', e.target.value)}
            />
            <Textarea
              label="醫囑"
              autosize
              minRows={2}
              value={form.advice}
              onChange={(e) => set('advice', e.target.value)}
              placeholder="例如：多喝水、避免辛辣，一週後回診"
            />
            <Textarea
              label="處方用藥"
              autosize
              minRows={1}
              value={form.prescription}
              onChange={(e) => set('prescription', e.target.value)}
              placeholder="例如：抗生素 3 天、止咳藥水"
            />
            <div className="fields">
              <TextInput
                label="下次回診日期"
                type="date"
                value={form.followUpDate}
                onChange={(e) => set('followUpDate', e.target.value)}
              />
            </div>
            <Textarea
              label="就醫備註"
              autosize
              minRows={1}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="例如：費用、下次要問醫生的事"
            />
            <Group>
              <Button type="submit">{editingId ? '更新就醫紀錄' : '新增就醫紀錄'}</Button>
              {editingId && (
                <Button type="button" variant="default" onClick={resetForm}>
                  取消編輯
                </Button>
              )}
            </Group>
            <Status status={status} />
          </Stack>
        </form>
      </Section>

      <Section title="就醫紀錄">
        {(listStatus.text || deleted) && (
          <Group justify="space-between" wrap="nowrap">
            <Status status={listStatus} />
            {deleted && (
              <Button type="button" variant="light" size="compact-md" onClick={handleUndo}>
                復原
              </Button>
            )}
          </Group>
        )}
        {visits?.length === 0 && <Text>還沒有就醫紀錄。</Text>}
        <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
          {all.map((v, i) => {
            const name = `${v.date} ${v.facility}`
            return (
              <Fragment key={v.id}>
                {i > 0 && <Divider component="li" />}
                <Stack component="li" gap={4} py="xs">
                  <Text fw={600}>{withWeekday(v.date)}</Text>
                  <Text>{describeVisit(v)}</Text>
                  {visitDetails(v).map((d) => (
                    <Text key={d.label} size="sm" className="visit-detail">
                      <Text span c="dimmed" size="sm">
                        {d.label}：
                      </Text>
                      <span>{d.value}</span>
                    </Text>
                  ))}
                  <Group gap="xs" mt={4}>
                    <Button
                      variant="light"
                      size="compact-md"
                      aria-label={`編輯 ${name}`}
                      onClick={() => startEdit(v)}
                    >
                      編輯
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="compact-md"
                      aria-label={`刪除 ${name}`}
                      onClick={() => handleDelete(v)}
                    >
                      刪除
                    </Button>
                  </Group>
                </Stack>
              </Fragment>
            )
          })}
        </Stack>
      </Section>
    </Stack>
  )
}
