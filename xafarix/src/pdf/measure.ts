/**
 * Reading the laid-out page back out of the DOM.
 *
 * The PDF is drawn from what the browser actually rendered, not from a second
 * layout calculation. Re-deriving the layout in PDF space would mean two
 * implementations that drift apart, and the preview would stop being a
 * preview. So we ask the browser where every line of text ended up and draw
 * exactly that.
 *
 * This also means the PDF inherits, for free, every typographic decision the
 * browser made that would be painful to reimplement: `text-wrap: balance`,
 * hyphenation, and the binary-searched font size.
 */

export interface TextLine {
  text: string
  /** Horizontal centre of the line, in px relative to the page's top-left. */
  centerX: number
  /** Vertical centre of the line's glyph box, in px relative to the page. */
  centerY: number
  fontFamily: string
  fontStyle: string
  /** Rendered size in CSS px. */
  fontSizePx: number
  /** Numeric weight, used to pick between the regular and semibold faces. */
  fontWeight: number
  /** Solid RGB after compositing any alpha over the page background. */
  color: [number, number, number]
}

export interface FilledRect {
  x: number
  y: number
  w: number
  h: number
  color: [number, number, number]
}

export interface PageSnapshot {
  /** Page size in CSS px at natural (unscaled) size. */
  widthPx: number
  heightPx: number
  background: [number, number, number]
  lines: TextLine[]
  rects: FilledRect[]
}

/** Parses `rgb()` / `rgba()` as returned by getComputedStyle. */
function parseColor(input: string): [number, number, number, number] {
  const m = input.match(/-?[\d.]+/g)
  if (!m || m.length < 3) return [0, 0, 0, 1]
  return [Number(m[0]), Number(m[1]), Number(m[2]), m.length > 3 ? Number(m[3]) : 1]
}

/**
 * Flattens a possibly-translucent colour onto an opaque backdrop. The menu
 * sets its muted greys with alpha over a solid page colour, and a PDF fill has
 * no backdrop to blend with, so the blend is done here instead.
 */
function composite(
  fg: [number, number, number, number],
  bg: [number, number, number],
): [number, number, number] {
  const a = fg[3]
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ]
}

function applyTransform(text: string, transform: string): string {
  if (transform === 'uppercase') return text.toUpperCase()
  if (transform === 'lowercase') return text.toLowerCase()
  if (transform === 'capitalize') {
    return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  }
  return text
}

interface CharBox {
  ch: string
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Splits one text node into its rendered lines by measuring each character.
 *
 * There is no API that hands back "the lines as wrapped", so each character is
 * measured individually and a new line is started wherever the glyph box jumps
 * vertically. Slow in principle, trivial in practice: a menu is a few hundred
 * characters.
 */
function linesFromTextNode(node: Text, transform: string): { text: string; box: CharBox }[][] {
  const raw = applyTransform(node.data, transform)
  const range = document.createRange()
  const boxes: CharBox[] = []

  for (let i = 0; i < node.data.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = range.getBoundingClientRect()
    // Whitespace collapsed at a line break measures as a zero box; skipping it
    // keeps it from anchoring a line's extent.
    if (r.width === 0 && r.height === 0) continue
    boxes.push({ ch: raw[i] ?? node.data[i], left: r.left, right: r.right, top: r.top, bottom: r.bottom })
  }

  const lines: CharBox[][] = []
  let current: CharBox[] = []
  let lineTop: number | null = null

  for (const b of boxes) {
    if (lineTop === null || Math.abs(b.top - lineTop) <= 1) {
      lineTop = lineTop ?? b.top
      current.push(b)
    } else {
      lines.push(current)
      current = [b]
      lineTop = b.top
    }
  }
  if (current.length) lines.push(current)

  return lines.map((l) => l.map((box) => ({ text: box.ch, box })))
}

/**
 * Walks the rendered page and records every filled box and every line of text,
 * in px relative to the page's own top-left corner.
 *
 * `page` must be at its natural scale when this is called — see
 * withNaturalScale.
 */
export function snapshotPage(page: HTMLElement): PageSnapshot {
  const pageRect = page.getBoundingClientRect()
  const pageStyle = getComputedStyle(page)
  const bgRgba = parseColor(pageStyle.backgroundColor)
  const background: [number, number, number] = [bgRgba[0], bgRgba[1], bgRgba[2]]

  const lines: TextLine[] = []
  const rects: FilledRect[] = []

  const walker = document.createTreeWalker(page, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)

  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      if (el === page) continue
      const style = getComputedStyle(el)
      const rgba = parseColor(style.backgroundColor)
      if (rgba[3] > 0) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          rects.push({
            x: r.left - pageRect.left,
            y: r.top - pageRect.top,
            w: r.width,
            h: r.height,
            color: composite(rgba, background),
          })
        }
      }
      continue
    }

    const textNode = n as Text
    if (!textNode.data.trim()) continue
    const parent = textNode.parentElement
    if (!parent) continue

    const style = getComputedStyle(parent)
    if (style.visibility === 'hidden' || style.display === 'none') continue

    const colorRgba = parseColor(style.color)
    const opacity = Number(style.opacity)
    if (!Number.isNaN(opacity) && opacity < 1) colorRgba[3] *= opacity
    const color = composite(colorRgba, background)

    const letterSpacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) || 0

    for (const line of linesFromTextNode(textNode, style.textTransform)) {
      // Drop whitespace at the ends so the centre is the centre of the ink.
      let start = 0
      let end = line.length - 1
      while (start <= end && !line[start].text.trim()) start++
      while (end >= start && !line[end].text.trim()) end--
      if (end < start) continue

      const slice = line.slice(start, end + 1)
      const text = slice.map((c) => c.text).join('')
      let left = Infinity
      let right = -Infinity
      let top = Infinity
      let bottom = -Infinity
      for (const c of slice) {
        left = Math.min(left, c.box.left)
        right = Math.max(right, c.box.right)
        top = Math.min(top, c.box.top)
        bottom = Math.max(bottom, c.box.bottom)
      }

      const common = {
        centerY: (top + bottom) / 2 - pageRect.top,
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontSizePx: parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        color,
      }

      if (letterSpacing !== 0) {
        // Letter-spaced text is emitted one glyph at a time, each at the
        // position the browser gave it. jsPDF has a charSpace option, but its
        // idea of where the spacing goes does not match CSS's (CSS adds a gap
        // after the final glyph too), and centring a string under the two
        // models disagrees by half a gap. Placing each glyph individually
        // sidesteps the question: the measured positions are already right.
        for (const c of slice) {
          if (!c.text.trim()) continue
          lines.push({
            ...common,
            text: c.text,
            centerX: (c.box.left + c.box.right - letterSpacing) / 2 - pageRect.left,
          })
        }
        continue
      }

      lines.push({
        ...common,
        text,
        centerX: (left + right) / 2 - pageRect.left,
      })
    }
  }

  return {
    widthPx: pageRect.width,
    heightPx: pageRect.height,
    background,
    lines,
    rects,
  }
}

/**
 * Runs `fn` with the preview's shrink-to-fit transform removed.
 *
 * On screen the sheet is scaled down to fit the pane, and getBoundingClientRect
 * reports transformed coordinates. Measuring through that scale would bake the
 * preview's zoom into the PDF. The transform is removed and restored without
 * yielding to the event loop, so no frame is painted in between and nothing
 * flickers.
 */
export function withNaturalScale<T>(stage: HTMLElement | null, fn: () => T): T {
  if (!stage) return fn()
  const previous = stage.style.transform
  stage.style.transform = 'none'
  // Force layout so the measurements below see the untransformed geometry.
  void stage.offsetHeight
  try {
    return fn()
  } finally {
    stage.style.transform = previous
    void stage.offsetHeight
  }
}
