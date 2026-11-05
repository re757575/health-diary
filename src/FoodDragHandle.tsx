import { ActionIcon } from '@mantine/core'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { MealType } from '@/domain/entry'
import { createDragGhost, type DragGhost } from './dragGhost'

/** 拖到離畫面上下緣這麼近（px）就自動捲動，長表單才拖得到畫面外的那一餐 */
const SCROLL_EDGE = 72
const SCROLL_STEP = 14

/** 拖到的位置：哪一餐，以及插在那一餐第幾項前面（0 是最前面，項數是最後面） */
export interface DropPosition {
  meal: MealType
  position: number
}

interface Props {
  /** 食物名稱，放進無障礙名稱 */
  name: string
  onStart: () => void
  /** 手指或滑鼠移到某一餐上面（null 表示不在任何一餐上） */
  onOver: (target: DropPosition | null) => void
  /** 放開；target 是放開時所在的位置，null 表示取消或不在任何一餐上 */
  onEnd: (target: DropPosition | null) => void
  /** 鍵盤上下鍵：往上（-1）或往下（1）移一格 */
  onStep: (direction: -1 | 1) => void
}

/** 手指或滑鼠底下是哪一餐的哪個位置（餐別區塊標了 data-meal-type，每一列標了 data-food-row） */
function dropPositionAt(x: number, y: number): DropPosition | null {
  const group = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-meal-type]')
  if (!group) return null
  // 位置 = 中線在手指上方的列數：手指在某一列的上半就插在它前面，下半就插在它後面
  let position = 0
  for (const row of group.querySelectorAll('[data-food-row]')) {
    const { top, height } = row.getBoundingClientRect()
    if (y > top + height / 2) position++
  }
  return { meal: group.dataset.mealType as MealType, position }
}

/** 常見的拖曳把手圖示：點陣（六顆點，2 欄 × 3 列），顏色跟著文字 */
function GripIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      {[5.5, 12.5].flatMap((cx) =>
        [3.5, 9, 14.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" />),
      )}
    </svg>
  )
}

/**
 * 一項食物前面的拖曳把手：按住拖到想放的位置放開，就把這項食物移過去，可以換餐也可以只換順序。
 * 用 Pointer Events 實作，滑鼠與手機觸控都能用；沒辦法拖的人可以聚焦後用上下鍵往上或往下移一格
 */
export function FoodDragHandle({ name, onStart, onOver, onEnd, onStep }: Props) {
  // 拖曳中的狀態放在 ref：每次移動都會更新，不需要重新繪製
  const active = useRef(false)
  const target = useRef<DropPosition | null>(null)
  const scrollSpeed = useRef(0)
  const frame = useRef(0)
  const ghost = useRef<DragGhost | null>(null)

  function stopScroll() {
    scrollSpeed.current = 0
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }
  /** 收掉浮起的那一列，游標恢復原樣 */
  function dropGhost() {
    ghost.current?.remove()
    ghost.current = null
    document.body.style.cursor = ''
  }
  // 拖曳到一半元件被拿掉（例如換日）時也要停掉捲動、收掉浮起的那一列
  useEffect(
    () => () => {
      stopScroll()
      dropGhost()
    },
    [],
  )

  function tickScroll() {
    if (scrollSpeed.current === 0) {
      frame.current = 0
      return
    }
    window.scrollBy(0, scrollSpeed.current)
    frame.current = requestAnimationFrame(tickScroll)
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current = true
    target.current = null
    // 抓起來：那一列浮起跟著手指走，原本的位置變淡當佔位；行動裝置輕輕震一下（不支援的略過）
    const row = event.currentTarget.closest<HTMLElement>('[data-food-row]')
    if (row) ghost.current = createDragGhost(row, event.clientX, event.clientY)
    document.body.style.cursor = 'grabbing'
    navigator.vibrate?.(10)
    onStart()
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!active.current) return
    ghost.current?.move(event.clientX, event.clientY)
    const next = dropPositionAt(event.clientX, event.clientY)
    if (next?.meal !== target.current?.meal || next?.position !== target.current?.position) {
      target.current = next
      onOver(next)
    }
    const { clientY } = event
    scrollSpeed.current =
      clientY < SCROLL_EDGE
        ? -SCROLL_STEP
        : clientY > window.innerHeight - SCROLL_EDGE
          ? SCROLL_STEP
          : 0
    if (scrollSpeed.current !== 0 && frame.current === 0) {
      frame.current = requestAnimationFrame(tickScroll)
    }
  }

  function finish(dropped: boolean) {
    if (!active.current) return
    active.current = false
    stopScroll()
    dropGhost()
    const last = target.current
    target.current = null
    onEnd(dropped ? last : null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      onStep(event.key === 'ArrowUp' ? -1 : 1)
    }
  }

  return (
    <ActionIcon
      type="button"
      variant="subtle"
      color="gray"
      size="input-md"
      // touch-action: none 讓手指在把手上拖不會變成捲動頁面；寬度比高度窄，把空間留給名稱欄位
      style={{ touchAction: 'none', cursor: 'grab', width: 28, minWidth: 28 }}
      data-food-handle
      aria-label={`拖曳 ${name}`}
      aria-description="按住拖到想放的位置，可以換到其他餐；也可以按上下鍵往上或往下移一格"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onKeyDown={handleKeyDown}
    >
      <GripIcon />
    </ActionIcon>
  )
}
