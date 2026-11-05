/**
 * Persistence without a backend.
 *
 * Two places a menu can live:
 *   - localStorage, so closing the tab does not lose the work;
 *   - the URL fragment, so a menu can be sent to someone as a plain link.
 *
 * Neither leaves the browser. There is no account, no server and no database,
 * which is why this app has no running costs and no stored personal data.
 *
 * Every read is wrapped: storage throws in private windows and when site data
 * is blocked, and the app has to keep working in that case.
 */

import type { Menu } from './types'

const KEY = 'xafarix.menu.v1'

/** btoa/atob only handle latin1, so UTF-8 is encoded first. */
function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function saveLocal(menu: Menu): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(menu))
  } catch {
    // Private window or blocked site data. Nothing to do; the app still runs.
  }
}

export function loadLocal(): Menu | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Menu) : null
  } catch {
    return null
  }
}

export function encodeToHash(menu: Menu): string {
  return toBase64(JSON.stringify(menu))
}

export function loadFromHash(): Menu | null {
  try {
    const hash = window.location.hash.replace(/^#m=/, '')
    if (!hash || hash === window.location.hash) return null
    return JSON.parse(fromBase64(hash)) as Menu
  } catch {
    return null
  }
}

export function shareUrl(menu: Menu): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#m=${encodeToHash(menu)}`
}
