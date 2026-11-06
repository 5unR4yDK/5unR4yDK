import type { Cocktail, Menu, Nominee, Orientation } from '../types'
import type { Drink } from '../cocktaildb'
import type { SavedMenu, Mode } from '../cloud'
import type { PresetId } from '../presets'
import type { FitReport } from './MenuPage'
import { MIN_BODY_PT } from './MenuPage'
import type { PdfState } from '../App'
import CocktailSearch from './CocktailSearch'
import Inspector from './Inspector'
import MenuSwitcher from './MenuSwitcher'
import type { SaveState } from './MenuSwitcher'
import NomineesPanel from './NomineesPanel'
import Roster from './Roster'

export type View = 'menu' | 'nominees'

interface Props {
  user: string
  mode: Mode | null
  onSwitchUser: () => void
  view: View
  onView: (v: View) => void

  menu: Menu
  setMenu: (m: Menu) => void
  presetId: PresetId | null
  savedId: string | null
  savedName: string | null
  dirty: boolean
  saved: SavedMenu[]
  saveState: SaveState
  saveError: string | null
  onOpenPreset: (id: PresetId) => void
  onOpenSaved: (id: string) => void
  onNew: () => void
  onClear: () => void
  onSave: (name: string) => void
  onRename: (name: string) => void
  onDelete: () => void

  searchKey: number
  onOpenDrink: (d: Drink) => void
  onQuickAdd: (d: Drink) => void
  onQuickNominate: (d: Drink) => void
  onCreateOwn: (name: string) => void

  selectedId: string | null
  onSelect: (id: string) => void
  onPatchSelected: (patch: Partial<Cocktail>) => void
  onMoveSelected: (delta: number) => void
  onRemoveSelected: () => void
  onNominateSelected: () => void

  nominees: Nominee[]
  nomineesOnMenu: ReadonlySet<string>
  onToggleNominee: (n: Nominee) => void
  onOpenNominee: (n: Nominee) => void

  fit: FitReport | null
  onDownloadPdf: () => void
  onPrint: () => void
  onShare: () => void
  shareState: 'idle' | 'copied' | 'failed'
  pdfState: PdfState
}

const lower = (s: string) => s.trim().toLowerCase()

export default function Editor(p: Props) {
  const { menu } = p
  const patch = (x: Partial<Menu>) => p.setMenu({ ...menu, ...x })
  const setOrientation = (orientation: Orientation) => patch({ orientation })

  const index = menu.cocktails.findIndex((c) => c.id === p.selectedId)
  const selected = index >= 0 ? menu.cocktails[index] : null
  const nominated =
    !!selected &&
    p.nominees.some((n) => n.id === selected.nomineeId || lower(n.name) === lower(selected.name))

  const menuNames = new Set(menu.cocktails.map((c) => lower(c.name)).filter(Boolean))
  const nomineeNames = new Set(p.nominees.map((n) => lower(n.name)).filter(Boolean))

  const tooSmall = p.fit !== null && menu.cocktails.length > 0 && p.fit.bodyPt < MIN_BODY_PT

  const search = (
    <CocktailSearch
      key={p.searchKey}
      menuNames={menuNames}
      nomineeNames={nomineeNames}
      onOpen={p.onOpenDrink}
      onQuickAdd={p.onQuickAdd}
      onQuickNominate={p.onQuickNominate}
      onCreateOwn={p.onCreateOwn}
    />
  )

  return (
    <div className="editor">
      <div className="editor__brand">
        <h1>Xafarix</h1>
        <span className="editor__user">
          {p.user}
          <span className="editor__sync">
            {p.mode === 'cloud' ? ' · synced' : p.mode === 'device' ? ' · on this device' : ''}
          </span>
          <button type="button" className="editor__switch" onClick={p.onSwitchUser}>
            Not you?
          </button>
        </span>
      </div>

      {/* On a phone the tab bar does this job, so this is desktop only. */}
      <div className="views" role="tablist" aria-label="Menu or nominees">
        <button type="button" role="tab" aria-selected={p.view === 'menu'} onClick={() => p.onView('menu')}>
          Menu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={p.view === 'nominees'}
          onClick={() => p.onView('nominees')}
        >
          Nominees{p.nominees.length ? ` · ${p.nominees.length}` : ''}
        </button>
      </div>

      {p.view === 'menu' ? (
        <>
          <MenuSwitcher
            presetId={p.presetId}
            savedId={p.savedId}
            savedName={p.savedName}
            dirty={p.dirty}
            cocktailCount={menu.cocktails.length}
            saved={p.saved}
            saveState={p.saveState}
            saveError={p.saveError}
            suggestedName={menu.title.trim() || 'My menu'}
            onOpenPreset={p.onOpenPreset}
            onOpenSaved={p.onOpenSaved}
            onNew={p.onNew}
            onClear={p.onClear}
            onSave={p.onSave}
            onRename={p.onRename}
            onDelete={p.onDelete}
          />

          {search}

          <Roster cocktails={menu.cocktails} selectedId={p.selectedId} onSelect={p.onSelect} />

          <Inspector
            cocktail={selected}
            index={index}
            total={menu.cocktails.length}
            onChange={p.onPatchSelected}
            onMove={p.onMoveSelected}
            onRemove={p.onRemoveSelected}
            nominated={nominated}
            onNominate={p.onNominateSelected}
          />

          <div className="row">
            <div className="field">
              <label htmlFor="menu-title">Menu title</label>
              <input
                id="menu-title"
                value={menu.title}
                placeholder="The bar's name"
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="menu-subtitle">Subtitle</label>
              <input
                id="menu-subtitle"
                value={menu.subtitle}
                placeholder="Cocktails"
                onChange={(e) => patch({ subtitle: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Paper — A4</label>
            <div className="seg">
              <button
                type="button"
                aria-pressed={menu.orientation === 'landscape'}
                onClick={() => setOrientation('landscape')}
              >
                Landscape
              </button>
              <button
                type="button"
                aria-pressed={menu.orientation === 'portrait'}
                onClick={() => setOrientation('portrait')}
              >
                Portrait
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {search}
          <NomineesPanel
            nominees={p.nominees}
            onMenu={p.nomineesOnMenu}
            onToggle={p.onToggleNominee}
            onOpen={p.onOpenNominee}
          />
        </>
      )}

      {tooSmall && (
        <p className="warn">
          At {menu.cocktails.length} cocktails the smallest text is down to{' '}
          {p.fit!.bodyPt.toFixed(1)}pt, too small to read on paper. Switch orientation,
          shorten the descriptions, or split this across two menus.
        </p>
      )}

      {p.pdfState.kind === 'error' && <p className="warn">{p.pdfState.message}</p>}

      <p className="hint">
        {p.fit
          ? `${p.fit.cols} × ${p.fit.rows} · name ${(p.fit.namePx * 0.75).toFixed(0)}pt · smallest ${p.fit.bodyPt.toFixed(1)}pt`
          : 'Measuring…'}
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn--primary"
          onClick={p.onDownloadPdf}
          disabled={p.pdfState.kind === 'working' || menu.cocktails.length === 0}
        >
          {p.pdfState.kind === 'working' ? 'Making PDF' : 'Download PDF'}
        </button>

        <div className="row">
          <button type="button" className="btn--outline" onClick={p.onPrint}>
            Print
          </button>
          <button type="button" className="btn--outline" onClick={p.onShare}>
            {p.shareState === 'copied'
              ? 'Link copied'
              : p.shareState === 'failed'
                ? 'Copy failed'
                : 'Share link'}
          </button>
        </div>
      </div>
    </div>
  )
}
