/**
 * Saved menus.
 *
 * A named shelf in localStorage beside the working menu. Still no server and
 * still no account: saving puts a copy on this browser, and the share link
 * remains the way to get a menu onto another device.
 */

import type { Menu } from './types'

const KEY = 'xafarix.library.v1'

export interface SavedMenu {
  id: string
  name: string
  /** ISO timestamp of the last save. */
  savedAt: string
  menu: Menu
}

function read(): SavedMenu[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedMenu[]) : []
  } catch {
    // Private window, blocked site data, or something else wrote here.
    return []
  }
}

function write(menus: SavedMenu[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(menus))
    return true
  } catch {
    return false
  }
}

/** Most recently saved first. */
export function listSaved(): SavedMenu[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/**
 * Saves under `name`, replacing any existing menu with the same name so that
 * saving twice does not silently leave two entries the user cannot tell apart.
 */
export function saveMenu(name: string, menu: Menu): SavedMenu[] {
  const trimmed = name.trim()
  if (trimmed === '') return listSaved()
  const existing = read().filter((m) => m.name.toLowerCase() !== trimmed.toLowerCase())
  const entry: SavedMenu = {
    id: crypto.randomUUID(),
    name: trimmed,
    savedAt: new Date().toISOString(),
    // Deep copy, so later edits to the working menu do not mutate the save.
    menu: JSON.parse(JSON.stringify(menu)) as Menu,
  }
  write([entry, ...existing])
  return listSaved()
}

export function deleteSaved(id: string): SavedMenu[] {
  write(read().filter((m) => m.id !== id))
  return listSaved()
}

export function loadSaved(id: string): Menu | null {
  const found = read().find((m) => m.id === id)
  return found ? (JSON.parse(JSON.stringify(found.menu)) as Menu) : null
}
