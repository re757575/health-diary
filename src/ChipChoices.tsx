import { Button, Group, Input, TextInput } from '@mantine/core'
import { useId, useState, type ReactNode } from 'react'

interface Props {
  label: string
  /** 可以點選的選項（預設與過去用過的） */
  known: readonly string[]
  selected: readonly string[]
  onToggle: (name: string) => void
  onAdd: (name: string) => void
  /** 新增欄位的名稱，例如「新增其他症狀」 */
  addLabel: string
  addPlaceholder: string
  /** 「新增」按鈕的無障礙名稱；同一頁有多組時要彼此不同 */
  addButtonLabel: string
  /** 顯示在選項與新增欄位之間，例如每個已選項目的細部設定 */
  children?: ReactNode
}

/**
 * 一排可點選的晶片，下方可輸入清單裡沒有的選項。
 * 選項是選填的多選：點一下選取，再點一下取消。
 */
export function ChipChoices({
  label,
  known,
  selected,
  onToggle,
  onAdd,
  addLabel,
  addPlaceholder,
  addButtonLabel,
  children,
}: Props) {
  const labelId = useId()
  const [draft, setDraft] = useState('')
  // 剛輸入、還沒存過的選項也要能看到並取消，接在清單最後
  const names = [...known, ...selected.filter((n) => !known.includes(n))]

  function handleAdd() {
    onAdd(draft)
    setDraft('')
  }

  return (
    <div>
      <Input.Label id={labelId} labelElement="div">
        {label}
      </Input.Label>
      <Group role="group" aria-labelledby={labelId} gap="xs">
        {names.map((name) => {
          const isSelected = selected.includes(name)
          return (
            <Button
              key={name}
              type="button"
              size="compact-md"
              variant={isSelected ? 'filled' : 'default'}
              aria-pressed={isSelected}
              onClick={() => onToggle(name)}
            >
              {name}
            </Button>
          )
        })}
      </Group>

      {children}

      <Group gap="xs" mt="sm" wrap="nowrap">
        <TextInput
          flex={1}
          aria-label={addLabel}
          placeholder={addPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // 在欄位裡按 Enter 是新增選項，不是送出整張表單
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button type="button" variant="light" aria-label={addButtonLabel} onClick={handleAdd}>
          新增
        </Button>
      </Group>
    </div>
  )
}
