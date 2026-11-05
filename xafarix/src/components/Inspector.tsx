import type { Cocktail } from '../types'

interface Props {
  cocktail: Cocktail | null
  index: number
  total: number
  onChange: (patch: Partial<Cocktail>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}

/**
 * The editor for the one selected cocktail.
 *
 * Always open, never a modal. Editing is the moment the live fit matters most
 * — type a longer name and the whole sheet re-sizes — and a dialog over the
 * preview would hide exactly the thing the app exists to show.
 */
export default function Inspector({
  cocktail,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: Props) {
  if (!cocktail) {
    return (
      <div className="inspector inspector--empty">
        <p className="hint">
          Search above to add a cocktail, or pick one from the menu — on the chips or
          straight off the sheet.
        </p>
      </div>
    )
  }

  return (
    <div className="inspector">
      <div className="inspector__head">
        <span className="field__label">
          Editing {index + 1} of {total}
        </span>
        <div className="item__tools">
          <button
            type="button"
            className="btn--icon"
            title="Move earlier"
            aria-label="Move earlier"
            onClick={() => onMove(-1)}
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn--icon"
            title="Move later"
            aria-label="Move later"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn--icon"
            title="Remove from menu"
            aria-label="Remove from menu"
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="insp-name">Name</label>
        <input
          id="insp-name"
          value={cocktail.name}
          placeholder="Cocktail name"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="insp-ing">Ingredients</label>
        <textarea
          id="insp-ing"
          rows={2}
          value={cocktail.ingredients}
          placeholder="Gin · Campari · Sweet vermouth"
          onChange={(e) => onChange({ ingredients: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="insp-desc">Description</label>
        <textarea
          id="insp-desc"
          rows={2}
          value={cocktail.description}
          placeholder="A line of your own"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  )
}
