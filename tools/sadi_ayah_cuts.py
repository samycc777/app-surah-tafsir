#!/usr/bin/env python3
"""Where each ayah's own commentary starts inside a Saʿdī passage.

Our Saʿdī text (src/data/tafsir/<n>.json, from site-tafsir-sadi) is in passages that cover
several ayat. The Surah app's database splits the same tafsir per ayah (the printed edition
marks each ayah's comment with {N}). We align the two texts word by word (harakat, punctuation
and spelling variants ignored) and record where ayah N begins in our vowelled paragraphs.

Output: src/data/tafsir-ayah/<n>.json = {"<passage index>": [[ayah, paragraph, char], ...]}
for ayat a+1..b of that passage (ayah a starts at the passage start). An ayah with no cut
(not commented on its own) falls back to the whole passage in the app.

Usage: python3 tools/sadi_ayah_cuts.py [--apk data/tafsir-json/saadi.jsonl] [--report]
"""
import argparse
import difflib
import json
import os
import re
import sys

MARKS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
NONLETTER = re.compile('[^ء-ي]')
FOLD = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي', 'ء': ''})


def norm(w):
    return NONLETTER.sub('', MARKS.sub('', w).translate(FOLD))


def words(text):
    """[(normalised word, start char)] of a text."""
    out = []
    for m in re.finditer(r'\S+', text):
        k = norm(m.group())
        if k:
            out.append((k, m.start()))
    return out


def apk_comment(t):
    """The APK's ayah entry without the vowelled verse block, footnotes and {N} markers."""
    t = re.sub(r'¬[^¥]*¥', ' ', t)
    keep = []
    for line in t.split('\n'):
        s = line.strip()
        if re.fullmatch(r'\{.*\(\d+\)\]?\}\.?', s):  # the verse block "{… (6) … (7)}."
            continue
        if re.fullmatch(r'تفسير سورة .*|وهي (مكية|مدنية).*', s):
            continue
        keep.append(line)
    t = '\n'.join(keep)
    t = re.sub(r'\{[\d\s\-ـ،,]+\}', ' ', t)
    return t


END = '.؟!'
CLAUSE = '.؟!؛،:﴾'


def tidy(para, c, floor):
    """Move a cut that falls mid-clause back to a nearby clause start."""
    if not c:
        return c
    head = para[:c].rstrip()
    # "… فَقَالَ: ﴿…﴾": the sentence that introduces the quote goes with it
    nxt = para[c:para.find('﴿', c)] if '﴿' in para[c:] else ''
    if nxt and len(nxt.split()) <= 2 and nxt.rstrip().endswith(':'):
        b = max(head.rfind(ch) for ch in END) + 1
        if b >= floor and len(para[b:c].split()) <= 25:
            return b + len(para[b:c]) - len(para[b:c].lstrip())
    if head and head[-1] not in CLAUSE:
        b = max(head.rfind(ch) for ch in CLAUSE) + 1
        if b >= floor and len(para[b:c].split()) <= 4:
            return b + len(para[b:c]) - len(para[b:c].lstrip())
    return c


def cuts_for(passage, apk):
    a, b = passage['a'], passage['b']
    ours = []  # (word, paragraph, char)
    para_start = set()
    for pi, para in enumerate(passage['p']):
        para_start.add(len(ours))
        ours += [(w, pi, c) for w, c in words(para)]
    theirs, owner, first = [], [], {}
    for v in range(a, b + 1):
        ws = [w for w, _ in words(apk_comment(apk.get(v, '')))]
        if ws:
            first[v] = len(theirs)
        theirs += ws
        owner += [v] * len(ws)
    if not ours or not theirs:
        return {}, 0.0
    sm = difflib.SequenceMatcher(None, [w for w, _, _ in ours], theirs, autojunk=False)
    pairs = [(blk.a + k, blk.b + k) for blk in sm.get_matching_blocks() for k in range(blk.size)]
    matched = len(pairs) / max(1, min(len(ours), len(theirs)))
    out = {}
    last, last_pi, last_c = 0, -1, 0
    for v in range(a + 1, b + 1):
        if v not in first:
            continue
        s = first[v]
        after = [o for o, t in pairs if t >= s and owner[t] == v]
        if not after:
            continue
        hi = after[0]
        before = [o for o, t in pairs if t < s]
        lo = before[-1] + 1 if before else 0
        lo = max(lo, last)
        if hi < lo:
            continue
        # a paragraph start in the unmatched gap is the natural cut; else where ayah v's words begin
        cut = next((i for i in range(lo, hi + 1) if i in para_start), hi)
        # snap to a paragraph start a few words away
        near = [i for i in para_start if abs(i - cut) <= 3 and i >= last]
        if near:
            cut = min(near, key=lambda i: abs(i - cut))
        if cut <= last and out:
            continue
        if cut == 0:
            continue
        _, pi, c = ours[cut]
        # never inside a ﴿…﴾ quote that runs over two ayat: the quote goes to ayah v
        para = passage['p'][pi]
        o = para.rfind('﴿', 0, c)
        if o >= 0 and para.rfind('﴾', 0, c) < o:
            cut = next(i for i in range(cut + 1) if ours[i][1] == pi and ours[i][2] >= o)
            c = o
            if cut <= last:
                continue
        c = tidy(para, c, last_c + 1 if last_pi == pi else 0)
        if (pi, c) <= (max(last_pi, 0), last_c):  # nothing left for the ayah before
            continue
        last, last_pi, last_c = cut, pi, c
        out[v] = [v, pi, c]
    return out, matched


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apk', default=None)
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    apk_path = args.apk or os.path.join(root, 'data/tafsir-json/saadi.jsonl')
    if not os.path.exists(apk_path):  # git-ignored: lives in the main folder only
        apk_path = os.path.expanduser('~/dev/app-surah-re/data/tafsir-json/saadi.jsonl')
    apk = {}
    for line in open(apk_path, encoding='utf8'):
        r = json.loads(line)
        apk.setdefault(r['s'], {})[r['a']] = r['t']
    os.makedirs(os.path.join(root, 'src/data/tafsir-ayah'), exist_ok=True)
    tot = got = mid = low = 0
    for n in range(1, 115):
        ps = json.load(open(os.path.join(root, f'src/data/tafsir/{n}.json'), encoding='utf8'))['passages']
        res = {}
        for i, p in enumerate(ps):
            if p['b'] <= p['a']:
                continue
            cuts, ratio = cuts_for(p, apk[n])
            tot += p['b'] - p['a']
            if ratio < 0.6:
                low += 1
                if args.report:
                    print(f'{n}:{p["a"]}-{p["b"]} low match {ratio:.2f}', file=sys.stderr)
                continue
            got += len(cuts)
            mid += sum(1 for _, _, c in cuts.values() if c)
            if cuts:
                res[str(i)] = list(cuts.values())
        with open(os.path.join(root, f'src/data/tafsir-ayah/{n}.json'), 'w', encoding='utf8') as f:
            json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{got}/{tot} ayah starts found ({mid} inside a paragraph); {low} passages skipped (low match)')


if __name__ == '__main__':
    main()
