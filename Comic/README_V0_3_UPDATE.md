# Barcodia Comic Reader v0.3 Update

This version fixes the issue where Pages 4–10 still pointed to old SVG placeholder stubs.

## What changed

- Pages 1–10 now load from PNG files.
- The old SVG page stubs were removed from the active `pages` folder to avoid confusion.
- `js/chapter-data.js` now uses a helper function `pageImg(pageNumber)` so page paths consistently point to:

```text
chapters/chapter-01-youre-late-again/pages/page-###.png
```

- Added `docs/HOW_TO_ADD_OR_REPLACE_PAGES.md`.

## Current story status

The current opening mini-arc is complete through Page 10:

1. Symbolic Nightmare
2. Barcodia — Morning
3. Warm Bedroom Wake-Up
4. Sister Texts / Realization
5. Scramble
6. Mom Kitchen Moment
7. Running Through Town
8. Street Con Begins
9. The Theft
10. First Skirmish

## Logo note

Some already-generated pages may still contain the old placeholder compass/star-style Barcodia symbol. That is known and can be replaced later during the visual cleanup pass. Future generated art should not use that symbol.
