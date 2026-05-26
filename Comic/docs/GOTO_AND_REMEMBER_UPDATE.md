# Go To Page + Remembered Page Update (v0.5)

This update adds:

- A **Go to page** number box in the top controls.
- Press **Enter** inside the box or click **Go** to jump.
- The reader automatically remembers the last page you viewed using browser localStorage.
- When you reopen the reader in the same browser, it returns to that page.

## Future page additions

The reader still depends on `js/chapter-data.js` for the page list.
If you add pages beyond the current count, `chapter-data.js` needs to include those page records.
