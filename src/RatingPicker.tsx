import { Button, Group, Input, Text, Tooltip } from '@mantine/core'
import { useId } from 'react'

interface Props {
  label: string
  /** 每個分數的說明，索引 0 是 1 分；長度就是分數的上限 */
  descriptions: readonly string[]
  /** 選到的數字；'' 代表沒填 */
  value: string
  onChange: (value: string) => void
  /** 兩端的簡短說明，例如「差」與「好」 */
  lowLabel: string
  highLabel: string
}

/**
 * 1 到 N 的點選按鈕，每顆按鈕有 tooltip 說明該分數的意思。
 * 再點一次已選的數字會取消，因為這些欄位都是選填。
 */
export function RatingPicker({ label, descriptions, value, onChange, lowLabel, highLabel }: Props) {
  const labelId = useId()
  return (
    <div>
      <Input.Label id={labelId} labelElement="div">
        {label}
      </Input.Label>
      <Group role="group" aria-labelledby={labelId} gap="xs" wrap="nowrap" grow>
        {descriptions.map((description, i) => {
          const n = String(i + 1)
          const selected = value === n
          return (
            // 觸控裝置沒有 hover，所以點一下也要能開關說明
            <Tooltip
              key={n}
              label={description}
              events={{ hover: true, focus: true, touch: true }}
              openDelay={150}
              multiline
              w={220}
              withArrow
            >
              <Button
                type="button"
                px={0}
                variant={selected ? 'filled' : 'default'}
                aria-pressed={selected}
                aria-description={description}
                onClick={() => onChange(selected ? '' : n)}
              >
                {n}
              </Button>
            </Tooltip>
          )
        })}
      </Group>
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          1 {lowLabel}
        </Text>
        <Text size="xs" c="dimmed">
          {descriptions.length} {highLabel}
        </Text>
      </Group>
    </div>
  )
}
