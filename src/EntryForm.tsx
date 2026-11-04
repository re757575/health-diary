import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Input,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { clearDraft, loadDraft, saveDraft, type Draft } from '@/data/draft'
import { addFoods, getEntry, saveEntry } from '@/data/repository'
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
  addFoodItems,
  addWater,
  emptyForm,
  entryToForm,
  fillEmptyMeals,
  isEmptyMeal,
  formToEntry,
  isSameEntry,
  shiftDate,
  toTimeString,
  type BowelFormValues,
  type FoodItemFormValues,
  type FormValues,
} from '@/domain/form'
import { RatingPicker } from './RatingPicker'
import { SymptomPicker } from './SymptomPicker'
import { TagPicker } from './TagPicker'
import { Status } from './Status'
import { TimeField } from './TimeField'
import { PRESET_SYMPTOMS } from '@/domain/symptom'
import { foodsToRemember } from '@/domain/food'
import type { Medication } from '@/domain/medication'
import { PRESET_TAGS, addTag, toggleTag } from '@/domain/tag'
import { ChipChoices } from './ChipChoices'
import { MealEditor } from './MealEditor'
import { PhotoFoodImport } from './PhotoFoodImport'
import { isSuspectWeight, type DayWeight } from '@/domain/weight'
import { useStatus } from './useStatus'

interface Props {
  initial: FormValues
  /** 使用者改選日期時通知上層載入該日的紀錄 */
  onDateChange: (date: string) => void
  /** 是否有未儲存的修改，變動時通知上層（切換日期或關閉頁面前提醒用） */
  onDirtyChange?: (dirty: boolean) => void
  /** 症狀選擇器的候選清單（預設症狀加上過去用過的）；沒給就只有預設症狀 */
  knownSymptoms?: readonly string[]
  /** 狀況標籤的候選清單；沒給就只有預設標籤 */
  knownTags?: readonly string[]
  /** 這天該吃的固定用藥（設定裡登記、期間包含這天的） */
  medications?: readonly Medication[]
  /** 臨時用藥的候選清單（過去用過的） */
  knownAsNeeded?: readonly string[]
  /** 常吃的食物，依各餐吃過的次數排序；三餐可以直接點選 */
  foodsByMeal?: Partial<Record<MealType, readonly string[]>>
  /** 全部的常吃食物，放進照片辨識的提示詞；沒給就不列 */
  knownFoods?: readonly string[]
  /** 這天之前最近一次量的體重；體重沒填時沿用它，顯示在欄位提示 */
  previousWeight?: DayWeight
}

/** 各餐備註的提示：寫在哪裡吃、怎麼煮這類食物清單表達不了的事 */
const MEAL_NOTE_PLACEHOLDERS: Record<MealType, string> = {
  breakfast: '備註，例如：早餐店',
  lunch: '備註，例如：外食、便當',
  dinner: '備註，例如：家裡煮',
  snack: '備註，例如：下午茶',
}

const emptyMeals = emptyForm('').meals

const EMPTY_BOWEL: BowelFormValues = { time: '', bristol: '', note: '' }

export function EntryForm({
  initial,
  onDateChange,
  onDirtyChange,
  knownSymptoms = PRESET_SYMPTOMS,
  knownTags = PRESET_TAGS,
  previousWeight,
  medications = [],
  knownAsNeeded = [],
  foodsByMeal = {},
  knownFoods = [],
}: Props) {
  const medicationsLabelId = useId()
  // 正在填的餐別；常吃的食物只列在這一餐下面
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null)
  // 上次沒儲存就離開（例如切到別的 App 被系統關掉）的內容；和已存的不同才還原。
  // 合併空表單是為了補上舊版草稿沒有的欄位
  const [restored, setRestored] = useState<Draft | undefined>(() => {
    const draft = loadDraft(initial.date)
    if (!draft) return undefined
    const form = { ...emptyForm(initial.date), ...draft.form, date: initial.date }
    return isSameEntry(form, initial) ? undefined : { ...draft, form }
  })
  const [form, setForm] = useState(() => restored?.form ?? initial)
  // 這天的紀錄在別處被改掉（刪除、復原、匯入備份）時，上層會傳來新的 initial：
  // 沒有未儲存的修改就換成新的內容；有修改則保留使用者的輸入（此時會算成有未儲存的修改）
  const [shownInitial, setShownInitial] = useState(initial)
  if (!isSameEntry(initial, shownInitial)) {
    setShownInitial(initial)
    if (isSameEntry(form, shownInitial)) setForm(initial)
  }
  const [status, setStatus, tryWrite] = useStatus()
  // 使用者已經看過「睡太久」警告並按了確認的那組入睡／起床時間；時間一改就不算數
  const [confirmedSleep, setConfirmedSleep] = useState<string | null>(null)

  const hours = sleepHours({
    bedtime: form.bedtime || undefined,
    wakeTime: form.wakeTime || undefined,
  })
  const isLongSleep = hours !== undefined && hours > LONG_SLEEP_HOURS
  const sleepKey = `${form.bedtime}|${form.wakeTime}`
  const sleepConfirmed = confirmedSleep === sleepKey

  // 體重和上次差太多（或不在合理範圍）多半是打錯，儲存前也要確認；只檢查這次有改的數值，
  // 之前確認過存下來的不用每次存檔都再問。confirmedWeight 是使用者已確認的數值，一改就不算數
  const [confirmedWeight, setConfirmedWeight] = useState<string | null>(null)
  const weightKg = form.weightKg.trim() === '' ? undefined : Number(form.weightKg)
  const isOddWeight =
    weightKg !== undefined &&
    weightKg > 0 &&
    form.weightKg !== initial.weightKg &&
    isSuspectWeight(weightKg, previousWeight?.kg)
  const weightConfirmed = confirmedWeight === form.weightKg
  const weightWarning =
    isOddWeight &&
    (previousWeight
      ? `體重 ${weightKg} kg 和上次（${previousWeight.measuredOn.slice(5).replace('-', '/')} 的 ${previousWeight.kg} kg）差很多`
      : `體重 ${weightKg} kg 不太像正常的數值`)
  const pendingConfirm = (isLongSleep && sleepConfirmed) || (isOddWeight && weightConfirmed)

  // initial 在儲存後會由上層換成剛存的內容，所以存檔後就不再算有修改
  const dirty = !isSameEntry(initial, form)
  // 不在 cleanup 清掉：切到別的分頁時 Tabs 會用 <Activity> 隱藏這裡並執行 cleanup，但修改還在
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // 有修改就隨時存成草稿；存檔後（或改回原樣）就清掉
  useEffect(() => {
    if (dirty) saveDraft(form)
    else clearDraft(form.date)
  }, [form, dirty])

  function discardRestored() {
    setForm(initial)
    setRestored(undefined)
    clearDraft(initial.date)
  }

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
    await tryWrite(() => copyMealsFrom(previousDate), '讀取前一天的餐點失敗')
  }

  async function copyMealsFrom(previousDate: string) {
    const previous = await getEntry(previousDate)
    const source = previous && entryToForm(previous).meals
    const { meals, filled } = fillEmptyMeals(form.meals, source ?? emptyMeals)
    if (!source || Object.values(source).every(isEmptyMeal)) {
      setStatus(`${previousDate} 沒有餐點紀錄`)
    } else if (filled === 0) {
      setStatus('餐點欄位都已有內容，沒有帶入')
    } else {
      set('meals', meals)
      setStatus(`已帶入 ${previousDate} 的 ${filled} 個餐別，記得檢查後儲存`)
    }
  }

  /** 照片辨識的結果加進指定的餐別，已有同名食物的略過 */
  function importPhotoFoods(type: MealType, items: FoodItemFormValues[], note: string) {
    const { meal, added, skipped } = addFoodItems(form.meals[type], items, note)
    set('meals', { ...form.meals, [type]: meal })
    return { added, skipped }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = entrySchema.safeParse(formToEntry(form))
    if (!parsed.success) {
      setStatus('有欄位格式不正確，請檢查後再儲存', true)
      return
    }
    const needSleep = isLongSleep && !sleepConfirmed
    const needWeight = isOddWeight && !weightConfirmed
    if (needSleep || needWeight) {
      if (needSleep) setConfirmedSleep(sleepKey)
      if (needWeight) setConfirmedWeight(form.weightKg)
      const reasons = [
        needSleep && `睡眠 ${hours} 小時，請確認入睡與起床時間`,
        needWeight && `${weightWarning}，請確認是否打錯`,
      ].filter(Boolean)
      setStatus(`${reasons.join('；')}；沒問題請再按一次儲存`, true)
      return
    }
    // 失敗時輸入還在畫面上，也已經存成草稿，重新整理後會還原
    await tryWrite(async () => {
      await saveEntry(parsed.data)
      // 第一次吃的食物自動加進常吃清單，之後就能直接點選
      await addFoods(
        foodsToRemember(parsed.data.meals.flatMap((m) => m.items?.map((i) => i.name) ?? [])),
      )
      setRestored(undefined)
      setStatus(`已儲存 ${parsed.data.date} 的紀錄`)
    }, '儲存失敗，輸入的內容已存成草稿')
  }

  /** 有看過警告、待確認的數值時，按鈕寫出要確認的是什麼 */
  function saveLabel(): string {
    const sleep = isLongSleep && sleepConfirmed
    const weight = isOddWeight && weightConfirmed
    if (sleep && weight) return '睡眠與體重確認無誤，儲存'
    if (sleep) return `睡眠 ${hours} 小時無誤，儲存`
    if (weight) return `體重 ${weightKg} kg 無誤，儲存`
    return '儲存'
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        {restored && (
          <Group
            component="section"
            aria-label="還原的草稿"
            justify="space-between"
            wrap="nowrap"
            gap="xs"
            p="xs"
            bg="var(--mantine-color-default-hover)"
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Text size="sm">已還原 {toTimeString(new Date(restored.savedAt))} 沒儲存的內容</Text>
            <Button
              type="button"
              variant="subtle"
              size="compact-sm"
              style={{ flexShrink: 0 }}
              onClick={discardRestored}
            >
              捨棄
            </Button>
          </Group>
        )}
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
            placeholder={previousWeight && `沿用 ${previousWeight.kg}`}
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
          <TextInput
            label="運動（分鐘）"
            type="number"
            inputMode="numeric"
            step="5"
            min="0"
            rightSection="分"
            value={form.exerciseMinutes}
            onChange={(e) => set('exerciseMinutes', e.target.value)}
          />
        </div>
        {/* 放在欄位格線外：放在格內會撐高那一格，旁邊的欄位就對不齊了 */}
        {weightWarning && (
          <Text size="sm" c="orange.8" aria-live="polite">
            {weightWarning}，是不是打錯了？
          </Text>
        )}

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
        <PhotoFoodImport
          knownFoods={knownFoods}
          activeMeal={activeMeal}
          onImport={importPhotoFoods}
        />
        {MEAL_TYPES.map((type) => (
          <MealEditor
            key={type}
            label={MEAL_LABELS[type]}
            value={form.meals[type]}
            onChange={(meal) => set('meals', { ...form.meals, [type]: meal })}
            foods={foodsByMeal[type] ?? []}
            active={activeMeal === type}
            onActivate={() => setActiveMeal(type)}
            notePlaceholder={MEAL_NOTE_PLACEHOLDERS[type]}
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
        <Group gap="xs" grow>
          <Button
            type="button"
            variant="light"
            onClick={() =>
              // 有了排便紀錄，「沒有排便」就不成立
              setForm((prev) => ({
                ...prev,
                bowel: [...prev.bowel, { ...EMPTY_BOWEL }],
                noBowel: false,
              }))
            }
          >
            新增排便
          </Button>
          {/* 沒有排便列時才能勾：分辨「確認沒排便」與「忘了填」，AI 分析時不會把漏填當成便秘 */}
          {form.bowel.length === 0 && (
            <Button
              type="button"
              variant={form.noBowel ? 'filled' : 'default'}
              aria-pressed={form.noBowel}
              onClick={() => set('noBowel', !form.noBowel)}
            >
              當天沒有排便
            </Button>
          )}
        </Group>

        <Divider
          label="用藥"
          labelPosition="left"
          mt="xs"
          classNames={{ label: 'section-label' }}
        />
        {medications.length > 0 ? (
          <div>
            <Input.Label id={medicationsLabelId} labelElement="div">
              固定吃的藥
            </Input.Label>
            <Text size="xs" c="dimmed" mb={4}>
              預設都有吃，沒吃的點一下
            </Text>
            <Group role="group" aria-labelledby={medicationsLabelId} gap="xs">
              {medications.map((m) => {
                const taken = !form.missedMedications.includes(m.id)
                // 無障礙名稱固定是藥名，有沒有吃由 aria-pressed 表達；「沒吃」字樣只給看得到的人
                return (
                  <Button
                    key={m.id}
                    type="button"
                    size="compact-md"
                    variant={taken ? 'light' : 'default'}
                    aria-pressed={taken}
                    td={taken ? undefined : 'line-through'}
                    onClick={() =>
                      set('missedMedications', toggleTag(form.missedMedications, m.id))
                    }
                  >
                    {taken && (
                      <span aria-hidden="true" style={{ marginRight: '0.25em' }}>
                        ✓
                      </span>
                    )}
                    {m.name}
                    {!taken && <span aria-hidden="true">（沒吃）</span>}
                  </Button>
                )
              })}
            </Group>
          </div>
        ) : (
          <Text size="sm" c="dimmed">
            每天固定吃的藥或保健食品，可以到「設定」登記
          </Text>
        )}
        <ChipChoices
          label="臨時用藥"
          known={knownAsNeeded}
          selected={form.asNeededMedications}
          onToggle={(name) => set('asNeededMedications', toggleTag(form.asNeededMedications, name))}
          onAdd={(name) => set('asNeededMedications', addTag(form.asNeededMedications, name))}
          addLabel="新增其他臨時用藥"
          addPlaceholder="例如：普拿疼"
          addButtonLabel="新增臨時用藥"
        />

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
        <TagPicker known={knownTags} tags={form.tags} onChange={(tags) => set('tags', tags)} />
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
        <Button type="submit" fullWidth color={pendingConfirm ? 'orange' : undefined}>
          {saveLabel()}
        </Button>
        <Status status={status} />
      </div>
    </form>
  )
}
