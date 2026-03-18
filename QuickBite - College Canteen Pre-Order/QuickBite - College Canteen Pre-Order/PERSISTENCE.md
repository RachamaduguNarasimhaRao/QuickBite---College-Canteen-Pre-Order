# Persistence (Local Miniflare & D1)

This short guide explains how local persistence works during development and how to verify or reset it.

## 🔧 What we enabled
- The Cloudflare Vite plugin is configured to persist state under `.mf/` (D1, KV, Durable Objects, etc.).
- `.mf/` is added to `.gitignore` so local state isn't committed.

## ✅ Quick verification
1. Start the dev server: `npm run dev`.
2. As **admin**, add a food item in the Admin UI.
3. Stop the dev server and restart it (`Ctrl+C`, then `npm run dev`).
4. Log in as admin — the food item should still be present.
5. Check that `.mf/v3` exists and contains D1 persistence files.

## ♻️ Reset local state (delete `.mf`)
- PowerShell:
  - Remove-Item -Recurse -Force .mf
- CMD:
  - rmdir /s /q .mf
- Or delete the `.mf` folder in File Explorer.

### npm script
- Run `npm run dev:reset-db` to remove the local persistence folder (`.mf`). This works cross-platform and prints `Removed .mf` (or `.mf not found`).

## ⚙️ Change persistence path
- Update `vite.config.ts` where `cloudflare()` is called:
```
cloudflare({ persistState: { path: ".mf" } })
```
You can set `path` to any directory you prefer (e.g., `.wrangler/state`).

## ☁️ Use a real D1 (production-like persistence)
- Create a D1 database in Cloudflare (UI or `wrangler d1 create <name>`).
- Add the binding in `wrangler.json` or `wrangler.toml`.
- Run `wrangler dev` or deploy the worker — data will persist in Cloudflare D1.

If you'd like, I can add a short note to the main `README.md` or add a script to make resetting local state easier. Which would you prefer?