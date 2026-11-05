/**
 * TheCocktailDB client.
 *
 * Used only to prefill. Whatever comes back is copied into an ordinary,
 * fully editable menu entry — the menu never holds a reference to the remote
 * record, so a bartender's edits are theirs and nothing upstream can change a
 * printed menu afterwards.
 */

const BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

/** One ingredient paired with its measure. */
export interface Pour {
  ingredient: string
  /** Empty for things like a garnish, which the API leaves unmeasured. */
  measure: string
}

export interface Drink {
  id: string
  name: string
  thumb: string | null
  category: string | null
  alcoholic: string | null
  glass: string | null
  iba: string | null
  instructions: string
  pours: Pour[]
}

/** The raw record: 51 flat keys, 30 of which are the ingredient matrix. */
interface RawDrink {
  [key: string]: string | null
}

/**
 * Collapses the API's 15 ingredient slots and 15 measure slots into a list.
 *
 * Slots are sparse and unordered in practice: a drink can have ingredient 1,
 * 2 and 4 filled with 3 empty, so every index to 15 is checked rather than
 * stopping at the first gap. A measure may be absent while its ingredient is
 * present (a garnish), which is not an error.
 */
export function zipPours(raw: RawDrink): Pour[] {
  const pours: Pour[] = []
  for (let i = 1; i <= 15; i++) {
    const ingredient = (raw[`strIngredient${i}`] ?? '').trim()
    if (ingredient === '') continue
    pours.push({
      ingredient,
      // Measures routinely carry a trailing space ("1 1/2 oz ").
      measure: (raw[`strMeasure${i}`] ?? '').trim(),
    })
  }
  return pours
}

function toDrink(raw: RawDrink): Drink {
  return {
    id: raw.idDrink ?? crypto.randomUUID(),
    name: (raw.strDrink ?? '').trim(),
    thumb: raw.strDrinkThumb || null,
    category: raw.strCategory || null,
    alcoholic: raw.strAlcoholic || null,
    glass: raw.strGlass || null,
    iba: raw.strIBA || null,
    instructions: (raw.strInstructions ?? '').trim(),
    pours: zipPours(raw),
  }
}

/** Renders pours the way the menu's ingredient line is written. */
export function poursToLine(pours: Pour[]): string {
  return pours
    .map((p) => (p.measure ? `${p.measure} ${p.ingredient}` : p.ingredient))
    .join(' · ')
}

export class SearchError extends Error {}

/**
 * Searches by name.
 *
 * A query with no matches is not an error: the API answers 200 with
 * `{"drinks": null}`, so null is normalised to an empty list here and callers
 * never see it.
 */
export async function searchDrinks(query: string, signal?: AbortSignal): Promise<Drink[]> {
  const q = query.trim()
  if (q === '') return []

  let res: Response
  try {
    res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(q)}`, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new SearchError('Could not reach the cocktail database. Check your connection.')
  }

  if (!res.ok) {
    throw new SearchError(`The cocktail database answered ${res.status}.`)
  }

  let body: { drinks?: RawDrink[] | null }
  try {
    body = await res.json()
  } catch {
    throw new SearchError('The cocktail database sent something unreadable.')
  }

  // The documented empty-result shape. Mapping over it without this check is
  // the crash the API's own quirk invites.
  if (!body || !Array.isArray(body.drinks)) return []

  return body.drinks.map(toDrink)
}
