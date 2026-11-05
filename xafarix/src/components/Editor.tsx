import type { Cocktail, Menu, Orientation } from '../types'
import { newCocktail } from '../types'
import type { FitReport } from './MenuPage'
import { MIN_BODY_PT } from './MenuPage'
import type { PdfState } from '../App'

interface Props {
  menu: Menu
  setMenu: (m: Menu) => void
  fit: FitReport | null
  onDownloadPdf: () => void
  onPrint: () => void
  onShare: () => void
  shareState: 'idle' | 'copied' | 'failed'
  pdfState: PdfState
}

export default function Editor({
  menu,
  setMenu,
  fit,
  onDownloadPdf,
  onPrint,
  onShare,
  shareState,
  pdfState,
}: Props) {
  const patch = (p: Partial<Menu>) => setMenu({ ...menu, ...p })

  const patchCocktail = (id: string, p: Partial<Cocktail>) =>
    patch({
      cocktails: menu.cocktails.map((c) => (c.id === id ? { ...c, ...p } : c)),
    })

  const add = () => patch({ cocktails: [...menu.cocktails, newCocktail()] })

  const remove = (id: string) =>
    patch({ cocktails: menu.cocktails.filter((c) => c.id !== id) })

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= menu.cocktails.length) return
    const next = [...menu.cocktails]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    patch({ cocktails: next })
  }

  const setOrientation = (orientation: Orientation) => patch({ orientation })

  const tooSmall = fit !== null && menu.cocktails.length > 0 && fit.bodyPt < MIN_BODY_PT

  return (
    <div className="editor">
      <div className="editor__brand">
        <h1>Xafarix</h1>
        <span className="overline">One-page cocktail menus</span>
      </div>

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
            aria-pressed={menu.orientation === 'portrait'}
            onClick={() => setOrientation('portrait')}
          >
            Portrait
          </button>
          <button
            type="button"
            aria-pressed={menu.orientation === 'landscape'}
            onClick={() => setOrientation('landscape')}
          >
            Landscape
          </button>
        </div>
      </div>

      <div className="list">
        {menu.cocktails.map((c, i) => (
          <div className="item" key={c.id}>
            <div className="item__head">
              <span className="item__num">{i + 1}</span>
              <input
                value={c.name}
                placeholder="Cocktail name"
                aria-label={`Cocktail ${i + 1} name`}
                onChange={(e) => patchCocktail(c.id, { name: e.target.value })}
              />
              <div className="item__tools">
                <button
                  type="button"
                  className="btn--icon"
                  title="Move up"
                  aria-label={`Move ${c.name || `cocktail ${i + 1}`} up`}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn--icon"
                  title="Move down"
                  aria-label={`Move ${c.name || `cocktail ${i + 1}`} down`}
                  onClick={() => move(i, 1)}
                  disabled={i === menu.cocktails.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn--icon"
                  title="Remove"
                  aria-label={`Remove ${c.name || `cocktail ${i + 1}`}`}
                  onClick={() => remove(c.id)}
                >
                  ✕
                </button>
              </div>
            </div>
            <textarea
              rows={2}
              value={c.description}
              placeholder="Description"
              aria-label={`Cocktail ${i + 1} description`}
              onChange={(e) => patchCocktail(c.id, { description: e.target.value })}
            />
            <textarea
              rows={2}
              value={c.ingredients}
              placeholder="Ingredients"
              aria-label={`Cocktail ${i + 1} ingredients`}
              onChange={(e) => patchCocktail(c.id, { ingredients: e.target.value })}
            />
          </div>
        ))}
      </div>

      <button type="button" className="btn--add" onClick={add}>
        + Add cocktail
      </button>

      {tooSmall && (
        <p className="warn">
          At {menu.cocktails.length} cocktails the body text is down to{' '}
          {fit!.bodyPt.toFixed(1)}pt, which is too small to read on paper. Switch to
          landscape, shorten the descriptions, or split this across two menus.
        </p>
      )}

      {pdfState.kind === 'error' && <p className="warn">{pdfState.message}</p>}

      <p className="hint">
        {fit
          ? `${fit.cols} × ${fit.rows} · name ${(fit.namePx * 0.75).toFixed(0)}pt · body ${fit.bodyPt.toFixed(1)}pt`
          : 'Measuring…'}
      </p>

      <p className="hint">
        Your menu is saved in this browser and nowhere else. There is no account and no
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
