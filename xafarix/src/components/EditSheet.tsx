import { useEffect, useRef, useState } from 'react'
import type { Drink } from '../cocktaildb'
import type { Base, Origin } from '../types'
import { isCustom } from '../types'
import CustomMark from './CustomMark'

export interface Fields {
  name: string
  ingredients: string
  description: string
}

export interface SheetAction {
  label: string
  kind: 'primary' | 'outline' | 'quiet'
  run: (fields: Fields) => void
}

interface Props {
  /** Shown above the fields, e.g. "From the database" or "Nominee". */
  kicker: string
  initial: Fields
  origin?: Origin
  base?: Base
  /** The database record, when editing something found by search. */
  drink?: Drink
  thumb?: string | null
  actions: SheetAction[]
  onClose: () => void
}

/**
 * One cocktail, fully editable, before it goes anywhere.
 *
 * Opened from a search result (to calibrate a recipe before adding or
 * nominating it) or from the shortlist (to rework a nominee). Nothing is
 * changed until an action is pressed, and the pen mark appears the moment the
 * wording no longer matches where it came from.
 *
 * A bottom sheet on a phone, a dialog on a desktop: see .sheet in styles.css.
 */
export default function EditSheet({ kicker, initial, origin, base, drink, thumb, actions, onClose }: Props) {
  const [fields, setFields] = useState<Fields>(initial)
  const [showRecipe, setShowRecipe] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }))
  const custom = isCustom({ ...fields, origin, base })
  const named = fields.name.trim() !== ''
  const picture = thumb ?? drink?.thumb ?? null
  const badges = drink
    ? [drink.category, drink.glass, drink.iba].filter((b): b is string => Boolean(b))
    : []

  return (
    <div
      className="sheet__scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={fields.name || 'Cocktail'}>
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          {/* The database's 200px preview: the full photo is ~700px for a 64px square. */}
          {picture && <img className="sheet__thumb" src={`${picture}/preview`} alt="" />}
          <div className="sheet__headtext">
            <span className="overline">
              {kicker}
              {custom && (
                <span className="sheet__custom">
                  <CustomMark /> Your version
                </span>
              )}
            </span>
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
          <button type="button" className="btn--icon sheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet__body">
          <div className="field">
            <label htmlFor="sheet-name">Name</label>
            <input
              id="sheet-name"
              ref={nameRef}
              value={fields.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="sheet-ing">Ingredients</label>
            <textarea
              id="sheet-ing"
              rows={2}
              value={fields.ingredients}
              placeholder="Gin · Campari · Sweet vermouth"
              onChange={(e) => set({ ingredients: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="sheet-desc">Description</label>
            <textarea
              id="sheet-desc"
              rows={2}
              value={fields.description}
              placeholder="A line of your own"
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          {drink && (drink.pours.length > 0 || drink.instructions) && (
            <div className="sheet__recipe">
              <button
                type="button"
                className="sheet__recipe-toggle"
                aria-expanded={showRecipe}
                onClick={() => setShowRecipe((v) => !v)}
              >
                Original recipe {showRecipe ? '▴' : '▾'}
              </button>
              {showRecipe && (
                <>
                  {drink.pours.length > 0 && (
                    <ul className="pours">
                      {drink.pours.map((p) => (
                        <li key={`${p.ingredient}-${p.measure}`}>
                          <span className="pours__measure">{p.measure || '—'}</span>
                          <span className="pours__name">{p.ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {drink.instructions && (
                    <>
                      <p className="sheet__method">{drink.instructions}</p>
                      <button
                        type="button"
                        className="btn--outline"
                        onClick={() => set({ description: drink.instructions })}
                      >
                        Use method as description
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="sheet__foot">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.kind === 'primary' ? 'btn--primary' : a.kind === 'outline' ? 'btn--outline' : 'btn--quiet'}
              disabled={a.kind !== 'quiet' && !named}
              onClick={() => a.run({ ...fields, name: fields.name.trim() })}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
