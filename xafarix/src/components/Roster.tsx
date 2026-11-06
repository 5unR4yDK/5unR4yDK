import type { Cocktail } from '../types'
import { isCustom } from '../types'
import CustomMark from './CustomMark'

interface Props {
  cocktails: Cocktail[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Every cocktail in the menu, as one compact wrapping row of chips.
 *
 * This replaced a vertical stack of edit forms. Forty cocktails were forty
 * scrolling cards that repeated what the sheet beside them already showed;
 * as chips the same forty fit in a few rows and act as the selector for the
 * single editor below. When categories arrive they become headed groups here,
 * which a column of forms could never do cleanly.
 */
export default function Roster({ cocktails, selectedId, onSelect }: Props) {
  if (cocktails.length === 0) return null

  return (
    <div className="roster">
      <span className="field__label">
        In this menu — {cocktails.length}
      </span>
      <div className="roster__chips">
        {cocktails.map((c, i) => (
          <button
            type="button"
            key={c.id}
            className="chip"
            aria-pressed={c.id === selectedId}
            onClick={() => onSelect(c.id)}
          >
            <span className="chip__num">{i + 1}</span>
            {c.name.trim() === '' ? <em>Untitled</em> : c.name}
            {isCustom(c) && <CustomMark />}
          </button>
        ))}
      </div>
    </div>
  )
}
