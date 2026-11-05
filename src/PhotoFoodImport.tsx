import { Button, Group, NativeSelect, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/domain/entry'
import type { FoodItemFormValues } from '@/domain/form'
import { buildPhotoPrompt, guessMeal, parsePhotoMeal } from '@/domain/photo-meal'
import { FoodItemRow } from './FoodItemRow'
import { resizePhoto, sharePhotoWithPrompt } from './photoFile'
import { canShareFile } from './shareFile'
import { Status } from './Status'
import { useStatus } from './useStatus'

interface Props {
  /** 常吃的食物，放進提示詞請 AI 沿用同樣的名稱 */
  knownFoods: readonly string[]
  /** 正在填的餐別，匯入時預設選它；沒有就依現在的時間猜 */
  activeMeal: MealType | null
  /** 把食物加進指定餐別，回傳實際加了幾項、略過幾項（這餐已有同名的） */
  onImport: (
    type: MealType,
    items: FoodItemFormValues[],
    note: string,
  ) => { added: number; skipped: number }
}

const PREVIEW = '辨識結果'

/** 縮好、等著分享的照片，與預覽用的暫時網址 */
interface Photo {
  file: File
  url: string
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`

/**
 * 用照片記錄食物：拍照（縮小後）連同提示詞分享給 AI App，或複製提示詞自己貼 →
 * 把 AI 回覆的 JSON 貼回來 → 檢查、修改名稱與份量 → 選一餐匯入。不用自己一項一項輸入
 */
export function PhotoFoodImport({ knownFoods, activeMeal, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  // 解析出來、等著確認的食物；null 表示還沒貼或貼的內容有問題
  const [items, setItems] = useState<FoodItemFormValues[] | null>(null)
  const [note, setNote] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  // 複製失敗時把提示詞列出來，讓使用者手動複製
  const [promptText, setPromptText] = useState('')
  const [status, setStatus] = useStatus()
  const [photo, setPhoto] = useState<Photo | null>(null)
  // 縮圖需要一點時間，這段期間先停用拍照與分享，避免分享到舊的照片
  const [busy, setBusy] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  // 預覽網址要手動釋放；用 ref 記著目前這一個，換照片、移除與離開頁面時才釋放得到
  const photoUrl = useRef('')

  useEffect(() => () => URL.revokeObjectURL(photoUrl.current), [])

  function replacePhoto(file: File | null) {
    URL.revokeObjectURL(photoUrl.current)
    photoUrl.current = file ? URL.createObjectURL(file) : ''
    setPhoto(file && { file, url: photoUrl.current })
  }

  async function pickPhoto(input: HTMLInputElement) {
    const file = input.files?.[0]
    // 清掉選取，之後再選同一張（例如重拍到同名檔）才會觸發 change
    input.value = ''
    if (!file) return
    setBusy(true)
    setStatus('')
    replacePhoto(await resizePhoto(file))
    setBusy(false)
  }

  async function sharePhoto() {
    if (!photo) return
    const { result, copied } = await sharePhotoWithPrompt(photo.file, buildPhotoPrompt(knownFoods))
    if (result === 'shared') {
      setStatus(
        copied
          ? '已分享照片；提示詞也複製了，AI 的輸入框沒有帶入提示詞的話，長按貼上即可'
          : '已分享照片；AI 的輸入框沒有帶入提示詞的話，請按「複製提示詞」後貼上',
      )
    } else if (result === 'cancelled') {
      setStatus(copied ? '已取消分享，提示詞已複製' : '已取消分享')
    } else {
      setStatus(
        copied
          ? '無法分享照片，已複製提示詞，請自己把照片貼給 AI'
          : '無法分享照片，請按「複製提示詞」，再自己把照片貼給 AI',
        true,
      )
    }
  }

  async function copyPrompt() {
    const prompt = buildPhotoPrompt(knownFoods)
    try {
      await navigator.clipboard.writeText(prompt)
      setPromptText('')
      setStatus('已複製提示詞，連同食物照片一起貼給 AI')
    } catch {
      setPromptText(prompt)
      setStatus('無法自動複製，請手動複製下方提示詞', true)
    }
  }

  function changeText(value: string) {
    setText(value)
    // 貼了新的內容，之前解析的結果就不算數了
    setItems(null)
  }

  function parse(source: string) {
    const result = parsePhotoMeal(source)
    if (!result.ok) {
      setItems(null)
      setStatus(result.error, true)
      return
    }
    setItems(result.meal.items)
    setNote(result.meal.note)
    setMealType(activeMeal ?? guessMeal(new Date()))
    setStatus(`辨識出 ${result.meal.items.length} 項，檢查名稱與份量後選擇要匯入的餐別`)
  }

  /** 直接在輸入框貼上：貼完就解析，不用再按「解析回覆」 */
  function pasteReply(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData('text')
    // 貼的不是文字（例如圖片）就維持瀏覽器原本的行為
    if (pasted.trim() === '') return
    event.preventDefault()
    // 照一般貼上的規則：取代選取的文字、插在游標處，已經貼過的內容不會被蓋掉
    const { value, selectionStart, selectionEnd } = event.currentTarget
    const next = value.slice(0, selectionStart) + pasted + value.slice(selectionEnd)
    changeText(next)
    parse(next)
  }

  async function pasteAndParse() {
    let clipboardText: string
    try {
      clipboardText = await navigator.clipboard.readText()
    } catch {
      setStatus('無法讀取剪貼簿，請長按下方輸入框貼上，再按「解析回覆」', true)
      return
    }
    changeText(clipboardText)
    parse(clipboardText)
  }

  const setItem = (index: number, patch: Partial<FoodItemFormValues>) =>
    setItems((prev) => prev && prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  // 名稱被清空的項目不會匯入（和存檔時的規則相同）
  const usable = (items ?? []).filter((i) => i.name.trim() !== '')

  function doImport() {
    const { added, skipped } = onImport(mealType, usable, note)
    const label = MEAL_LABELS[mealType]
    setStatus(
      `已加入 ${added} 項到${label}` +
        (skipped > 0 ? `（${skipped} 項${label}已有，已略過）` : '') +
        '，記得儲存',
    )
    setText('')
    setItems(null)
    setNote('')
    setPromptText('')
    replacePhoto(null)
    setOpen(false)
  }

  return (
    <Stack gap="xs">
      <Button
        type="button"
        variant="light"
        size="compact-md"
        style={{ alignSelf: 'flex-start' }}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? '收起照片辨識' : '用照片辨識食物'}
      </Button>
      {!open && status.text && <Status status={status} />}

      {open && (
        <Paper
          component="section"
          aria-label="用照片辨識食物"
          withBorder
          p="sm"
          bg="var(--mantine-color-default-hover)"
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              1. 拍下食物照片，分享給 AI（ChatGPT、Claude、Gemini
              都可以）；電腦上就複製提示詞，自己把照片貼給 AI。2. 複製 AI
              的回覆，按「貼上並解析」。3. 檢查名稱與份量，選一餐匯入。
            </Text>
            <Group gap="xs">
              <Button
                type="button"
                variant="default"
                disabled={busy}
                onClick={() => cameraInput.current?.click()}
              >
                拍照
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={busy}
                onClick={() => libraryInput.current?.click()}
              >
                選擇照片
              </Button>
              {/* capture 讓手機直接開後鏡頭；電腦上沒有作用，會變成選檔 */}
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                aria-label="食物照片（相機）"
                onChange={(e) => void pickPhoto(e.target)}
              />
              <input
                ref={libraryInput}
                type="file"
                accept="image/*"
                hidden
                aria-label="食物照片（相簿）"
                onChange={(e) => void pickPhoto(e.target)}
              />
            </Group>
            {busy && (
              <Text size="sm" c="dimmed">
                處理照片中…
              </Text>
            )}
            {photo && (
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <img
                  src={photo.url}
                  alt="食物照片預覽"
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: 'cover',
                    borderRadius: 'var(--mantine-radius-sm)',
                  }}
                />
                <Stack gap="xs" align="flex-start">
                  <Text size="xs" c="dimmed">
                    {formatSize(photo.file.size)}
                  </Text>
                  {canShareFile(photo.file) ? (
                    <Button type="button" onClick={sharePhoto}>
                      分享給 AI App
                    </Button>
                  ) : (
                    <Text size="sm" c="dimmed">
                      這裡無法直接分享照片，請複製提示詞，再把照片貼給 AI。
                    </Text>
                  )}
                  <Button
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="compact-sm"
                    onClick={() => replacePhoto(null)}
                  >
                    移除照片
                  </Button>
                </Stack>
              </Group>
            )}
            <Button
              type="button"
              variant="default"
              style={{ alignSelf: 'flex-start' }}
              onClick={copyPrompt}
            >
              複製提示詞
            </Button>
            {promptText && <Textarea label="提示詞" readOnly rows={6} value={promptText} />}

            <Textarea
              label="貼上 AI 的回覆"
              placeholder={'{"items":[{"name":"燕麥粥","amount":1,"unit":"碗"}],"note":null}'}
              rows={4}
              value={text}
              onChange={(e) => changeText(e.target.value)}
              onPaste={pasteReply}
            />
            <Group gap="xs">
              <Button type="button" onClick={pasteAndParse}>
                貼上並解析
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={text.trim() === ''}
                onClick={() => parse(text)}
              >
                解析回覆
              </Button>
            </Group>
            {status.text && <Status status={status} />}

            {items && (
              <div role="group" aria-label={PREVIEW}>
                {items.map((item, i) => (
                  <FoodItemRow
                    key={i}
                    item={item}
                    index={i}
                    scope={PREVIEW}
                    labelPrefix={`${PREVIEW}：`}
                    onChange={(patch) => setItem(i, patch)}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))}
                  />
                ))}
                <TextInput
                  mb="xs"
                  aria-label={`${PREVIEW}備註`}
                  placeholder="備註，例如：外食、家裡煮"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <NativeSelect
                    label="匯入到"
                    data={MEAL_TYPES.map((type) => ({ value: type, label: MEAL_LABELS[type] }))}
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                  />
                  <Button type="button" disabled={usable.length === 0} onClick={doImport}>
                    匯入 {usable.length} 項
                  </Button>
                </Group>
              </div>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
