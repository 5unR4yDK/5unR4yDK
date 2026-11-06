/**
 * The three starter menus every user sees: small, medium and large.
 *
 * Fixed content, never saved over. Opening one gives a working copy; saving
 * that copy makes it the user's own menu. Every cocktail carries its own
 * wording as `base`, so once it is edited it is marked as customised.
 *
 * The large menu keeps its descriptions to a few words on purpose: at 28
 * cocktails on one landscape sheet, longer lines push the smallest text under
 * the size that can be read on paper.
 */
import type { Cocktail, Menu } from './types'
import { DEFAULT_ORIENTATION } from './types'

export type PresetId = 'small' | 'medium' | 'large'

type Row = [name: string, description: string, ingredients: string]

const cocktail = (presetId: PresetId, i: number, [name, description, ingredients]: Row): Cocktail => ({
  id: `p${presetId[0]}${String(i).padStart(2, '0')}${'0'.repeat(28)}`.slice(0, 32),
  name,
  description,
  ingredients,
  origin: 'preset',
  base: { name, description, ingredients },
})

const SMALL: Row[] = [
  ['Negroni', 'Bitter, botanical and unhurried. The one to start on.', 'Gin · Campari · Sweet vermouth · Orange peel'],
  ['Daiquiri', 'Three ingredients and nothing to hide behind.', 'White rum · Lime · Sugar'],
  ['Old Fashioned', 'Sugar, bitters and time. Stirred until it turns to silk.', 'Bourbon · Demerara · Angostura · Orange peel'],
  ['Espresso Martini', 'The late shift. Dark, cold and wide awake.', 'Vodka · Espresso · Coffee liqueur'],
]

const MEDIUM: Row[] = [
  ['Negroni', 'Bitter, botanical and unhurried.', 'Gin · Campari · Sweet vermouth · Orange peel'],
  ['Old Fashioned', 'Sugar, bitters and time, stirred to silk.', 'Bourbon · Demerara · Angostura · Orange peel'],
  ['Margarita', 'Sharp and salt-rimmed, for the first warm evening.', 'Tequila · Cointreau · Lime · Salt'],
  ['Daiquiri', 'Three ingredients, nothing to hide behind.', 'White rum · Lime · Sugar'],
  ['Espresso Martini', 'The late shift. Dark, cold and wide awake.', 'Vodka · Espresso · Coffee liqueur'],
  ['Paper Plane', 'Equal parts and dangerously easy.', 'Bourbon · Aperol · Amaro Nonino · Lemon'],
  ['Whisky Sour', 'Foam on top, bite underneath.', 'Bourbon · Lemon · Sugar · Egg white'],
  ['Mojito', 'Mint pressed, not murdered.', 'White rum · Mint · Lime · Sugar · Soda'],
  ['Aperol Spritz', 'Low, bright and built for the terrace.', 'Aperol · Prosecco · Soda · Orange'],
  ['French 75', 'Gin dressed for the evening.', 'Gin · Lemon · Sugar · Champagne'],
]

const LARGE: Row[] = [
  ['Negroni', 'Bitter and unhurried.', 'Gin · Campari · Sweet vermouth'],
  ['Old Fashioned', 'Stirred to silk.', 'Bourbon · Demerara · Angostura'],
  ['Margarita', 'Sharp and salt-rimmed.', 'Tequila · Cointreau · Lime · Salt'],
  ['Daiquiri', 'Nothing to hide behind.', 'White rum · Lime · Sugar'],
  ['Espresso Martini', 'Dark, cold, wide awake.', 'Vodka · Espresso · Coffee liqueur'],
  ['Paper Plane', 'Equal parts, easy.', 'Bourbon · Aperol · Amaro Nonino · Lemon'],
  ['Whisky Sour', 'Foam over bite.', 'Bourbon · Lemon · Sugar · Egg white'],
  ['Mojito', 'Mint, lime, crushed ice.', 'White rum · Mint · Lime · Soda'],
  ['Aperol Spritz', 'Built for the terrace.', 'Aperol · Prosecco · Soda'],
  ['French 75', 'Gin in black tie.', 'Gin · Lemon · Sugar · Champagne'],
  ['Gimlet', 'Cold and direct.', 'Gin · Lime cordial'],
  ['Manhattan', 'Entirely serious.', 'Rye · Sweet vermouth · Angostura'],
  ['Boulevardier', 'The Negroni, grown up.', 'Bourbon · Campari · Sweet vermouth'],
  ['Aviation', 'Pale violet, a little odd.', 'Gin · Maraschino · Crème de violette · Lemon'],
  ['Sidecar', 'Cognac, edges filed off.', 'Cognac · Cointreau · Lemon'],
  ['Pisco Sour', 'Bright and floral.', 'Pisco · Lime · Sugar · Egg white'],
  ['Caipirinha', 'Raw sugar, no fuss.', 'Cachaça · Lime · Sugar'],
  ['Mai Tai', 'Rum and a long afternoon.', 'Aged rum · Curaçao · Orgeat · Lime'],
  ['Last Word', 'Four parts, all loud.', 'Gin · Green Chartreuse · Maraschino · Lime'],
  ['Penicillin', 'Honey, ginger, smoke.', 'Blended Scotch · Honey · Ginger · Lemon'],
  ['Bramble', 'Blackberry through ice.', 'Gin · Lemon · Sugar · Crème de mûre'],
  ['Clover Club', 'Raspberry and silk.', 'Gin · Raspberry · Lemon · Egg white'],
  ['Dark ’n’ Stormy', 'Ginger heat, dark rum.', 'Dark rum · Ginger beer · Lime'],
  ['Vesper', 'Shaken, as he said.', 'Gin · Vodka · Lillet Blanc'],
  ['Americano', 'The long, low opener.', 'Campari · Sweet vermouth · Soda'],
  ['Sazerac', 'New Orleans, chilled.', 'Rye · Sugar · Peychaud’s · Absinthe'],
  ['Tommy’s Margarita', 'Agave, not orange.', 'Tequila · Lime · Agave'],
  ['Jungle Bird', 'Campari meets pineapple.', 'Dark rum · Campari · Pineapple · Lime'],
]

export interface Preset {
  id: PresetId
  label: string
  menu: Menu
}

function build(id: PresetId, label: string, subtitle: string, rows: Row[]): Preset {
  return {
    id,
    label,
    menu: {
      title: 'Xafarix',
      subtitle,
      orientation: DEFAULT_ORIENTATION,
      cocktails: rows.map((r, i) => cocktail(id, i, r)),
    },
  }
}

export const PRESETS: readonly Preset[] = [
  build('small', 'Small', 'The Short List', SMALL),
  build('medium', 'Medium', 'Cocktails', MEDIUM),
  build('large', 'Large', 'The Full Bar', LARGE),
]

export const DEFAULT_PRESET: PresetId = 'small'

/** A fresh, independent copy, so editing it never touches the starter. */
export function presetMenu(id: PresetId): Menu {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  return JSON.parse(JSON.stringify(p.menu)) as Menu
}
