import { useCallback, useEffect, useRef, useState } from 'react'
import type { Menu } from './types'
import Editor from './components/Editor'
import MenuPage from './components/MenuPage'
import type { FitReport } from './components/MenuPage'
import Preview from './components/Preview'
import { sampleMenu } from './sample'
import { loadFromHash, loadLocal, saveLocal, shareUrl } from './storage'

const PAGE_STYLE_ID = 'xafarix-page-size'

export type PdfState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

export type MobileTab = 'edit' | 'preview'

/**
 * `@page` cannot be written with a CSS custom property, so the rule that tells
 * the printer whether the sheet is portrait or landscape is injected directly.
 * Without this the browser prints portrait regardless and crops a landscape
 * menu.
 */
function usePageSizeRule(orientation: string) {
  useEffect(() => {
    let el = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = PAGE_STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = `@page { size: A4 ${orientation}; margin: 0; }`
  }, [orientation])
}

function initialMenu(): Menu {
  return loadFromHash() ?? loadLocal() ?? sampleMenu
}

export default function App() {
  const [menu, setMenu] = useState<Menu>(initialMenu)
  const [fit, setFit] = useState<FitReport | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [pdfState, setPdfState] = useState<PdfState>({ kind: 'idle' })
  const [mobileTab, setMobileTab] = useState<MobileTab>('edit')

  const pageRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  usePageSizeRule(menu.orientation)

  useEffect(() => {
    saveLocal(menu)
    setShareState('idle')
    setPdfState({ kind: 'idle' })
  }, [menu])

  const onFit = useCallback((report: FitReport) => setFit(report), [])

  /**
   * Builds a real PDF file and hands it to the browser as a download.
   *
   * This is the primary export rather than window.print(), because on a phone
   * the print dialog either produces a print job or nothing at all, and in an
   * in-app browser it silently does neither. A downloaded file works
   * everywhere.
   *
   * jsPDF and the embedded fonts are a large dependency that most sessions
   * never need, so they load on demand rather than at startup.
   */
  const onDownloadPdf = useCallback(async () => {
    const page = pageRef.current
    if (!page) return
    setPdfState({ kind: 'working' })
    try {
      const { generatePdf, downloadPdf, uncoveredCharacters } = await import(
        './pdf/generatePdf'
      )
      const allText = [
        menu.title,
        menu.subtitle,
        ...menu.cocktails.flatMap((c) => [c.name, c.description, c.ingredients]),
      ].join('')
      const missing = uncoveredCharacters(allText)
      if (missing.length > 0) {
        setPdfState({
          kind: 'error',
          message: `The embedded fonts don't cover ${missing.join(' ')}. Use Print instead — your browser has the complete fonts.`,
        })
        return
      }
      downloadPdf(await generatePdf(page, stageRef.current, menu.title))
      setPdfState({ kind: 'done' })
    } catch (err) {
      setPdfState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not create the PDF.',
      })
    }
  }, [menu])

  const onPrint = useCallback(() => {
    window.print()
  }, [])

  const onShare = useCallback(async () => {
    const url = shareUrl(menu)
    // Put it in the address bar either way, so there is still a link to copy
    // by hand if the clipboard is unavailable (it needs a secure context).
    window.history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }, [menu])

  return (
    <div className="app" data-mobile-tab={mobileTab}>
      {/* Only rendered on narrow screens; see the media query in styles.css.
          Side by side there is no room for both panes, and stacking them put
          the sheet below a long form where it was never seen. */}
      <div className="tabs" role="tablist" aria-label="Editor or preview">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'edit'}
          onClick={() => setMobileTab('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'preview'}
          onClick={() => setMobileTab('preview')}
        >
          Preview{fit ? ` · ${fit.cols}×${fit.rows}` : ''}
        </button>
      </div>

      <Editor
        menu={menu}
        setMenu={setMenu}
        fit={fit}
        onDownloadPdf={onDownloadPdf}
        onPrint={onPrint}
        onShare={onShare}
        shareState={shareState}
        pdfState={pdfState}
      />
      <Preview orientation={menu.orientation} stageRef={stageRef}>
        <MenuPage menu={menu} onFit={onFit} pageRef={pageRef} />
      </Preview>
    </div>
  )
}
