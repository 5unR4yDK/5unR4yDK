/**
 * The faces the menu sheet is set in, loaded on purpose.
 *
 * Browsers fetch a web font only when something on screen uses it. On a phone
 * the sheet sits on a hidden tab, so its faces — the italic in particular,
 * which nothing else uses — were never requested. The type search then
 * measured with a fallback font of different width, which made an exported
 * PDF about 8% smaller than the preview and wrapped some lines differently.
 * Asking for the faces explicitly takes visibility out of the question.
 */
const FACES = [
  '700 16px "Cormorant Garamond"',
  'italic 500 16px "Cormorant Garamond"',
  '400 16px Montserrat',
  '600 16px Montserrat',
] as const

/** Resolves once every face is loaded, or has definitely failed to. */
export function loadSheetFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve()
  return Promise.all(FACES.map((f) => document.fonts.load(f)))
    .then(() => undefined)
    // A failed font load must not block export; the fallback is still drawn.
    .catch(() => undefined)
}
