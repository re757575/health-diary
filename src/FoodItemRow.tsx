import type { ReactNode } from 'react'
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
  /** 名稱前面的東西，例如拖曳把手 */
  leading?: ReactNode
  /** 正在被拖曳：淡化顯示 */
  dragging?: boolean
  /** 拖曳中的插入位置提示：在這一列的上面或下面畫一條線 */
  insert?: 'before' | 'after'
}

/** 一項食物：名稱（可修改）、數量、單位，與移除按鈕 */
export function FoodItemRow({
  item,
  onChange,
  onRemove,
  scope,
  index,
  labelPrefix = '',
  leading,
  dragging = false,
  insert,
}: Props) {
  // 舊資料的單位可能不在選單裡（例如「粒」），也要選得到
  const units = FOOD_UNITS.includes(item.unit as (typeof FOOD_UNITS)[number])
    ? FOOD_UNITS
    : [...FOOD_UNITS, item.unit]
  return (
    // 一律單行；間距比預設小，手機上每一欄都要省，名稱欄位才有地方顯示食物名稱
    <Group
      gap={6}
      wrap="nowrap"
      mb="xs"
      data-food-row
      style={{
        opacity: dragging ? 0.4 : undefined,
        boxShadow: insert
          ? `0 ${insert === 'before' ? -3 : 3}px 0 -1px var(--mantine-primary-color-filled)`
          : undefined,
      }}
    >
      {leading}
      <TextInput
        flex={1}
        miw={0}
        aria-label={`${scope}第 ${index + 1} 項的名稱`}
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <TextInput
        w="4rem"
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        aria-label={`${labelPrefix}${item.name}的數量`}
        value={item.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
      />
      <NativeSelect
        w="5rem"
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
        // 寬度比高度窄：手機上把空間留給名稱欄位，高度仍維持好點的大小
        style={{ width: 34, minWidth: 34 }}
        aria-label={`${labelPrefix}移除 ${item.name}`}
        onClick={onRemove}
      >
        ×
      </ActionIcon>
    </Group>
  )
}
