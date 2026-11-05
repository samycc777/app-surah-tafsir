# app-surah

PWA Qur'an reader with Saʿdī tafsir (Arabic-only, RTL; light by default, dark via the ☾ button). Rebuilt from a reverse‑engineering
of the Android app `com.surahapp`; the dossier is `docs/notes/re-report.md`, the raw APK/DB in
`apk/` and `db/` (git‑ignored). Live: https://surah-tafsir.pages.dev

## Where things live
- `src/pages/`: `index` (surah list + juz tab), `surah/[n]` (15-line mushaf page + tafsir sheet), `search`, `saved`, `about`.
  `src/layouts/App.astro` is the shell (top bar: logo, ☾, saved, search, menu; settings sheet; toast). No bottom tab bar.
- `src/lib.mjs`: `ar()`, `ayahWord()`, `verses`, `passages()`, `passageFor()`, `JUZ` (from the page files). Reads data by cwd
  path (`src/data/...`), never `import.meta.url` — Astro's prerender bundling breaks that.
- `src/data/`: Tanzil text, `tafsir/<n>.json` passages, `meta.json` (generated), `mushaf-ayahs.json` (ayah→page) and `mushaf-surahs.json` (page ranges).
- `public/mushaf/pages/<1..604>.json`: API-generated 15-line page data (words, surah bands, juz); fetched by the reader and pre-cached.
- `public/js/app.js`: sheet, harakat strip, bookmarks, last position, install, SW. `search.js`: bucket client.
- `scripts/`: `search-index.mjs` and `sw-manifest.mjs` run after `astro build`; `check.mjs` guards data.
- `tools/`: `make_meta.py` (meta + harakat audit), `export_tafsir.py` (APK DB → JSONL), `fetch_mushaf.py` (Quran.com API → page JSON, one-time), `shots.py` (smoke test).
- `android/`: plain WebView app (`dev.pages.surahtafsir`) that shows the built `dist/` from `assets/www` via WebViewAssetLoader (works offline); `window.SurahNative` bridges theme bar colour and fullscreen.
- `docs/notes/`: RE report, artifact inventory (raw APK/DB are git-ignored, in the main folder only), UI screenshots.

## Commands
- `npm ci`, `npm run dev`, `npm run build`, `npm run check`.
- Rebuild mushaf data (network): `python3 tools/fetch_mushaf.py` (raw API cache in git-ignored `work/api`).
- Verify: `python3 -m http.server 8788 --directory dist` + `python3 tools/shots.py`.
- Deploy: `HOME=$PWD/.home npx wrangler@3 pages deploy dist --project-name surah-tafsir --branch main`.
- APK: every push to main runs `.github/workflows/android.yml` (GitHub: samycc777/app-surah-tafsir, private) → release `app-vN` with `surah-tafsir.apk`.
  Install on the phone: `gh release download -R samycc777/app-surah-tafsir -p '*.apk' -D <dir>` then `adb install -r`. Signing key: `~/Backups/surah-signing-key/` (also in Actions secrets).

## Conventions
- Harakat are never invented or removed from the data: surahs 40–114 are fully vocalised, 1–39 are
  not; `meta.json.full` drives the notice. Re-run `tools/make_meta.py` after any tafsir data change.
- Arabic UI only; no editorial text beyond UI words and the About page.
- Look follows web.surahapp.com/ar: cream and gold, star badges, framed mushaf page; all drawn in our own CSS/SVG, never their images or fonts. Theme is `html[data-theme]` (saved as `surah:theme`), not the system setting.
- The mushaf layout and Uthmani words come from the Quran.com API; the app's line PNGs/fonts are never reused. The page font is Amiri Quran (OFL).
- The API returns pause/sajdah marks as separate words: merge them into the adjacent word or they float at line edges; leading pauses belong to the previous page/line.
- Every page is static; the service worker pre‑caches all of them. Its version derives from file
  sizes — keep `scripts/sw-manifest.mjs` in the build.
- `/tanzil/` style notice: Tanzil credit is required and shown on About.

## Mistakes to avoid
- Astro prerender cannot read `new URL('…', import.meta.url)` data files → use cwd paths in `lib.mjs`.
- `npx`/wrangler fail here with a read-only `~/.npm` and `~/.wrangler` → set `npm_config_cache=$PWD/.npm-cache`
  and `HOME=$PWD/.home` (the refreshed Cloudflare token lives there, untracked).
- `[hidden]` is overridden by `display:flex`/`grid` → add `X[hidden]{display:none}` for every such class.
- CSS classes don't reach inside SVG `<use>` → colour the `#orn` symbol with inline `style="fill:var(…)"`.
- Light-only pages get force-darkened by Chrome Android → keep the `color-scheme: light dark` meta and all colours in the `:root` / `[data-theme='dark']` vars; no literals outside them.
- The Tanzil notice has an unbreakable `====` line and is English → `.notice` needs `overflow-wrap:anywhere` and `direction:ltr`; otherwise the RTL page scrolls sideways.
- Capacitor's local server sends every extension-less path to the root `index.html` → the app uses its own WebViewAssetLoader handler that maps `/x/` to `x/index.html`.
- Inside the app `location.origin` is `appassets.androidplatform.net` → share links use `ORIGIN` (the public site); no service worker there.
- `public/mushaf/pages` is ~5 MB and pre-cached by the SW; don't fetch all pages in the page HTML — the reader loads one JSON.
