import { Button, Group, Input, Stack, Text, TextInput } from '@mantine/core'
import { useId, useState } from 'react'
import {
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  SYMPTOM_SEVERITIES,
  type SymptomItem,
} from '@/domain/entry'
import { addSymptom, setSeverity, toggleSymptom } from '@/domain/symptom'

interface Props {
  /** 可以點選的症狀（預設症狀與過去用過的） */
  known: readonly string[]
  items: SymptomItem[]
  onChange: (items: SymptomItem[]) => void
}

/**
 * 點選今天有的症狀，每個症狀再選輕／中／重。
 * 常用的點一下就好；清單裡沒有的在下方輸入，之後會自動出現在清單裡。
 */
export function SymptomPicker({ known, items, onChange }: Props) {
  const labelId = useId()
  const [draft, setDraft] = useState('')
  // 剛輸入、還沒存過的症狀也要能看到並取消，接在清單最後
  const names = [...known, ...items.map((i) => i.name).filter((n) => !known.includes(n))]

  function handleAdd() {
    onChange(addSymptom(items, draft))
    setDraft('')
  }

  return (
    <div>
      <Input.Label id={labelId} labelElement="div">
        症狀
      </Input.Label>
      <Group role="group" aria-labelledby={labelId} gap="xs">
        {names.map((name) => {
          const selected = items.some((i) => i.name === name)
          return (
            <Button
              key={name}
              type="button"
              size="compact-md"
              variant={selected ? 'filled' : 'default'}
              aria-pressed={selected}
              onClick={() => onChange(toggleSymptom(items, name))}
            >
              {name}
            </Button>
          )
        })}
      </Group>

      {items.length > 0 && (
        <Stack gap="xs" mt="sm">
          {items.map((item) => (
            <Group key={item.name} justify="space-between" wrap="nowrap">
              <Text fw={500}>{item.name}</Text>
              <Group role="group" aria-label={`${item.name}的嚴重程度`} gap={4} wrap="nowrap">
                {SYMPTOM_SEVERITIES.map((severity) => {
                  const selected = item.severity === severity
                  return (
                    <Button
                      key={severity}
                      type="button"
                      size="compact-md"
                      variant={selected ? 'filled' : 'default'}
                      aria-pressed={selected}
                      aria-description={SEVERITY_DESCRIPTIONS[severity - 1]}
                      onClick={() => onChange(setSeverity(items, item.name, severity))}
                    >
                      {SEVERITY_LABELS[severity]}
                    </Button>
                  )
                })}
              </Group>
            </Group>
          ))}
          <Text size="xs" c="dimmed">
            {SEVERITY_DESCRIPTIONS.join('　')}
          </Text>
        </Stack>
      )}

      <Group gap="xs" mt="sm" wrap="nowrap">
        <TextInput
          flex={1}
          aria-label="新增其他症狀"
          placeholder="其他症狀，例如：耳鳴"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // 在欄位裡按 Enter 是新增症狀，不是送出整張表單
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button type="button" variant="light" onClick={handleAdd}>
          新增
        </Button>
      </Group>
    </div>
  )
}
