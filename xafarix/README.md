# Xafarix

Type in cocktails, get a print-ready one-page menu.

The point of the app is that you never lay anything out. You enter names,
descriptions and ingredients; it decides how many columns and rows the page
should have and how large the type can be, so that whatever you put in fills
one sheet of A4 and looks deliberate. One cocktail becomes a poster. Twenty-
seven become a tight three-column list. Nothing ever runs off the page.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

The "Share link" button still encodes the entire menu into the URL fragment,
so a link carries a menu with it independently of any storage. Saved menus
and the shortlist are covered under *Storage* below; both run on free tiers.

## Users, menus and the shortlist

**A name, not an account.** The first visit asks for a name and nothing else.
Everything is kept under it, matched without regard to case or spacing, so
"Francesco" on a phone and "francesco" on a laptop are the same person. There
is no password: anyone who types the same name opens the same menus. That is
deliberate for a private experiment, and the sign-in screen says so plainly.

**Starter menus.** Small (4 cocktails), Medium (10) and Large (28) are always
available, and a new user opens on Small. Opening one gives a working copy;
saving it makes it the user's own, and from then on it saves itself.
Switching away from an edited starter asks first, since that is the only case
where work could be lost. **New** opens a blank menu; **Clear** empties the one
on screen, after asking.

**Nominees.** A shortlist kept beside the menu without changing it. Every
search result has two one-tap buttons — ★ to nominate, + to put straight on
the menu — and tapping the result itself opens it for editing first. Each
nominee row carries a single button that both adds it to the menu and takes
it off again. Anything changed from the recipe it came from, or written from
scratch, carries a small pen mark.

On a phone the three areas are tabs — Menu, Nominees, Preview — and editing
happens in a sheet that rises from the bottom, where the thumb already is.

### Storage

Synced through two small serverless functions, `api/menus.js` and
`api/nominees.js`, onto Vercel Blob: one JSON document per menu and one per
shortlist, written in place and read past the CDN cache, so a save on one
device is what another reads a second later.

Until a Blob store is connected to the project, the functions answer `503`
and the app keeps everything on each device instead — it works either way,
and says which ("synced" or "on this device") beside the user's name. When
sync is switched on, menus that so far existed only on a device are uploaded
rather than left behind.

To switch sync on: Vercel → the `xafarix` project → **Storage** → **Create** →
**Blob** (private), connected to this project, then redeploy. The store's
token arrives as `BLOB_READ_WRITE_TOKEN`; nothing in the code changes.

## The console

One rule drove the layout: nothing in the console repeats what the sheet
beside it already shows.

- **Search** adds cocktails. Debounced at 350ms, so typing a name is one
  request rather than nine, and in-flight requests are aborted when a newer
  one starts — otherwise a slow answer to a short query can land after a
  later one and overwrite the right results. Results are a dropdown that
  closes, not a panel that stays.
- **A detail sheet** opens on a result: image, category, glass, IBA badges,
  the ingredient table and the method. It answers "is this the drink I meant"
  and then closes.
- **The roster** is every cocktail in the menu as compact chips, a few
  wrapping rows even at forty. This replaced a vertical stack of edit forms,
  one per cocktail, which both repeated the sheet and turned a long menu into
  a long scroll.
- **One inspector** edits the selected cocktail, always open and never a
  modal: editing is exactly when the live re-fit matters, and a dialog over
  the preview would hide it.
- **The sheet is also the selector.** Clicking a cocktail on the page selects
  it for editing. That is what lets the console drop its own copy of the list.

Adding from the database copies name and ingredients in by value and nothing
else; the method is one button away if wanted. The menu keeps no link back to
the record, so every field is the bartender's from that moment and nothing
upstream can alter a printed menu. Drinks the database has never heard of are
added under whatever was typed.

Chips are also what makes categories tractable later: they become headed
groups, and a cocktail moves between groups by dragging a chip. A column of
forms could never do that cleanly.

## How the layout works

Two separate problems, solved in two places.

**Which grid?** (`src/layout.ts`) Given N cocktails and the printable area of
the sheet, every possible column count is scored and the best one wins. The
score weighs the proportion of the resulting cell against a target that shifts
with the item count — a single hero cocktail wants a roughly square block,
thirty want wide, shallow list rows — then penalises wasted slots in the last
row, and applies hard floors below which a column is too narrow to hold a name
or too shallow to hold three lines of type.

**Which type size?** (`src/fit.ts`) A binary search for the largest font size
at which no cell overflows, in the manner of
[fitty](https://github.com/rikschennink/fitty) and
[textFit](https://github.com/STRML/textFit). The difference is that one size is
found for the whole page rather than one per cell: a menu where every cocktail
is set at a slightly different size looks like a mistake. Per fitty's own
warning about web fonts invalidating earlier measurements, the search is re-run
once `document.fonts.ready` resolves.

Secondary text is not held at a fixed fraction of the name. On a one-cocktail
page the description sits at 28% of a very large name; as the menu gets denser
that ratio climbs toward parity, because 28% of an already-small name would be
unreadable.

## Design

The colours and type are not an interpretation of the venue's site; they are
its own tokens, read out of `republic.show`'s stylesheet:

| token | value | used for |
| --- | --- | --- |
| `--cream` | `#faf8f5` | the canvas the editor sits on |
| `--cream-200` | `#f5f0e8` | the stage behind the sheet |
| `--charcoal` | `#1a1a1a` | the sheet itself, and filled controls |
| `--charcoal-500` | `#9a9a9a` | secondary text |
| `--gold` | `#c9a227` | every call to action, and the menu's overline |
| `--gold-light` | `#e8d5b0` | the gold hover state |
| `--gold-dark` | `#996515` | warnings |

The venue pairs **Montserrat** (300-900) with **Cormorant Garamond**, so the
menu sets cocktail names in Cormorant 700, descriptions in its medium italic -
the treatment the site gives its taglines - and the ingredient line in
Montserrat, since that line is information rather than voice. Cards use the
site's 3px radius and buttons its 2px, with calls to action in uppercase
Montserrat tracked to 0.12em and carrying the same arrow as its RESERVE
buttons.

Hierarchy is carried by weight, tone and space. There are no rules, dividers
or accent bars anywhere in the stylesheet: panes are told apart by their cream
tone, selected states by a filled charcoal block, and the pinned export bar by
a short gradient rather than a line.

## Getting the PDF out

**Download PDF** builds a real file and hands it to the browser. This is the
primary export because the print dialog is not a usable answer on a phone:
there it produces a print job, or on an in-app browser nothing at all.

The file is vector text in the same four faces as the preview, typically
10–25KB, drawn from the geometry the browser actually produced rather than
from a second layout pass — see `src/pdf/measure.ts`. Every line of text is
measured where it landed, so the PDF inherits the wrapping, the balanced
lines and the searched font size instead of trying to recompute them and
disagreeing. Verified against a screenshot of the same sheet: no horizontal
offset, under half a pixel vertically, and the rest of the difference is the
two rasterisers' antialiasing.

The three faces are subset to Latin, Latin-1 Supplement and Latin Extended-A,
which is what keeps them at 77KB rather than 760KB. Text outside that range
has no glyph, so the app checks first and points at **Print** instead, which
uses the browser's complete fonts. jsPDF and the fonts load only when the
button is pressed; they are not in the initial bundle.

**Print** opens the browser's own dialog, which is still the better path on a
desktop. An injected `@page` rule sets sheet size and orientation, and
`print-color-adjust: exact` keeps the black background even when "Background
graphics" is unticked.

The editor warns when the body text drops below 6pt — at that point the menu
needs landscape, shorter descriptions, or splitting in two.

## On a phone

The form and the sheet become tabs rather than stacking. Stacked, the preview
pane was the `1fr` row of an auto-height container: it collapsed to a ~56px
strip below a long scrolling form, and since its usable height was zero the
shrink-to-fit never ran, leaving a full-size A4 clipped inside the strip. As
tabs, whichever pane is showing gets the whole viewport. The sheet re-fits
when it becomes visible, because a `display: none` sheet cannot be measured.

## Not in this version

Groups and categories, colour themes and fonts beyond the black-and-white
house style, paper sizes other than A4, and images. The layout engine is
written against item counts rather than a fixed design, so categories can be
added as nested grids without rewriting it.
