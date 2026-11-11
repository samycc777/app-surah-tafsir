#!/usr/bin/env python3
"""The helpers' doubts (harakat/meaning/unsure.md) with the lines they are about, for the second read.

  python3 tools/meaning_doubts.py NNN [NNN…]   one block per chunk: the helper's doubt line as written, then
                                               each line it names: number, Qur'an word (s:a), the ayah, the
                                               source text and the vowelled text
  python3 tools/meaning_doubts.py --list       the chunks that have doubts

A helper names a line by its number or by its place in the chunk; the quoted word decides which.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / "harakat/meaning"
MARKS = re.compile("[ً-ْٰـۖ-ۭ]")


def strip(s):
    return MARKS.sub("", s).replace("ٱ", "ا")


def doubts():
    """{chunk: [doubt lines]} from unsure.md."""
    got = {}
    for l in (DIR / "unsure.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"- (\d{3}): (.*)", l)
        if m:
            got.setdefault(m.group(1), []).append(m.group(2))
    return got


def ayahs():
    got = {}
    for l in (ROOT / "src/data/quran-uthmani.txt").read_text(encoding="utf-8").splitlines():
        p = l.split("|", 2)
        if len(p) == 3:
            got[(p[0], p[1])] = p[2].strip()
    return got


def block(name, lines, quran):
    rows = [l.split("\t") for l in (DIR / "chunks" / f"{name}.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
    out = {}
    for l in (DIR / "out" / f"{name}.txt").read_text(encoding="utf-8").splitlines():
        if l.strip():
            n, _, t = l.partition("\t")
            out[n.strip()] = t.strip()
    by_no = {r[0]: r for r in rows}
    picked, loose = [], []

    def has(no, word):
        w = strip(word).split(" … ")[0].split(" / ")[0].strip()
        return bool(w) and w in strip(out.get(no, ""))

    for text in lines:
        last = None
        for m in re.finditer(r"(?:(\d+)\s*)?«([^»]*)»", text):
            n, word = m.groups()
            cands = []
            if n:
                if n in by_no:
                    cands.append(n)
                if 1 <= int(n) <= len(rows):
                    cands.append(rows[int(n) - 1][0])
            elif last:
                cands.append(last)
            hit = next((c for c in cands if has(c, word)), None)
            if hit is None:
                found = [r[0] for r in rows if has(r[0], word)]
                if len(found) == 1 or (found and not cands):
                    hit = found[0] if len(found) == 1 else None
                if hit is None and n and cands:
                    hit = cands[0]                  # the number is right, the word was quoted loosely
            if hit is None:
                if n:
                    loose.append(f"{n} «{word}»")
                continue
            if n:
                last = hit
            if hit not in picked:
                picked.append(hit)
    print(f"== chunk {name}")
    for text in lines:
        print(f"helper's doubts: {text}")
    for no in sorted(picked, key=lambda x: [r[0] for r in rows].index(x)):
        _, word, src = by_no[no]
        m = re.search(r"\((\d+):(\d+)\)", word)
        print(f"[{no}] {word} | ayah: {quran.get(m.groups(), '?') if m else '?'}")
        print(f"   source:   {src}")
        print(f"   vowelled: {out.get(no, '(missing)')}")
    if loose:
        print("not found by the tool (look in the chunk yourself): " + "; ".join(loose))
    print()


def main():
    d = doubts()
    if sys.argv[1:] == ["--list"]:
        print(" ".join(sorted(d)))
        return
    quran = ayahs()
    for name in sys.argv[1:]:
        if name in d:
            block(name, d[name], quran)
        else:
            print(f"== chunk {name}: no doubts logged\n")


if __name__ == "__main__":
    main()
