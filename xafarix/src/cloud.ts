/**
 * Saved menus and the shortlist, for one user.
 *
 * Synced through /api when a storage store is connected to the deployment;
 * kept on this device when it is not, so the app works either way. The
 * device copy is maintained in both modes: it is the fallback if the network
 * drops, and when sync is first switched on, anything saved only on this
 * device is uploaded rather than left behind.
 */
import type { Menu, Nominee } from './types'
import { newId } from './types'
import { deviceStore, userSlug } from './session'

export interface SavedMenu {
  id: string
  name: string
  updatedAt: string
  menu: Menu
}

export type Mode = 'cloud' | 'device'

const LEGACY_LIBRARY_KEY = 'xafarix.library.v1'

class ApiUnavailable extends Error {}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiUnavailable('offline')
  }
  // A static host without the API answers with the HTML page, not JSON.
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
  if (!isJson) throw new ApiUnavailable('no api')
  const data = await res.json()
  if (res.status === 503 && data?.error === 'storage-unavailable') throw new ApiUnavailable('no store')
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status}).`)
  return data as T
}

const byNewest = (a: SavedMenu, b: SavedMenu) => b.updatedAt.localeCompare(a.updatedAt)

export class UserStore {
  private constructor(
    readonly user: string,
    readonly mode: Mode,
  ) {}

  private get q() {
    return `user=${encodeURIComponent(this.user)}`
  }

  private get menusKey() {
    return `xafarix.u.${userSlug(this.user)}.menus`
  }

  private get nomineesKey() {
    return `xafarix.u.${userSlug(this.user)}.nominees`
  }

  private readDevice<T>(key: string): T[] {
    try {
      const v = JSON.parse(deviceStore.get(key) ?? '[]')
      return Array.isArray(v) ? (v as T[]) : []
    } catch {
      return []
    }
  }

  private writeDevice(key: string, value: unknown[]) {
    deviceStore.set(key, JSON.stringify(value))
  }

  /**
   * Opens the user's store, choosing cloud or device by asking the API once.
   * Returns the menus and shortlist as well, already reconciled.
   */
  static async open(user: string): Promise<{ store: UserStore; menus: SavedMenu[]; nominees: Nominee[] }> {
    const probe = new UserStore(user, 'device')
    probe.importLegacyLibrary()
    const deviceMenus = probe.readDevice<SavedMenu>(probe.menusKey)
    const deviceNominees = probe.readDevice<Nominee>(probe.nomineesKey)

    let cloudMenus: SavedMenu[]
    try {
      cloudMenus = (await api<{ menus: SavedMenu[] }>('GET', `/api/menus?${probe.q}`)).menus
    } catch (err) {
      if (!(err instanceof ApiUnavailable)) console.warn('Menus could not be loaded:', err)
      return { store: probe, menus: deviceMenus.sort(byNewest), nominees: deviceNominees }
    }

    const store = new UserStore(user, 'cloud')

    // Upload anything that so far only existed on this device.
    const known = new Set(cloudMenus.map((m) => m.id))
    for (const m of deviceMenus) {
      if (known.has(m.id)) continue
      try {
        const saved = (await api<{ menu: SavedMenu }>('PUT', `/api/menus?${store.q}`, m)).menu
        cloudMenus.push(saved)
      } catch (err) {
        console.warn('A device-only menu could not be uploaded yet:', err)
      }
    }

    let cloudNominees: Nominee[] = []
    try {
      cloudNominees = (await api<{ items: Nominee[] }>('GET', `/api/nominees?${store.q}`)).items
    } catch (err) {
      console.warn('The shortlist could not be loaded:', err)
      cloudNominees = []
    }
    const ids = new Set(cloudNominees.map((n) => n.id))
    const merged = [...cloudNominees, ...deviceNominees.filter((n) => !ids.has(n.id))]
    if (merged.length !== cloudNominees.length) {
      try {
        await api('PUT', `/api/nominees?${store.q}`, { items: merged })
      } catch (err) {
        console.warn('The shortlist could not be synced yet:', err)
      }
    }

    cloudMenus.sort(byNewest)
    store.writeDevice(store.menusKey, cloudMenus)
    store.writeDevice(store.nomineesKey, merged)
    return { store, menus: cloudMenus, nominees: merged }
  }

  /** Menus saved by the earlier, device-only version of the app are kept. */
  private importLegacyLibrary() {
    const raw = deviceStore.get(LEGACY_LIBRARY_KEY)
    if (!raw) return
    try {
      const legacy = JSON.parse(raw) as Array<{ name: string; savedAt: string; menu: Menu }>
      const current = this.readDevice<SavedMenu>(this.menusKey)
      for (const m of Array.isArray(legacy) ? legacy : []) {
        if (!m?.menu || !Array.isArray(m.menu.cocktails)) continue
        current.push({ id: newId(), name: m.name || 'Saved menu', updatedAt: m.savedAt, menu: m.menu })
      }
      this.writeDevice(this.menusKey, current)
    } catch {
      /* unreadable: leave it */
    }
    deviceStore.remove(LEGACY_LIBRARY_KEY)
  }

  async saveMenu(input: { id: string | null; name: string; menu: Menu }): Promise<SavedMenu> {
    const record: SavedMenu = {
      id: input.id ?? newId(),
      name: input.name,
      updatedAt: new Date().toISOString(),
      menu: input.menu,
    }
    const saved =
      this.mode === 'cloud'
        ? (await api<{ menu: SavedMenu }>('PUT', `/api/menus?${this.q}`, record)).menu
        : record
    const others = this.readDevice<SavedMenu>(this.menusKey).filter((m) => m.id !== saved.id)
    this.writeDevice(this.menusKey, [saved, ...others])
    return saved
  }

  async deleteMenu(id: string): Promise<void> {
    if (this.mode === 'cloud') {
      await api('DELETE', `/api/menus?${this.q}&id=${encodeURIComponent(id)}`)
    }
    this.writeDevice(
      this.menusKey,
      this.readDevice<SavedMenu>(this.menusKey).filter((m) => m.id !== id),
    )
  }

  async saveNominees(items: Nominee[]): Promise<void> {
    // Device first: a failed upload must never lose the edit.
    this.writeDevice(this.nomineesKey, items)
    if (this.mode === 'cloud') await api('PUT', `/api/nominees?${this.q}`, { items })
  }
}
