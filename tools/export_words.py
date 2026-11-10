#!/usr/bin/env python3
"""Export the per-word study texts (meaning, iʿrāb, taṣrīf) from the app's bundled SQLite DB.

Usage: python3 tools/export_words.py [path/to/surah_database_app_v34.db]

Writes public/words/{meaning,irab,sarf}/<page>.json: one string per word of that mushaf
page, in the order of the `k == "word"` items of public/mushaf/pages/<page>.json (the reader
numbers its word spans the same way). Texts are copied as they are.

The DB and the page data split five ayahs differently; those are listed in JOIN / SHARE.
"""
import json
import pathlib
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else (
    ROOT / "db/assets/flutter_assets/database/surah_database_app_v34.db")
PAGES = ROOT / "public/mushaf/pages"
OUT = ROOT / "public/words"

KINDS = {
    "meaning": ("word_content_meaning", "meaning"),
    "irab": ("word_content_irab", "irabMushakkal"),
    "sarf": ("word_content_sarf", "sarf"),
}
# page word (1-based, within the ayah) that the DB writes as two words: «بَعْدَ مَا», «إِلْ يَاسِينَ»
JOIN = {(2, 181): 3, (8, 6): 4, (13, 37): 8, (37, 130): 3}
# DB word that the page writes as two words: «لَّوْ مَا» (both get the DB's one text)
SHARE = {(15, 7): 1}


def main():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    names = {}
    for s, a, w, t in con.execute(
            "select surah_no, ayah_no, word_no, word_with_haraqah from quran_word_summary"):
        names[(s, a, w)] = t
    data = {}
    for kind, (table, col) in KINDS.items():
        per = {}
        for s, a, w, t in con.execute(
                f"select surahNo, ayahNo, wordNo, {col} from {table} order by surahNo, ayahNo, wordNo"):
            per.setdefault((s, a), []).append((w, (t or "").strip()))
        data[kind] = per

    def texts(kind, s, a, n):
        """The DB texts of ayah s:a spread over its n page words."""
        rows = data[kind][(s, a)]
        if (s, a) in JOIN:
            i = JOIN[(s, a)] - 1
            (w1, t1), (w2, t2) = rows[i], rows[i + 1]
            # taṣrīf texts already start with their own word
            tag = (lambda w, t: t) if kind == "sarf" else (lambda w, t: f"«{names[(s, a, w)]}»: {t}")
            both = f"{tag(w1, t1)}\n{tag(w2, t2)}"
            out = [t for _, t in rows[:i]] + [both] + [t for _, t in rows[i + 2:]]
        elif (s, a) in SHARE:
            i = SHARE[(s, a)] - 1
            out = [t for _, t in rows[:i + 1]] + [t for _, t in rows[i:]]
        else:
            out = [t for _, t in rows]
        if len(out) != n:
            raise SystemExit(f"{kind} {s}:{a}: {len(out)} texts for {n} page words")
        if not all(out):
            raise SystemExit(f"{kind} {s}:{a}: empty text")
        return out

    # the page words of every ayah, in order (an ayah may run over two pages)
    order, count = [], {}
    for p in range(1, 605):
        page = json.loads((PAGES / f"{p}.json").read_text(encoding="utf-8"))
        for row in page["rows"]:
            for w in row.get("words") or []:
                if w["k"] == "word":
                    s, a = map(int, w["v"].split(":"))
                    order.append((p, s, a, count.get((s, a), 0)))
                    count[(s, a)] = count.get((s, a), 0) + 1
    if set(count) != set(data["irab"]):
        raise SystemExit("the page data and the DB do not list the same ayahs")

    total = 0
    for kind in KINDS:
        spread = {k: texts(kind, k[0], k[1], n) for k, n in count.items()}
        pages = {}
        for p, s, a, i in order:
            pages.setdefault(p, []).append(spread[(s, a)][i])
        (OUT / kind).mkdir(parents=True, exist_ok=True)
        size = 0
        for p, items in pages.items():
            text = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
            (OUT / kind / f"{p}.json").write_text(text, encoding="utf-8")
            size += len(text.encode())
        total += size
        print(f"{kind}: {len(pages)} pages, {sum(map(len, pages.values()))} words, {size / 1e6:.1f} MB")
    print(f"total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
