#!/usr/bin/env python3
"""Build the 15-line mushaf page data from the Quran.com word API.

One-time generator; the output is committed. Requires network for the first run
(raw responses stay in work/api, git-ignored). The app's own line PNGs/fonts are
NOT used: the API gives the Madinah page/line grouping, the Uthmani words and
the glyph codes of the King Fahd Complex QCF V2 page fonts (tools/fetch_qcf.py).
"""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'work' / 'api'
PAGES = ROOT / 'public' / 'mushaf' / 'pages'
API = 'https://api.quran.com/api/v4/verses/by_page/{p}?words=true&word_fields=text_uthmani,code_v2,line_number,page_number&per_page=50'
UA = 'Mozilla/5.0 (compatible; surah-tafsir-build/1.0)'
# first page of each juz in the Madinah print (the API's juz_number follows the verse,
# so a page opening a verse or two before the juz mark showed the previous juz)
JUZ_PAGES = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
             302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582]
NAMES = [m['name'] for m in json.load(open(ROOT / 'src/data/meta.json'))]

def fetch(p):
    out = RAW / f'{p}.json'
    if out.exists() and out.stat().st_size > 200:
        return p
    for attempt in range(5):
        try:
            req = urllib.request.Request(API.format(p=p), headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            json.loads(data)
            out.write_bytes(data)
            return p
        except Exception as e:
            time.sleep(1 + attempt * 2)
    raise RuntimeError(f'page {p}: {e}')

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    PAGES.mkdir(parents=True, exist_ok=True)
    missing = [p for p in range(1, 605) if not (RAW / f'{p}.json').exists()]
    print('fetching', len(missing), 'pages')
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, p in enumerate(ex.map(fetch, missing), 1):
            if i % 50 == 0:
                print(' ', i, '/', len(missing))

    pages = {}
    ayah_page = {}
    surah_pages = {}
    # The API's by_page lists sometimes hold a verse whose words sit on the
    # neighbouring page (e.g. 55:17-18 listed on 532 but printed on 531's last
    # lines). Place every word by its own page_number, never by the list it came in.
    page_rows = {p: {} for p in range(1, 605)}
    page_starts = {p: [] for p in range(1, 605)}
    page_verses = {p: [] for p in range(1, 605)}
    seen = set()
    for p in range(1, 605):
        d = json.loads((RAW / f'{p}.json').read_text())
        for v in d['verses']:
            s, a = map(int, v['verse_key'].split(':'))
            if v['verse_key'] in seen:
                continue
            seen.add(v['verse_key'])
            words = [w for w in v['words'] if w.get('line_number')]
            first_word = words[0]
            fp = int(first_word.get('page_number') or p)
            if a == 1:
                page_starts[fp].append({'n': s, 'name': NAMES[s-1], 'line': int(first_word['line_number']), 'a': a})
            last = None
            for w in words:
                wp = int(w.get('page_number') or p)
                # the API once files a verse-end number a line too early (84:21's ۝ on
                # 589 line 13, mid-verse): an end marker stays on its verse's last line.
                if (w.get('char_type_name') == 'end' and last and
                        (wp, int(w['line_number'])) < last):
                    wp, w = last[0], {**w, 'line_number': last[1]}
                last = (wp, int(w['line_number']))
                if not page_verses[wp] or page_verses[wp][-1] is not v:
                    page_verses[wp].append(v)
                kind = w.get('char_type_name') or 'word'
                txt = w.get('text_uthmani') or w.get('text') or ''
                page_rows[wp].setdefault(int(w['line_number']), []).append({
                    't': txt, 'v': v['verse_key'], 'k': kind,
                    'g': w.get('code_v2') or '',  # glyphs of the King Fahd page font public/qcf/p<page>.woff2
                })
            ayah_page.setdefault(s, {}).setdefault(a, fp)
    for p in range(1, 605):
        rows, starts = page_rows[p], page_starts[p]
        first_verse, last_verse = page_verses[p][0], page_verses[p][-1]
        # rows: words per line, 1..15
        lines = [{'line': i, 'words': rows.get(i, [])} for i in range(1, 16)]
        # insert surah banners / basmalas
        # Process starts from bottom to top so earlier line numbers stay valid.
        by_line = {l['line']: l for l in lines}
        for st in sorted(starts, key=lambda x: -x['line']):
            line = st['line']
            band = {'band': {'n': st['n'], 'name': st['name']}}
            bas = {'bas': 1}
            # free rows immediately before this surah's first row
            idx = next(i for i, l in enumerate(lines) if l['line'] >= line and l.get('words'))
            free = []
            j = idx - 1
            while j >= 0 and not lines[j]['words'] and len(free) < 2:
                free.append(j); j -= 1
            need = 1 if st['n'] in (1, 9) else 2
            if len(free) >= need:
                # use the last `need` free rows just before the text
                slots = sorted(free[:need])
                lines[slots[0]] = {'line': lines[slots[0]]['line'], **band}
                if need == 2:
                    lines[slots[1]] = {'line': lines[slots[1]]['line'], **bas}
            elif idx == len(free) and p > 1 and need - len(free) <= trailing_blanks(pages[p - 1]):
                # the surah opens this page with too few lines above it: the print
                # puts its band (and basmala, if still short) on the last lines of
                # the previous page, e.g. an-Nisa's band ends page 76.
                items = [band] + ([bas] if need == 2 else [])
                carry, here = items[:need - len(free)], items[need - len(free):]
                prev = pages[p - 1]['rows']
                for k, it in enumerate(carry):
                    prev[len(prev) - len(carry) + k] = it
                (PAGES / f'{p - 1}.json').write_text(json.dumps(pages[p - 1], ensure_ascii=False, separators=(',', ':')))
                for slot, it in zip(sorted(free), here):
                    lines[slot] = {'line': lines[slot]['line'], **it}
            else:
                # insert before the surah's first row and shift everything below
                ins = idx
                lines[ins:ins] = [{'line': 0, **band}] + ([{'line': 0, **bas}] if need == 2 else [])
        # renumber, drop empty source rows, then pad to the 15-line page
        out_rows = []
        for l in lines:
            if l.get('band') or l.get('bas') or l['words']:
                out_rows.append({k: v for k, v in l.items() if k != 'line'})
        while len(out_rows) < 15:
            out_rows.append({'blank': 1})
        meta = {
            'p': p,
            'juz': max(j for j, first in enumerate(JUZ_PAGES, 1) if first <= p),  # the print's header: every juz starts a page
            'hizb': first_verse.get('hizb_number'),
            'rub': first_verse.get('rub_el_hizb_number'),
            's': {'n': int(first_verse['verse_key'].split(':')[0]), 'a': int(first_verse['verse_key'].split(':')[1]), 'name': NAMES[int(first_verse['verse_key'].split(':')[0])-1]},
            'e': {'n': int(last_verse['verse_key'].split(':')[0]), 'a': int(last_verse['verse_key'].split(':')[1]), 'name': NAMES[int(last_verse['verse_key'].split(':')[0])-1]},
            'starts': [{'n': x['n'], 'name': x['name']} for x in starts],
            'rows': out_rows,
        }
        (PAGES / f'{p}.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
        pages[p] = meta

    # verify completeness
    missing_ayahs = [(s, a) for s in range(1, 115) for a in range(1, len(ayahs(s)) + 1) if a not in ayah_page.get(s, {})]
    if missing_ayahs:
        print('MISSING ayahs', missing_ayahs[:20], '... total', len(missing_ayahs))
    ranges = {}
    for s, m in ayah_page.items():
        ps = set(m.values())
        ranges[str(s)] = {'first': min(ps), 'last': max(ps)}
    (ROOT / 'src/data/mushaf-ayahs.json').write_text(json.dumps(ayah_page, ensure_ascii=False, separators=(',', ':')))
    (ROOT / 'src/data/mushaf-surahs.json').write_text(json.dumps(ranges, ensure_ascii=False, separators=(',', ':')))
    print('pages', len(pages), 'surahs', len(ranges), 'bytes', sum((PAGES / f'{p}.json').stat().st_size for p in pages))

def trailing_blanks(meta):
    n = 0
    for r in reversed(meta['rows']):
        if not r.get('blank'):
            break
        n += 1
    return n

def ayahs(s):
    # count from meta.json
    return [0] * json.loads((ROOT / 'src/data/meta.json').read_text())[s-1]['ayahs']

if __name__ == '__main__':
    main()
