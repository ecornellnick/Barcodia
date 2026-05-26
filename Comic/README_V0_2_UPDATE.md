# Barcodia Comic Reader v0.2 Update

This version fixes the PNG/SVG mismatch.

- Pages 1–3 are actual PNG comic pages.
- The JavaScript chapter data now points to `page-001.png`, `page-002.png`, and `page-003.png`.
- Pages 4–11 are still SVG placeholders until final comic pages are generated.

## How to use

Open `index.html` in your browser, or run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Important

Do not just drop randomly named PNGs into the folder. The reader displays whatever file path is listed in `js/chapter-data.js`.
