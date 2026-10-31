import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { getEntry, saveEntry } from '@/data/repository'
import {
  BRISTOL_DESCRIPTIONS,
  LONG_SLEEP_HOURS,
  MEAL_LABELS,
  MEAL_TYPES,
  MOOD_DESCRIPTIONS,
  SLEEP_QUALITY_DESCRIPTIONS,
  entrySchema,
  sleepHours,
  type MealType,
} from '@/domain/entry'
import {
  addWater,
  emptyForm,
  entryToForm,
  fillEmptyMeals,
  formToEntry,
  shiftDate,
  type BowelFormValues,
  type FormValues,
} from '@/domain/form'
import { RatingPicker } from './RatingPicker'
import { SymptomPicker } from './SymptomPicker'
import { Status } from './Status'
import { TimeField } from './TimeField'
import { PRESET_SYMPTOMS } from '@/domain/symptom'
import { useStatus } from './useStatus'

interface Props {
  initial: FormValues
  /** 使用者改選日期時通知上層載入該日的紀錄 */
  onDateChange: (date: string) => void
  /** 症狀選擇器的候選清單（預設症狀加上過去用過的）；沒給就只有預設症狀 */
  knownSymptoms?: readonly string[]
}

const MEAL_PLACEHOLDERS: Record<MealType, string> = {
  breakfast: '例如：燕麥奶加香蕉',
  lunch: '例如：雞腿便當、青菜',
  dinner: '例如：燙青菜、豆腐、白飯半碗',
  snack: '例如：無糖豆漿、堅果',
}

const emptyMeals = emptyForm('').meals

const EMPTY_BOWEL: BowelFormValues = { time: '', bristol: '', note: '' }

export function EntryForm({ initial, onDateChange, knownSymptoms = PRESET_SYMPTOMS }: Props) {
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useStatus()
  // 使用者已經看過「睡太久」警告並按了確認的那組入睡／起床時間；時間一改就不算數
  const [confirmedSleep, setConfirmedSleep] = useState<string | null>(null)

  const hours = sleepHours({
    bedtime: form.bedtime || undefined,
    wakeTime: form.wakeTime || undefined,
  })
  const isLongSleep = hours !== undefined && hours > LONG_SLEEP_HOURS
  const sleepKey = `${form.bedtime}|${form.wakeTime}`
  const sleepConfirmed = confirmedSleep === sleepKey

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const setBowel = (index: number, patch: Partial<BowelFormValues>) =>
    set(
      'bowel',
      form.bowel.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    )

  // 只補還空著的餐別，不蓋掉已經打的字；其他欄位（體重、睡眠、排便、飲水…）每天不同，不帶入
  async function handleCopyMeals() {
    const previousDate = shiftDate(form.date, -1)
    const previous = await getEntry(previousDate)
    const source = previous && entryToForm(previous).meals
    const { meals, filled } = fillEmptyMeals(form.meals, source ?? emptyMeals)
    if (!source || Object.values(source).every((text) => text.trim() === '')) {
      setStatus(`${previousDate} 沒有餐點紀錄`)
    } else if (filled === 0) {
      setStatus('餐點欄位都已有內容，沒有帶入')
    } else {
      set('meals', meals)
      setStatus(`已帶入 ${previousDate} 的 ${filled} 個餐別，記得檢查後儲存`)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = entrySchema.safeParse(formToEntry(form))
    if (!parsed.success) {
      setStatus('有欄位格式不正確，請檢查後再儲存', true)
      return
    }
    if (isLongSleep && !sleepConfirmed) {
      setConfirmedSleep(sleepKey)
      setStatus(`睡眠 ${hours} 小時，請確認入睡與起床時間；沒問題請再按一次儲存`, true)
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
            rightSection={
              <Button
                type="button"
                variant="light"
                size="compact-xs"
                aria-label="飲水加 250 ml"
                onClick={() => set('waterMl', addWater(form.waterMl, 250))}
              >
                +250
              </Button>
            }
            rightSectionWidth="3.75rem"
            rightSectionPointerEvents="all"
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
          <TimeField
            label="入睡時間"
            nowLabel="填入現在時刻：入睡"
            value={form.bedtime}
            onChange={(v) => set('bedtime', v)}
          />
          <TimeField
            label="起床時間"
            nowLabel="填入現在時刻：起床"
            value={form.wakeTime}
            onChange={(v) => set('wakeTime', v)}
          />
        </div>
        {hours !== undefined && (
          <Text size="sm" c={isLongSleep ? 'orange.8' : 'dimmed'} aria-live="polite">
            {isLongSleep
              ? `睡 ${hours} 小時，時間是不是填錯了？例如入睡 23:50 填成了 11:50`
              : `睡 ${hours} 小時`}
          </Text>
        )}
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
        <Button
          type="button"
          variant="light"
          size="compact-md"
          style={{ alignSelf: 'flex-start' }}
          onClick={handleCopyMeals}
        >
          複製前一天的餐點
        </Button>
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
                <TimeField
                  label="時間"
                  nowLabel={`填入現在時刻：第 ${i + 1} 次排便`}
                  value={b.time}
                  onChange={(v) => setBowel(i, { time: v })}
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
        <SymptomPicker
          known={knownSymptoms}
          items={form.symptomItems}
          onChange={(items) => set('symptomItems', items)}
        />
        <Textarea
          label="症狀補充"
          placeholder="例如：下午開車時腰椎酸痛"
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
        <Button
          type="submit"
          fullWidth
          color={isLongSleep && sleepConfirmed ? 'orange' : undefined}
        >
          {isLongSleep && sleepConfirmed ? `睡眠 ${hours} 小時無誤，儲存` : '儲存'}
        </Button>
        <Status status={status} />
      </div>
    </form>
  )
}
