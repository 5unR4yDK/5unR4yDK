import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Base, Cocktail, Menu, Nominee } from './types'
import { asMenuCocktail, emptyMenu, newCocktail, newId } from './types'
import type { Drink } from './cocktaildb'
import { poursToLine } from './cocktaildb'
import Editor from './components/Editor'
import type { View } from './components/Editor'
import EditSheet from './components/EditSheet'
import type { Fields, SheetAction } from './components/EditSheet'
import MenuPage from './components/MenuPage'
import type { FitReport } from './components/MenuPage'
import Preview from './components/Preview'
import UserGate from './components/UserGate'
import type { SaveState } from './components/MenuSwitcher'
import { UserStore } from './cloud'
import type { Mode, SavedMenu } from './cloud'
import { DEFAULT_PRESET, presetMenu } from './presets'
import type { PresetId } from './presets'
import {
  clearUser,
  loadUser,
  loadWorking,
  saveUser,
  saveWorking,
  signature,
  userSlug,
} from './session'
import type { Working } from './session'
import { clearHash, loadFromHash, shareUrl } from './storage'

const PAGE_STYLE_ID = 'xafarix-page-size'
const AUTOSAVE_MS = 900
const NOMINEE_SAVE_MS = 700

export type PdfState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

type Sheet =
  | { kind: 'drink'; drink: Drink }
  | { kind: 'own'; name: string }
  | { kind: 'nominee'; id: string }

const isPhone = () => window.matchMedia('(max-width: 860px)').matches

/**
 * `@page` cannot be written with a CSS custom property, so the rule that tells
 * the printer whether the sheet is portrait or landscape is injected directly.
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

const workingFor = (
  menu: Menu,
  savedId: string | null,
  savedName: string | null,
  presetId: PresetId | null,
): Working => ({ menu, savedId, savedName, presetId, baseline: signature({ menu, savedName }) })

/** What to show first: a shared link, else where this user left off, else the small starter. */
function startingPoint(user: string): { working: Working; resumed: boolean } {
  const shared = loadFromHash()
  if (shared) {
    // Removed once read, or every reload would re-import over later edits.
    clearHash()
    return { working: { ...workingFor(shared, null, null, null), baseline: '' }, resumed: true }
  }
  const local = loadWorking(user)
  if (local) return { working: local, resumed: true }
  return { working: workingFor(presetMenu(DEFAULT_PRESET), null, null, DEFAULT_PRESET), resumed: false }
}

const fromDrinkBase = (d: Drink): Base => ({
  name: d.name,
  ingredients: poursToLine(d.pours),
  description: '',
})

export default function App() {
  const [user, setUser] = useState<string | null>(() => loadUser())

  if (!user) {
    return (
      <UserGate
        onEnter={(name) => {
          saveUser(name)
          setUser(name)
        }}
      />
    )
  }

  return (
    <Workspace
      key={userSlug(user)}
      user={user}
      onSwitchUser={() => {
        clearUser()
        setUser(null)
      }}
    />
  )
}

function Workspace({ user, onSwitchUser }: { user: string; onSwitchUser: () => void }) {
  const start = useMemo(() => startingPoint(user), [user])
  const [working, setWorking] = useState<Working>(start.working)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => start.working.menu.cocktails[0]?.id ?? null,
  )

  const [store, setStore] = useState<UserStore | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [saved, setSaved] = useState<SavedMenu[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const nomineesTouched = useRef(false)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const [view, setView] = useState<View>('menu')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const [fit, setFit] = useState<FitReport | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [pdfState, setPdfState] = useState<PdfState>({ kind: 'idle' })

  const pageRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const menu = working.menu
  const dirty = signature(working) !== working.baseline
  usePageSizeRule(menu.orientation)

  // ------------------------------------------------------------- loading

  useEffect(() => {
    let cancelled = false
    UserStore.open(user).then(({ store, menus, nominees }) => {
      if (cancelled) return
      setStore(store)
      setMode(store.mode)
      setSaved(menus)
      setNominees(nominees)
      // Same person on a new device: open their latest menu instead of the
      // starter — unless they have already started editing in the meantime.
      if (!start.resumed && menus.length > 0) {
        setWorking((w) => {
          if (signature(w) !== w.baseline) return w
          const m = menus[0]
          const next = workingFor(JSON.parse(JSON.stringify(m.menu)), m.id, m.name, null)
          setSelectedId(next.menu.cocktails[0]?.id ?? null)
          return next
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [user, start.resumed])

  useEffect(() => {
    saveWorking(user, working)
    setShareState('idle')
    setPdfState((s) => (s.kind === 'working' ? s : { kind: 'idle' }))
  }, [user, working])

  // ------------------------------------------------------------ autosave

  /** Saves the working menu now, if it is a saved menu with changes. */
  const persist = useCallback(
    async (w: Working) => {
      if (!store || !w.savedId || signature(w) === w.baseline) return
      const name = (w.savedName ?? '').trim()
      if (!name) {
        setSaveState('error')
        setSaveError('the menu needs a name')
        return
      }
      const snapshot = { menu: w.menu, savedName: name }
      setSaveState('saving')
      try {
        const rec = await store.saveMenu({ id: w.savedId, name, menu: w.menu })
        setSaved((list) => [rec, ...list.filter((m) => m.id !== rec.id)])
        setWorking((cur) => (cur.savedId === rec.id ? { ...cur, baseline: signature(snapshot) } : cur))
        setSaveState('saved')
        setSaveError(null)
      } catch (err) {
        setSaveState('error')
        setSaveError(err instanceof Error ? err.message : 'check your connection')
        window.setTimeout(() => setRetryTick((t) => t + 1), 5000)
      }
    },
    [store],
  )

  useEffect(() => {
    if (!working.savedId || !dirty) return
    const t = window.setTimeout(() => void persist(working), AUTOSAVE_MS)
    return () => window.clearTimeout(t)
  }, [working, dirty, persist, retryTick])

  useEffect(() => {
    if (!store || !nomineesTouched.current) return
    const t = window.setTimeout(() => {
      store.saveNominees(nominees).catch((err) => console.warn('Shortlist not synced yet:', err))
    }, NOMINEE_SAVE_MS)
    return () => window.clearTimeout(t)
  }, [store, nominees])

  // -------------------------------------------------------------- menus

  /**
   * Leaving the menu on screen. A saved menu is flushed rather than asked
   * about, since it saves itself anyway; an edited starter or new menu would
   * lose its changes, so that one asks.
   */
  const leaveCurrent = useCallback((): boolean => {
    if (working.savedId) {
      void persist(working)
      return true
    }
    if (dirty && working.menu.cocktails.length > 0) {
      return window.confirm('Leave this menu without saving? Your changes to it will be lost.')
    }
    return true
  }, [working, dirty, persist])

  const open = (next: Working) => {
    setWorking(next)
    setSelectedId(next.menu.cocktails[0]?.id ?? null)
    setSaveState('idle')
    setSaveError(null)
  }

  const onOpenPreset = (id: PresetId) => {
    if (working.presetId === id && !working.savedId && !dirty) return
    if (!leaveCurrent()) return
    open(workingFor(presetMenu(id), null, null, id))
  }

  const onOpenSaved = (id: string) => {
    if (working.savedId === id) return
    const m = saved.find((x) => x.id === id)
    if (!m || !leaveCurrent()) return
    open(workingFor(JSON.parse(JSON.stringify(m.menu)), m.id, m.name, null))
  }

  const onNew = () => {
    if (!leaveCurrent()) return
    open(workingFor(emptyMenu(menu.orientation), null, null, null))
  }

  const onClear = () => {
    const n = menu.cocktails.length
    const where = working.savedName ? ` from “${working.savedName}”` : ''
    if (!window.confirm(`Clear all ${n} cocktail${n === 1 ? '' : 's'}${where} and start from a blank page?`)) return
    setWorking((w) => ({ ...w, menu: { ...w.menu, title: '', subtitle: '', cocktails: [] } }))
    setSelectedId(null)
  }

  const onSave = async (name: string) => {
    if (!store) return
    if (working.savedId) return void persist(working)
    const snapshot = working.menu
    setSaveState('saving')
    try {
      const rec = await store.saveMenu({ id: null, name, menu: snapshot })
      setSaved((list) => [rec, ...list])
      setWorking((w) => ({
        ...w,
        savedId: rec.id,
        savedName: rec.name,
        presetId: null,
        baseline: signature({ menu: snapshot, savedName: rec.name }),
      }))
      setSaveState('saved')
      setSaveError(null)
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'check your connection')
    }
  }

  const onRename = (name: string) => setWorking((w) => ({ ...w, savedName: name }))

  const onDelete = async () => {
    if (!store || !working.savedId) return
    const name = working.savedName ?? 'this menu'
    if (!window.confirm(`Delete “${name}”? It stays on screen until you open another menu.`)) return
    const id = working.savedId
    try {
      await store.deleteMenu(id)
      setSaved((list) => list.filter((m) => m.id !== id))
      setWorking((w) => ({ ...w, savedId: null, savedName: null, presetId: null, baseline: '' }))
      setSaveState('idle')
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'could not delete')
    }
  }

  // ---------------------------------------------------------- cocktails

  const setMenu = (m: Menu) => setWorking((w) => ({ ...w, menu: m }))

  const addToMenu = useCallback((c: Cocktail) => {
    setWorking((w) => ({ ...w, menu: { ...w.menu, cocktails: [...w.menu.cocktails, c] } }))
    setSelectedId(c.id)
  }, [])

  const onPatchSelected = (patch: Partial<Cocktail>) =>
    setWorking((w) => ({
      ...w,
      menu: {
        ...w.menu,
        cocktails: w.menu.cocktails.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
      },
    }))

  const onMoveSelected = (delta: number) =>
    setWorking((w) => {
      const i = w.menu.cocktails.findIndex((c) => c.id === selectedId)
      const target = i + delta
      if (i < 0 || target < 0 || target >= w.menu.cocktails.length) return w
      const next = [...w.menu.cocktails]
      const [item] = next.splice(i, 1)
      next.splice(target, 0, item)
      return { ...w, menu: { ...w.menu, cocktails: next } }
    })

  const onRemoveSelected = () => {
    const list = menu.cocktails
    const i = list.findIndex((c) => c.id === selectedId)
    if (i < 0) return
    const next = list.filter((c) => c.id !== selectedId)
    setWorking((w) => ({ ...w, menu: { ...w.menu, cocktails: next } }))
    setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null)
  }

  const onSelectFromPage = (id: string) => {
    setSelectedId(id)
    if (isPhone()) {
      setView('menu')
      setMobileTab('edit')
    }
  }

  // ----------------------------------------------------------- nominees

  const touchNominees = (update: (list: Nominee[]) => Nominee[]) => {
    nomineesTouched.current = true
    setNominees(update)
  }

  const addNominee = (n: Omit<Nominee, 'id'>): Nominee => {
    const entry: Nominee = { ...n, id: newId() }
    touchNominees((list) => [entry, ...list])
    return entry
  }

  const nomineesOnMenu = useMemo(
    () => new Set(menu.cocktails.map((c) => c.nomineeId).filter((x): x is string => Boolean(x))),
    [menu.cocktails],
  )

  const onToggleNominee = (n: Nominee) => {
    if (nomineesOnMenu.has(n.id)) {
      setWorking((w) => ({
        ...w,
        menu: { ...w.menu, cocktails: w.menu.cocktails.filter((c) => c.nomineeId !== n.id) },
      }))
    } else {
      addToMenu(asMenuCocktail(n, n.id))
    }
  }

  const onNominateSelected = () => {
    const c = menu.cocktails.find((x) => x.id === selectedId)
    if (!c) return
    const entry = addNominee({
      name: c.name,
      ingredients: c.ingredients,
      description: c.description,
      origin: c.origin,
      base: c.base,
      thumb: null,
    })
    onPatchSelected({ nomineeId: entry.id })
  }

  // ------------------------------------------------------- search & sheet

  const onQuickAdd = (d: Drink) => {
    const base = fromDrinkBase(d)
    addToMenu(newCocktail({ ...base, origin: 'database', base }))
  }

  const onQuickNominate = (d: Drink) => {
    const base = fromDrinkBase(d)
    addNominee({ ...base, origin: 'database', base, thumb: d.thumb })
  }

  const closeSheet = useCallback(() => setSheet(null), [])

  const finishFromSearch = () => {
    setSheet(null)
    setSearchKey((k) => k + 1)
  }

  let sheetEl: JSX.Element | null = null
  if (sheet?.kind === 'drink' || sheet?.kind === 'own') {
    const drink = sheet.kind === 'drink' ? sheet.drink : undefined
    const base = drink ? fromDrinkBase(drink) : undefined
    const origin = drink ? ('database' as const) : ('own' as const)
    const initial: Fields = base ?? { name: sheet.kind === 'own' ? sheet.name : '', ingredients: '', description: '' }
    const actions: SheetAction[] = [
      {
        label: 'Add to menu',
        kind: 'primary',
        run: (f) => {
          addToMenu(newCocktail({ ...f, origin, base }))
          finishFromSearch()
        },
      },
      {
        label: '★ Nominate',
        kind: 'outline',
        run: (f) => {
          addNominee({ ...f, origin, base, thumb: drink?.thumb ?? null })
          finishFromSearch()
        },
      },
    ]
    sheetEl = (
      <EditSheet
        key={drink?.id ?? 'own'}
        kicker={drink ? 'From the database' : 'Your own drink'}
        initial={initial}
        origin={origin}
        base={base}
        drink={drink}
        actions={actions}
        onClose={closeSheet}
      />
    )
  } else if (sheet?.kind === 'nominee') {
    const n = nominees.find((x) => x.id === sheet.id)
    if (n) {
      const on = nomineesOnMenu.has(n.id)
      const save = (f: Fields) =>
        touchNominees((list) => list.map((x) => (x.id === n.id ? { ...x, ...f } : x)))
      const actions: SheetAction[] = on
        ? [
            { label: 'Save changes', kind: 'primary', run: (f) => (save(f), setSheet(null)) },
            { label: 'Take off menu', kind: 'outline', run: (f) => (save(f), onToggleNominee(n), setSheet(null)) },
          ]
        : [
            {
              label: 'Add to menu',
              kind: 'primary',
              run: (f) => {
                save(f)
                addToMenu(asMenuCocktail({ ...n, ...f }, n.id))
                setSheet(null)
              },
            },
            { label: 'Save changes', kind: 'outline', run: (f) => (save(f), setSheet(null)) },
          ]
      actions.push({
        label: 'Remove from nominees',
        kind: 'quiet',
        run: () => {
          if (!window.confirm(`Remove “${n.name}” from your nominees?`)) return
          touchNominees((list) => list.filter((x) => x.id !== n.id))
          setSheet(null)
        },
      })
      sheetEl = (
        <EditSheet
          key={n.id}
          kicker="Nominee"
          initial={{ name: n.name, ingredients: n.ingredients, description: n.description }}
          origin={n.origin}
          base={n.base}
          thumb={n.thumb}
          actions={actions}
          onClose={closeSheet}
        />
      )
    }
  }

  // ------------------------------------------------------------- outputs

  const onFit = useCallback((report: FitReport) => setFit(report), [])

  const onDownloadPdf = useCallback(async () => {
    const page = pageRef.current
    if (!page) return
    setPdfState({ kind: 'working' })
    try {
      const { generatePdf, downloadPdf, uncoveredCharacters } = await import('./pdf/generatePdf')
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
      const name = working.savedName?.trim() || menu.title
      downloadPdf(await generatePdf(page, stageRef.current, name, menu.orientation))
      setPdfState({ kind: 'done' })
    } catch (err) {
      setPdfState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not create the PDF.',
      })
    }
  }, [menu, working.savedName])

  const onPrint = useCallback(() => window.print(), [])

  const onShare = useCallback(async () => {
    const url = shareUrl(menu)
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch {
      window.history.replaceState(null, '', url)
      setShareState('failed')
    }
  }, [menu])

  // --------------------------------------------------------------- render

  const tab = mobileTab === 'preview' ? 'preview' : view

  return (
    <div className="app" data-mobile-tab={mobileTab}>
      {/* Phones only; see the media query in styles.css. */}
      <div className="tabs" role="tablist" aria-label="Sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'menu'}
          onClick={() => {
            setView('menu')
            setMobileTab('edit')
          }}
        >
          Menu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nominees'}
          onClick={() => {
            setView('nominees')
            setMobileTab('edit')
          }}
        >
          Nominees{nominees.length ? ` ${nominees.length}` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setMobileTab('preview')}>
          Preview
        </button>
      </div>

      <Editor
        user={user}
        mode={mode}
        onSwitchUser={onSwitchUser}
        view={view}
        onView={setView}
        menu={menu}
        setMenu={setMenu}
        presetId={working.presetId}
        savedId={working.savedId}
        savedName={working.savedName}
        dirty={dirty}
        saved={saved}
        saveState={saveState}
        saveError={saveError}
        onOpenPreset={onOpenPreset}
        onOpenSaved={onOpenSaved}
        onNew={onNew}
        onClear={onClear}
        onSave={onSave}
        onRename={onRename}
        onDelete={onDelete}
        searchKey={searchKey}
        onOpenDrink={(drink) => setSheet({ kind: 'drink', drink })}
        onQuickAdd={onQuickAdd}
        onQuickNominate={onQuickNominate}
        onCreateOwn={(name) => setSheet({ kind: 'own', name })}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPatchSelected={onPatchSelected}
        onMoveSelected={onMoveSelected}
        onRemoveSelected={onRemoveSelected}
        onNominateSelected={onNominateSelected}
        nominees={nominees}
        nomineesOnMenu={nomineesOnMenu}
        onToggleNominee={onToggleNominee}
        onOpenNominee={(n) => setSheet({ kind: 'nominee', id: n.id })}
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

      {sheetEl}
    </div>
  )
}
