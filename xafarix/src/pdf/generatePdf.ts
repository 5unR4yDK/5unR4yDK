import { jsPDF } from 'jspdf'
import { loadFaces } from './loadFonts'
import type { LoadedFace } from './loadFonts'
import { snapshotPage, withNaturalScale } from './measure'
import type { PageSnapshot } from './measure'
import { fitPage } from '../fit'
import { loadSheetFonts } from '../sheetFonts'
import type { Orientation } from '../types'

/** CSS pixels per millimetre at the 96dpi reference the browser lays out in. */
const PX_PER_MM = 96 / 25.4
/** 1 CSS px at 96dpi is 0.75pt. */
const PT_PER_PX = 0.75

const px2mm = (px: number) => px / PX_PER_MM

/**
 * The code points the embedded subsets cover. Must match the `--unicodes`
 * argument recorded in public/fonts/README.md: Latin, Latin-1 Supplement,
 * Latin Extended-A, and the punctuation menus use.
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

function registerFonts(doc: jsPDF, faces: LoadedFace[]): void {
  for (const face of faces) {
    doc.addFileToVFS(face.vfsName, face.data)
    doc.addFont(face.vfsName, face.family, face.style)
  }
}

/**
 * Maps a computed font-family/style/weight onto one of the four embedded
 * faces: Cormorant Garamond bold and medium italic, Montserrat regular and
 * semibold. Anything the stylesheet sets must land on one of them, so the
 * fallbacks here follow the sheet's own usage rather than guessing.
 */
function faceFor(
  fontFamily: string,
  fontStyle: string,
  fontWeight: number,
): [string, string] {
  const italic = fontStyle === 'italic' || fontStyle === 'oblique'
  if (/cormorant/i.test(fontFamily)) {
    return ['CormorantGaramond', italic ? 'italic' : 'bold']
  }
  return ['Montserrat', fontWeight >= 600 ? 'bold' : 'normal']
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
    const [family, style] = faceFor(line.fontFamily, line.fontStyle, line.fontWeight)
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
/**
 * Runs `fn` with the sheet laid out and its type fitted.
 *
 * On a phone the sheet lives on the Preview tab, so while the user is on Edit
 * — which is where the Download button is — it sits inside a `display: none`
 * pane. A hidden element measures as 0x0, and every line of text with it, so
 * exporting from there used to produce a blank page; and because the type
 * search skips a hidden sheet, a phone that never opened Preview had never had
 * its type sized at all. So every hidden ancestor is shown, the fit is run,
 * and everything is put back, all synchronously: no frame is painted in
 * between, so nothing flickers.
 */
function withMeasurableSheet<T>(page: HTMLElement, fn: () => T): T {
  const restore: Array<() => void> = []
  // Both kinds of hiding are undone. A display:none ancestor gives the sheet
  // no size at all; a visibility:hidden one (how the phone layout parks the
  // preview off screen) keeps the size but makes every line of text count as
  // invisible, which the snapshot rightly skips. Inline styles beat the
  // non-important stylesheet rules that hide it.
  for (let el = page.parentElement; el; el = el.parentElement) {
    const target = el
    const cs = getComputedStyle(target)
    if (cs.display === 'none') {
      const previous = target.style.display
      target.style.display = 'block'
      restore.push(() => {
        target.style.display = previous
      })
    }
    if (cs.visibility === 'hidden') {
      const previous = target.style.visibility
      target.style.visibility = 'visible'
      restore.push(() => {
        target.style.visibility = previous
      })
    }
  }
  try {
    void page.offsetHeight
    fitPage(page, Array.from(page.querySelectorAll<HTMLElement>('.cell')))
    return fn()
  } finally {
    for (const undo of restore.reverse()) undo()
  }
}

export async function generatePdf(
  page: HTMLElement,
  stage: HTMLElement | null,
  menuTitle: string,
  orientation: Orientation,
): Promise<PdfResult> {
  // Both awaited before measuring, so the (synchronous) snapshot and draw
  // happen back to back with no await between them. The sheet's web fonts
  // must be in before anything is measured, or the layout is computed in a
  // fallback face and the exported text comes out the wrong size.
  const [faces] = await Promise.all([loadFaces(), loadSheetFonts()])

  const snap = withMeasurableSheet(page, () =>
    withNaturalScale(stage, () => snapshotPage(page)),
  )

  // A sheet that still measures as nothing would export as a blank page.
  // Failing loudly is better than handing over a file that looks fine
  // until it is printed.
  if (snap.widthPx < 10 || snap.heightPx < 10 || snap.lines.length === 0) {
    throw new Error('The menu could not be measured for export. Try opening Preview first.')
  }

  // Taken from the menu's own setting rather than inferred from the measured
  // size, which is how a hidden sheet once turned landscape menus portrait.
  const landscape = orientation === 'landscape'
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  registerFonts(doc, faces)
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
