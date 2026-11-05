import { readFileSync } from 'node:fs';

export const AR = '٠١٢٣٤٥٦٧٨٩';
export const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);

// 1 آية · 2 آيتان · 3–10 آيات · 11+ آية
export const ayahWord = (n) =>
  (n === 1 ? 'آية' : n === 2 ? 'آيتان' : n >= 3 && n <= 10 ? 'آيات' : 'آية');

export const SITE = {
  title: 'سورة',
  sub: 'القرآن الكريم مع تفسير السعدي',
  book: 'تيسير الكريم الرحمن في تفسير كلام المنان',
  author: 'الشيخ عبد الرحمن بن ناصر السعدي',
};

export const META = JSON.parse(
  readFileSync('src/data/meta.json', 'utf8'),
);
export const NAMES = META.map((m) => m.name);
export const meta = (n) => META[n - 1];

const lines = readFileSync('src/data/quran-uthmani.txt', 'utf8').split('\n');
export const verses = {}; // verses[surah] = [text of verse 1, …]
for (const l of lines) {
  const m = /^(\d+)\|(\d+)\|(.*)$/.exec(l);
  if (m) (verses[+m[1]] ??= [])[+m[2] - 1] = m[3];
}
export const basmala = verses[1][0];
// Tanzil prefixes verse 1 of every surah with the basmala; the page shows it in the heading instead
for (let n = 2; n <= 114; n++) {
  if (verses[n][0].startsWith(basmala + ' ')) {
    verses[n][0] = verses[n][0].slice(basmala.length + 1);
  }
}
export const tanzilNotice = lines
  .filter((l) => l.startsWith('#'))
  .map((l) => l.replace(/^#\s?/, ''))
  .join('\n')
  .trim();

export function passages(n) {
  return JSON.parse(
    readFileSync(`src/data/tafsir/${n}.json`, 'utf8'),
  ).passages;
}

// "﴿…﴾" fragments Saʿdi quotes inside his prose → [[text, isVerse], …]
export function pieces(t) {
  return t.split(/(﴿[^﴾]*﴾)/).filter(Boolean).map((s) => [s, s.startsWith('﴿')]);
}

// Every ayah maps to the passage that covers it (a passage runs to the verse before the next one).
export function passageFor(ps, v) {
  let found = 0;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].a <= v) found = i;
    else break;
  }
  return found;
}

// Juz → { j, first, last, parts: [{ n, name, a, b }] } from the 604 page files (every juz starts a page).
export const JUZ = (() => {
  const out = [];
  for (let p = 1; p <= 604; p++) {
    const d = JSON.parse(readFileSync(`public/mushaf/pages/${p}.json`, 'utf8'));
    const j = out[out.length - 1];
    if (!j || j.j !== d.juz) out.push({ j: d.juz, first: p, last: p, s: d.s, e: d.e });
    else { j.last = p; j.e = d.e; }
  }
  for (const j of out) {
    j.parts = [];
    for (let n = j.s.n; n <= j.e.n; n++) {
      j.parts.push({
        n, name: META[n - 1].name,
        a: n === j.s.n ? j.s.a : 1,
        b: n === j.e.n ? j.e.a : META[n - 1].ayahs,
      });
    }
  }
  return out;
})();
