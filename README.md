# AI Learning Hub

This is a static, catalog-driven learning site (tutorials + Practice Labs + quizzes). It **must be served over HTTP** so the app can `fetch()` the JSON catalogs and tutorial HTML files.

## Run locally

From `c:\ai_learning_site`:

- If you have Python:
  - `python -m http.server 8000`
  - Open: `http://localhost:8000/`

## Troubleshooting

- If you double-click `index.html` and open it via `file://`, most browsers will block `fetch()` and the app can’t load the catalog.
- If you host the site in a subfolder, it should still work: all asset and data URLs are relative.
