# app-surah

PWA Qur'an reader with Saʿdī tafsir (Arabic-only, RTL; light or dark by system). Rebuilt from a reverse‑engineering
of the Android app `com.surahapp`; the dossier is `docs/notes/re-report.md`, the raw APK/DB in
`apk/` and `db/` (git‑ignored). Live: https://surah-tafsir.pages.dev

## Where things live
- `src/pages/`: `index` (surah grid), `surah/[n]` (reader + tafsir sheet), `search`, `saved`, `about`.
  `src/layouts/App.astro` is the shell (bar, tab bar, settings sheet, toast).
- `src/lib.mjs`: `ar()`, `ayahWord()`, `verses`, `passages()`, `passageFor()`. Reads data by cwd
  path (`src/data/...`), never `import.meta.url` — Astro's prerender bundling breaks that.
- `src/data/`: Tanzil text, `tafsir/<n>.json` passages, `meta.json` (generated).
- `public/js/app.js`: sheet, harakat strip, bookmarks, last position, install, SW. `search.js`: bucket client.
- `scripts/`: `search-index.mjs` and `sw-manifest.mjs` run after `astro build`; `check.mjs` guards data.
- `tools/`: `make_meta.py` (meta + harakat audit), `export_tafsir.py` (APK DB → JSONL), `shots.py` (smoke test).
- `docs/notes/`: RE report, artifact inventory (raw APK/DB are git-ignored, in the main folder only), UI screenshots.

## Commands
- `npm ci`, `npm run dev`, `npm run build`, `npm run check`.
- Verify: `python3 -m http.server 8788 --directory dist` + `python3 tools/shots.py`.
- Deploy: `HOME=$PWD/.home npx wrangler@3 pages deploy dist --project-name surah-tafsir --branch main`.

## Conventions
- Harakat are never invented or removed from the data: surahs 40–114 are fully vocalised, 1–39 are
  not; `meta.json.full` drives the notice. Re-run `tools/make_meta.py` after any tafsir data change.
- Arabic UI only; no editorial text beyond UI words and the About page.
- Every page is static; the service worker pre‑caches all of them. Its version derives from file
  sizes — keep `scripts/sw-manifest.mjs` in the build.
- `/tanzil/` style notice: Tanzil credit is required and shown on About.

## Mistakes to avoid
- Astro prerender cannot read `new URL('…', import.meta.url)` data files → use cwd paths in `lib.mjs`.
- `npx`/wrangler fail here with a read-only `~/.npm` and `~/.wrangler` → set `npm_config_cache=$PWD/.npm-cache`
  and `HOME=$PWD/.home` (the refreshed Cloudflare token lives there, untracked).
- `[hidden]` is overridden by `display:flex` → keep `.row[hidden]{display:none}`.
- Light-only pages get force-darkened by Chrome Android → keep `color-scheme: light dark`, the two `theme-color` metas and all colours in the `:root` vars; no literals outside them.
- The Tanzil notice has an unbreakable `====` line and is English → `.notice` needs `overflow-wrap:anywhere` and `direction:ltr`; otherwise the RTL page scrolls sideways.
