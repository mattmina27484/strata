# Strata Cleaned Project

This package contains the latest uploaded files with the entry point fixed.

## Main fix applied
`index.html` now loads these missing files before `app.jsx`:
- `profile.jsx`
- `news.jsx`
- `strata-ai.jsx`

Without those, the routes in `app.jsx` for `profile`, `news`, and `strata-ai` break because the screen components are never registered on `window`.

## Run locally
Because this is a static browser app, open it through a simple local server rather than double-clicking the file.

Python:
```bash
python3 -m http.server 8000
```
Then open:
```text
http://localhost:8000
```

## Optional config in `index.html`
- `window.STRATA_PASSCODE` — optional lock screen
- `window.GOOGLE_CLIENT_ID` — required for Google Drive backup
- `window.ANTHROPIC_API_KEY` or `window.STRATA_AI_ENDPOINT` — required for AI features

## Notes
- The core tracker works without AI or Drive config.
- AI/news/Drive features depend on third-party services and browser network access.
- `styles.css` is included because you uploaded it, though the current `index.html` still uses its inline stylesheet.
