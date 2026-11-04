import { Button, Group, Input, Text, TextInput } from '@mantine/core'
import { useId, useState, type KeyboardEvent } from 'react'
import { filterFoods } from '@/domain/food'
import {
  removeFoodItem,
  toggleFoodItem,
  type FoodItemFormValues,
  type MealFormValues,
} from '@/domain/form'
import { FoodItemRow } from './FoodItemRow'

/** 常吃的食物先列這麼多個，其餘收進「更多」，清單再長也只佔幾行 */
const CHIP_LIMIT = 12

interface Props {
  label: string
  value: MealFormValues
  onChange: (value: MealFormValues) => void
  /** 常吃的食物，已依這一餐吃過的次數排序 */
  foods: readonly string[]
  /** 這一餐是否正在填；常吃的食物只在正在填的那一餐下面列出，四餐都列會把表單撐得很長 */
  active: boolean
  onActivate: () => void
  notePlaceholder: string
}

/** 一餐吃的食物：一項一列（名稱、數量、單位，名稱可以改），可以輸入新的或點選常吃的；另有備註 */
export function MealEditor({
  label,
  value,
  onChange,
  foods,
  active,
  onActivate,
  notePlaceholder,
}: Props) {
  const labelId = useId()
  // 新增食物欄位的字，同時用來篩選常吃的食物
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const setItem = (index: number, patch: Partial<FoodItemFormValues>) =>
    onChange({
      ...value,
      items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })

  function addTyped() {
    const name = query.trim()
    if (!name) return
    if (!value.items.some((i) => i.name === name)) onChange(toggleFoodItem(value, name))
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter 是加入這項食物，不是送出整張表單
    if (event.key === 'Enter') {
      event.preventDefault()
      addTyped()
    }
  }

  function pick(name: string) {
    onChange(toggleFoodItem(value, name))
    setQuery('')
  }

  const matches = filterFoods(foods, query)
  const shown = expanded ? matches : matches.slice(0, CHIP_LIMIT)

  return (
    <div role="group" aria-labelledby={labelId} onFocusCapture={onActivate}>
      <Input.Label id={labelId} labelElement="div">
        {label}
      </Input.Label>

      {value.items.map((item, i) => (
        // 名稱可以改，所以用位置當 key，輸入時才不會因為 key 變了而失去焦點
        <FoodItemRow
          key={i}
          item={item}
          index={i}
          scope={label}
          onChange={(patch) => setItem(i, patch)}
          onRemove={() => onChange(removeFoodItem(value, i))}
        />
      ))}

      <Group gap="xs" wrap="nowrap">
        <TextInput
          flex={1}
          aria-label={`新增食物：${label}`}
          placeholder="輸入或點選食物"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="light"
          aria-label={`加入食物：${label}`}
          disabled={query.trim() === ''}
          onClick={addTyped}
        >
          加入
        </Button>
      </Group>

      {active && foods.length > 0 && (
        <>
          {query.trim() !== '' && matches.length === 0 && (
            <Text size="sm" c="dimmed" mt="xs">
              清單裡沒有「{query.trim()}」，按「加入」直接新增
            </Text>
          )}
          {shown.length > 0 && (
            <Group role="group" aria-label={`常吃的食物：${label}`} gap="xs" mt="xs">
              {shown.map((name) => {
                const picked = value.items.some((i) => i.name === name)
                return (
                  <Button
                    key={name}
                    type="button"
                    size="compact-md"
                    variant={picked ? 'filled' : 'default'}
                    aria-pressed={picked}
                    onClick={() => pick(name)}
                  >
                    {name}
                  </Button>
                )
              })}
              {matches.length > CHIP_LIMIT && (
                <Button
                  type="button"
                  size="compact-md"
                  variant="subtle"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? '收合' : `更多（${matches.length - CHIP_LIMIT}）`}
                </Button>
              )}
            </Group>
          )}
        </>
      )}

      <TextInput
        mt="xs"
        aria-label={`${label}備註`}
        placeholder={notePlaceholder}
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </div>
  )
}
