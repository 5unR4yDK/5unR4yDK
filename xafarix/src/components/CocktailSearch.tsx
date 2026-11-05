import { useCallback, useEffect, useRef, useState } from 'react'
import { SearchError, searchDrinks } from '../cocktaildb'
import type { Drink } from '../cocktaildb'

/** Long enough that typing a name does not fire a request per keystroke. */
const DEBOUNCE_MS = 350

interface Props {
  /** Opens the detail sheet for a result. */
  onInspect: (drink: Drink) => void
  /** Adds a blank entry under the typed name, for drinks not in the database. */
  onAddManual: (name: string) => void
}

/**
 * Name search against TheCocktailDB.
 *
 * The results list is deliberately a transient dropdown rather than a panel:
 * the console already shows the menu's own cocktails, and a second permanent
 * list of candidates is the thing that makes these tools feel endless.
 */
export default function CocktailSearch({ onInspect, onAddManual }: Props) {
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

  // Dismiss on an outside click so the dropdown never traps the console.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const addManual = useCallback(() => {
    const name = query.trim()
    if (name === '') return
    onAddManual(name)
    setQuery('')
    setOpen(false)
  }, [query, onAddManual])

  const trimmed = query.trim()

  return (
    <div className="search" ref={boxRef}>
      <label className="field__label" htmlFor="cocktail-search">
        Add a cocktail
      </label>
      <input
        id="cocktail-search"
        type="search"
        value={query}
        placeholder="Search by name — Negroni, Daiquiri…"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => trimmed !== '' && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          // Enter adds by hand when nothing matched, which is the fast path
          // for a house drink that will never be in the database.
          if (e.key === 'Enter' && !isLoading && results.length === 0) {
            e.preventDefault()
            addManual()
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
            results.map((drink) => (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="search__hit"
                key={drink.id}
                onClick={() => {
                  onInspect(drink)
                  setOpen(false)
                }}
              >
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
            ))}

          {/* Always offered: the database will not have a bar's own drinks. */}
          <button type="button" className="search__manual" onClick={addManual}>
            Add “{trimmed}” myself
          </button>
        </div>
      )}
    </div>
  )
}
