# app-surah

PWA Qur'an reader with three tafsirs — Saʿdī, al-Muyassar, al-Mukhtaṣar — picked in the tafsir sheet (Arabic-only, RTL; light by default, dark via the ☾ button). Rebuilt from a reverse‑engineering
of the Android app `com.surahapp`; the dossier is `docs/notes/re-report.md`, the raw APK/DB in
`apk/` and `db/` (git‑ignored). Live: https://surah-tafsir.pages.dev

## Where things live
- `src/pages/`: `index` (surah list + juz tab), `surah/[n]` (15-line mushaf page + tafsir sheet), `search`, `saved`, `about`.
  `src/layouts/App.astro` is the shell (top bar: logo, ☾, saved, search, menu; settings sheet; toast). No bottom tab bar.
- `src/lib.mjs`: `ar()`, `ayahWord()`, `verses`, `passages()`, `passageFor()`, `JUZ` (from the page files). Reads data by cwd
  path (`src/data/...`), never `import.meta.url` — Astro's prerender bundling breaks that.
- `src/data/`: Tanzil text, `tafsir/<n>.json` passages, `meta.json` (generated), `mushaf-ayahs.json` (ayah→page) and `mushaf-surahs.json` (page ranges).
- `public/tafsir/{muyassar,mukhtasar}/<n>.json`: `[{a,b,t}]` passages, fetched by the sheet; made by `tools/export_extra_tafsir.py` from the git-ignored `data/tafsir-json/*.jsonl` (Mukhtasar text: media-harakat-books' vowelled `out/`, keeping the APK's `_word_` highlights; Muyassar 39–114 likewise from its vowelled `out/`). Saʿdī stays in the page as `<template>`s.
- `public/mushaf/pages/<1..604>.json`: API-generated 15-line page data (words, surah bands, juz); fetched by the reader and pre-cached.
- `public/js/app.js`: sheet, harakat strip, bookmarks, last position, install, SW. Page turns slide in `#m-track`: the current `.m-page` plus two `.ghost` neighbours drawn in advance (next on the left, RTL book order); swiping past the surah's pages opens the neighbouring surah at that page (`/surah/N/?p=page`, `location.replace`); the tafsir sheet's ayah is drawn with the QCF page fonts (`ayahQcf`). `search.js`: bucket client.
- `scripts/`: `search-index.mjs` and `sw-manifest.mjs` run after `astro build`; `check.mjs` guards data.
- `tools/`: `make_meta.py` (meta + harakat audit), `export_tafsir.py` (APK DB → JSONL), `fetch_mushaf.py` (Quran.com API → page JSON, one-time), `shots.py` (smoke test).
- `android/`: plain WebView app (`dev.pages.surahtafsir`) that shows the built `dist/` from `assets/www` via WebViewAssetLoader (works offline); `window.SurahNative` bridges theme bar colour, fullscreen, `immersive()` (the reader hides the phone's bars with its own), `cutoutTop()` and the share sheet; WebView debugging is on (DevTools over adb); the back button asks `window.surahBack()` (closes an open sheet) before leaving the page.
- `docs/notes/`: RE report, artifact inventory (raw APK/DB are git-ignored, in the main folder only), UI screenshots.

## Commands
- `npm ci`, `npm run dev`, `npm run build`, `npm run check`.
- Rebuild mushaf data (network): `python3 tools/fetch_mushaf.py` (raw API cache in git-ignored `work/api`).
- Page fonts (needed before `npm run build` for deploys): `python3 tools/fetch_qcf.py`.
- Verify: `python3 -m http.server 8788 --directory dist` + `python3 tools/shots.py`.
- Deploy: `HOME=$PWD/.home npx wrangler@3 pages deploy dist --project-name surah-tafsir --branch main`.
- APK: every push to main runs `.github/workflows/android.yml` (GitHub: samycc777/app-surah-tafsir, public: private repos get no Actions minutes) → release `app-vN` with `surah-tafsir.apk`.
  Install on the phone: `gh release download -R samycc777/app-surah-tafsir -p '*.apk' -D <dir>` then `adb install -r`. Signing key: `~/Backups/surah-signing-key/` (also in Actions secrets).

## Conventions
- Bilal wants every tafsir fully vowelled. The app never invents or removes harakat: al-Mukhtasar comes fully
  vowelled from `~/dev/media-harakat-books/books/mukhtasar-tafsir` (proved to add marks only); Saʿdī: surahs 40–114
  are fully vocalised, 1–39 not yet (`meta.json.full` drives the notice); Muyassar: surahs 39–114 fully vowelled from `~/dev/media-harakat-books/books/muyassar-39-114/out` (same proof), 1–38 as printed. Re-run
  `tools/make_meta.py` after any tafsir data change.
- Arabic UI only; no editorial text beyond UI words and the About page.
- Look follows web.surahapp.com/ar: cream and gold, star badges, framed mushaf page; all drawn in our own CSS/SVG, never their images or fonts. Theme is `html[data-theme]` (saved as `surah:theme`), not the system setting.
- The mushaf layout, Uthmani words and glyph codes (`g`) come from the Quran.com API; the app's line PNGs/fonts are never reused. Pages are drawn with the King Fahd Complex QCF V2 page fonts `public/qcf/p<N>.woff2` (98 MB, git-ignored, `tools/fetch_qcf.py`; CI fetches them; SW caches them on first view, not precached); Amiri Quran is only the fallback.
- The API returns pause/sajdah marks as separate words: merge them into the adjacent word or they float at line edges; leading pauses belong to the previous page/line.
- Every page is static; the service worker pre‑caches all of them. Its version derives from file
  sizes — keep `scripts/sw-manifest.mjs` in the build.
- `/tanzil/` style notice: Tanzil credit is required and shown on About.

## Mistakes to avoid
- Astro prerender cannot read `new URL('…', import.meta.url)` data files → use cwd paths in `lib.mjs`.
- `npx`/wrangler fail here with a read-only `~/.npm` and `~/.wrangler` → set `npm_config_cache=$PWD/.npm-cache`
  and `HOME=$PWD/.home` (the refreshed Cloudflare token lives there, untracked).
- The reader must look like the printed mushaf / Surah app: no frame, 15 QCF lines edge to edge, one small header line; Amiri with spread-out words looked ugly.
- The reader is one screen that never scrolls: `fit()` picks the largest font that fits width and height; the top bar, tools row and page buttons are overlays toggled by `body.chrome` (tap outside the words). No `scrollIntoView`/`scrollTo` in the reader.
- `[hidden]` is overridden by `display:flex`/`grid` → add `X[hidden]{display:none}` for every such class.
- CSS classes don't reach inside SVG `<use>` → colour the `#orn` symbol with inline `style="fill:var(…)"`.
- Light-only pages get force-darkened by Chrome Android → keep the `color-scheme: light dark` meta and all colours in the `:root` / `[data-theme='dark']` vars; no literals outside them.
- The Tanzil notice has an unbreakable `====` line and is English → `.notice` needs `overflow-wrap:anywhere` and `direction:ltr`; otherwise the RTL page scrolls sideways.
- Capacitor's local server sends every extension-less path to the root `index.html` → the app uses its own WebViewAssetLoader handler that maps `/x/` to `x/index.html`.
- Inside the app `location.origin` is `appassets.androidplatform.net` → share links use `ORIGIN` (the public site); no service worker there.
- Android's packager drops asset folders starting with `_` (Astro's default `_astro`) → the app showed unstyled pages; keep `build.assets: 'assets'`.
- `public/mushaf/pages` is ~5 MB and pre-cached by the SW; don't fetch all pages in the page HTML — the reader loads one JSON.
