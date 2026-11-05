import type { Cocktail, Menu, Orientation } from '../types'
import type { SavedMenu } from '../library'
import type { Drink } from '../cocktaildb'
import type { FitReport } from './MenuPage'
import { MIN_BODY_PT } from './MenuPage'
import type { PdfState } from '../App'
import CocktailSearch from './CocktailSearch'
import Inspector from './Inspector'
import MenuLibrary from './MenuLibrary'
import Roster from './Roster'

interface Props {
  menu: Menu
  /** Changes after a successful add, which remounts the search empty. */
  searchKey: number
  setMenu: (m: Menu) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onInspectDrink: (drink: Drink) => void
  onAddManual: (name: string) => void
  onPatchSelected: (patch: Partial<Cocktail>) => void
  onMoveSelected: (delta: number) => void
  onRemoveSelected: () => void
  saved: SavedMenu[]
  onSaveMenu: (name: string) => void
  onLoadMenu: (id: string) => void
  onDeleteMenu: (id: string) => void
  fit: FitReport | null
  onDownloadPdf: () => void
  onPrint: () => void
  onShare: () => void
  shareState: 'idle' | 'copied' | 'failed'
  pdfState: PdfState
}

export default function Editor({
  menu,
  searchKey,
  setMenu,
  selectedId,
  onSelect,
  onInspectDrink,
  onAddManual,
  onPatchSelected,
  onMoveSelected,
  onRemoveSelected,
  saved,
  onSaveMenu,
  onLoadMenu,
  onDeleteMenu,
  fit,
  onDownloadPdf,
  onPrint,
  onShare,
  shareState,
  pdfState,
}: Props) {
  const patch = (p: Partial<Menu>) => setMenu({ ...menu, ...p })
  const setOrientation = (orientation: Orientation) => patch({ orientation })

  const index = menu.cocktails.findIndex((c) => c.id === selectedId)
  const selected = index >= 0 ? menu.cocktails[index] : null

  const existingNames = new Set(
    menu.cocktails.map((c) => c.name.trim().toLowerCase()).filter(Boolean),
  )

  const tooSmall = fit !== null && menu.cocktails.length > 0 && fit.bodyPt < MIN_BODY_PT

  return (
    <div className="editor">
      <div className="editor__brand">
        <h1>Xafarix</h1>
        <span className="overline">One-page cocktail menus</span>
      </div>

      <CocktailSearch
        key={searchKey}
        existingNames={existingNames}
        onInspect={onInspectDrink}
        onAddManual={onAddManual}
      />

      <Roster cocktails={menu.cocktails} selectedId={selectedId} onSelect={onSelect} />

      <Inspector
        cocktail={selected}
        index={index}
        total={menu.cocktails.length}
        onChange={onPatchSelected}
        onMove={onMoveSelected}
        onRemove={onRemoveSelected}
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

      <MenuLibrary
        saved={saved}
        currentTitle={menu.title}
        onSave={onSaveMenu}
        onLoad={onLoadMenu}
        onDelete={onDeleteMenu}
      />

      {tooSmall && (
        <p className="warn">
          At {menu.cocktails.length} cocktails the smallest text is down to{' '}
          {fit!.bodyPt.toFixed(1)}pt, too small to read on paper. Switch orientation,
          shorten the descriptions, or split this across two menus.
        </p>
      )}

      {pdfState.kind === 'error' && <p className="warn">{pdfState.message}</p>}

      <p className="hint">
        {fit
          ? `${fit.cols} × ${fit.rows} · name ${(fit.namePx * 0.75).toFixed(0)}pt · smallest ${fit.bodyPt.toFixed(1)}pt`
          : 'Measuring…'}
      </p>

      <p className="hint">
        Menus are saved in this browser and nowhere else. There is no account and no
        server — the shareable link carries the whole menu inside it.
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn--primary"
          onClick={onDownloadPdf}
          disabled={pdfState.kind === 'working'}
        >
          {pdfState.kind === 'working' ? 'Making PDF' : 'Download PDF'}
        </button>

        <div className="row">
          <button type="button" className="btn--outline" onClick={onPrint}>
            Print
          </button>
          <button type="button" className="btn--outline" onClick={onShare}>
            {shareState === 'copied'
              ? 'Link copied'
              : shareState === 'failed'
                ? 'Copy failed'
                : 'Share link'}
          </button>
        </div>
      </div>
    </div>
  )
}
