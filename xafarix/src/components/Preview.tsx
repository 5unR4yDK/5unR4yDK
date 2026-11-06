import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { Orientation } from '../types'
import { PX_PER_MM, pageBox } from '../paper'

/**
 * Scales the sheet down to fit the available pane, or shows it at actual size.
 *
 * The sheet itself is always rendered at true A4 size; only a CSS transform
 * shrinks it for the screen. That keeps one source of truth — what you see is
 * literally the printed page, viewed smaller — and because transforms do not
 * affect layout boxes, the fit measurements in fit.ts are unaffected.
 *
 * Fitting a landscape A4 onto an upright phone leaves the ingredient line
 * about 4px tall: the composition reads, the words do not. "Actual size" shows
 * the sheet at its printed scale and lets the pane scroll around it.
 */
export default function Preview({
  orientation,
  stageRef,
  children,
}: {
  orientation: Orientation
  /** Owned by App: the PDF exporter removes this transform while measuring. */
  stageRef: RefObject<HTMLDivElement>
  children: ReactNode
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [actual, setActual] = useState(false)
  const scale = actual ? 1 : fitScale

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
    setFitScale(Math.min(1, availW / pageW, availH / pageH))
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

  // Each switch starts from the top-left corner, where the title is.
  useEffect(() => {
    paneRef.current?.scrollTo({ left: 0, top: 0 })
  }, [actual])

  return (
    <div className="preview" ref={paneRef}>
      <div
        ref={stageRef}
        className="preview__stage"
        style={{
          transform: `scale(${scale})`,
          width: `${pageW * scale}px`,
          height: `${pageH * scale}px`,
        }}
      >
        {children}
      </div>

      {/* Only worth offering when fitting actually shrinks the sheet. */}
      {(fitScale < 0.98 || actual) && (
        <button
          type="button"
          className="zoom-toggle"
          aria-pressed={actual}
          onClick={() => setActual((v) => !v)}
        >
          {actual ? 'Fit page' : 'Actual size'}
        </button>
      )}
    </div>
  )
}
