import { useState } from 'react'
import type { SavedMenu } from '../library'

interface Props {
  saved: SavedMenu[]
  currentTitle: string
  onSave: (name: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Named menus kept on this browser: save the working menu, reopen an old one. */
export default function MenuLibrary({
  saved,
  currentTitle,
  onSave,
  onLoad,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const effective = name.trim() || currentTitle.trim()

  return (
    <div className="library">
      <button
        type="button"
        className="library__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Saved menus{saved.length > 0 ? ` — ${saved.length}` : ''} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div className="library__body">
          <div className="row">
            <input
              value={name}
              placeholder={currentTitle.trim() || 'Name this menu'}
              aria-label="Name for the saved menu"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && effective) {
                  onSave(effective)
                  setName('')
                }
              }}
            />
            <button
              type="button"
              className="btn--outline"
              disabled={!effective}
              onClick={() => {
                onSave(effective)
                setName('')
              }}
            >
              Save
            </button>
          </div>

          {saved.length === 0 ? (
            <p className="hint">Nothing saved yet. Saving keeps a copy on this browser.</p>
          ) : (
            <ul className="library__list">
              {saved.map((m) => (
                <li key={m.id}>
                  <button type="button" className="library__open" onClick={() => onLoad(m.id)}>
                    <span className="library__name">{m.name}</span>
                    <span className="library__meta">
                      {m.menu.cocktails.length} · {when(m.savedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn--icon"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => onDelete(m.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
