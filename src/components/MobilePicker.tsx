import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface MobilePickerOption {
  value: string
  label: ReactNode
  detail?: ReactNode
}

interface MobilePickerProps {
  ariaLabel: string
  className?: string
  menuPlacement?: 'down' | 'up'
  onChange: (value: string) => void
  options: readonly MobilePickerOption[]
  triggerLabel?: ReactNode
  value: string
}

export function MobilePicker({
  ariaLabel,
  className = '',
  menuPlacement = 'down',
  onChange,
  options,
  triggerLabel,
  value,
}: MobilePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const initialFocusIndex = useRef(0)
  const menuId = useId()
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selectedOption = options[selectedIndex]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) optionRefs.current[initialFocusIndex.current]?.focus()
  }, [open])

  const openAt = (index: number) => {
    initialFocusIndex.current = index
    setOpen(true)
  }

  const closeAndRestoreFocus = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAt(selectedIndex)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(options.length - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      openAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      openAt(options.length - 1)
    }
  }

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % options.length
    else if (event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length
    } else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = options.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeAndRestoreFocus()
      return
    }

    if (nextIndex !== undefined) {
      event.preventDefault()
      optionRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      className={`mobile-picker mobile-picker--${menuPlacement}${className ? ` ${className}` : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        className="mobile-picker__trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => {
          if (open) setOpen(false)
          else openAt(selectedIndex)
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{triggerLabel ?? selectedOption?.label}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          className="mobile-picker__menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => (
            <button
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                closeAndRestoreFocus()
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {option.detail && <small>{option.detail}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
