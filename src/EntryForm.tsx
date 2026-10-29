import { Button, Fieldset, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { saveEntry } from '@/data/repository'
import { MEAL_LABELS, MEAL_TYPES, entrySchema } from '@/domain/entry'
import { formToEntry, type BowelFormValues, type FormValues } from '@/domain/form'

interface Props {
  initial: FormValues
  /** 使用者改選日期時通知上層載入該日的紀錄 */
  onDateChange: (date: string) => void
}

const EMPTY_BOWEL: BowelFormValues = { time: '', bristol: '', note: '' }

export function EntryForm({ initial, onDateChange }: Props) {
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState('')

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const setBowel = (index: number, patch: Partial<BowelFormValues>) =>
    set(
      'bowel',
      form.bowel.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = entrySchema.safeParse(formToEntry(form))
    if (!parsed.success) {
      setStatus('有欄位格式不正確，請檢查後再儲存')
      return
    }
    await saveEntry(parsed.data)
    setStatus(`已儲存 ${parsed.data.date} 的紀錄`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <TextInput
          label="日期"
          type="date"
          required
          withAsterisk={false}
          value={form.date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
        />

        <div className="fields">
          <TextInput
            label="體重（kg）"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={form.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
          />
          <TextInput
            label="飲水（ml）"
            type="number"
            inputMode="numeric"
            step="50"
            min="0"
            value={form.waterMl}
            onChange={(e) => set('waterMl', e.target.value)}
          />
        </div>

        <div className="fields">
          <TextInput
            label="入睡時間"
            type="time"
            value={form.bedtime}
            onChange={(e) => set('bedtime', e.target.value)}
          />
          <TextInput
            label="起床時間"
            type="time"
            value={form.wakeTime}
            onChange={(e) => set('wakeTime', e.target.value)}
          />
          <TextInput
            label="睡眠品質（1–5）"
            type="number"
            min="1"
            max="5"
            value={form.sleepQuality}
            onChange={(e) => set('sleepQuality', e.target.value)}
          />
        </div>

        {MEAL_TYPES.map((type) => (
          <Textarea
            key={type}
            label={MEAL_LABELS[type]}
            rows={2}
            value={form.meals[type]}
            onChange={(e) => set('meals', { ...form.meals, [type]: e.target.value })}
          />
        ))}

        <Fieldset legend="排便">
          <Stack gap="sm">
            {form.bowel.map((b, i) => (
              <Paper withBorder p="sm" key={i}>
                <div className="fields">
                  <TextInput
                    label="時間"
                    type="time"
                    value={b.time}
                    onChange={(e) => setBowel(i, { time: e.target.value })}
                  />
                  <TextInput
                    label="布里斯托（1–7）"
                    type="number"
                    min="1"
                    max="7"
                    value={b.bristol}
                    onChange={(e) => setBowel(i, { bristol: e.target.value })}
                  />
                  <TextInput
                    label="備註"
                    value={b.note}
                    onChange={(e) => setBowel(i, { note: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    aria-label={`移除第 ${i + 1} 次排便`}
                    onClick={() =>
                      set(
                        'bowel',
                        form.bowel.filter((_, j) => j !== i),
                      )
                    }
                  >
                    移除
                  </Button>
                </div>
              </Paper>
            ))}
            <Button
              type="button"
              variant="light"
              onClick={() => set('bowel', [...form.bowel, { ...EMPTY_BOWEL }])}
            >
              新增排便
            </Button>
          </Stack>
        </Fieldset>

        <TextInput
          label="心情／精神（1–5）"
          type="number"
          min="1"
          max="5"
          value={form.mood}
          onChange={(e) => set('mood', e.target.value)}
        />
        <Textarea
          label="症狀"
          rows={2}
          value={form.symptoms}
          onChange={(e) => set('symptoms', e.target.value)}
        />
        <Textarea
          label="備註"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />

        <Button type="submit">儲存</Button>
        <Text role="status" size="sm" c="dimmed">
          {status}
        </Text>
      </Stack>
    </form>
  )
}
