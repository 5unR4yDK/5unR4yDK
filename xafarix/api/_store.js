/**
 * Per-user storage on Vercel Blob.
 *
 * There is no authentication by design: a user is just a name, and anyone who
 * types the same name sees the same menus. The limits below are therefore not
 * security, only a guard against one name filling the store by accident.
 *
 * Layout, one JSON document per thing:
 *   u/<key>/menus/<id>.json   a saved menu
 *   u/<key>/nominees.json     the user's shortlist
 * where <key> is the lower-cased name in base64url, so "Francesco",
 * "francesco" and " FRANCESCO " are the same person, and any alphabet is
 * a valid path.
 *
 * Writes overwrite in place and reads bypass the CDN cache (useCache: false),
 * so a menu saved on a phone is what the laptop reads a second later.
 */
import { del, get, list, put } from '@vercel/blob'

export const LIMITS = {
  nameLength: 40,
  menuNameLength: 80,
  menusPerUser: 100,
  cocktailsPerMenu: 80,
  nominees: 300,
  documentBytes: 150_000,
}

/** Is a store connected? Until one is, the app keeps data on each device. */
export function storageReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** Normalises a typed name into a stable path segment, or null if invalid. */
export function userKey(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (name === '' || name.length > LIMITS.nameLength) return null
  return Buffer.from(name.toLowerCase(), 'utf8').toString('base64url')
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export const unavailable = () =>
  json({ error: 'storage-unavailable', message: 'No storage is connected yet.' }, 503)

export const badRequest = (message) => json({ error: 'bad-request', message }, 400)

/**
 * Whether the store is public or private is chosen when it is created, and
 * every call has to name the right one. It is read off the store's URLs where
 * any exist; a first write tries private, then public.
 */
let access = null

function accessFromUrl(url) {
  if (url.includes('.private.blob.')) return 'private'
  if (url.includes('.public.blob.')) return 'public'
  return null
}

export async function listUnder(prefix) {
  const blobs = []
  let cursor
  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    blobs.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  if (!access) access = blobs.map((b) => accessFromUrl(b.url)).find(Boolean) ?? null
  return blobs
}

export async function readJson(pathname) {
  const attempt = async (mode) => {
    const res = await get(pathname, { access: mode, useCache: false })
    if (!res) return null
    return JSON.parse(await new Response(res.stream).text())
  }
  if (access) return attempt(access)
  try {
    return await attempt('private')
  } catch {
    return attempt('public')
  }
}

export async function writeJson(pathname, value) {
  const body = JSON.stringify(value)
  if (Buffer.byteLength(body) > LIMITS.documentBytes) {
    throw Object.assign(new Error('That is too large to save.'), { status: 413 })
  }
  const attempt = (mode) =>
    put(pathname, body, {
      access: mode,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    })
  if (access) return attempt(access)
  try {
    const r = await attempt('private')
    access = 'private'
    return r
  } catch {
    const r = await attempt('public')
    access = 'public'
    return r
  }
}

export async function remove(pathname) {
  await del(pathname)
}

export async function readBody(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Wraps a handler so storage failures become a JSON error, not a crash. */
export function handle(fn) {
  return async (request) => {
    if (!storageReady()) return unavailable()
    try {
      return await fn(request, new URL(request.url))
    } catch (err) {
      const status = err?.status ?? 500
      return json({ error: 'server', message: err?.message ?? 'Something went wrong.' }, status)
    }
  }
}
