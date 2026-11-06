import { useCallback, useEffect, useRef, useState } from 'react'
import { SearchError, searchDrinks } from '../cocktaildb'
import type { Drink } from '../cocktaildb'

/** Long enough that typing a name does not fire a request per keystroke. */
const DEBOUNCE_MS = 350

interface Props {
  /** Lower-cased names already on the menu / in the shortlist. */
  menuNames: ReadonlySet<string>
  nomineeNames: ReadonlySet<string>
  /** Tap on the result itself: open it to calibrate before doing anything. */
  onOpen: (drink: Drink) => void
  /** One-tap shortcuts that skip the sheet. */
  onQuickAdd: (drink: Drink) => void
  onQuickNominate: (drink: Drink) => void
  /** For a drink the database does not have: start one from the typed name. */
  onCreateOwn: (name: string) => void
}

/**
 * Name search against TheCocktailDB.
 *
 * Every result offers the two common moves as single taps — ★ to shortlist,
 * + to put straight on the menu — and the row itself opens the recipe for
 * editing first. The dropdown stays open after a quick tap so several
 * variations can be picked from one search.
 */
export default function CocktailSearch({
  menuNames,
  nomineeNames,
  onOpen,
  onQuickAdd,
  onQuickNominate,
  onCreateOwn,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Drink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q === '') {
      abortRef.current?.abort()
      setResults([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      // Cancel any request still in flight. Without this a slow response to
      // an earlier, shorter query can land after a later one and overwrite
      // the right results with stale ones.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      searchDrinks(q, controller.signal)
        .then((drinks) => {
          setResults(drinks)
          setOpen(true)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setResults([])
          setError(err instanceof SearchError ? err.message : 'Search failed.')
          setOpen(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Dismiss on an outside tap so the dropdown never traps the console.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const createOwn = useCallback(() => {
    const name = query.trim()
    if (name === '') return
    onCreateOwn(name)
    setOpen(false)
  }, [query, onCreateOwn])

  const trimmed = query.trim()
  const key = (d: Drink) => d.name.trim().toLowerCase()

  return (
    <div className="search" ref={boxRef}>
      <label className="field__label" htmlFor="cocktail-search">
        Find a cocktail
      </label>
      <input
        id="cocktail-search"
        type="search"
        value={query}
        placeholder="Negroni, daiquiri, mule…"
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => trimmed !== '' && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          // Enter starts a drink of your own when nothing matched — the fast
          // path for a house drink the database will never have.
          if (e.key === 'Enter' && !isLoading && results.length === 0) {
            e.preventDefault()
            createOwn()
          }
        }}
      />

      {open && trimmed !== '' && (
        <div className="search__panel" role="listbox" aria-label="Search results">
          {isLoading && <p className="search__state">Searching…</p>}
          {!isLoading && error && <p className="search__state search__state--error">{error}</p>}
          {!isLoading && !error && results.length === 0 && (
            <p className="search__state">Nothing in the database matches that.</p>
          )}

          {!isLoading &&
            !error &&
            results.map((drink) => {
              const onMenu = menuNames.has(key(drink))
              const nominated = nomineeNames.has(key(drink))
              return (
                <div className="search__hit" key={drink.id} role="option" aria-selected={false}>
                  <button type="button" className="search__hit-open" onClick={() => onOpen(drink)}>
                    {drink.thumb ? (
                      <img src={`${drink.thumb}/preview`} alt="" loading="lazy" />
                    ) : (
                      <span className="search__hit-noimg" aria-hidden="true" />
                    )}
                    <span className="search__hit-text">
                      <span className="search__hit-name">{drink.name}</span>
                      <span className="search__hit-meta">
                        {[drink.category, drink.glass].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="quick"
                    aria-pressed={nominated}
                    disabled={nominated}
                    aria-label={nominated ? `${drink.name} is nominated` : `Nominate ${drink.name}`}
                    title={nominated ? 'Already nominated' : 'Nominate'}
                    onClick={() => onQuickNominate(drink)}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="quick quick--add"
                    aria-pressed={onMenu}
                    disabled={onMenu}
                    aria-label={onMenu ? `${drink.name} is on the menu` : `Add ${drink.name} to the menu`}
                    title={onMenu ? 'On the menu' : 'Add to menu'}
                    onClick={() => onQuickAdd(drink)}
                  >
                    {onMenu ? '✓' : '+'}
                  </button>
                </div>
              )
            })}

          {/* Always offered: the database will not have a bar's own drinks. */}
          <button type="button" className="search__manual" onClick={createOwn}>
            Make “{trimmed}” my own
          </button>
        </div>
      )}
    </div>
  )
}
