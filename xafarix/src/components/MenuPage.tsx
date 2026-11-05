import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Menu } from '../types'
import { chooseGrid } from '../layout'
import { pageBox } from '../paper'
import { fitPage } from '../fit'

/** 1 CSS px at the 96dpi print reference is 0.75pt. */
const PT_PER_PX = 0.75
/** Printed body copy below this is not worth reading. */
export const MIN_BODY_PT = 6

export interface FitReport {
  /** Chosen base (cocktail name) size, in px at 96dpi. */
  namePx: number
  /** The smallest text actually rendered on the sheet, in points on paper. */
  bodyPt: number
  cols: number
  rows: number
}

/**
 * Secondary text does not stay at a fixed fraction of the name.
 *
 * On a one-cocktail hero page the name is enormous and the description wants
 * to be a quiet 28% of it. On a forty-cocktail page the name is already small,
 * and holding the description at 28% would make it illegible — so the ratio
 * climbs towards parity as the menu gets denser.
 */
/**
 * The size of the smallest text actually on the sheet, in points.
 *
 * Measured rather than derived. The secondary sizes are fractions set in CSS,
 * and recomputing them here would be a second copy of those numbers that
 * silently goes stale the moment the stylesheet is retuned — which is exactly
 * what happened when the type scale changed and this still reported a size no
 * element had.
 */
function smallestTextPt(gridEl: HTMLElement, fallbackPx: number): number {
  const probes = gridEl.querySelectorAll<HTMLElement>('.cell__ing, .cell__desc')
  let smallest = Infinity
  for (const el of probes) {
    const px = parseFloat(getComputedStyle(el).fontSize)
    if (Number.isFinite(px) && px > 0) smallest = Math.min(smallest, px)
  }
  return (Number.isFinite(smallest) ? smallest : fallbackPx) * PT_PER_PX
}

function subRatio(n: number): number {
  const t = Math.min(1, Math.max(0, (n - 1) / 19))
  return 0.28 + (0.66 - 0.28) * t
}

function gapMm(cellW: number, cellH: number): number {
  return Math.min(9, Math.max(2.2, Math.min(cellW, cellH) * 0.14))
}

interface Props {
  menu: Menu
  onFit?: (report: FitReport) => void
  /** Owned by App so the PDF exporter can measure the rendered sheet. */
  pageRef: RefObject<HTMLDivElement>
}

export default function MenuPage({ menu, onFit, pageRef }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  const box = pageBox(menu.orientation)
  const items = menu.cocktails
  const n = items.length

  const grid = useMemo(
    () => chooseGrid(Math.max(n, 1), box.innerW, box.innerH),
    [n, box.innerW, box.innerH],
  )

  const sub = subRatio(Math.max(n, 1))
  const gap = gapMm(box.innerW / grid.cols, box.innerH / grid.rows)

  // The whole point of the app: re-solve the type size whenever anything that
  // could change the fit changes.
  const signature =
    JSON.stringify(items) + menu.title + menu.subtitle + menu.orientation

  const runFit = useCallback(() => {
    const page = pageRef.current
    const gridEl = gridRef.current
    if (!page || !gridEl) return
    const cells = Array.from(gridEl.querySelectorAll<HTMLElement>('.cell'))
    const namePx = fitPage(page, cells)
    // 0 means the sheet is not currently laid out (a hidden tab, for
    // instance). Leave the last good size in place and wait to be called
    // again rather than reporting a bogus one.
    if (namePx <= 0) return
    onFit?.({
      namePx,
      bodyPt: smallestTextPt(gridEl, namePx),
      cols: grid.cols,
      rows: grid.rows,
    })
    // onFit is a reporting callback; including it would re-run the search on
    // every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, grid.cols, grid.rows])

  // useLayoutEffect so the user never sees a frame at the wrong size.
  useLayoutEffect(() => {
    runFit()
  }, [signature, gap, runFit])

  // fitty's readme makes the point that any measurement taken before the web
  // font loads is wrong, so the search is repeated once the font is in.
  useEffect(() => {
    if (!('fonts' in document)) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) runFit()
    })
    return () => {
      cancelled = true
    }
  }, [signature, runFit])

  // On a phone the sheet lives in a tab and is display:none until selected,
  // which means its first fit happened against a zero-size box and was
  // skipped. Watching its box catches the moment it becomes real.
  useEffect(() => {
    const page = pageRef.current
    if (!page || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => runFit())
    ro.observe(page)
    return () => ro.disconnect()
  }, [runFit, pageRef])

  const hasHeader = menu.title.trim() !== '' || menu.subtitle.trim() !== ''

  return (
    <div
      ref={pageRef}
      className="page"
      style={{
        width: `${box.w}mm`,
        height: `${box.h}mm`,
        padding: `${(box.h - box.innerH) / 2}mm ${(box.w - box.innerW) / 2}mm`,
        ['--cols' as string]: grid.cols,
        ['--rows' as string]: grid.rows,
        ['--gap' as string]: `${gap}mm`,
        ['--sub' as string]: sub,
        ['--fs' as string]: '24px',
      }}
    >
      {hasHeader && (
        <header className="page__header">
          {menu.title.trim() !== '' && <h2 className="page__title">{menu.title}</h2>}
          {menu.subtitle.trim() !== '' && <p className="page__subtitle">{menu.subtitle}</p>}
        </header>
      )}

      <div
        className={`page__grid${grid.rows > 1 ? ' page__grid--stacked' : ''}`}
        ref={gridRef}
      >
        {n === 0 ? (
          <div className="cell cell--empty">
            <p className="cell__name">Your first cocktail</p>
            <p className="cell__desc">Type it on the left and it appears here.</p>
          </div>
        ) : (
          items.map((c) => (
            <article className="cell" key={c.id}>
              {c.name.trim() !== '' && <h3 className="cell__name">{c.name}</h3>}
              {c.description.trim() !== '' && <p className="cell__desc">{c.description}</p>}
              {c.ingredients.trim() !== '' && <p className="cell__ing">{c.ingredients}</p>}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
