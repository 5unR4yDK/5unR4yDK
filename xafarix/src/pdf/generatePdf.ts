import { jsPDF } from 'jspdf'
import { inter300Italic, inter400, playfairDisplay700 } from './fonts'
import { snapshotPage, withNaturalScale } from './measure'
import type { PageSnapshot } from './measure'

/** CSS pixels per millimetre at the 96dpi reference the browser lays out in. */
const PX_PER_MM = 96 / 25.4
/** 1 CSS px at 96dpi is 0.75pt. */
const PT_PER_PX = 0.75

const px2mm = (px: number) => px / PX_PER_MM

/**
 * The code points the embedded subsets cover. Must match the `--unicodes`
 * argument used to build fonts.ts: Latin, Latin-1 Supplement, Latin
 * Extended-A, and the punctuation menus use.
 */
const COVERED: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x100, 0x17f],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
]

/**
 * Characters in `text` that the embedded font subsets cannot draw.
 *
 * Subsetting is what keeps the three faces at 77KB instead of 760KB, and the
 * cost is that anything outside Western European script has no glyph. A
 * missing glyph would come out of jsPDF as a silent blank, so the caller warns
 * instead and points at the browser's own print dialog, which has the full
 * fonts.
 */
export function uncoveredCharacters(text: string): string[] {
  const missing = new Set<string>()
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    if (ch === '\n' || ch === '\t') continue
    if (!COVERED.some(([lo, hi]) => cp >= lo && cp <= hi)) missing.add(ch)
  }
  return [...missing]
}

function registerFonts(doc: jsPDF): void {
  doc.addFileToVFS('PlayfairDisplay-Bold.ttf', playfairDisplay700)
  doc.addFont('PlayfairDisplay-Bold.ttf', 'PlayfairDisplay', 'bold')
  doc.addFileToVFS('Inter-Regular.ttf', inter400)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-LightItalic.ttf', inter300Italic)
  doc.addFont('Inter-LightItalic.ttf', 'Inter', 'italic')
}

/** Maps a computed font-family/style onto one of the three embedded faces. */
function faceFor(fontFamily: string, fontStyle: string): [string, string] {
  if (/playfair/i.test(fontFamily)) return ['PlayfairDisplay', 'bold']
  if (fontStyle === 'italic' || fontStyle === 'oblique') return ['Inter', 'italic']
  return ['Inter', 'normal']
}

function draw(doc: jsPDF, snap: PageSnapshot): void {
  const [br, bg, bb] = snap.background
  doc.setFillColor(br, bg, bb)
  doc.rect(0, 0, px2mm(snap.widthPx), px2mm(snap.heightPx), 'F')

  for (const r of snap.rects) {
    doc.setFillColor(r.color[0], r.color[1], r.color[2])
    doc.rect(px2mm(r.x), px2mm(r.y), px2mm(r.w), px2mm(r.h), 'F')
  }

  for (const line of snap.lines) {
    const [family, style] = faceFor(line.fontFamily, line.fontStyle)
    doc.setFont(family, style)
    doc.setFontSize(line.fontSizePx * PT_PER_PX)
    doc.setTextColor(line.color[0], line.color[1], line.color[2])
    doc.text(line.text, px2mm(line.centerX), px2mm(line.centerY), {
      align: 'center',
      baseline: 'middle',
    })
  }
}

export interface PdfResult {
  blob: Blob
  filename: string
}

/**
 * Renders the on-screen sheet to a real PDF file.
 *
 * Vector text in the same three typefaces as the preview, drawn at the
 * positions the browser actually laid out. Unlike the print dialog this
 * produces a file the caller can hand straight to the user, which is the only
 * thing that works on a phone.
 */
export function generatePdf(
  page: HTMLElement,
  stage: HTMLElement | null,
  menuTitle: string,
): PdfResult {
  const snap = withNaturalScale(stage, () => snapshotPage(page))

  const landscape = snap.widthPx > snap.heightPx
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  registerFonts(doc)
  draw(doc, snap)

  const safe = menuTitle.trim().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')
  return {
    blob: doc.output('blob'),
    filename: `${safe || 'cocktail-menu'}.pdf`,
  }
}

/** Hands the generated file to the browser as a download. */
export function downloadPdf(result: PdfResult): void {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on a later turn of the event loop: Safari cancels the download if
  // the object URL disappears in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
