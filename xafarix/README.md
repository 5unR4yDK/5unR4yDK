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

## Getting the PDF out

**Download PDF** builds a real file and hands it to the browser. This is the
primary export because the print dialog is not a usable answer on a phone:
there it produces a print job, or on an in-app browser nothing at all.

The file is vector text in the same three faces as the preview, typically
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
