/**
 * Who is using the app, and what they were last working on.
 *
 * The user is a typed name with no password: a name tag, not a lock. It is
 * remembered on this device so the gate only appears once.
 */
import type { Menu } from './types'
import type { PresetId } from './presets'

const USER_KEY = 'xafarix.user'

export const MAX_NAME = 40

/** Trimmed, single-spaced, 1 to 40 characters; null if not usable. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  return name.length > 0 && name.length <= MAX_NAME ? name : null
}

/** Case-insensitive key: "Francesco" and "francesco" are the same person. */
export const userSlug = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private window or blocked storage: the app still runs, just forgets.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* as above */
  }
}

export const loadUser = (): string | null => normalizeName(safeGet(USER_KEY) ?? '')
export const saveUser = (name: string) => safeSet(USER_KEY, name)
export const clearUser = () => safeRemove(USER_KEY)

/** The menu on screen, and what it is relative to: a starter, a save, or neither. */
export interface Working {
  menu: Menu
  /** Id of the saved menu this is, once saved. */
  savedId: string | null
  /** Its name in the user's list. */
  savedName: string | null
  /** The starter it was opened from, while it is still unsaved. */
  presetId: PresetId | null
  /** Serialised name + menu at the last load or save; differs when edited. */
  baseline: string
}

export const signature = (w: Pick<Working, 'menu' | 'savedName'>) =>
  JSON.stringify({ n: w.savedName, m: w.menu })

const workKey = (user: string) => `xafarix.work.${userSlug(user)}`

export function loadWorking(user: string): Working | null {
  try {
    const raw = safeGet(workKey(user))
    if (!raw) return null
    const w = JSON.parse(raw) as Working
    return w && w.menu && Array.isArray(w.menu.cocktails) ? w : null
  } catch {
    return null
  }
}

export const saveWorking = (user: string, w: Working) => safeSet(workKey(user), JSON.stringify(w))

/** Device storage used by the per-user store; exported for the store only. */
export const deviceStore = { get: safeGet, set: safeSet, remove: safeRemove }
