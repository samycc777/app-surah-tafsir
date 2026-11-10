// Data guard: every ayah has a tafsir passage, and the meta file matches the data.
import { readFileSync } from 'node:fs';
import { META, ayahParts, passageFor, passages, verses } from '../src/lib.mjs';

let bad = 0;
for (const m of META) {
  const vs = verses[m.n];
  const ps = passages(m.n);
  if (!vs || vs.length !== m.ayahs) {
    console.log(`surah ${m.n}: ${vs?.length ?? 0} verses in Tanzil, meta says ${m.ayahs}`);
    bad++;
  }
  for (let v = 1; v <= vs.length; v++) {
    const i = passageFor(ps, v);
    if (!ps[i] || ps[i].a > v) {
      console.log(`surah ${m.n}: ayah ${v} has no passage`);
      bad++;
      break;
    }
  }
  // the per-ayah split of Saʿdī keeps every letter, in order, and gives each listed ayah a part
  ps.forEach((p, i) => {
    const { paras, own } = ayahParts(m.n, i, p);
    const flat = (a) => a.join('').replace(/\s+/g, '');
    if (flat(paras.map((x) => x.t)) !== flat(p.p)) { console.log(`surah ${m.n}: Saʿdī split ${p.a}-${p.b} changes the text`); bad++; }
    for (const v of own) {
      if (v < p.a || v > p.b || !paras.some((x) => x.v === v)) { console.log(`surah ${m.n}: Saʿdī ayah ${v} has no part`); bad++; }
    }
  });
  for (const k of ['muyassar', 'mukhtasar']) {
    const list = JSON.parse(readFileSync(`public/tafsir/${k}/${m.n}.json`, 'utf8'));
    let next = 1;
    for (const x of list) { if (x.a !== next || x.b < x.a || !x.t.trim()) break; next = x.b + 1; }
    if (next !== vs.length + 1) { console.log(`surah ${m.n}: ${k} breaks at ayah ${next}`); bad++; }
  }
  if (m.full && m.pct < 97) {
    console.log(`surah ${m.n}: marked full but ${m.pct}%`);
    bad++;
  }
}
// word texts: one per word of every mushaf page, for each kind
for (let p = 1; p <= 604; p++) {
  const words = JSON.parse(readFileSync(`public/mushaf/pages/${p}.json`, 'utf8')).rows
    .flatMap((r) => r.words || []).filter((w) => w.k === 'word').length;
  for (const k of ['meaning', 'irab', 'sarf']) {
    let list = [];
    try { list = JSON.parse(readFileSync(`public/words/${k}/${p}.json`, 'utf8')); } catch { /* missing */ }
    if (list.length !== words || list.some((t) => !t || !t.trim())) { console.log(`page ${p}: ${k} has ${list.length} texts for ${words} words`); bad++; }
  }
}
console.log(bad ? `${bad} problem(s)` : `ok: ${META.length} surahs, every ayah covered`);
process.exit(bad ? 1 : 0);
