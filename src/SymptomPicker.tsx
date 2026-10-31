import { Button, Group, Stack, Text } from '@mantine/core'
import {
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  SYMPTOM_SEVERITIES,
  type SymptomItem,
} from '@/domain/entry'
import { addSymptom, setSeverity, toggleSymptom } from '@/domain/symptom'
import { ChipChoices } from './ChipChoices'

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
  return (
    <ChipChoices
      label="症狀"
      known={known}
      selected={items.map((i) => i.name)}
      onToggle={(name) => onChange(toggleSymptom(items, name))}
      onAdd={(name) => onChange(addSymptom(items, name))}
      addLabel="新增其他症狀"
      addPlaceholder="其他症狀，例如：耳鳴"
      addButtonLabel="新增症狀"
    >
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
    </ChipChoices>
  )
}
