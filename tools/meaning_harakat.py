#!/usr/bin/env python3
"""Full harakat on the word meanings (Tafsir Center's texts come unvowelled).

  make             DB → harakat/meaning/chunks/NNN.txt (~400 words each): every distinct meaning once,
                   one per line: number <TAB> the Qur'an word it explains (s:a) <TAB> the meaning
  check [NNN…]     harakat/meaning/out/NNN.txt (number <TAB> vowelled meaning) against its chunk:
                   same letters and punctuation, only marks added, every word vowelled
  map              → harakat/meaning/map.json {source text: vowelled text} for tools/export_words.py

Only invisible characters are tidied before vowelling (zero-width marks, no-break spaces, presentation
forms); a line break inside a meaning is written « ⏎ » in the chunk and put back by `map`.
"""
import json
import pathlib
import re
import sqlite3
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB = "db/assets/flutter_assets/database/surah_database_app_v34.db"
DIR = ROOT / "harakat/meaning"
MARKS = re.compile("[ً-ْٰـۖ-ۭ]")
HARAKA = "ً-ْٰ"
WORDS = 400
NL = " ⏎ "


def strip(s):
    return MARKS.sub("", s).replace("ٱ", "ا")


def tidy(t):
    t = re.sub("[ﭐ-﷏ﹰ-ﻼ]", lambda m: unicodedata.normalize("NFKC", m.group()), t)
    t = re.sub("[​-‏‪-‮﻿]", "", t).replace(" ", " ")
    t = re.sub(r"[ \t]*\n\s*", NL, t.strip())
    return re.sub(" {2,}", " ", t)


def source():
    """[(source text, s, a, Qur'an word)] in the order of first use."""
    db = ROOT / DB
    if not db.exists():                       # a worktree: the DB lives in the main folder only
        db = pathlib.Path.home() / "dev/app-surah-re" / DB
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    names = {(s, a, w): t for s, a, w, t in con.execute(
        "select surah_no, ayah_no, word_no, word_with_haraqah from quran_word_summary")}
    seen = {}
    for s, a, w, t in con.execute(
            "select surahNo, ayahNo, wordNo, meaning from word_content_meaning order by surahNo, ayahNo, wordNo"):
        seen.setdefault((t or "").strip(), (s, a, names.get((s, a, w), "")))
    return [(t, *v) for t, v in seen.items()]


def chunks():
    """[[(number, source text, s, a, word)]]: the same cut every time."""
    out, cur, n = [], [], 0
    for i, row in enumerate(source(), 1):
        k = len(row[0].split())
        if cur and n + k > WORDS:
            out.append(cur)
            cur, n = [], 0
        cur.append((i, *row))
        n += k
    out.append(cur)
    return out


def cmd_make():
    (DIR / "chunks").mkdir(parents=True, exist_ok=True)
    cs = chunks()
    for c, rows in enumerate(cs, 1):
        text = "".join(f"{i}\t{w} ({s}:{a})\t{tidy(t)}\n" for i, t, s, a, w in rows)
        (DIR / "chunks" / f"{c:03d}.txt").write_text(text, encoding="utf-8")
    print(f"{len(cs)} chunks, {sum(map(len, cs))} meanings")


def read_out(name):
    """{number: vowelled text} of out/<name>.txt, or None."""
    f = DIR / "out" / f"{name}.txt"
    if not f.exists():
        return None
    got = {}
    for l in f.read_text(encoding="utf-8").splitlines():
        if l.strip():
            n, _, t = l.partition("\t")
            got[n.strip()] = t.strip()
    return got


def line_errors(src, out):
    if strip(src) != strip(out):
        xs, ys = strip(src).split(), strip(out).split()
        j = next((j for j, (p, q) in enumerate(zip(xs, ys)) if p != q), min(len(xs), len(ys)))
        return [f"word {j + 1}: chunk «{' '.join(xs[j:j + 4])}» out «{' '.join(ys[j:j + 4])}»"]
    errs = []
    bare = [w for w in re.findall(f"[ء-ي{HARAKA}ٱ]+", out)
            if len(strip(w)) > 1 and not re.search(f"[{HARAKA}]", w)]
    if bare:
        errs.append("no marks on: " + " ".join(bare[:5]))
    if re.search(f"ا[ًٌٍَُِْ]", out.replace("اً", "")):
        errs.append("a mark on a bare alif")
    return errs


def cmd_check(names):
    names = names or sorted(p.stem for p in (DIR / "chunks").glob("*.txt") if (DIR / "out" / p.name).exists())
    bad = 0
    for name in names:
        rows = [l.split("\t") for l in (DIR / "chunks" / f"{name}.txt").read_text(encoding="utf-8").splitlines()]
        got = read_out(name)
        if got is None:
            print(name, "MISSING")
            bad += 1
            continue
        errs = []
        extra = set(got) - {r[0] for r in rows}
        if extra:
            errs.append(f"numbers not in the chunk: {' '.join(sorted(extra)[:5])}")
        for n, _, src in rows:
            if n not in got:
                errs.append(f"{n}: missing")
            else:
                errs += [f"{n}: {e}" for e in line_errors(src, got[n])]
        text = " ".join(got.values())
        letters = len(re.findall("[ء-غف-ي]", text))
        marked = len(re.findall("[ء-غف-ي][ً-ْ]", text))
        print(name, "OK" if not errs else "BAD", f"marks on {marked * 100 // max(letters, 1)}% of letters",
              *errs[:8], sep="  ")
        bad += bool(errs)
    return bad


def cmd_map():
    done, todo = {}, 0
    for c, rows in enumerate(chunks(), 1):
        name = f"{c:03d}"
        got = read_out(name)
        if got is None or cmd_check([name]):
            todo += len(rows)
            continue
        for i, t, *_ in rows:
            done[t] = got[str(i)].replace(NL.strip(), "\n").replace(" \n ", "\n")
    (DIR / "map.json").write_text(json.dumps(done, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(done)} meanings vowelled, {todo} still as printed")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "make":
        cmd_make()
    elif cmd == "check":
        sys.exit(1 if cmd_check(sys.argv[2:]) else 0)
    elif cmd == "map":
        cmd_map()
    else:
        sys.exit(__doc__)
