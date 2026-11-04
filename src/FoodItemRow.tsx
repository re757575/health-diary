import { ActionIcon, Group, NativeSelect, TextInput } from '@mantine/core'
import { FOOD_UNITS } from '@/domain/entry'
import type { FoodItemFormValues } from '@/domain/form'

interface Props {
  item: FoodItemFormValues
  onChange: (patch: Partial<FoodItemFormValues>) => void
  onRemove: () => void
  /** 名稱欄位的無障礙名稱開頭，例如餐別；同一頁有好幾組食物時用來區分（名稱會被改，不能拿來區分） */
  scope: string
  /** 這一項在列表中的位置（從 0 起算），名稱欄位的無障礙名稱用 */
  index: number
  /** 數量、單位、移除的無障礙名稱開頭；同一頁有兩組可能出現同名食物時用來區分，預設沒有 */
  labelPrefix?: string
}

/** 一項食物：名稱（可修改）、數量、單位，與移除按鈕 */
export function FoodItemRow({ item, onChange, onRemove, scope, index, labelPrefix = '' }: Props) {
  // 舊資料的單位可能不在選單裡（例如「粒」），也要選得到
  const units = FOOD_UNITS.includes(item.unit as (typeof FOOD_UNITS)[number])
    ? FOOD_UNITS
    : [...FOOD_UNITS, item.unit]
  return (
    <Group gap="xs" wrap="nowrap" mb="xs">
      <TextInput
        flex={1}
        miw={0}
        aria-label={`${scope}第 ${index + 1} 項的名稱`}
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <TextInput
        w="4.5rem"
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        aria-label={`${labelPrefix}${item.name}的數量`}
        value={item.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
      />
      <NativeSelect
        w="5.25rem"
        aria-label={`${labelPrefix}${item.name}的單位`}
        data={units}
        value={item.unit}
        onChange={(e) => onChange({ unit: e.target.value })}
      />
      <ActionIcon
        type="button"
        variant="subtle"
        color="gray"
        size="input-md"
        aria-label={`${labelPrefix}移除 ${item.name}`}
        onClick={onRemove}
      >
        ×
      </ActionIcon>
    </Group>
  )
}
