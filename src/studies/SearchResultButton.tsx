import { useRef, type ComponentPropsWithoutRef, type TouchEvent } from 'react'

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'onClick'> & { onSelect: () => void }

export function SearchResultButton({ onSelect, ...props }: Props) {
  const touch = useRef<{ id: number; x: number; y: number; scrollTop: number } | null>(null)
  const scrollTop = (button: HTMLButtonElement) => button.closest('.search-results')?.scrollTop ?? 0
  const select = () => {
    onSelect()
    const focused = document.activeElement
    if (focused instanceof HTMLElement && focused.closest('.train-search')) focused.blur()
  }
  const startTouch = (event: TouchEvent<HTMLButtonElement>) => {
    const point = event.touches[0]
    touch.current = event.touches.length === 1
      ? { id: point.identifier, x: point.clientX, y: point.clientY, scrollTop: scrollTop(event.currentTarget) }
      : null
  }
  const moveTouch = (event: TouchEvent<HTMLButtonElement>) => {
    const start = touch.current, point = event.touches[0]
    if (start && (event.touches.length !== 1 || point.identifier !== start.id || Math.hypot(point.clientX - start.x, point.clientY - start.y) > 10)) touch.current = null
  }
  const endTouch = (event: TouchEvent<HTMLButtonElement>) => {
    // Activate before keyboard dismissal can swallow the compatibility click.
    // Cancel its default so the revealed controls cannot receive a second click.
    event.preventDefault()
    const start = touch.current
    touch.current = null
    const point = Array.from(event.changedTouches).find(point => point.identifier === start?.id)
    if (!start || !point || event.touches.length || Math.hypot(point.clientX - start.x, point.clientY - start.y) > 10 || start.scrollTop !== scrollTop(event.currentTarget)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (point.clientX < bounds.left || point.clientX > bounds.right || point.clientY < bounds.top || point.clientY > bounds.bottom) return
    select()
  }
  return <button {...props}
    onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault() }}
    onPointerCancel={() => { touch.current = null }}
    onTouchStart={startTouch}
    onTouchMove={moveTouch}
    onTouchCancel={() => { touch.current = null }}
    onTouchEnd={endTouch}
    onClick={select}
  />
}
