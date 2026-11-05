#!/usr/bin/env python3
"""Build src/data/meta.json: per-surah metadata + harakat audit.

Reads the app's bundled DB for names/place/order (the APK's surah_stats) and the
Saadi passages in src/data/tafsir for the vocalisation percentage.
Run once (and again if the tafsir data changes):  python3 tools/make_meta.py
"""
import json
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB = ROOT / "db/assets/flutter_assets/database/surah_database_app_v34.db"
TAFSIR = ROOT / "src/data/tafsir"

HARA = set("\u064b\u064c\u064d\u064e\u064f\u0650\u0651\u0652\u0653\u0654\u0655\u0670")
TOK = re.compile(r"[\u0621-\u064a\u064b-\u0652\u0670\u0640]+")


def audit(text):
    words = with_haraka = 0
    for w in TOK.findall(text):
        if not any("\u0621" <= c <= "\u064a" for c in w):
            continue
        words += 1
        if any(c in HARA for c in w):
            with_haraka += 1
    return words, with_haraka


def main():
    con = sqlite3.connect(DB)
    rows = con.execute(
        "select surahNo, surahName, revelationSeq, makkiMadani, surahClass, ayahCount "
        "from surah_stats order by surahNo").fetchall()
    meta = []
    for n, name, seq, place, cls, ayahs in rows:
        passages = json.loads((TAFSIR / f"{n}.json").read_text())["passages"]
        text = " ".join(p for ps in passages for p in ps["p"])
        words, haraka = audit(text)
        pct = round(100 * haraka / words, 1) if words else 0.0
        meta.append({
            "n": n, "name": name, "ayahs": ayahs, "place": place,
            "seq": seq, "class": cls,
            "pct": pct,
            # 97%+ of words carry a haraka: treat as fully vocalised
            "full": pct >= 97,
        })
    full = sum(1 for m in meta if m["full"])
    (ROOT / "src/data/meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"meta: {len(meta)} surahs, {full} fully vocalised")


if __name__ == "__main__":
    main()
