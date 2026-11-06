/**
 * Saved menus for one user.
 *
 *   GET    /api/menus?user=NAME               every saved menu, newest first
 *   PUT    /api/menus?user=NAME   {id?, name, menu}   create or update one
 *   DELETE /api/menus?user=NAME&id=ID         delete one
 */
import { randomUUID } from 'node:crypto'
import {
  LIMITS,
  badRequest,
  handle,
  json,
  listUnder,
  readBody,
  readJson,
  remove,
  userKey,
  writeJson,
} from './_store.js'

const ID = /^[a-f0-9]{32}$/
const pathFor = (key, id) => `u/${key}/menus/${id}.json`
const idOf = (pathname) => pathname.match(/\/menus\/([a-f0-9]{32})\.json$/)?.[1] ?? null

export const GET = handle(async (_request, url) => {
  const key = userKey(url.searchParams.get('user'))
  if (!key) return badRequest('A user name is required.')
  const blobs = await listUnder(`u/${key}/menus/`)
  const menus = (
    await Promise.all(
      blobs
        .filter((b) => idOf(b.pathname))
        .map(async (b) => {
          try {
            return await readJson(b.pathname)
          } catch {
            return null
          }
        }),
    )
  ).filter(Boolean)
  menus.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return json({ menus })
})

export const PUT = handle(async (request, url) => {
  const key = userKey(url.searchParams.get('user'))
  if (!key) return badRequest('A user name is required.')
  const body = await readBody(request)
  if (!body || typeof body !== 'object') return badRequest('Expected a JSON body.')

  const name = String(body.name ?? '').trim()
  if (name === '' || name.length > LIMITS.menuNameLength) {
    return badRequest(`A menu name of 1 to ${LIMITS.menuNameLength} characters is required.`)
  }
  const menu = body.menu
  if (!menu || typeof menu !== 'object' || !Array.isArray(menu.cocktails)) {
    return badRequest('Expected a menu with a cocktails list.')
  }
  if (menu.cocktails.length > LIMITS.cocktailsPerMenu) {
    return badRequest(`A menu can hold at most ${LIMITS.cocktailsPerMenu} cocktails.`)
  }

  let id = typeof body.id === 'string' && ID.test(body.id) ? body.id : null
  if (!id) {
    const existing = await listUnder(`u/${key}/menus/`)
    if (existing.length >= LIMITS.menusPerUser) {
      return badRequest(`You can keep at most ${LIMITS.menusPerUser} menus. Delete one first.`)
    }
    id = randomUUID().replace(/-/g, '')
  }

  const record = { id, name, updatedAt: new Date().toISOString(), menu }
  await writeJson(pathFor(key, id), record)
  return json({ menu: record })
})

export const DELETE = handle(async (_request, url) => {
  const key = userKey(url.searchParams.get('user'))
  const id = url.searchParams.get('id') ?? ''
  if (!key) return badRequest('A user name is required.')
  if (!ID.test(id)) return badRequest('A valid menu id is required.')
  await remove(pathFor(key, id))
  return json({ deleted: id })
})
