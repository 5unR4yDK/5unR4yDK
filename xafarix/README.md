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

There is no backend, no account and no database. A menu is saved in the
browser's `localStorage`, and the "copy shareable link" button encodes the
entire menu into the URL fragment, so a link carries the menu with it and no
data is stored on a server. That is also why the app costs nothing to run.

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

## Printing

The sheet is rendered at true A4 in millimetres and only scaled down by a CSS
transform for the screen, so what you see is the printed page viewed smaller.
"Print / Save as PDF" opens the browser's own print dialog; an injected
`@page` rule sets the sheet size and orientation, and `print-color-adjust:
exact` keeps the black background even when the user leaves "Background
graphics" unticked. Output is one page, vector-sharp, with no PDF library and
no server involved.

The editor warns when the body text drops below 6pt — at that point the menu
needs landscape, shorter descriptions, or splitting in two.

## Not in this version

Groups and categories, colour themes and fonts beyond the black-and-white
house style, paper sizes other than A4, and images. The layout engine is
written against item counts rather than a fixed design, so categories can be
added as nested grids without rewriting it.
