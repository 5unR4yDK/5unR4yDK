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

export const newCocktail = (): Cocktail => ({
  id: Math.random().toString(36).slice(2, 10),
  name: '',
  description: '',
  ingredients: '',
})
