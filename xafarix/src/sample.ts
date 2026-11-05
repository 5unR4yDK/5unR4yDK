import type { Menu } from './types'
import { DEFAULT_ORIENTATION } from './types'

let seq = 0
const id = () => `s${++seq}`

/**
 * A seeded menu so the app shows something the moment it opens. Seven items
 * lands in the middle of the layout engine's range, which is the most
 * informative default to look at.
 */
export const sampleMenu: Menu = {
  title: 'Xafarix',
  subtitle: 'Cocktails',
  orientation: DEFAULT_ORIENTATION,
  cocktails: [
    {
      id: id(),
      name: 'Negroni',
      description: 'Bitter, botanical and unhurried. The one to start on.',
      ingredients: 'Gin · Campari · Sweet vermouth · Orange',
    },
    {
      id: id(),
      name: 'Daiquiri',
      description: 'Three ingredients, nothing to hide behind.',
      ingredients: 'White rum · Lime · Cane sugar',
    },
    {
      id: id(),
      name: 'Old Fashioned',
      description: 'Sugar, bitters and time. Stirred until it turns silk.',
      ingredients: 'Bourbon · Demerara · Angostura · Orange peel',
    },
    {
      id: id(),
      name: 'Margarita',
      description: 'Sharp and salt-rimmed, built for the first warm evening.',
      ingredients: 'Blanco tequila · Lime · Triple sec · Salt',
    },
    {
      id: id(),
      name: 'Espresso Martini',
      description: 'The late shift. Dark, cold and wide awake.',
      ingredients: 'Vodka · Espresso · Coffee liqueur',
    },
    {
      id: id(),
      name: 'Paper Plane',
      description: 'Equal parts, perfectly balanced, dangerously easy.',
      ingredients: 'Bourbon · Aperol · Amaro Nonino · Lemon',
    },
    {
      id: id(),
      name: 'Gimlet',
      description: 'Cold, clean and bracing. Gin at its most direct.',
      ingredients: 'Gin · Lime cordial · Lime',
    },
  ],
}
