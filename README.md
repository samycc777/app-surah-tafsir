# سورة — القرآن الكريم مع تفسير السعدي

PWA reader for the Qur'an with Saʿdī's tafsir, rebuilt from a reverse‑engineering of the
Android app **Surah: Noble Quran with Tafsir** (`com.surahapp`).

**Live:** https://surah-tafsir.pages.dev

- Qur'an text: Tanzil Uthmani, ayah by ayah, tap an ayah for its tafsir.
- Tafsir: *Taysīr al‑Karīm al‑Raḥmān* — fully vocalised for surahs **40–114**, the rest
  (1–39) as the source has it, with a notice on those pages.
- Harakat toggle (tafsir only — the Qur'an text always keeps its marks), font size,
  bookmarks, last‑read position, tafsir search, offline (service worker pre‑caches every page).

## Develop

```bash
npm ci
npm run dev            # http://localhost:4321
npm run build          # astro build + search index + service worker manifest
npm run check          # every ayah must map to a tafsir passage
```

Verify visually:

```bash
python3 -m http.server 8788 --directory dist &
python3 tools/shots.py          # Playwright screenshots into shots/
```

## Deploy

```bash
HOME=$PWD/.home npx wrangler@3 pages deploy dist --project-name surah-tafsir --branch main
```

## Data pipeline

| what | where |
|---|---|
| Qur'an text (Tanzil Uthmani) | `src/data/quran-uthmani.txt` |
| Saʿdī passages `{a,b,r,p}` | `src/data/tafsir/<1..114>.json` |
| Surah metadata + harakat audit | `src/data/meta.json` (generated: `python3 tools/make_meta.py`) |

`tools/make_meta.py` reads the surah table from the Android app's bundled SQLite
(weights, names, revelation place/order) and measures the vocalisation of each surah.
`tools/export_tafsir.py` exports the app's own tafsir tables (5 editions + Mukhtasar) to
JSONL, if you want them.

The reverse‑engineering dossier is in [docs/notes/re-report.md](docs/notes/re-report.md):
packaging, the 260 MB SQLite schema, the mushaf line‑image renderer, network surface,
and the harakat coverage table for the app's tafsir corpus.

## Credits

Qur'an text © [Tanzil](https://tanzil.net/) (see `/tanzil/` notice on the About page).
Tafsir: Shaykh ʿAbd al‑Raḥmān al‑Saʿdī, al‑Risālah edition. Surah metadata from the
`com.surahapp` database. No affiliation with either.
