#!/usr/bin/env python3
"""Download the King Fahd Complex QCF V2 page fonts (free) into public/qcf/p<1..604>.woff2.

Each page font draws that page's words exactly as in the printed Madinah mushaf,
so every line fills the page width. The glyph codes are the `g` of each word in
public/mushaf/pages/<p>.json (tools/fetch_mushaf.py).
"""
import time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'public' / 'qcf'
URL = 'https://quran.com/fonts/quran/hafs/v2/woff2/p{p}.woff2'
UA = 'Mozilla/5.0 (compatible; surah-tafsir-build/1.0)'

def get(p):
    out = OUT / f'p{p}.woff2'
    if out.exists() and out.stat().st_size > 1000:
        return
    for attempt in range(5):
        try:
            req = urllib.request.Request(URL.format(p=p), headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if data[:4] != b'wOF2':
                raise ValueError('not woff2')
            out.write_bytes(data)
            return
        except Exception as e:
            err = e
            time.sleep(1 + attempt * 2)
    raise RuntimeError(f'p{p}: {err}')

OUT.mkdir(parents=True, exist_ok=True)
with ThreadPoolExecutor(max_workers=6) as ex:
    list(ex.map(get, range(1, 605)))
print('fonts', len(list(OUT.glob('*.woff2'))), 'bytes', sum(f.stat().st_size for f in OUT.glob('*.woff2')))
