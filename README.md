# Tasky

A simple mobile web app to keep track of client tasks: what's due, what's late, and what's done.

Dark, Apple-inspired UI. No accounts, no backend: data stays on your phone (localStorage), with export/import for backups.

## Features

- **Tasks grouped by deadline:** Overdue, Today, Tomorrow, Coming up, Later, No deadline
- **Quick summary tiles:** Overdue, Due today, Next 7 days (tap to jump)
- **To do / Done** switch, with "Done today / yesterday / earlier" history
- **Filter by client** with one tap
- **Clients view:** open count, overdue count, progress bar and next deadline per client
- **Fast add:** title, client chip, deadline chips (Today / Tomorrow / In a week / Pick date)
- **Undo** on complete, edit and delete
- **Installable (PWA):** "Add to Home Screen" works offline

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

Settings → Pages → Build and deployment → Source: **Deploy from a branch** → pick the branch and `/ (root)` → Save.

## Files

| File | What it does |
|------|--------------|
| `index.html` | App shell, sheets, tab bar |
| `styles.css` | Design tokens + components |
| `app.js` | State, rendering, interactions |
| `sw.js` | Offline cache (network-first) |
| `manifest.webmanifest`, `icons/` | Home-screen install |
