Subset copies of the two families republic.show uses, embedded into exported
PDFs so the file carries real vector text in the right typefaces.

Built from the Google Fonts static instances with:

    pyftsubset <face>.ttf \
      --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+00B7,U+2013-2014,\
U+2018-201A,U+201C-201E,U+2022,U+2026,U+20AC,U+2122" \
      --layout-features='' --no-hinting --desubroutinize \
      --drop-tables+=GSUB,GPOS

That covers Latin, Latin-1 Supplement, Latin Extended-A and the punctuation
menus use, and takes the four faces from 944KB to 166KB. Text outside the
range is detected before export and the user is sent to Print instead — see
uncoveredCharacters() in src/pdf/generatePdf.ts.

Both families are licensed under the SIL Open Font License 1.1.
