/**
 * Shrink-to-fit type sizing.
 *
 * The approach is borrowed from fitty / textFit: binary-search the font size
 * until the content just fits its box. The difference is that we search ONE
 * size for the whole page rather than a size per cell. A menu where every
 * cocktail is set at a different size looks like a mistake; a menu where they
 * all share the largest size that still fits looks typeset.
 *
 * fitty's readme warns that custom web fonts invalidate any measurement taken
 * before they load, so callers re-run this on `document.fonts.ready`.
 */

const MIN_PX = 3
const MAX_PX = 400
const ITERATIONS = 16
/** Sub-pixel slack, so a 0.3px rounding error does not shrink the whole page. */
const SLACK = 1

function overflows(cells: HTMLElement[]): boolean {
  for (const cell of cells) {
    if (cell.scrollHeight > cell.clientHeight + SLACK) return true
    if (cell.scrollWidth > cell.clientWidth + SLACK) return true
  }
  return false
}

/**
 * Finds the largest base font size (in px) at which no cell overflows, and
 * applies it to `page` as the `--fs` custom property.
 *
 * @param page  element carrying the `--fs` variable
 * @param cells the boxes that must not overflow
 * @returns the chosen size in px
 */
export function fitPage(page: HTMLElement, cells: HTMLElement[]): number {
  if (cells.length === 0) return MIN_PX

  let lo = MIN_PX
  let hi = MAX_PX

  // Confirm the floor is actually feasible; if even MIN_PX overflows there is
  // nothing to search for and we take the floor rather than loop pointlessly.
  page.style.setProperty('--fs', `${MIN_PX}px`)
  void page.offsetHeight
  if (overflows(cells)) {
    return MIN_PX
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    page.style.setProperty('--fs', `${mid}px`)
    // Force a synchronous layout so the measurements below are current.
    void page.offsetHeight
    if (overflows(cells)) {
      hi = mid
    } else {
      lo = mid
    }
  }

  const chosen = Math.floor(lo * 100) / 100
  page.style.setProperty('--fs', `${chosen}px`)
  return chosen
}
