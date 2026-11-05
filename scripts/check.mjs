// Data guard: every ayah has a tafsir passage, and the meta file matches the data.
import { META, passageFor, passages, verses } from '../src/lib.mjs';

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
  if (m.full && m.pct < 97) {
    console.log(`surah ${m.n}: marked full but ${m.pct}%`);
    bad++;
  }
}
console.log(bad ? `${bad} problem(s)` : `ok: ${META.length} surahs, every ayah covered`);
process.exit(bad ? 1 : 0);
