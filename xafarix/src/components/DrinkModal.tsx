import { useEffect, useRef } from 'react'
import type { Drink } from '../cocktaildb'
import { poursToLine } from '../cocktaildb'

interface Props {
  drink: Drink
  /** Adds it to the menu. `useInstructions` copies them into the description. */
  onAdd: (drink: Drink, useInstructions: boolean) => void
  onClose: () => void
}

/**
 * The full recipe for one search result, shown before it is added.
 *
 * Transient by design. The console's job is the menu being built, so the
 * database's own detail lives in a sheet that opens, answers "is this the
 * drink I meant", and closes again.
 */
export default function DrinkModal({ drink, onAdd, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const badges = [drink.category, drink.alcoholic, drink.glass, drink.iba].filter(
    (b): b is string => Boolean(b),
  )

  return (
    <div
      className="modal__scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={drink.name}>
        <div className="modal__head">
          {drink.thumb && <img className="modal__thumb" src={drink.thumb} alt="" />}
          <div>
            <h2 className="modal__title">{drink.name}</h2>
            {badges.length > 0 && (
              <div className="badges">
                {badges.map((b) => (
                  <span className="badge" key={b}>
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn--icon modal__close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal__body">
          <section>
            <h3 className="field__label">Ingredients</h3>
            {drink.pours.length === 0 ? (
              <p className="hint">This record lists no ingredients.</p>
            ) : (
              <ul className="pours">
                {drink.pours.map((p) => (
                  <li key={`${p.ingredient}-${p.measure}`}>
                    <span className="pours__measure">{p.measure || '—'}</span>
                    <span className="pours__name">{p.ingredient}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="hint modal__asline">Goes onto the menu as: {poursToLine(drink.pours)}</p>
          </section>

          {drink.instructions !== '' && (
            <section>
              <h3 className="field__label">Method</h3>
              <p className="modal__instructions">{drink.instructions}</p>
            </section>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn--primary" onClick={() => onAdd(drink, false)}>
            Add to menu
          </button>
          {drink.instructions !== '' && (
            <button type="button" className="btn--outline" onClick={() => onAdd(drink, true)}>
              Add with method as description
            </button>
          )}
        </div>
        <p className="hint modal__note">
          Name, ingredients and description stay fully editable once added.
        </p>
      </div>
    </div>
  )
}
