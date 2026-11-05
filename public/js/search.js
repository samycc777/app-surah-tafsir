(() => {
  const CHUNK = 30, BUCKETS = 512, PAGE = 20;
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const strip = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '');
  const norm = (s) => strip(s).replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/[^ء-ي0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const key = (w) => [...w.slice(0, 3)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % BUCKETS;
  const forms = (w) => {
    const out = new Set([w]);
    for (const x of [...out]) if (/^[وف]/.test(x) && x.length > 3) out.add(x.slice(1));
    for (const x of [...out]) if (/^ال/.test(x) && x.length > 4) out.add(x.slice(2));
    return out;
  };
  const cache = new Map();
  const get = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }));
    return cache.get(url);
  };
  const form = document.getElementById('sform'), input = document.getElementById('q');
  const status = document.getElementById('status'), list = document.getElementById('results'), more = document.getElementById('more');
  let hits = [], shown = 0, words = [], run = 0;

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // snippet around the first match, matching tokens marked
  const snippet = (text, ws) => {
    const toks = [...text.matchAll(/[^\s،.؟:؛!"()\-﴿﴾]+/g)];
    const isHit = (t) => { const f = forms(norm(t[0])); return ws.some((w) => f.has(w) || [...forms(w)].some((x) => f.has(x))); };
    const idx = toks.findIndex(isHit);
    const from = Math.max(0, (idx < 0 ? 0 : idx) - 12), to = Math.min(toks.length, from + 40);
    let out = '';
    for (let i = from; i < to; i++) {
      out += (i > from ? ' ' : '') + (isHit(toks[i]) ? `<mark>${esc(toks[i][0])}</mark>` : esc(toks[i][0]));
    }
    return (from > 0 ? '… ' : '') + out + (to < toks.length ? ' …' : '');
  };

  async function render(meta, from, to, myRun) {
    const ids = hits.slice(from, to);
    const chunks = await Promise.all([...new Set(ids.map((i) => Math.floor(i / CHUNK)))].map((c) => get(`/search-index/c/${c}.json`).then((a) => [c, a])));
    if (myRun !== run) return;
    const byChunk = Object.fromEntries(chunks);
    for (const id of ids) {
      const [s, a, b] = meta.passages[id];
      const li = document.createElement('li');
      const label = `سورة ${meta.names[s - 1]} · ${a === b ? ar(a) : ar(a) + '–' + ar(b)}`;
      li.innerHTML = `<a class="ref" href="/surah/${s}/#${a}">${label}</a><p>${snippet(byChunk[Math.floor(id / CHUNK)][id % CHUNK], words)}</p>`;
      list.append(li);
    }
    shown = to;
    more.hidden = shown >= hits.length;
  }

  async function search(q) {
    const myRun = ++run;
    list.innerHTML = '';
    more.hidden = true;
    words = norm(q).split(' ').filter(Boolean);
    if (!words.length) { status.textContent = ''; return; }
    status.textContent = '…';
    try {
      const meta = await get('/search-index/meta.json');
      const sets = await Promise.all(words.map(async (w) => {
        const ids = new Set();
        for (const f of forms(w)) {
          const bucket = await get(`/search-index/w/${key(f)}.json`);
          for (const id of bucket[f] ?? []) ids.add(id);
        }
        return ids;
      }));
      if (myRun !== run) return;
      sets.sort((x, y) => x.size - y.size);
      hits = [...sets[0]].filter((id) => sets.every((s) => s.has(id))).sort((x, y) => x - y);
      // passages holding the words side by side come first (checked while the list is short)
      if (words.length > 1 && hits.length <= 300) {
        const phrase = words.join(' ');
        const texts = await Promise.all([...new Set(hits.map((i) => Math.floor(i / CHUNK)))].map((c) => get(`/search-index/c/${c}.json`).then((a) => [c, a])));
        const by = Object.fromEntries(texts);
        const has = (id) => norm(by[Math.floor(id / CHUNK)][id % CHUNK]).includes(phrase);
        const flags = new Map(hits.map((id) => [id, has(id)]));
        hits.sort((x, y) => (flags.get(y) - flags.get(x)) || x - y);
      }
      status.textContent = hits.length ? `${ar(hits.length)} نتيجة` : 'لا توجد نتائج';
      await render(meta, 0, Math.min(PAGE, hits.length), myRun);
    } catch {
      status.textContent = 'تعذّر البحث';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    history.replaceState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname);
    search(q);
  });
  more.addEventListener('click', async () => {
    const meta = await get('/search-index/meta.json');
    render(meta, shown, Math.min(shown + PAGE, hits.length), run);
  });
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) { input.value = q0; search(q0); }
})();
