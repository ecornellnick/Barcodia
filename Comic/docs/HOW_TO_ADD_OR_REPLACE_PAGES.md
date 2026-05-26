# How to Add or Replace Comic Pages

This reader now points to PNG comic page files, not SVG stubs.

## Replace an existing page

Go to:

```text
chapters/chapter-01-youre-late-again/pages/
```

Replace the matching PNG file using the same exact filename:

```text
page-001.png
page-002.png
page-003.png
...
page-010.png
```

Example: if Page 6 is revised, replace:

```text
chapters/chapter-01-youre-late-again/pages/page-006.png
```

Then refresh the browser.

## Add a brand-new page

1. Put the new image in the same folder using the next number:

```text
page-011.png
```

2. Open:

```text
js/chapter-data.js
```

3. Add a new object to the `pages` array for Page 11.

Use this pattern:

```js
{
  "number": 11,
  "title": "New Page Title",
  "goal": "What this page should accomplish.",
  "tone": "Tone/mood of the page.",
  "image": pageImg(11),
  "references": [],
  "panels": [
    {"label":"1","type":"Panel type","shot":"Shot description","text":"What happens here.","dialogue":""}
  ]
}
```

## Important

The browser cannot automatically discover new files in the folder. Replacing an existing PNG works immediately if the filename stays the same. Adding a new numbered page requires a new entry in `js/chapter-data.js`.
