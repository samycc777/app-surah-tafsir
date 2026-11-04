# Reverse engineering — “Surah: Noble Quran with Tafsir” (`com.surahapp`)

Static analysis of the APK pulled from APKPure (the Play build), 5 Nov 2026.
Target of interest: the tafsir corpus and why it has so few harakat.

| | |
|---|---|
| Package | `com.surahapp` |
| Version | 6.2.0 (versionCode 148), minSdk 24, targetSdk 35 |
| XAPK sha256 | `3e287513c4ef23d2366f3100c8334e715ea001ea14f8da78b3eed6a665398f79` (189.9 MB) |
| Base APK sha256 | `168184b649f1cb90e28a7a0989201a792dc403a940b13f1def01255002647d74` |
| Bundled DB sha256 | `48174bb1e8ef48f165fc28ae737d5ab3cc88cc265f80244af64e21370a8d599e` |
| Publisher | Tafsir Center for Qur’anic Studies (`tafsir.net`), sold as `surahapp.com` |

The app is the **Tafsir Center** app. `libapp.so` carries the paths
`package:Surah/src/views/about_tafsir_center.dart`, the credits “Awards received by
the Tafsir Center”, `https://tafsir.net`, and the Madinah-mushaf notice (“digital copy
of the Mus’haf … issued by the King Fahd Complex … 1442 AH”). `com.surahapp` is the
consumer brand around that content.

---

## 1. Packaging

It ships as a **XAPK** (split APKs), not a single APK:

```
com.surahapp.apk            163.8 MB  base (dex, assets, DB)
config.arm64_v8a.apk         25.9 MB  libapp.so + libflutter.so + libdartjni.so
config.en.apk / config.fr.apk        locale strings
config.mdpi.apk                      low-dpi res
```

So the Dart AOT payload and the quran data live in **different** files — remember this
when pulling from the phone (`adb shell pm path com.surahapp` lists `base.apk` plus the
split names).

## 2. Runtime

Flutter (Dart AOT), release build; `libapp.so` = 14,353,328 bytes,
sha256 `e1333acf7e37a04b9dcd657bfd8a4d798a83ad33a4a3a69770f21505a60515c7`,
snapshot hash `78da37fed6bf1489361a312568249f3f`; engine `libflutter.so` build id
`0d216f3f630e1105257f8a3f74e22c9b43c22a51` (REA evidence
`ev_6c3d283ed7aa202bd1d80a13d8f51ea3d3234ed0c1140532efdb1856b50ab352`).

Native side is thin — Flutter plugins only. Dex strings show the usual set:

- **OneSignal** push (`com.onesignal.*`), Firebase Messaging + Analytics,
  Google/Apple sign-in, Play Billing (`IInAppBillingService`).
- `audio_service` / `just_audio` (`com.ryanheise.audioservice.AudioServiceActivity` is
  the launcher activity) → background audio with lock-screen controls.
- `sqflite`, `background_downloader` (offline surah/recitation downloads),
  `geolocator` (prayer-time/qibla style extras), `webview_flutter` (Surahpedia,
  feedback forms), `flutter_quill` + `flutter_quill_delta_from_html` (rich annotations),
  `dio`/`rxdart`/`dart:html`-style HTML generation for sharing.

210 app-level Dart source paths survive in the AOT string table — enough to map the
whole feature set (section 5).

## 3. The data core: one 260 MB SQLite file

`assets/flutter_assets/database/surah_database_app_v34.db.zip` unpacks to
**259,846,144 bytes, 41 tables**. It is the whole app — the UI is a thin shell over it.
A second, empty 32 KB `surah_database_user_v1.db` holds user state (bookmarks, plans).

Table groups:

**Mushaf geometry** (the reason paging feels exact)
- `PageMatrix` (610), `pageSizes`, `pageLineInfo` (15 lines/page), `linePaddingLR`,
  `linePaddingTB`, `page_header_matrix`, `linePadding*` — declared page box in logical
  units, per-line padding, juz/surah header placement, page shading.
- `WordCoordinateS2` (83,897) — `x1,x2,y1,y2` for **every word on every page**, in page
  coordinates. This is how a tap on the mushaf lands on a word: transparent hotspots over
  a bitmap, not text hit-testing.
- `SurahMatrix`, `QuranNajm` (hizb/rubʿ marks), `sajdah_info`, `QuranWordInfo`.

**Qur’an text**
- `quran_word_summary` — 77,436 words with `word_with_haraqah` / `word_without_haraqah`.
- `quran_text_with_tajweed` — 6,236 ayahs with inline tajweed markup, e.g. 2:1 is
  `ا<5>لٓ</5><5>مٓ</5>` (tag → rule).
- `ayah_summary` — ayah → start/end word id.
- `surah_content` — per-surah names, revelation info, virtues, goals (rich prose).

**Tafsir** — five per-ayah tables + the Tafsir Center’s own Mukhtasar:
`tafsir_baghawy`, `tafsir_katheer`, `tafsir_moyassar`, `tafsir_saadi`, `tafsir_tabary`
(6,236 rows each), and `QuranTafseer` with `Mukhtasarar` (ar), `Mukhtasaren` (en),
`Mukhtasarbn` (bn).

**Per-word study tools** (each 77,432 rows = every word)
- `word_content_irab.irabMushakkal` — fully vowelled iʿrāb per word,
  e.g. `مُبْتَدَأٌ مَرْفُوعٌ …`.
- `word_content_sarf` — full morphology (gender, number, verb form, wazn, root).
- `word_content_meaning`, `word_content_rasm`, `word_content_locations`.
- `qeraat_info` — per-word qirāʾāt notes.
- `QuranicVerbs` (2,006), `word_statistics`, `surah_stats` — the “science” panels.

**Extras**
- `ayah_content_irab` (vowelled), `ayah_content_nozool`, `ayah_timing_info` (181,755
  rows, 29 reciter ids), `ReciterInfo` (14), `quran_mutashabihat` (8),
  `quranpointers`, `mokhtasar_fawaed`, `Tag`, `Settings`.

### How the mushaf is drawn

`assets/flutter_assets/assets/quranlines/<page>/<line>.png` — **604 pages × 15 lines =
9,060 PNGs, 105 MB** (1080×174, 4-bit palette). The mushaf is *pre-rendered line images*,
not text. Fonts in the APK (`Hafs_18.ttf`, `noorehuda.ttf`, `QuranNumbers.ttf`) are used
for tafsir/irab text, not for the page view.

That is the single biggest thing to replace in a clone: the line images are King Fahd
Complex / Tafsir Center artwork. Options: QCF page fonts (free, render text yourself),
or an ayah-by-ayah reader (simplest, and what I’d start with).

## 4. Network surface

| Endpoint | Use |
|---|---|
| `panel.surahpedia.com/api/v1` | content/user API (accounts, sync, feedback) |
| `resources.surahpedia.com/` | downloadable recitations / extra content |
| `generator.surahapp.com/vote/?lang=` | share-image generator |
| `tasmee3.rdi-hafss.com/api/v1/get-user-token/` | speech-to-text recitation checking (RDI service) |
| `wtq-recitations.s3.us-east-2.amazonaws.com/wtq_recitations/` | audio files |

`RDI` = the recitation-check service (`rdi_service/…`, `speech_to_text/TextMatcher`):
record a recitation, the server aligns it, the app highlights matched words.

## 5. Feature map (from the 210 Dart paths)

- **Mushaf**: page view, 15-line geometry, page header (juz/surah), tap-word hotspots,
  landscape, auto page turn, vertical scroll mode, scale.
- **Content overlays**: brief tafsir (Mukhtasar), detailed tafsir (5 editions), iʿrāb
  (ayah + word), ṣarf, tajwīd colouring, qirāʾāt, nozūl, surah goals, mutashābihāt.
- **Recitation**: 14 reciters, per-ayah timing, word-level highlighting, download queue,
  counters, repeat modes, recitation plan (khatma), speech-to-text check.
- **Study**: kalimāt search (word search with diacritic-normalised `normalizedText`),
  annotations (Quill editor, colours), bookmarks, favourites, tags.
- **Sharing**: image cards, PDF, text, HTML (Mixin-heavy `advance-sharing/`).
- **Account**: Google/Apple/OTP sign-in, backup/sync (`userdata_backup`), feedback and
  report-a-problem (with “Tafsir Type” in the report payload).
- **Monetisation/ops**: Billing, ads (AdMob deps), OneSignal push, analytics, local
  notifications, geolocation.

## 6. Tafsir and harakat — the actual finding

The UI does **not** strip harakat. The tafsir text is stored exactly as the source feed
gave it, and the app renders it as-is (the only diacritic processing is the `diacritic`
package, used for **search** normalisation). So the missing harakat are missing from the
**data**.

Coverage over the whole corpus (Arabic words with at least one haraka, and haraka per
letter):

| table | Arabic words | words with haraka | haraka/letter | verdict |
|---|---|---|---|---|
| `tafsir_baghawy` | 1,011,307 | **83.3 %** | 0.70 | effectively fully vowelled |
| `tafsir_tabary` | 3,568,267 | 47.6 % | 0.25 | Qur’an quotes + occasional words only |
| `tafsir_saadi` | 602,213 | 35.3 % | 0.20 | Qur’an quotes only |
| `tafsir_katheer` | 2,320,923 | 15.4 % | 0.12 | Qur’an quotes only |
| `tafsir_moyassar` | 242,995 | **8.2 %** | 0.03 | essentially unvowelled |

Samples:

- Baghawi (vowelled): `سُورَةُ فَاتِحَةِ الْكِتَابِ وَلَهَا ثَلَاثَةُ أَسْمَاءٍ مَعْرُوفَةٌ…`
- Saadi (unvowelled prose, vowelled quotes): `{1} أي: أبتدئ بكل اسم لله تعالى؛ لأن لفظ «اسم» مفرد مضاف…`
- Muyassar (unvowelled): `أبتدئ قراءة القرآن باسم الله مستعينا به، (اللهِ) علم على الرب…`
- Mukhtasar ar (unvowelled): `باسم الله أبدأ قراءة القرآن، مستعينًا به تعالى…`

(The short printed **al-Muyassar** and **al-Mukhtaṣar** editions are fully vowelled in
print; the digital feeds used here are plain-text, which is why they look bare.)

### Two concrete defects worth knowing

1. **Baghawi is truncated at 32,767 characters** (2^15−1) — 4 ayahs (4:43, 17:4, 18:10,
   33:9) end mid-word because the text column was cut at 32 KB during import.
2. `tafsir_moyassar` is the shortest corpus of the five yet has the least tashkīl, so it
   reads worst despite being the “easy” tafsir.

### What this means for the rebuild

- **Reusable as-is**: Qur’an text + word table, iʿrāb (already fully vowelled), ṣarf,
  qirāʾāt, tajwīd markup, tafsir texts, timings — i.e. almost everything in the DB.
- **The harakat problem is a text-sourcing problem, not an app problem.** Three ways to
  get an all-harakat tafsir:
  1. **Use the edition that is already vowelled** — Baghawi is 83 % and reads fine;
     with a cleanup pass it is a fully vocalised tafsir today.
  2. **Bring a vowelled source** for the edition you want (your `site-tafsir-sadi` already
     has 75/114 surahs at 100 %).
  3. **Diacritise the rest** with an Arabic tashkeel model (Shakkelha / CATT / Mishkal),
     then review — Qur’an quotes and hadith must be protected from model edits.
- Your Saadi corpus is the natural candidate: it is your own data, 75 surahs are already
  fully vowelled, and the remaining 39 (parts 1–4) need a source or a diacitiser pass.

## 7. Evidence index

- `apk/surah.apk` — XAPK as downloaded (APKPure `d.apkpure.com/b/APK/com.surahapp`).
- `apk/xapk/com.surahapp.apk` — base APK (dex, `assets/flutter_assets`).
- `apk/xapk/config.arm64_v8a.apk` — Dart AOT + engine.
- `apk/extracted/` — base APK unpacked (9,351 Flutter assets, 41-table DB inside).
- `apk/extracted-arm/lib/arm64-v8a/libapp.so` — Dart snapshot; strings at
  `work/libapp.strings` (72k lines, 210 `package:Surah/…` paths).
- `db/assets/flutter_assets/database/surah_database_app_v34.db` — the SQLite corpus.

All observations above are static (shipped artifact). No runtime capture was taken; the
device was not attached during analysis.
