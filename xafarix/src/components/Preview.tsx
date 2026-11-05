import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Orientation } from '../types'
import { PX_PER_MM, pageBox } from '../paper'

/**
 * Scales the sheet down to fit the available pane.
 *
 * The sheet itself is always rendered at true A4 size; only a CSS transform
 * shrinks it for the screen. That keeps one source of truth — what you see is
 * literally the printed page, viewed smaller — and because transforms do not
 * affect layout boxes, the fit measurements in fit.ts are unaffected.
 */
export default function Preview({
  orientation,
  children,
}: {
  orientation: Orientation
  children: ReactNode
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const box = pageBox(orientation)
  const pageW = box.w * PX_PER_MM
  const pageH = box.h * PX_PER_MM

  const measure = useCallback(() => {
    const pane = paneRef.current
    if (!pane) return
    const style = getComputedStyle(pane)
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const availW = pane.clientWidth - padX
    const availH = pane.clientHeight - padY
    if (availW <= 0 || availH <= 0) return
    setScale(Math.min(1, availW / pageW, availH / pageH))
  }, [pageW, pageH])

  useEffect(() => {
    measure()
    const pane = paneRef.current
    if (!pane || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(pane)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div className="preview" ref={paneRef}>
      <div
        className="preview__stage"
        style={{
          transform: `scale(${scale})`,
          width: `${pageW * scale}px`,
          height: `${pageH * scale}px`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
