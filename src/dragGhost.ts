/** 浮起時略微放大的倍率 */
const LIFT_SCALE = 1.03

export interface DragGhost {
  /** 跟著手指或滑鼠移動 */
  move: (x: number, y: number) => void
  remove: () => void
}

/**
 * 拖曳時跟著手指走的「浮起」的那一列：複製原本那一列（原本的留在原地變淡當佔位），
 * 略微放大、加陰影、半透明，看起來像被從畫面上提起來。
 * 只是畫面效果：複製出來的不能操作，也不會被輔助技術讀到
 */
export function createDragGhost(row: HTMLElement, startX: number, startY: number): DragGhost {
  const rect = row.getBoundingClientRect()
  const ghost = row.cloneNode(true) as HTMLElement

  // 複製不會帶走使用者正在輸入的值（只有屬性被複製），逐一補上
  const sources = row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
  ghost.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((el, i) => {
    el.value = sources[i].value
  })
  // 複製的不能再被當成食物列、把手或有 id 的欄位找到
  ghost.removeAttribute('data-food-row')
  ghost
    .querySelectorAll('[data-food-handle]')
    .forEach((el) => el.removeAttribute('data-food-handle'))
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute('inert', '')
  ghost.dataset.dragGhost = ''

  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    margin: '0',
    zIndex: '1000',
    pointerEvents: 'none',
    opacity: '0.9',
    boxShadow: 'var(--mantine-shadow-md)',
    background: 'var(--mantine-color-body)',
    borderRadius: 'var(--mantine-radius-sm)',
    transform: `scale(${LIFT_SCALE})`,
  })
  document.body.append(ghost)

  return {
    move(x, y) {
      ghost.style.transform = `translate(${x - startX}px, ${y - startY}px) scale(${LIFT_SCALE})`
    },
    remove: () => ghost.remove(),
  }
}
