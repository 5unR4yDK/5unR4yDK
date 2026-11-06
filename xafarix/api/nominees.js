/**
 * One user's shortlist of nominated cocktails.
 *
 *   GET /api/nominees?user=NAME            { items }
 *   PUT /api/nominees?user=NAME  {items}   replace the list
 */
import {
  LIMITS,
  badRequest,
  handle,
  json,
  listUnder,
  readBody,
  readJson,
  userKey,
  writeJson,
} from './_store.js'

const pathFor = (key) => `u/${key}/nominees.json`

export const GET = handle(async (_request, url) => {
  const key = userKey(url.searchParams.get('user'))
  if (!key) return badRequest('A user name is required.')
  // Listed before it is read. The listing says whether the file exists and,
  // from its URL, whether the store is public or private. Reading blind with
  // the wrong guess could come back as "not found", show an empty shortlist,
  // and let the next save overwrite the real one.
  const found = await listUnder(pathFor(key))
  if (!found.some((b) => b.pathname === pathFor(key))) return json({ items: [], updatedAt: null })
  const doc = await readJson(pathFor(key))
  return json({ items: Array.isArray(doc?.items) ? doc.items : [], updatedAt: doc?.updatedAt ?? null })
})

export const PUT = handle(async (request, url) => {
  const key = userKey(url.searchParams.get('user'))
  if (!key) return badRequest('A user name is required.')
  const body = await readBody(request)
  if (!body || !Array.isArray(body.items)) return badRequest('Expected { items: [...] }.')
  if (body.items.length > LIMITS.nominees) {
    return badRequest(`The shortlist can hold at most ${LIMITS.nominees} cocktails.`)
  }
  const doc = { updatedAt: new Date().toISOString(), items: body.items }
  await writeJson(pathFor(key), doc)
  return json(doc)
})
