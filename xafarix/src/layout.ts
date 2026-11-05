/**
 * Grid packing for a fixed page.
 *
 * Off-the-shelf libraries (fitty, textFit) solve "shrink this text to fill its
 * box". None of them answer the question this app actually has: given N
 * cocktails and one sheet of A4, how many columns and rows should there be?
 * That decision is made here; the text sizing itself is in fit.ts.
 *
 * The method: score every possible column count and keep the best. A score
 * combines three things a designer would actually look at —
 *
 *   1. cell proportion, against a target that shifts with the item count.
 *      A hero cocktail wants a roughly square block; twenty-seven of them
 *      want wide, shallow list rows.
 *   2. wasted slots. A trailing gap is far more visible in a 3-item menu
 *      than in a 40-item one, so the penalty is relative to N.
 *   3. hard readability floors. A column narrower than ~44mm cannot hold a
 *      cocktail name and a description without breaking words apart, and a
 *      row shallower than ~14mm cannot hold three lines of type at all.
 */

export interface Grid {
  cols: number
  rows: number
}

/** Below this column width a name + description starts breaking mid-word. */
const MIN_CELL_W_MM = 44
/** Below this row height three lines of type stop fitting legibly. */
const MIN_CELL_H_MM = 14

/** Cell proportion (w/h) wanted when there are very few items. */
const TARGET_ASPECT_FEW = 1.15
/** Cell proportion wanted once the menu is dense. */
const TARGET_ASPECT_MANY = 2.3
/** Item count at which "dense" is reached. */
const DENSE_AT = 24

const EMPTY_SLOT_WEIGHT = 1.5
const FLOOR_WEIGHT = 4

export function targetAspect(n: number): number {
  const t = Math.min(1, Math.max(0, (n - 1) / (DENSE_AT - 1)))
  return TARGET_ASPECT_FEW + (TARGET_ASPECT_MANY - TARGET_ASPECT_FEW) * t
}

export function scoreGrid(
  n: number,
  cols: number,
  rows: number,
  w: number,
  h: number,
): number {
  const cellW = w / cols
  const cellH = h / rows
  const aspect = cellW / cellH

  // 1. proportion, measured in log space so 2x too wide and 2x too tall cost
  //    the same.
  let score = Math.abs(Math.log(aspect / targetAspect(n)))

  // 2. wasted slots, relative to how many items there are.
  const empty = cols * rows - n
  score += (EMPTY_SLOT_WEIGHT * empty) / n

  // 3. readability floors, steep so they effectively veto.
  if (cellW < MIN_CELL_W_MM) {
    score += FLOOR_WEIGHT * ((MIN_CELL_W_MM - cellW) / MIN_CELL_W_MM)
  }
  if (cellH < MIN_CELL_H_MM) {
    score += FLOOR_WEIGHT * ((MIN_CELL_H_MM - cellH) / MIN_CELL_H_MM)
  }

  return score
}

/**
 * @param n      number of cocktails
 * @param w      usable page width in mm (page minus margins)
 * @param h      usable page height in mm
 */
export function chooseGrid(n: number, w: number, h: number): Grid {
  if (n <= 1) return { cols: 1, rows: 1 }

  let best: Grid = { cols: 1, rows: n }
  let bestScore = Infinity

  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const score = scoreGrid(n, cols, rows, w, h)
    if (score < bestScore) {
      bestScore = score
      best = { cols, rows }
    }
  }

  return best
}
