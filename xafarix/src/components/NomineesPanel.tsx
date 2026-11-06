import type { Nominee } from '../types'
import { isCustom } from '../types'
import CustomMark from './CustomMark'

interface Props {
  nominees: Nominee[]
  /** Ids of nominees that are on the menu on screen. */
  onMenu: ReadonlySet<string>
  onToggle: (n: Nominee) => void
  onOpen: (n: Nominee) => void
}

/**
 * The shortlist: drinks kept aside without touching the menu.
 *
 * One button per row does both jobs — "+ Add" puts it on the menu on screen,
 * "✓ On menu" takes it off again — so building a menu from the shortlist is
 * a tap per drink. Tapping the drink itself opens it for editing.
 */
export default function NomineesPanel({ nominees, onMenu, onToggle, onOpen }: Props) {
  if (nominees.length === 0) {
    return (
      <div className="nominees nominees--empty">
        <p className="hint">
          Nothing nominated yet. Search above and tap <strong>★</strong> to keep a drink here
          without putting it on the menu — or tap a result first to make it your own version.
        </p>
      </div>
    )
  }

  return (
    <div className="nominees">
      <div className="nominees__head">
        <span className="field__label">Nominees — {nominees.length}</span>
        <span className="hint">Tap + to put one on the menu. Tap a name to edit it.</span>
      </div>
      <ul className="nominees__list">
        {nominees.map((n) => {
          const on = onMenu.has(n.id)
          return (
            <li key={n.id} className="nominee">
              <button type="button" className="nominee__body" onClick={() => onOpen(n)}>
                {n.thumb ? (
                  <img src={`${n.thumb}/preview`} alt="" loading="lazy" />
                ) : (
                  <span className="nominee__mono" aria-hidden="true">
                    {n.name.trim().charAt(0).toUpperCase() || '·'}
                  </span>
                )}
                <span className="nominee__text">
                  <span className="nominee__name">
                    {n.name || 'Untitled'}
                    {isCustom(n) && <CustomMark />}
                  </span>
                  <span className="nominee__ing">{n.ingredients || 'No ingredients yet'}</span>
                </span>
              </button>
              <button
                type="button"
                className={`nominee__toggle${on ? ' nominee__toggle--on' : ''}`}
                aria-pressed={on}
                aria-label={on ? `Remove ${n.name} from the menu` : `Add ${n.name} to the menu`}
                onClick={() => onToggle(n)}
              >
                {on ? '✓ On menu' : '+ Add'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
