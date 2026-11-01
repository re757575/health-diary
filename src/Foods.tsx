import { Button, FileButton, Group, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { addFoods, deleteFood, listFoods } from '@/data/repository'
import { filterFoods, formatFoodList, splitFoodList } from '@/domain/food'
import { toDateString } from '@/domain/form'
import { shareOrDownload } from './shareFile'
import { Section } from './Section'
import { Status } from './Status'
import { useStatus } from './useStatus'

/** 常吃的食物清單：貼上或從檔案匯入，之後在每日紀錄的三餐可以直接點選 */
export function Foods() {
  const foods = useLiveQuery(listFoods, [])
  const [text, setText] = useState('')
  // 清單變長之後，用來找出要移除的項目
  const [search, setSearch] = useState('')
  const [status, setStatus, tryWrite] = useStatus()
  const resetFileRef = useRef<() => void>(null)

  async function importList(source: string) {
    const names = splitFoodList(source)
    if (names.length === 0) {
      setStatus('沒有找到食物名稱，請一行一個，或用逗號、頓號分隔', true)
      return
    }
    await tryWrite(async () => {
      // 同一份清單裡重複的、已經在清單裡的（寫法稍有不同也算）都略過，一起算進略過的數量
      const added = await addFoods(names)
      const skipped = names.length - added
      setStatus(`已加入 ${added} 項` + (skipped > 0 ? `（${skipped} 項重複，已略過）` : ''))
      setText('')
    }, '匯入失敗')
  }

  async function handleFile(file: File | null) {
    resetFileRef.current?.() // 讓同一個檔案可以再選一次
    if (file) await importList(await file.text())
  }

  /** 匯出成一行一個的文字檔，可以直接用「從檔案匯入」匯回來（換手機或分享給家人） */
  async function handleExport() {
    if (!foods || foods.length === 0) return
    await tryWrite(async () => {
      const file = new File(
        [formatFoodList(foods)],
        `health-diary-foods-${toDateString(new Date())}.txt`,
        { type: 'text/plain' },
      )
      const result = await shareOrDownload(file, '常吃的食物')
      setStatus(result === 'cancelled' ? '已取消匯出' : `已匯出 ${foods.length} 項`)
    }, '匯出失敗')
  }

  async function handleDelete(name: string) {
    await tryWrite(async () => {
      await deleteFood(name)
      setStatus(`已移除「${name}」`)
    }, '移除失敗')
  }

  return (
    <Section title="常吃的食物">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          匯入常吃的食物後，在每日紀錄點一下餐別的「新增食物」，就能直接點選加入，常吃的會排在前面。每日紀錄存檔時，清單裡沒有的食物也會自動加進來。
        </Text>
        <Textarea
          label="貼上食物清單"
          placeholder={'一行一個，或用逗號、頓號分隔，例如：\n燕麥、香蕉、無糖豆漿'}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Group>
          <Button type="button" onClick={() => importList(text)} disabled={text.trim() === ''}>
            匯入清單
          </Button>
          <FileButton
            resetRef={resetFileRef}
            accept=".txt,.csv,text/plain,text/csv"
            onChange={handleFile}
            inputProps={{ 'aria-label': '從檔案匯入食物清單' }}
          >
            {(props) => (
              <Button variant="light" {...props}>
                從檔案匯入（.txt、.csv）
              </Button>
            )}
          </FileButton>
          <Button
            type="button"
            variant="light"
            onClick={handleExport}
            disabled={!foods || foods.length === 0}
          >
            匯出清單
          </Button>
        </Group>
        <Status status={status} />

        {foods && foods.length > 0 && (
          <div>
            <TextInput
              label="搜尋清單"
              placeholder="輸入名稱找出食物"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              mb="xs"
            />
            <Text size="sm" fw={500} mb={4}>
              {search.trim()
                ? `符合 ${filterFoods(foods, search).length} 項（共 ${foods.length} 項，點一下移除）`
                : `目前 ${foods.length} 項（點一下移除）`}
            </Text>
            <Group gap="xs" role="group" aria-label="常吃的食物清單">
              {filterFoods(foods, search).map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="compact-md"
                  variant="default"
                  aria-label={`移除 ${name}`}
                  onClick={() => handleDelete(name)}
                >
                  {name}
                  <span aria-hidden="true" style={{ marginLeft: '0.375em', opacity: 0.6 }}>
                    ×
                  </span>
                </Button>
              ))}
            </Group>
          </div>
        )}
      </Stack>
    </Section>
  )
}
