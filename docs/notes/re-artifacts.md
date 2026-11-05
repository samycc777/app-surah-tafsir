# RE artifacts — what is in git and what is not

The report ([re-report.md](re-report.md)) is reproducible from the files below. Only the
small evidence is committed; the APK and DB are too big for git and live in this folder
only, so **a worktree will not contain them** — use the absolute paths.

| artifact | path | size | in git |
|---|---|---|---|
| XAPK as downloaded (Play build 6.2.0) | `apk/surah.apk` | 182 MB | no |
| split APKs | `apk/xapk/` | 190 MB | no |
| base APK unpacked | `apk/extracted/` | 179 MB | no |
| arm64 split (Dart AOT + engine) | `apk/extracted-arm/` | 25 MB | no |
| bundled SQLite (41 tables) | `db/assets/flutter_assets/database/surah_database_app_v34.db` | 248 MB | no |
| Dart AOT strings (72k lines, 210 app paths) | `docs/notes/evidence/libapp.strings` | 1 MB | **yes** |
| tafsir exports, 8 editions JSONL | `data/tafsir-json/` | 97 MB | no |
| current UI screenshots | `docs/notes/ui/` | 0.5 MB | **yes** |

The SQLite DB is the one input the build does not need: `src/data/` already holds the
Tanzil text, the Saʿdī passages and `meta.json` (generated from the DB once).

## Regenerating

```bash
# 1. APK (XAPK) + unpack
curl -L -A "Mozilla/5.0" -o apk/surah.apk "https://d.apkpure.com/b/APK/com.surahapp?version=latest"
unzip -o apk/surah.apk -d apk/xapk
unzip -o apk/xapk/com.surahapp.apk -d apk/extracted
unzip -o apk/xapk/config.arm64_v8a.apk -d apk/extracted-arm

# 2. bundled DB
unzip -o apk/extracted/assets/flutter_assets/database/surah_database_app_v34.db.zip -d db/

# 3. Dart strings
strings -n 4 apk/extracted-arm/lib/arm64-v8a/libapp.so > work/libapp.strings

# 4. tafsir exports (needs the DB)  → data/tafsir-json/
python3 tools/export_tafsir.py

# 5. surah metadata + harakat audit (needs the DB) → src/data/meta.json
python3 tools/make_meta.py
```

If the S24 is on adb, prefer the installed build over the APKPure copy:

```bash
adb shell pm path com.surahapp          # base.apk + split_* names
adb pull /data/app/…/base.apk          # then diff by sha256 with apk/xapk/com.surahapp.apk
```
