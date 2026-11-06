#!/usr/bin/env python3
"""Write the Muyassar and Mukhtasar tafsirs as per-surah JSON for the reader.

Output: public/tafsir/{muyassar,mukhtasar}/<n>.json = [{"a": first ayah, "b": last ayah, "t": text}, ...] in ayah order.

Muyassar: data/tafsir-json/moyassar.jsonl (from tools/export_tafsir.py; git-ignored, in the main project folder);
suras 39-114 take the fully vowelled text of ~/dev/media-harakat-books/books/muyassar-39-114/out/*.txt instead
(quran.com's printed text, marks only added there). A row is replaced only when both texts agree letter for letter,
except the few printed-text fixes in MUYASSAR_SOURCE; an ayah missing in out/ shares the previous ayah's text. Ayahs that share one text become one passage (a..b);
its "__________" footnote rule stays in the text, the reader turns it into styling.

Mukhtasar: the fully vowelled text of ~/dev/media-harakat-books/books/mukhtasar-tafsir/out/*.txt
(QuranEnc's arabic_mokhtasar, harakat added there and proved to add marks only), one passage per line
(`sura:aya` or `sura:a-b`), with the few source typos in display_fixes.tsv mended. The APK text in mukhtasar_ar.jsonl is used only for its _word_ highlights
(the meaning of the mushaf's words): they are copied onto the vowelled text wherever the two texts agree
letter for letter around the highlight; where the editions differ, that highlight is left out.

python3 tools/export_extra_tafsir.py [<tafsir-json dir> [<mukhtasar out dir>]]
"""
import difflib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / "dev/app-surah-re/data/tafsir-json"
VOWELLED = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else \
    pathlib.Path.home() / "dev/media-harakat-books/books/mukhtasar-tafsir/out"
MUYASSAR = pathlib.Path.home() / "dev/media-harakat-books/books/muyassar-39-114/out"
MUYASSAR_SOURCE = {(54, 17)}   # APK typo «الاستنكار»; the printed book (and out/) reads «الاستكثار»
OUT = ROOT / "public/tafsir"
RANGE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*-\s*")
MARK = re.compile("[ً-ْٰـ]")


def rows_of(fname):
    by = {}
    for line in open(SRC / fname, encoding="utf-8"):
        r = json.loads(line)
        by.setdefault(r["s"], {})[r["a"]] = r["t"] or ""
    return by


def vowel_muyassar(by):
    got = {}
    for f in sorted(MUYASSAR.glob("*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                k, t = line.split("\t", 1)
                s, a = map(int, k.split(":"))
                got[(s, a)] = t.strip()
    done = 0
    for s in range(39, 115):
        last = None
        for a in sorted(by[s]):
            old = by[s][a].strip()
            if (s, a) in got:
                new = got[(s, a)]
                last = (old, new)
            elif last and old == last[0]:
                new = last[1]
            else:
                sys.exit(f"muyassar {s}:{a}: not in out/ and not the previous ayah's text")
            if bare(new)[0] != bare(old)[0] and (s, a) not in MUYASSAR_SOURCE:
                sys.exit(f"muyassar {s}:{a}: vowelled text differs from the app's")
            by[s][a] = new
            done += 1
    print("muyassar vowelled ayahs:", done)
    return by


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


def bare(text):
    """Text without harakat, alef wasla as plain alef; plus, for each kept char, its index in `text`."""
    chars, where = [], []
    for i, c in enumerate(text):
        if not MARK.match(c):
            chars.append("ا" if c == "ٱ" else c)
            where.append(i)
    return "".join(chars), where


def add_highlights(vowelled, old):
    """Copy old's _x_ highlights onto the vowelled text where the letters around them match."""
    plain, marks = [], []               # old text without "_", positions of its "_" in that text
    for c in old:
        if c == "_":
            marks.append(len(plain))
        else:
            plain.append(c)
    if not marks or len(marks) % 2:
        return vowelled, 0, len(marks) // 2
    b, where = bare(vowelled)
    q, _ = bare("".join(plain))         # old text has a few editors' marks too
    qmap = [i for i, c in enumerate(plain) if not MARK.match(c)]   # bare index -> plain index
    p2q = {p: k for k, p in enumerate(qmap)}
    sm = difflib.SequenceMatcher(None, q, b, autojunk=False)
    to_b = {}
    for i, j, n in sm.get_matching_blocks():
        for k in range(n + 1):          # boundary positions inside (and at the ends of) equal runs
            to_b[i + k] = j + k
    ins, done = [], 0
    for s, e in zip(marks[::2], marks[1::2]):
        qs = p2q.get(s, None) if s < len(plain) else len(q)
        qe = p2q.get(e, None) if e < len(plain) else len(q)
        if qs is None or qe is None or qs not in to_b or qe not in to_b:
            continue
        bs, be = to_b[qs], to_b[qe]
        if q[qs:qe] != b[bs:be]:
            continue
        ins += [(where[bs] if bs < len(where) else len(vowelled)),
                (where[be] if be < len(where) else len(vowelled))]
        done += 1
    out = vowelled
    for pos in sorted(ins, reverse=True):
        out = out[:pos] + "_" + out[pos:]
    return out, done, len(marks) // 2


def mukhtasar(old_by):
    by = {}
    fixes = [l.split("\t") for l in (VOWELLED.parent / "display_fixes.tsv").read_text(encoding="utf-8").splitlines()
             if l and not l.startswith("#")]   # source typos out/ keeps letter for letter, mended for display
    for f in sorted(VOWELLED.glob("*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            k, t = line.split("\t", 1)
            s, r = k.split(":")
            a, _, b = r.partition("-")
            s, a, b = int(s), int(a), int(b or a)
            for key, bad, good in fixes:
                fs, fa = map(int, key.split(":"))
                if fs == s and a <= fa <= b:
                    assert bad in t, (key, bad)
                    t = t.replace(bad, good)
            by.setdefault(s, []).append({"a": a, "b": b, "t": t.strip()})
    kept = total = 0
    for s, ps in by.items():
        ps.sort(key=lambda p: p["a"])
        old = old_by[s]
        for p in ps:
            seen, parts = set(), []
            for v in range(p["a"], p["b"] + 1):
                t = RANGE.sub("", old.get(v, "").strip(), count=1)
                if t and t not in seen:
                    seen.add(t)
                    parts.append(t)
            p["t"], k, n = add_highlights(p["t"], " ".join(parts))
            kept += k
            total += n
    return by, kept, total


def write(kind, by):
    d = OUT / kind
    d.mkdir(parents=True, exist_ok=True)
    total = 0
    for s in range(1, 115):
        ps = by[s]
        total += len(ps)
        (d / f"{s}.json").write_text(json.dumps(ps, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(kind, total, "passages")


write("muyassar", {s: passages(r) for s, r in vowel_muyassar(rows_of("moyassar.jsonl")).items()})
by, kept, total = mukhtasar(rows_of("mukhtasar_ar.jsonl"))
missing = [s for s in range(1, 115) if s not in by]
if missing:
    sys.exit(f"mukhtasar: suras not vowelled yet: {missing}")
write("mukhtasar", by)
print(f"mukhtasar highlights: {kept} of {total} copied")
