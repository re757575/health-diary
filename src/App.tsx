import { Box, Container, Stack, Tabs, Title } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { clearDraft } from '@/data/draft'
import {
  getEntry,
  getLastBackupAt,
  getProfile,
  listEntries,
  listFoods,
  listMedications,
  listVisits,
} from '@/data/repository'
import { backupStatus } from '@/domain/backup'
import { emptyForm, entryToForm, shiftDate, toDateString } from '@/domain/form'
import { collectSymptomNames } from '@/domain/symptom'
import { MEAL_TYPES } from '@/domain/entry'
import { sortFoodsByUsage } from '@/domain/food'
import { activeMedications, collectAsNeededNames } from '@/domain/medication'
import { collectTagNames } from '@/domain/tag'
import { FOLLOW_UP_REMINDER_DAYS, upcomingFollowUps } from '@/domain/visit'
import { weightOn } from '@/domain/weight'
import { AboutSection } from './AboutSection'
import { BackupNotice } from './BackupNotice'
import { Conditions } from './Conditions'
import { DataTools } from './DataTools'
import { findIncompleteDays } from '@/domain/quality'
import { EntryForm } from './EntryForm'
import { HistoryList } from './HistoryList'
import { FollowUpNotice } from './FollowUpNotice'
import { Foods } from './Foods'
import { Medications } from './Medications'
import { MissingNotice } from './MissingNotice'
import { ProfileForm } from './ProfileForm'
import { Report } from './Report'
import { Section } from './Section'
import { TrendCharts } from './TrendCharts'
import { UpdateNotice } from './UpdateNotice'
import { Visits } from './Visits'
import { useAppUpdate } from './useAppUpdate'

type TabValue = 'today' | 'trends' | 'visits' | 'report' | 'settings'

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
  const asNeededNames = useMemo(() => collectAsNeededNames(history ?? []), [history])
  const medications = useLiveQuery(listMedications, [])
  const foodList = useLiveQuery(listFoods, [])
  const visits = useLiveQuery(listVisits, [])
  // 每一餐依那一餐吃過的次數排序，早餐常吃的不一定是晚餐常吃的
  const foodsByMeal = useMemo(
    () =>
      Object.fromEntries(
        MEAL_TYPES.map((type) => [type, sortFoodsByUsage(foodList ?? [], history ?? [], type)]),
      ),
    [foodList, history],
  )
  // 照片辨識的提示詞用：整體最常吃的排前面
  const knownFoods = useMemo(
    () => sortFoodsByUsage(foodList ?? [], history ?? []),
    [foodList, history],
  )
  const todaysMedications = useMemo(
    () => activeMedications(medications ?? [], date),
    [medications, date],
  )
  // 體重沒填的日子沿用之前最近一次，表單上提示會沿用多少
  const previousWeight = useMemo(
    () => weightOn(history ?? [], shiftDate(date, -1)),
    [history, date],
  )
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

  // 新版本裝好後，沒有未儲存的修改就趁切到背景時套用（會重新載入頁面），使用者不會看到畫面跳動
  const { updateReady, applyUpdate } = useAppUpdate()
  useEffect(() => {
    if (!updateReady || dirty) return
    function applyWhenHidden() {
      if (document.visibilityState === 'hidden') applyUpdate()
    }
    document.addEventListener('visibilitychange', applyWhenHidden)
    return () => document.removeEventListener('visibilitychange', applyWhenHidden)
  }, [updateReady, dirty, applyUpdate])

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
    // 修改隨著舊的表單一起捨棄（草稿也清掉，不然回到那天又會還原）；新的那天載入後表單會再回報
    if (dirty) clearDraft(date)
    setDate(next)
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

  // 回診前幾天在「今天」提醒；以 App 開著的今天為準，不是正在編輯的那天
  const followUps = upcomingFollowUps(visits ?? [], today).filter(
    (f) => f.daysLeft <= FOLLOW_UP_REMINDER_DAYS,
  )

  // 歷史紀錄在「趨勢」，編輯表單在「今天」，所以選一天來編輯時要切過去
  function editDate(next: string) {
    if (changeDate(next)) changeTab('today')
  }

  return (
    <Container component="main" size="sm" py="md">
      {/* 列印就醫報告時，App 標題與更新提示都不印 */}
      <Title order={1} size="h2" mb="sm" className="no-print">
        健康日記
      </Title>

      {updateReady && (
        <Box mb="sm" className="no-print">
          <UpdateNotice dirty={dirty} onUpdate={applyUpdate} />
        </Box>
      )}

      <Tabs value={tab} onChange={(value) => changeTab(value as TabValue)}>
        <Tabs.List grow className="app-tabs">
          <Tabs.Tab value="today">今天</Tabs.Tab>
          <Tabs.Tab value="trends">趨勢</Tabs.Tab>
          <Tabs.Tab value="visits">就醫</Tabs.Tab>
          <Tabs.Tab value="report">報告</Tabs.Tab>
          <Tabs.Tab value="settings">設定</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="today" pt="md">
          <Stack gap="md">
            {followUps.length > 0 && (
              <FollowUpNotice followUps={followUps} onOpen={() => changeTab('visits')} />
            )}
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
                  previousWeight={previousWeight}
                  medications={todaysMedications}
                  knownAsNeeded={asNeededNames}
                  foodsByMeal={foodsByMeal}
                  knownFoods={knownFoods}
                />
              )}
            </Section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="trends" pt="md">
          <Stack gap="md">
            {history && (
              <TrendCharts entries={history} today={new Date()} medications={medications} />
            )}

            {history && <HistoryList entries={history} editingDate={date} onEdit={editDate} />}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="visits" pt="md">
          <Visits />
        </Tabs.Panel>

        <Tabs.Panel value="report" pt="md">
          {history && (
            <Report entries={history} medications={medications ?? []} visits={visits ?? []} />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <Stack gap="md">
            <Conditions />

            <Medications />

            <Foods />

            <Section title="基本資料">{profile && <ProfileForm initial={profile.value} />}</Section>

            <DataTools />

            <AboutSection />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
