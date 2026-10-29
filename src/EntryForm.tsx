import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { saveEntry } from '@/data/repository'
import {
  BRISTOL_DESCRIPTIONS,
  MEAL_LABELS,
  MEAL_TYPES,
  MOOD_DESCRIPTIONS,
  SLEEP_QUALITY_DESCRIPTIONS,
  entrySchema,
  type MealType,
} from '@/domain/entry'
import { formToEntry, shiftDate, type BowelFormValues, type FormValues } from '@/domain/form'
import { RatingPicker } from './RatingPicker'
import { Status } from './Status'
import { useStatus } from './useStatus'

interface Props {
  initial: FormValues
  /** 使用者改選日期時通知上層載入該日的紀錄 */
  onDateChange: (date: string) => void
}

const MEAL_PLACEHOLDERS: Record<MealType, string> = {
  breakfast: '例如：燕麥奶加香蕉',
  lunch: '例如：雞腿便當、青菜',
  dinner: '例如：燙青菜、豆腐、白飯半碗',
  snack: '例如：無糖豆漿、堅果',
}

const EMPTY_BOWEL: BowelFormValues = { time: '', bristol: '', note: '' }

export function EntryForm({ initial, onDateChange }: Props) {
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useStatus()

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
      setStatus('有欄位格式不正確，請檢查後再儲存', true)
      return
    }
    await saveEntry(parsed.data)
    setStatus(`已儲存 ${parsed.data.date} 的紀錄`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <ActionIcon
            type="button"
            variant="default"
            size="input-md"
            aria-label="前一天"
            onClick={() => onDateChange(shiftDate(form.date, -1))}
          >
            ‹
          </ActionIcon>
          <TextInput
            flex={1}
            label="日期"
            type="date"
            required
            withAsterisk={false}
            value={form.date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
          <ActionIcon
            type="button"
            variant="default"
            size="input-md"
            aria-label="後一天"
            onClick={() => onDateChange(shiftDate(form.date, 1))}
          >
            ›
          </ActionIcon>
        </Group>

        <Divider
          label="身體"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
        <div className="fields">
          <TextInput
            label="體重（kg）"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            rightSection="kg"
            value={form.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
          />
          <TextInput
            label="飲水（ml）"
            type="number"
            inputMode="numeric"
            step="50"
            min="0"
            rightSection="ml"
            rightSectionWidth="3rem"
            value={form.waterMl}
            onChange={(e) => set('waterMl', e.target.value)}
          />
        </div>

        <Divider
          label="睡眠"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
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
        </div>
        <RatingPicker
          label="睡眠品質（1–5）"
          descriptions={SLEEP_QUALITY_DESCRIPTIONS}
          value={form.sleepQuality}
          onChange={(v) => set('sleepQuality', v)}
          lowLabel="差"
          highLabel="好"
        />

        <Divider
          label="飲食"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
        {MEAL_TYPES.map((type) => (
          <Textarea
            key={type}
            label={MEAL_LABELS[type]}
            placeholder={MEAL_PLACEHOLDERS[type]}
            rows={2}
            value={form.meals[type]}
            onChange={(e) => set('meals', { ...form.meals, [type]: e.target.value })}
          />
        ))}

        <Divider
          label="排便"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
        {form.bowel.map((b, i) => (
          <Paper withBorder p="sm" key={i} bg="var(--mantine-color-default-hover)">
            <Stack gap="sm">
              <div className="fields">
                <TextInput
                  label="時間"
                  type="time"
                  value={b.time}
                  onChange={(e) => setBowel(i, { time: e.target.value })}
                />
              </div>
              <RatingPicker
                label="布里斯托（1–7）"
                descriptions={BRISTOL_DESCRIPTIONS}
                value={b.bristol}
                onChange={(v) => setBowel(i, { bristol: v })}
                lowLabel="硬塊"
                highLabel="水狀"
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
                size="compact-sm"
                style={{ alignSelf: 'flex-start' }}
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
            </Stack>
          </Paper>
        ))}
        <Button
          type="button"
          variant="light"
          onClick={() => set('bowel', [...form.bowel, { ...EMPTY_BOWEL }])}
        >
          新增排便
        </Button>

        <Divider
          label="整體狀況"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
        <RatingPicker
          label="心情／精神（1–5）"
          descriptions={MOOD_DESCRIPTIONS}
          value={form.mood}
          onChange={(v) => set('mood', v)}
          lowLabel="低落"
          highLabel="良好"
        />
        <Textarea
          label="症狀"
          placeholder="例如：頭痛、胃脹"
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
      </Stack>

      {/* 固定在畫面底部：表單很長，儲存按鈕與結果訊息隨時看得到 */}
      <div className="save-bar">
        <Button type="submit" fullWidth>
          儲存
        </Button>
        <Status status={status} />
      </div>
    </form>
  )
}
