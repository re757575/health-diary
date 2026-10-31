import { Badge, Button, Container, Divider, Group, Stack, Tabs, Text, Title } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { getEntry, getLastBackupAt, getProfile, listEntries } from '@/data/repository'
import { backupStatus } from '@/domain/backup'
import { emptyForm, entryToForm, toDateString } from '@/domain/form'
import { sleepHours } from '@/domain/entry'
import { collectSymptomNames } from '@/domain/symptom'
import { collectTagNames } from '@/domain/tag'
import { AboutSection } from './AboutSection'
import { BackupNotice } from './BackupNotice'
import { Conditions } from './Conditions'
import { DataTools } from './DataTools'
import { findIncompleteDays } from '@/domain/quality'
import { EntryForm } from './EntryForm'
import { MissingNotice } from './MissingNotice'
import { ProfileForm } from './ProfileForm'
import { Section } from './Section'
import { TrendCharts } from './TrendCharts'

type TabValue = 'today' | 'trends' | 'settings'

export default function App() {
  const [tab, setTab] = useState<TabValue>('today')
  const [date, setDate] = useState(() => toDateString(new Date()))
  // 包一層物件以區分「載入中」（undefined）與「這天沒有紀錄」（{ entry: undefined }）。
  // useLiveQuery 在 date 改變後，新結果回來前會先給上一次的結果，所以結果要帶著日期，
  // 對不上目前的 date 就當作還在載入；否則表單會用上一天的資料初始化，之後也不會更新
  const loaded = useLiveQuery(async () => ({ date, entry: await getEntry(date) }), [date])
  const history = useLiveQuery(listEntries, [])
  const symptomNames = useMemo(() => collectSymptomNames(history ?? []), [history])
  const tagNames = useMemo(() => collectTagNames(history ?? []), [history])
  // 同樣包一層物件區分「載入中」與「尚未填寫」
  const profile = useLiveQuery(async () => ({ value: await getProfile() }), [])
  const lastBackup = useLiveQuery(async () => ({ at: await getLastBackupAt() }), [])
  // 每日紀錄表單是否有未儲存的修改
  const [dirty, setDirty] = useState(false)

  // 有未儲存的修改時，關閉或重新整理頁面前由瀏覽器詢問（iOS Safari 不支援，只能靠切換日期時的提醒）
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // App 開著的那天。安裝成 App 後常整晚留在背景，隔天回到前景時要換成新的今天，
  // 否則會把紀錄寫進前一天
  const [today, setToday] = useState(() => toDateString(new Date()))
  useEffect(() => {
    function checkNewDay() {
      if (document.visibilityState !== 'visible') return
      const now = toDateString(new Date())
      if (now === today) return
      setToday(now)
      // 原本停在今天、也沒有未儲存的修改才跟著換；正在看別天或改到一半就不動
      if (date === today && !dirty) setDate(now)
    }
    document.addEventListener('visibilitychange', checkNewDay)
    return () => document.removeEventListener('visibilitychange', checkNewDay)
  }, [today, date, dirty])

  /** 換一天編輯；表單是每天重新載入的，有未儲存的修改要先確認，回傳是否真的換了 */
  function changeDate(next: string): boolean {
    if (next === date) return true
    if (dirty && !window.confirm(`${date} 有尚未儲存的修改，切換日期後會遺失。確定要切換嗎？`)) {
      return false
    }
    setDate(next)
    // 修改隨著舊的表單一起捨棄；新的那天載入後表單會再回報
    setDirty(false)
    return true
  }

  // 各分頁共用同一個捲動位置，切換時回到頂端，不要停在上一頁的中段
  function changeTab(next: TabValue) {
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  // history 由新到舊，最後一筆是第一天的紀錄
  const backup =
    history &&
    lastBackup &&
    backupStatus(lastBackup.at, history[history.length - 1]?.date, new Date())

  // 歷史紀錄在「趨勢」，編輯表單在「今天」，所以選一天來編輯時要切過去
  function editDate(next: string) {
    if (changeDate(next)) changeTab('today')
  }

  return (
    <Container component="main" size="sm" py="md">
      <Title order={1} size="h2" mb="sm">
        健康日記
      </Title>

      <Tabs value={tab} onChange={(value) => changeTab(value as TabValue)}>
        <Tabs.List grow className="app-tabs">
          <Tabs.Tab value="today">今天</Tabs.Tab>
          <Tabs.Tab value="trends">趨勢</Tabs.Tab>
          <Tabs.Tab value="settings">設定</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="today" pt="md">
          <Stack gap="md">
            {backup?.due && <BackupNotice daysSince={backup.daysSince} />}
            {history && (
              <MissingNotice
                days={findIncompleteDays(history, new Date())}
                currentDate={date}
                onFill={changeDate}
              />
            )}
            <Section title="每日紀錄">
              {loaded?.date === date && (
                <EntryForm
                  key={date}
                  initial={loaded.entry ? entryToForm(loaded.entry) : emptyForm(date)}
                  onDateChange={changeDate}
                  onDirtyChange={setDirty}
                  knownSymptoms={symptomNames}
                  knownTags={tagNames}
                />
              )}
            </Section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="trends" pt="md">
          <Stack gap="md">
            {history && <TrendCharts entries={history} today={new Date()} />}

            <Section title="歷史紀錄">
              {history?.length === 0 && <Text>還沒有紀錄。</Text>}
              <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
                {history?.map((entry, i) => {
                  const hours = sleepHours(entry.sleep)
                  return (
                    <Fragment key={entry.date}>
                      {i > 0 && <Divider component="li" />}
                      <Group component="li" justify="space-between" wrap="nowrap" py="xs">
                        <div>
                          <Group gap="xs">
                            <Text fw={600}>{entry.date}</Text>
                            {entry.date === date && (
                              <Badge variant="light" size="sm">
                                編輯中
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm" c="dimmed">
                            {[
                              entry.weightKg !== undefined && `${entry.weightKg} kg`,
                              hours !== undefined && `睡 ${hours} 小時`,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '只有文字紀錄'}
                          </Text>
                        </div>
                        <Button
                          variant="light"
                          size="compact-md"
                          aria-label={`編輯 ${entry.date}`}
                          onClick={() => editDate(entry.date)}
                        >
                          編輯
                        </Button>
                      </Group>
                    </Fragment>
                  )
                })}
              </Stack>
            </Section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <Stack gap="md">
            <Conditions />

            <Section title="基本資料">{profile && <ProfileForm initial={profile.value} />}</Section>

            <DataTools />

            <AboutSection />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
