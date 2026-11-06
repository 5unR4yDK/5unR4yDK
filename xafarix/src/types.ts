/** Where a cocktail came from, which decides whether it counts as custom. */
export type Origin = 'database' | 'preset' | 'own'

/** The wording a cocktail started with, kept to tell whether it was changed. */
export interface Base {
  name: string
  ingredients: string
  description: string
}

export interface Cocktail {
  id: string
  name: string
  description: string
  ingredients: string
  /** Absent on menus saved before origins were tracked. */
  origin?: Origin
  base?: Base
  /** Set when the cocktail was added from the shortlist, to toggle it back off. */
  nomineeId?: string
}

/** A shortlisted cocktail: same fields, plus the database picture if any. */
export interface Nominee extends Cocktail {
  thumb?: string | null
}

export type Orientation = 'portrait' | 'landscape'

export interface Menu {
  title: string
  subtitle: string
  orientation: Orientation
  cocktails: Cocktail[]
}

/** Landscape by default: a bar menu is usually read lying on the counter. */
export const DEFAULT_ORIENTATION: Orientation = 'landscape'

/** 32 hex characters: the id format the storage API accepts. */
export const newId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

export const newCocktail = (fields: Partial<Cocktail> = {}): Cocktail => ({
  id: newId(),
  name: '',
  description: '',
  ingredients: '',
  ...fields,
})

export const emptyMenu = (orientation: Orientation = DEFAULT_ORIENTATION): Menu => ({
  title: '',
  subtitle: '',
  orientation,
  cocktails: [],
})

const same = (a: string, b: string) => a.trim() === b.trim()

/**
 * Whether the user has made this cocktail their own: written by hand, or
 * changed in any field from the recipe or starter it came from. Cocktails
 * from before origins were tracked are not marked, rather than all being
 * marked at once.
 */
export function isCustom(c: Pick<Cocktail, 'origin' | 'base' | 'name' | 'ingredients' | 'description'>): boolean {
  if (c.origin === 'own') return true
  if (!c.base) return false
  return (
    !same(c.name, c.base.name) ||
    !same(c.ingredients, c.base.ingredients) ||
    !same(c.description, c.base.description)
  )
}

/** A copy that can be added to a menu, keeping its provenance. */
export function asMenuCocktail(src: Omit<Cocktail, 'id'> & { id?: string }, nomineeId?: string): Cocktail {
  return {
    id: newId(),
    name: src.name,
    description: src.description,
    ingredients: src.ingredients,
    origin: src.origin,
    base: src.base,
    ...(nomineeId ? { nomineeId } : {}),
  }
}
