/**
 * Fetches the embedded PDF faces at export time.
 *
 * These are subset copies of the two families republic.show uses, served from
 * /fonts as plain .ttf files rather than inlined as base64. 166KB of font
 * binary becomes 222KB once base64-encoded, and inlining it would put all of
 * that in a JavaScript chunk that cannot be cached separately or served
 * compressed as well. Fetching keeps the bytes as bytes.
 */

export interface LoadedFace {
  /** Filename registered in jsPDF's virtual file system. */
  vfsName: string
  /** Family name used with doc.setFont(). */
  family: string
  /** Style slot used with doc.setFont(). */
  style: 'normal' | 'bold' | 'italic'
  /** Base64 of the .ttf. */
  data: string
}

const FACES: ReadonlyArray<{
  url: string
  vfsName: string
  family: string
  style: 'normal' | 'bold' | 'italic'
}> = [
  {
    url: 'fonts/cormorant-garamond-700.ttf',
    vfsName: 'CormorantGaramond-Bold.ttf',
    family: 'CormorantGaramond',
    style: 'bold',
  },
  {
    url: 'fonts/cormorant-garamond-500-italic.ttf',
    vfsName: 'CormorantGaramond-MediumItalic.ttf',
    family: 'CormorantGaramond',
    style: 'italic',
  },
  {
    url: 'fonts/montserrat-400.ttf',
    vfsName: 'Montserrat-Regular.ttf',
    family: 'Montserrat',
    style: 'normal',
  },
  {
    url: 'fonts/montserrat-600.ttf',
    vfsName: 'Montserrat-SemiBold.ttf',
    family: 'Montserrat',
    style: 'bold',
  },
]

/** btoa needs a binary string, and spreading a large array blows the stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

let cache: Promise<LoadedFace[]> | null = null

/** Loads and caches every face. Repeated exports reuse the first fetch. */
export function loadFaces(): Promise<LoadedFace[]> {
  if (cache) return cache
  const base = import.meta.env.BASE_URL || '/'
  cache = Promise.all(
    FACES.map(async (face) => {
      const res = await fetch(`${base}${face.url}`)
      if (!res.ok) {
        throw new Error(`Could not load the font ${face.url} (${res.status}).`)
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      return { ...face, data: toBase64(bytes) }
    }),
  ).catch((err) => {
    // Let the next attempt retry rather than caching the failure forever.
    cache = null
    throw err
  })
  return cache
}
