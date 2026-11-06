import { useEffect, useRef, useState } from 'react'
import type { PresetId } from '../presets'
import { PRESETS } from '../presets'
import type { SavedMenu } from '../cloud'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  presetId: PresetId | null
  savedId: string | null
  savedName: string | null
  dirty: boolean
  cocktailCount: number
  saved: SavedMenu[]
  saveState: SaveState
  saveError: string | null
  suggestedName: string
  onOpenPreset: (id: PresetId) => void
  onOpenSaved: (id: string) => void
  onNew: () => void
  onClear: () => void
  onSave: (name: string) => void
  onRename: (name: string) => void
  onDelete: () => void
}

/**
 * Which menu is on screen, and the four things you do to it.
 *
 * Starters and the user's own menus share one row of chips that scrolls
 * sideways, so switching is a single tap on a phone and the row never grows
 * downwards no matter how many menus pile up.
 */
export default function MenuSwitcher(p: Props) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (naming) nameRef.current?.select()
  }, [naming])

  // Opening another menu abandons a half-typed name.
  useEffect(() => setNaming(false), [p.presetId, p.savedId])

  const isSaved = p.savedId !== null
  const preset = PRESETS.find((x) => x.id === p.presetId)

  const status = isSaved
    ? p.saveState === 'saving'
      ? 'Saving…'
      : p.saveState === 'error'
        ? `Not saved — ${p.saveError ?? 'try again'}`
        : p.dirty
          ? 'Saving…'
          : 'Saved'
    : preset
      ? p.dirty
        ? 'Edited starter — save to keep it'
        : 'Starter menu — save to make it yours'
      : 'Not saved yet'

  const beginSave = () => {
    if (isSaved) return p.onSave(p.savedName ?? p.suggestedName)
    setName(p.suggestedName)
    setNaming(true)
  }

  const commit = () => {
    const n = name.trim()
    if (!n) return
    p.onSave(n)
    setNaming(false)
  }

  return (
    <section className="menus" aria-label="Menus">
      <div className="menus__strip" role="list">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="listitem"
            className="menus__chip"
            aria-pressed={!isSaved && p.presetId === x.id}
            onClick={() => p.onOpenPreset(x.id)}
          >
            <span className="menus__chip-kind">Starter</span>
            {x.label}
            <span className="menus__chip-count">{x.menu.cocktails.length}</span>
          </button>
        ))}
        {p.saved.map((m) => (
          <button
            key={m.id}
            type="button"
            role="listitem"
            className="menus__chip"
            aria-pressed={p.savedId === m.id}
            onClick={() => p.onOpenSaved(m.id)}
          >
            <span className="menus__chip-kind">Yours</span>
            {m.name}
            <span className="menus__chip-count">{m.menu.cocktails.length}</span>
          </button>
        ))}
        <button type="button" role="listitem" className="menus__chip menus__chip--new" onClick={p.onNew}>
          + New
        </button>
      </div>

      <div className="menus__current">
        {isSaved ? (
          <input
            className="menus__name"
            aria-label="Menu name"
            value={p.savedName ?? ''}
            onChange={(e) => p.onRename(e.target.value)}
          />
        ) : (
          <span className="menus__title">{preset ? `${preset.label} starter` : 'New menu'}</span>
        )}
        <span className={`menus__status${p.saveState === 'error' ? ' menus__status--error' : ''}`}>
          {status}
        </span>
      </div>

      {naming ? (
        <form
          className="row menus__naming"
          onSubmit={(e) => {
            e.preventDefault()
            commit()
          }}
        >
          <input
            ref={nameRef}
            aria-label="Name this menu"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn--primary" disabled={!name.trim()}>
            Save
          </button>
          <button type="button" className="btn--outline" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="menus__actions">
          {!isSaved && (
            <button type="button" className="btn--primary" onClick={beginSave}>
              Save
            </button>
          )}
          <button
            type="button"
            className="btn--outline"
            onClick={p.onClear}
            disabled={p.cocktailCount === 0}
          >
            Clear
          </button>
          {isSaved && (
            <button type="button" className="btn--outline" onClick={p.onDelete}>
              Delete
            </button>
          )}
        </div>
      )}
    </section>
  )
}
