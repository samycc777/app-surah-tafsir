// Runs after `astro build`: writes the static search index read by /search/
// (public/js/search.js) into dist/search-index/:
//   meta.json   surah names, passages [[surah, first verse, last verse]…]
//   c/<n>.json  passage texts without harakat, CHUNK per file
//   w/<n>.json  {word: [passage ids]}, words bucketed by key() so a query fetches one file per word
// norm(), key(), CHUNK and BUCKETS must stay identical in public/js/search.js.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { NAMES, passages } from '../src/lib.mjs';

const CHUNK = 30;
const BUCKETS = 512;
const strip = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '');
const norm = (s) => strip(s).replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^ء-ي0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (w) => [...w.slice(0, 3)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % BUCKETS;
// forms a word is indexed under: itself, without a joined و/ف, without ال
const forms = (w) => {
  const out = new Set([w]);
  for (const x of [...out]) if (/^[وف]/.test(x) && x.length > 3) out.add(x.slice(1));
  for (const x of [...out]) if (/^ال/.test(x) && x.length > 4) out.add(x.slice(2));
  return out;
};

const out = 'dist/search-index';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/c`, { recursive: true });
await mkdir(`${out}/w`, { recursive: true });

const meta = [], texts = [], words = new Map();
for (let n = 1; n <= 114; n++) {
  for (const p of passages(n)) {
    const id = meta.length;
    meta.push([n, p.a, p.b]);
    const text = p.p.join(' ').replace(/[﴿﴾]/g, '').replace(/\s+/g, ' ').trim();
    texts.push(text);
    const ws = new Set();
    for (const w of norm(text).split(' ')) if (w) for (const f of forms(w)) ws.add(f);
    for (const w of ws) (words.get(w) ?? words.set(w, []).get(w)).push(id);
  }
}
for (let i = 0; i < texts.length; i += CHUNK)
  await writeFile(`${out}/c/${i / CHUNK}.json`, JSON.stringify(texts.slice(i, i + CHUNK)));
const buckets = Array.from({ length: BUCKETS }, () => ({}));
for (const [w, ids] of words) buckets[key(w)][w] = ids;
await Promise.all(buckets.map((b, i) => writeFile(`${out}/w/${i}.json`, JSON.stringify(b))));
await writeFile(`${out}/meta.json`, JSON.stringify({ names: NAMES, passages: meta }));
console.log(`search index: ${meta.length} passages, ${words.size} words`);
