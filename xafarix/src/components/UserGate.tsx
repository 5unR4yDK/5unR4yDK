import { useState } from 'react'
import { MAX_NAME, normalizeName } from '../session'

/**
 * The first screen: just a name. There is no password and no account; the
 * name is a tag that groups one person's menus, and the copy says so plainly
 * rather than implying a security it does not have.
 */
export default function UserGate({ onEnter }: { onEnter: (name: string) => void }) {
  const [value, setValue] = useState('')
  const name = normalizeName(value)

  return (
    <div className="gate">
      <form
        className="gate__card"
        onSubmit={(e) => {
          e.preventDefault()
          if (name) onEnter(name)
        }}
      >
        <h1 className="gate__brand">Xafarix</h1>
        <span className="overline">One-page cocktail menus</span>

        <label className="field__label gate__label" htmlFor="gate-name">
          What’s your name?
        </label>
        <input
          id="gate-name"
          value={value}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          autoCapitalize="words"
          autoFocus
          placeholder="Francesco"
          onChange={(e) => setValue(e.target.value)}
        />

        <button type="submit" className="btn--primary" disabled={!name}>
          Let’s go
        </button>

        <p className="hint gate__note">
          No password. Your menus are kept under this name, so use the same one on your
          phone and your laptop. Anyone who types the same name opens the same menus — it
          is a name tag, not a lock.
        </p>
      </form>
    </div>
  )
}
