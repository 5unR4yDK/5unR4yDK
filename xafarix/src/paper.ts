import type { Orientation } from './types'

/** A4, in millimetres. The only paper size the MVP ships. */
export const A4_SHORT = 210
export const A4_LONG = 297

/** Page margin in mm. Generous, because a menu needs air at the edges. */
export const MARGIN_MM = 14

export interface PageBox {
  /** Full sheet width in mm. */
  w: number
  /** Full sheet height in mm. */
  h: number
  /** Printable width in mm, margins removed. */
  innerW: number
  /** Printable height in mm, margins removed. */
  innerH: number
}

export function pageBox(orientation: Orientation): PageBox {
  const w = orientation === 'portrait' ? A4_SHORT : A4_LONG
  const h = orientation === 'portrait' ? A4_LONG : A4_SHORT
  return {
    w,
    h,
    innerW: w - MARGIN_MM * 2,
    innerH: h - MARGIN_MM * 2,
  }
}

/** CSS pixels per millimetre at the 96dpi reference the browser prints from. */
export const PX_PER_MM = 96 / 25.4
