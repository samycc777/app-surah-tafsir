# سورة — القرآن الكريم مع تفسير السعدي

PWA reader for the Qur'an with Saʿdī's tafsir, rebuilt from a reverse‑engineering of the
Android app **Surah: Noble Quran with Tafsir** (`com.surahapp`).

**Live:** https://surah-tafsir.pages.dev

- 15-line Madinah mushaf page (juz/page/surah header, surah bands, basmala, ayah rosettes); tap any word for its tafsir. The page text is the Uthmani mushaf from the Quran.com API; the tafsir sheet quotes Tanzil.
- Tafsir: *Taysīr al‑Karīm al‑Raḥmān* — fully vocalised for surahs **40–114**, the rest
  (1–39) as the source has it, with a notice on those pages.
- Harakat toggle (tafsir only — the mushaf always keeps its marks), font size,
  bookmarks, last‑read position, tafsir search, offline (service worker pre‑caches every page
  and all 604 mushaf pages).

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
| Mushaf page text + 15-line layout | `public/mushaf/pages/<1..604>.json` (generated: `python3 tools/fetch_mushaf.py`, Quran.com API) |
| Ayah → page / page ranges | `src/data/mushaf-ayahs.json`, `src/data/mushaf-surahs.json` |
| Qur'an text for the tafsir sheet (Tanzil Uthmani) | `src/data/quran-uthmani.txt` |
| Saʿdī passages `{a,b,r,p}` | `src/data/tafsir/<1..114>.json` |
| Surah metadata + harakat audit | `src/data/meta.json` (generated: `python3 tools/make_meta.py`) |

`tools/fetch_mushaf.py` fetches the 604 Madinah pages with their 15-line word layout from
[Quran.com](https://quran.com/) and writes the JSON the reader fetches. The app's own line
images and fonts are not used. `tools/make_meta.py` reads the surah table from the Android app's bundled SQLite
(weights, names, revelation place/order) and measures the vocalisation of each surah.
`tools/export_tafsir.py` exports the app's own tafsir tables (5 editions + Mukhtasar) to
JSONL, if you want them.

The reverse‑engineering dossier is in [docs/notes/re-report.md](docs/notes/re-report.md):
packaging, the 260 MB SQLite schema, the mushaf line‑image renderer, network surface,
and the harakat coverage table for the app's tafsir corpus.

## Credits

Qur'an text © [Tanzil](https://tanzil.net/) (see `/tanzil/` notice on the About page).
Mushaf page text and 15-line layout from [Quran.com](https://quran.com/). Mushaf font:
[Amiri Quran](https://github.com/aliftype/amiri) (SIL OFL). Tafsir: Shaykh ʿAbd al‑Raḥmān
as‑Saʿdī, al‑Risālah edition. Surah metadata from the `com.surahapp` database. No
affiliation with any of them.
