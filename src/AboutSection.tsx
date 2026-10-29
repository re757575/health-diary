import { Group, Text } from '@mantine/core'
import { useId } from 'react'
import { Section } from './Section'

/** 頁面最下方的「關於」：目前的 App 版本，回報問題或確認已更新到新版時用 */
export function AboutSection() {
  const versionId = useId()
  return (
    <Section title="關於">
      <Group component="dl" gap="xs" m={0}>
        <Text component="dt" id={versionId} c="dimmed">
          版本
        </Text>
        <Text component="dd" aria-labelledby={versionId} m={0}>
          v{__APP_VERSION__}
        </Text>
      </Group>
    </Section>
  )
}
