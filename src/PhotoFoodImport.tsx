import { Button, Group, NativeSelect, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/domain/entry'
import type { FoodItemFormValues } from '@/domain/form'
import { buildPhotoPrompt, guessMeal, parsePhotoMeal } from '@/domain/photo-meal'
import { FoodItemRow } from './FoodItemRow'
import { Status } from './Status'
import { useStatus } from './useStatus'

interface Props {
  /** 常吃的食物，放進提示詞請 AI 沿用同樣的名稱 */
  knownFoods: readonly string[]
  /** 正在填的餐別，匯入時預設選它；沒有就依現在的時間猜 */
  activeMeal: MealType | null
  /** 把食物加進指定餐別，回傳實際加了幾項、略過幾項（這餐已有同名的） */
  onImport: (
    type: MealType,
    items: FoodItemFormValues[],
    note: string,
  ) => { added: number; skipped: number }
}

const PREVIEW = '辨識結果'

/**
 * 用照片記錄食物：複製提示詞連同照片貼給 AI → 把 AI 回覆的 JSON 貼回來 →
 * 檢查、修改名稱與份量 → 選一餐匯入。不用自己一項一項輸入
 */
export function PhotoFoodImport({ knownFoods, activeMeal, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  // 解析出來、等著確認的食物；null 表示還沒貼或貼的內容有問題
  const [items, setItems] = useState<FoodItemFormValues[] | null>(null)
  const [note, setNote] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  // 複製失敗時把提示詞列出來，讓使用者手動複製
  const [promptText, setPromptText] = useState('')
  const [status, setStatus] = useStatus()

  async function copyPrompt() {
    const prompt = buildPhotoPrompt(knownFoods)
    try {
      await navigator.clipboard.writeText(prompt)
      setPromptText('')
      setStatus('已複製提示詞，連同食物照片一起貼給 AI')
    } catch {
      setPromptText(prompt)
      setStatus('無法自動複製，請手動複製下方提示詞', true)
    }
  }

  function changeText(value: string) {
    setText(value)
    // 貼了新的內容，之前解析的結果就不算數了
    setItems(null)
  }

  function parse() {
    const result = parsePhotoMeal(text)
    if (!result.ok) {
      setItems(null)
      setStatus(result.error, true)
      return
    }
    setItems(result.meal.items)
    setNote(result.meal.note)
    setMealType(activeMeal ?? guessMeal(new Date()))
    setStatus(`辨識出 ${result.meal.items.length} 項，檢查名稱與份量後選擇要匯入的餐別`)
  }

  const setItem = (index: number, patch: Partial<FoodItemFormValues>) =>
    setItems((prev) => prev && prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  // 名稱被清空的項目不會匯入（和存檔時的規則相同）
  const usable = (items ?? []).filter((i) => i.name.trim() !== '')

  function doImport() {
    const { added, skipped } = onImport(mealType, usable, note)
    const label = MEAL_LABELS[mealType]
    setStatus(
      `已加入 ${added} 項到${label}` +
        (skipped > 0 ? `（${skipped} 項${label}已有，已略過）` : '') +
        '，記得儲存',
    )
    setText('')
    setItems(null)
    setNote('')
    setPromptText('')
    setOpen(false)
  }

  return (
    <Stack gap="xs">
      <Button
        type="button"
        variant="light"
        size="compact-md"
        style={{ alignSelf: 'flex-start' }}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? '收起照片辨識' : '用照片辨識食物'}
      </Button>
      {!open && status.text && <Status status={status} />}

      {open && (
        <Paper
          component="section"
          aria-label="用照片辨識食物"
          withBorder
          p="sm"
          bg="var(--mantine-color-default-hover)"
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              1. 複製提示詞，連同食物照片一起貼給 AI（ChatGPT、Claude、Gemini 都可以）。2. 把 AI
              回覆的內容整段貼到下面。3. 檢查名稱與份量，選一餐匯入。
            </Text>
            <Button
              type="button"
              variant="default"
              style={{ alignSelf: 'flex-start' }}
              onClick={copyPrompt}
            >
              複製提示詞
            </Button>
            {promptText && <Textarea label="提示詞" readOnly rows={6} value={promptText} />}

            <Textarea
              label="貼上 AI 的回覆"
              placeholder={'{"items":[{"name":"燕麥粥","amount":1,"unit":"碗"}],"note":null}'}
              rows={4}
              value={text}
              onChange={(e) => changeText(e.target.value)}
            />
            <Button
              type="button"
              style={{ alignSelf: 'flex-start' }}
              disabled={text.trim() === ''}
              onClick={parse}
            >
              解析回覆
            </Button>
            {status.text && <Status status={status} />}

            {items && (
              <div role="group" aria-label={PREVIEW}>
                {items.map((item, i) => (
                  <FoodItemRow
                    key={i}
                    item={item}
                    index={i}
                    scope={PREVIEW}
                    labelPrefix={`${PREVIEW}：`}
                    onChange={(patch) => setItem(i, patch)}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))}
                  />
                ))}
                <TextInput
                  mb="xs"
                  aria-label={`${PREVIEW}備註`}
                  placeholder="備註，例如：外食、家裡煮"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <NativeSelect
                    label="匯入到"
                    data={MEAL_TYPES.map((type) => ({ value: type, label: MEAL_LABELS[type] }))}
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                  />
                  <Button type="button" disabled={usable.length === 0} onClick={doImport}>
                    匯入 {usable.length} 項
                  </Button>
                </Group>
              </div>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
