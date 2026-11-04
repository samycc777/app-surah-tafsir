#!/usr/bin/env python3
"""Export the tafsir tables from the app's bundled SQLite DB to JSONL.

Usage: python3 tools/export_tafsir.py [path/to/surah_database_app_v34.db]

Writes data/tafsir-json/<table>.jsonl  ({"s":sura,"a":aya,"t":text})
and   data/tafsir-json/coverage.json   (harakat coverage per table).
"""
import json
import pathlib
import re
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else (
    ROOT / "db/assets/flutter_assets/database/surah_database_app_v34.db")
OUT = ROOT / "data/tafsir-json"

HARA = set("\u064b\u064c\u064d\u064e\u064f\u0650\u0651\u0652\u0653\u0654\u0655\u0670")
TOK = re.compile(r"[\u0621-\u064a\u064b-\u0652\u0670\u0640]+")

TABLES = {
    "baghawy": ("tafsir_baghawy", "tafsir", "sura", "aya"),
    "tabary": ("tafsir_tabary", "tafsir", "sura", "aya"),
    "saadi": ("tafsir_saadi", "tafsir", "sura", "aya"),
    "katheer": ("tafsir_katheer", "tafsir", "sura", "aya"),
    "moyassar": ("tafsir_moyassar", "tafsir", "sura", "aya"),
    "mukhtasar_ar": ("QuranTafseer", "Mukhtasarar", "surahNo", "ayahNo"),
    "mukhtasar_en": ("QuranTafseer", "Mukhtasaren", "surahNo", "ayahNo"),
    "mukhtasar_bn": ("QuranTafseer", "Mukhtasarbn", "surahNo", "ayahNo"),
}


def coverage(texts):
    words = with_haraka = 0
    for t in texts:
        for w in TOK.findall(t or ""):
            if not any("\u0621" <= c <= "\u064a" for c in w):
                continue
            words += 1
            if any(c in HARA for c in w):
                with_haraka += 1
    return words, with_haraka, round(100 * with_haraka / words, 1) if words else 0.0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    report = {}
    for name, (table, col, scol, acol) in TABLES.items():
        cur = con.execute(
            f"select {scol}, {acol}, {col} from {table} "
            f"where {col} is not null and trim({col}) != '' "
            f"order by {scol}, {acol}")
        rows, texts = 0, []
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as fh:
            for s, a, t in cur:
                texts.append(t)
                fh.write(json.dumps({"s": s, "a": a, "t": t}, ensure_ascii=False) + "\n")
                rows += 1
        words, with_haraka, pct = coverage(texts)
        report[name] = {"table": table, "rows": rows, "words": words,
                        "with_haraka": with_haraka, "pct": pct}
        print(f"{name:12s} rows={rows:5d} words={words:8d} with_haraka={pct:5.1f}%")
    (OUT / "coverage.json").write_text(
        json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
