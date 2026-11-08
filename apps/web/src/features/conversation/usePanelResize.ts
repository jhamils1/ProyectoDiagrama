import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

const DEFAULT_WIDTH = 380

export function usePanelResize() {
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ id: number; x: number; width: number } | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [maximum, setMaximum] = useState(720)
  const [resizing, setResizing] = useState(false)
  const minimum = Math.min(320, maximum)
  const clamp = (value: number) => Math.round(Math.max(minimum, Math.min(maximum, value)))

  useEffect(() => {
    const parent = panel.current?.parentElement
    if (!parent) return
    const measure = () => {
      // Leave room for the diagram on desktop; match the overlay bounds on mobile.
      const available = parent.getBoundingClientRect().width
      const limit = Math.max(1, Math.floor(window.innerWidth <= 850
        ? available * .94 : Math.min(720, available - 320)))
      setMaximum(limit)
      setWidth(current => Math.max(Math.min(320, limit), Math.min(limit, current)))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    if (!resizing) return
    const previousCursor = document.body.style.cursor
    const previousSelection = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelection
    }
  }, [resizing])

  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return {
    panel, width, minimum, maximum, resizing,
    separator: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || drag.current) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { id: event.pointerId, x: event.clientX, width: panel.current?.getBoundingClientRect().width ?? width }
        setResizing(true)
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const start = drag.current
        if (start?.id === event.pointerId) setWidth(clamp(start.width + start.x - event.clientX))
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
      onDoubleClick() { setWidth(clamp(DEFAULT_WIDTH)) },
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Escape' && drag.current) {
          event.stopPropagation()
          setWidth(clamp(drag.current.width))
          const id = drag.current.id
          drag.current = null
          setResizing(false)
          if (event.currentTarget.hasPointerCapture(id)) event.currentTarget.releasePointerCapture(id)
          return
        }
        const step = event.shiftKey ? 50 : 10
        const next = event.key === 'ArrowLeft' ? width + step : event.key === 'ArrowRight' ? width - step
          : event.key === 'Home' ? minimum : event.key === 'End' ? maximum : null
        if (next !== null) { event.preventDefault(); setWidth(clamp(next)) }
      },
    },
  }
}
