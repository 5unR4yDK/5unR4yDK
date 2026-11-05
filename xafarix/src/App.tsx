import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cocktail, Menu } from './types'
import { newCocktail } from './types'
import type { Drink } from './cocktaildb'
import { poursToLine } from './cocktaildb'
import Editor from './components/Editor'
import DrinkModal from './components/DrinkModal'
import MenuPage from './components/MenuPage'
import type { FitReport } from './components/MenuPage'
import Preview from './components/Preview'
import { sampleMenu } from './sample'
import { deleteSaved, listSaved, loadSaved, saveMenu } from './library'
import type { SavedMenu } from './library'
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
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialMenu().cocktails[0]?.id ?? null,
  )
  const [inspecting, setInspecting] = useState<Drink | null>(null)
  /**
   * Bumped after a database drink is added, remounting the search with an
   * empty box so the next name can be typed straight away. Only on a
   * successful add: cancelling the recipe sheet keeps the query, because the
   * likely next move is picking a different result from the same list.
   */
  const [searchKey, setSearchKey] = useState(0)
  const [saved, setSaved] = useState<SavedMenu[]>(() => listSaved())
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

  // ----------------------------------------------------------- cocktails

  /** Appends a cocktail and makes it the one being edited. */
  const addCocktail = useCallback((fields: Partial<Cocktail>) => {
    const entry = newCocktail(fields)
    setMenu((m) => ({ ...m, cocktails: [...m.cocktails, entry] }))
    setSelectedId(entry.id)
  }, [])

  /**
   * Copies a database record into the menu. Everything is copied by value and
   * is editable from that moment; the menu keeps no link back to the record.
   */
  const onAddDrink = useCallback(
    (drink: Drink, useInstructions: boolean) => {
      addCocktail({
        name: drink.name,
        ingredients: poursToLine(drink.pours),
        description: useInstructions ? drink.instructions : '',
      })
      setInspecting(null)
      setSearchKey((k) => k + 1)
    },
    [addCocktail],
  )

  const onAddManual = useCallback(
    (name: string) => addCocktail({ name }),
    [addCocktail],
  )

  const onPatchSelected = useCallback(
    (patch: Partial<Cocktail>) => {
      setMenu((m) => ({
        ...m,
        cocktails: m.cocktails.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
      }))
    },
    [selectedId],
  )

  const onMoveSelected = useCallback(
    (delta: number) => {
      setMenu((m) => {
        const i = m.cocktails.findIndex((c) => c.id === selectedId)
        const target = i + delta
        if (i < 0 || target < 0 || target >= m.cocktails.length) return m
        const next = [...m.cocktails]
        const [item] = next.splice(i, 1)
        next.splice(target, 0, item)
        return { ...m, cocktails: next }
      })
    },
    [selectedId],
  )

  const onRemoveSelected = useCallback(() => {
    setMenu((m) => {
      const i = m.cocktails.findIndex((c) => c.id === selectedId)
      if (i < 0) return m
      const next = m.cocktails.filter((c) => c.id !== selectedId)
      // Select the neighbour that takes its place, so the editor is never
      // left pointing at nothing after a delete.
      setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null)
      return { ...m, cocktails: next }
    })
  }, [selectedId])

  /** Selecting from the sheet on a phone has to bring the editor forward. */
  const onSelectFromPage = useCallback((id: string) => {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 860px)').matches) setMobileTab('edit')
  }, [])

  // ------------------------------------------------------------- library

  const onSaveMenu = useCallback(
    (name: string) => setSaved(saveMenu(name, menu)),
    [menu],
  )

  const onLoadMenu = useCallback((id: string) => {
    const loaded = loadSaved(id)
    if (!loaded) return
    setMenu(loaded)
    setSelectedId(loaded.cocktails[0]?.id ?? null)
  }, [])

  const onDeleteMenu = useCallback((id: string) => setSaved(deleteSaved(id)), [])

  // ------------------------------------------------------------- outputs

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
      {/* Only rendered on narrow screens; see the media query in styles.css. */}
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
        searchKey={searchKey}
        setMenu={setMenu}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onInspectDrink={setInspecting}
        onAddManual={onAddManual}
        onPatchSelected={onPatchSelected}
        onMoveSelected={onMoveSelected}
        onRemoveSelected={onRemoveSelected}
        saved={saved}
        onSaveMenu={onSaveMenu}
        onLoadMenu={onLoadMenu}
        onDeleteMenu={onDeleteMenu}
        fit={fit}
        onDownloadPdf={onDownloadPdf}
        onPrint={onPrint}
        onShare={onShare}
        shareState={shareState}
        pdfState={pdfState}
      />

      <Preview orientation={menu.orientation} stageRef={stageRef}>
        <MenuPage
          menu={menu}
          onFit={onFit}
          pageRef={pageRef}
          selectedId={selectedId}
          onSelectCocktail={onSelectFromPage}
        />
      </Preview>

      {inspecting && (
        <DrinkModal
          drink={inspecting}
          onAdd={onAddDrink}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  )
}
