export interface Cocktail {
  id: string
  name: string
  description: string
  ingredients: string
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

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

export const newCocktail = (fields: Partial<Cocktail> = {}): Cocktail => ({
  id: newId(),
  name: '',
  description: '',
  ingredients: '',
  ...fields,
})

export const emptyMenu = (): Menu => ({
  title: '',
  subtitle: '',
  orientation: DEFAULT_ORIENTATION,
  cocktails: [],
})
