#!/usr/bin/env python3
"""Write the Muyassar and Mukhtasar tafsirs as per-surah JSON for the reader.

Input: data/tafsir-json/{moyassar,mukhtasar_ar}.jsonl (from tools/export_tafsir.py; git-ignored,
in the main project folder). Output: public/tafsir/{muyassar,mukhtasar}/<n>.json =
[{"a": first ayah, "b": last ayah, "t": text}, ...] in ayah order.

Text is copied as is (no harakat added or removed). Only layout markers change:
- ayahs that share one text become one passage (a..b);
- Mukhtasar's leading "3 - 4 - " range prefix becomes a..b and is dropped from the text;
- Mukhtasar's _word_ highlights and Muyassar's "__________" footnote rule stay in the text,
  the reader turns them into styling.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / "dev/app-surah-re/data/tafsir-json"
OUT = ROOT / "public/tafsir"
RANGE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*-\s*")
KINDS = {"muyassar": "moyassar.jsonl", "mukhtasar": "mukhtasar_ar.jsonl"}


def passages(rows):
    out, a, cnt = [], 1, len(rows)
    while a <= cnt:
        t = rows[a].strip()
        b = a
        m = RANGE.match(t)
        if m and int(m.group(1)) == a and int(m.group(2)) >= a:
            b = min(int(m.group(2)), cnt)
            t = t[m.end():]
        while b < cnt and rows[b + 1].strip() == rows[a].strip():
            b += 1
        out.append({"a": a, "b": b, "t": t})
        a = b + 1
    return out


for kind, fname in KINDS.items():
    by = {}
    for line in open(SRC / fname, encoding="utf-8"):
        r = json.loads(line)
        by.setdefault(r["s"], {})[r["a"]] = r["t"] or ""
    d = OUT / kind
    d.mkdir(parents=True, exist_ok=True)
    total = 0
    for s in range(1, 115):
        ps = passages(by[s])
        total += len(ps)
        (d / f"{s}.json").write_text(json.dumps(ps, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(kind, total, "passages")
