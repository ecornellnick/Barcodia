# Barcodia Comic Reader — Local Prototype v0.3

This folder is a local browser-based comic/manga prototype for the Barcodia opening sequence:

**Chapter 1 Opening: “You’re Late Again”**

It is separate from the Barcodia game.

## How to open

The simplest method:

1. Unzip the folder.
2. Open `index.html` in Chrome, Edge, Safari, or Firefox.
3. Use the Previous/Next buttons or keyboard arrows.

Recommended local-server method:

```bash
cd barcodia_comic_reader_v0_3
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## What this contains

- `index.html` — local comic reader
- `css/style.css` — reader styling
- `js/chapter-data.js` — chapter/page data
- `js/reader.js` — page navigation logic
- `chapters/chapter-01-youre-late-again/pages/` — active PNG comic pages
- `docs/` — storyboard, layout templates, canon references, AI workflow, and page replacement instructions
- `references/` — supplied character and environment references
- `source_prompt/` — original opening-scope prompt

## Current active page files

The reader now loads these PNG files directly:

```text
chapters/chapter-01-youre-late-again/pages/page-001.png
chapters/chapter-01-youre-late-again/pages/page-002.png
chapters/chapter-01-youre-late-again/pages/page-003.png
chapters/chapter-01-youre-late-again/pages/page-004.png
chapters/chapter-01-youre-late-again/pages/page-005.png
chapters/chapter-01-youre-late-again/pages/page-006.png
chapters/chapter-01-youre-late-again/pages/page-007.png
chapters/chapter-01-youre-late-again/pages/page-008.png
chapters/chapter-01-youre-late-again/pages/page-009.png
chapters/chapter-01-youre-late-again/pages/page-010.png
```

To replace a page, overwrite the matching PNG with the same filename and refresh the browser.

For detailed instructions, see:

```text
docs/HOW_TO_ADD_OR_REPLACE_PAGES.md
```

## Canon reference reminder

- Hero is currently called Nick for comic drafting purposes.
- Hero visual source is `hero_main_unnamed.png`.
- Twin sister is `twin_sister_blonde.png` / Lumiere on the temporary phone UI.
- Mother is `mother.png`.
- Maverick is an anti-hero and is not the protagonist in this opening.
- The bedroom, kitchen, and village references are locked environment references.

Do not introduce new character designs or major environment designs without approval.

## Logo note

Some current generated pages may still include the old placeholder Barcodia compass/star-style icon. That symbol is now deprecated and should not be used for future generated art. It can be replaced later during a cleanup pass.


## v0.5 Update
Adds Go To Page controls and remembered last-read page state. See `docs/GOTO_AND_REMEMBER_UPDATE.md`.
