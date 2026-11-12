(() => {
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const en = (s) => String(s).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
  const native = window.SurahNative || null; // set by the Android app
  const ORIGIN = native ? 'https://surah-tafsir.pages.dev' : location.origin;
  const $ = (s, r = document) => r.querySelector(s);
  // Android back button: the app asks surahBack() first; true = a sheet was closed, stay on the page.
  const backHandlers = [];
  window.surahBack = () => backHandlers.some((f) => f());
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem('surah:' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('surah:' + k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem('surah:' + k); } catch { /* ignore */ } },
  };

  /* ── toast ─────────────────────────────────────────── */
  const toastEl = $('#toast');
  let tt;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(tt);
    tt = setTimeout(() => { toastEl.hidden = true; }, 1700);
  };

  /* ── harakat ───────────────────────────────────────── */
  const MARKS = /[\u064B-\u0652\u0670\u0640]/g;
  const HAS = /[\u064B-\u0652\u0670\u0640]/;
  let harakat = store.get('harakat') !== '0';
  const strip = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) if (HAS.test(t.data)) t.data = t.data.replace(MARKS, '');
  };

  /* ── font size ─────────────────────────────────────── */
  let fs = parseFloat(store.get('fs')) || 1;
  const setFs = (x) => {
    fs = Math.min(1.7, Math.max(0.85, Math.round(x * 20) / 20));
    document.documentElement.style.setProperty('--fs', fs);
    store.set('fs', fs);
  };
  setFs(fs);

  /* ── settings sheet ────────────────────────────────── */
  const setWrap = $('#settings');
  const openSettings = () => {
    if (!setWrap) return;
    setWrap.hidden = false;
    document.body.style.overflow = 'hidden';
    const cb = $('#set-harakat');
    if (cb) cb.checked = harakat;
  };
  const closeSettings = () => {
    if (!setWrap) return;
    setWrap.hidden = true;
    document.body.style.overflow = '';
  };
  $('#open-settings')?.addEventListener('click', openSettings);
  backHandlers.push(() => !!setWrap && !setWrap.hidden && (closeSettings(), true));
  setWrap?.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSettings));
  $('#set-harakat')?.addEventListener('change', (e) => {
    harakat = e.target.checked;
    store.set('harakat', harakat ? '1' : '0');
    window.dispatchEvent(new CustomEvent('harakat'));
  });
  // which tafsir the pop-up shows (the reader listens for 'tafsir')
  const kindBtns = $$('#set-tafsir [data-kind]');
  const syncKind = () => {
    const k = ['saadi', 'muyassar', 'mukhtasar'].includes(store.get('tafsir')) ? store.get('tafsir') : 'saadi';
    kindBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
  };
  syncKind();
  window.addEventListener('tafsir', syncKind); // also picked from the pop-up's tabs
  kindBtns.forEach((b) => b.addEventListener('click', () => {
    store.set('tafsir', b.dataset.kind);
    syncKind();
    window.dispatchEvent(new CustomEvent('tafsir', { detail: b.dataset.kind }));
  }));
  $('#fs-up')?.addEventListener('click', () => { setFs(fs + 0.1); toast(`حجم الخط ${Math.round(fs * 100)}٪`); });
  $('#fs-down')?.addEventListener('click', () => { setFs(fs - 0.1); toast(`حجم الخط ${Math.round(fs * 100)}٪`); });

  /* ── install ───────────────────────────────────────── */
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    const b = $('#install');
    if (b) b.hidden = false;
  });
  $('#install')?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    deferred = null;
  });

  /* ── theme (☾) ────────────────────────────────────── */
  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    const m = $('#theme-color');
    if (m) m.content = t === 'dark' ? '#1d1a15' : '#ffffff';
    store.set('theme', t);
    native?.theme(t);
  };
  native?.theme(document.documentElement.dataset.theme || 'light');
  if (!document.body.classList.contains('mushaf-shell')) native?.immersive?.(false); // the reader hides the phone's bars
  $('#theme-toggle')?.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ── home: recently read + tabs ────────────────────── */
  const resume = $('#resume');
  if (resume) {
    try {
      const last = JSON.parse(store.get('last') || 'null');
      if (last && last.n >= 1 && last.n <= 114) {
        $('#resume-wrap').hidden = false;
        resume.href = `/surah/${last.n}/#${last.v}`;
        $('.bn', resume).textContent = ar(last.n);
        $('.sname', resume).textContent = `سورة ${last.name}`;
        $('.smeta', resume).textContent = `الآية ${ar(last.v)}`;
      }
    } catch { /* ignore */ }
  }
  const tabs = $$('.tab[data-tab]');
  if (tabs.length) {
    const show = (k) => {
      tabs.forEach((b) => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
      $('#tab-s').hidden = k !== 's';
      $('#tab-j').hidden = k !== 'j';
      store.set('tab', k);
    };
    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    if (store.get('tab') === 'j') show('j');
  }

  /* ── home: find a surah by name or number ──────────── */
  const sFind = $('#s-find');
  if (sFind) {
    const fold = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
    const cards = $$('#tab-s .scard').map((a) => [a, fold($('.sname', a).textContent).replace(/^سوره /, ''), fold($('.bn', a).textContent)]);
    sFind.addEventListener('input', () => {
      const q = fold(sFind.value).replace(/^سوره ?/, '');
      let any = false;
      for (const [a, nm, num] of cards) {
        const ok = !q || (/^\d+$/.test(q) ? num === q : nm.includes(q) || nm.replace(/^ال/, '').startsWith(q.replace(/^ال/, '')));
        a.hidden = !ok;
        any ||= ok;
      }
      $('#s-none').hidden = any;
    });
  }

  /* ── bookmarks ─────────────────────────────────────── */
  const savedList = () => {
    try { return JSON.parse(store.get('saved') || '[]'); } catch { return []; }
  };
  const isSaved = (n, v) => savedList().some((x) => x.n === n && x.v === v);
  const toggleSaved = (n, v, name) => {
    const cur = savedList();
    const i = cur.findIndex((x) => x.n === n && x.v === v);
    if (i >= 0) cur.splice(i, 1);
    else cur.unshift({ n, v, name, t: Date.now() });
    store.set('saved', JSON.stringify(cur.slice(0, 500)));
    return i < 0;
  };

  /* ── mushaf reader ─────────────────────────────────── */
  const mushaf = $('#mushaf');
  if (mushaf) {
    // the surah's data; swapped in place when the reader moves on into another surah (switchTo)
    let n, name, full, first, last, pages, map, passes, ayahs, count;
    const readSurah = () => {
      const D = mushaf.dataset;
      n = +D.n; name = D.name; full = D.full === 'true'; first = +D.first; last = +D.last;
      pages = JSON.parse(D.pages); map = JSON.parse(D.map); passes = JSON.parse(D.passes);
      ayahs = JSON.parse($('#m-ayahs').textContent); count = ayahs.length;
    };
    readSurah();
    const sheet = $('#taf');
    const bodyEl = $('#taf-body');
    const sub = $('#taf-sub');
    const note = $('#taf-note');
    const bmBtn = $('#taf-bookmark');
    const linesEl = $('#m-lines');
    const startEl = $('#m-start');
    const pageEl = $('#m-page-no');
    const juzEl = $('#m-juz');
    const countEl = $('#m-count');
    const prevBtn = $('#m-prev');
    const nextBtn = $('#m-next');
    const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

    let page = first, pageData = null, cur = 0, req = 0;
    const BOOK = 604; // pages in the mushaf: swiping past this surah's pages goes on into the next one
    const inBook = (p) => p >= 1 && p <= BOOK;

    /* King Fahd Complex QCF page fonts: page p's words are glyphs `g` of the font /qcf/p<p>.woff2.
       If a font can't load (offline, not cached yet) the page falls back to Amiri text `t`. */
    const fonts = {};
    const fontFor = (p) => {
      fonts[p] ||= new FontFace(`qcf${p}`, `url(/qcf/p${p}.woff2)`, { display: 'block' }).load()
        .then((f) => { document.fonts.add(f); return true; })
        .catch(() => { delete fonts[p]; return false; });
      return fonts[p];
    };
    const pageJson = {};
    const getPage = (p) => {
      pageJson[p] ||= fetch(`/mushaf/pages/${p}.json`, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('page'); return r.json(); })
        .catch((e) => { delete pageJson[p]; throw e; });
      return pageJson[p];
    };
    const qcfOk = (d) => d.rows.every((r) => !r.words || r.words.every((w) => w.g));

    /* Page turns slide like a book read right to left: the next page waits on the left, the previous
       on the right; both are drawn in advance so the page follows the finger. */
    const track = $('#m-track');
    const curPanel = linesEl.parentElement;
    const ghost = (cls) => {
      const el = curPanel.cloneNode(true);
      el.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
      el.removeAttribute('aria-live');
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('ghost', cls);
      track.append(el);
      return el;
    };
    const side = { [-1]: ghost('prev'), [1]: ghost('next') };
    const sideLines = (k) => side[k].querySelector('.m-lines');

    let basGlyphs = null; // the basmala = the first four words of 1:1, drawn with page 1's font
    const basReady = fetch('/mushaf/pages/1.json').then((r) => r.json()).then((d) => {
      basGlyphs = d.rows.flatMap((r) => r.words || []).filter((w) => w.v === '1:1' && w.k === 'word').map((w) => w.g);
      return fontFor(1);
    }).catch(() => false);

    /* three tafsirs: Saadi is in the page (templates), the other two are fetched per surah */
    const KINDS = { saadi: 'تفسير السعدي', muyassar: 'التفسير الميسر', mukhtasar: 'المختصر في التفسير' };
    let kind = KINDS[store.get('tafsir')] ? store.get('tafsir') : 'saadi';
    const extra = {};
    const loadExtra = (k) => {
      extra[k] ||= fetch(`/tafsir/${k}/${n}.json`).then((r) => { if (!r.ok) throw new Error(k); return r.json(); })
        .catch((e) => { delete extra[k]; throw e; });
      return extra[k];
    };
    const extraFor = (list, v) => list.find((x) => x.a <= v && v <= x.b) || null;
    // _words_ = the Mukhtasar's highlighted meaning; a "____" rule = Muyassar's footnote line
    const extraHtml = (t) => t.split(/\s*_{5,}\s*/).map((part, i) =>
      `<p${i ? ' class="fn"' : ''}>${esc(part).replace(/_([^_]+)_/g, '<span class="q">$1</span>')}</p>`).join('');
    const extraPlain = (t) => t.replace(/\s*_{5,}\s*/g, '\n\n').replace(/_([^_]+)_/g, '$1');
    const SHORT = { saadi: 'السعدي', muyassar: 'الميسر', mukhtasar: 'المختصر' };

    /* per-word study texts (meaning, iʿrāb, taṣrīf): one file per mushaf page and kind, one text
       per word in page order (tools/export_words.py); `mode` is what the pop-up shows */
    const WKINDS = { meaning: 'المعنى', irab: 'الإعراب', sarf: 'التصريف' };
    const WSOURCE = 'مركز تفسير للدراسات القرآنية';
    const tabsEl = $('#taf-tabs');
    let mode = WKINDS[store.get('pop')] ? store.get('pop') : 'taf';
    let curW = null; // the tapped word: { i: index among the page's words, p: page, t: text, g: page-font glyph }
    const wordMode = () => mode !== 'taf' && !!curW && !!tabsEl;
    const wordJson = {};
    const loadWords = (k, p) => {
      wordJson[`${k}/${p}`] ||= fetch(`/words/${k}/${p}.json`).then((r) => { if (!r.ok) throw new Error(k); return r.json(); })
        .catch((e) => { delete wordJson[`${k}/${p}`]; throw e; });
      return wordJson[`${k}/${p}`];
    };
    // ﴿…﴾ and {…} are the Qur'an's own words inside the explanation
    const wordHtml = (t) => t.split('\n').filter((x) => x.trim()).map((x) =>
      `<p>${esc(x).replace(/(﴿[^﴾]*﴾|\{[^}]*\})/g, '<span class="q">$1</span>')}</p>`).join('');
    const syncTabs = () => {
      if (!tabsEl) return;
      const shown = wordMode() ? mode : 'taf';
      $$('button', tabsEl).forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.mode === shown && (!b.dataset.kind || b.dataset.kind === kind)));
        b.disabled = b.dataset.mode !== 'taf' && !curW; // no word tapped (ayah number, link)
      });
    };

    const tplFor = (i) => document.querySelector(`template[data-pass="${i}"]`);
    // the Saʿdī paragraphs for ayah v: its own part when the passage is split per ayah, else all
    const sadiFor = (v) => {
      const t = tplFor(passes[v - 1]);
      if (!t) return null;
      const own = (t.dataset.own || '').split(' ').includes(String(v));
      const ps = [...t.content.querySelectorAll(own ? `p[data-v="${v}"]` : 'p')];
      return { ps, label: own ? label(v, v) : label(+t.dataset.a, +t.dataset.b) };
    };
    const label = (a, b) => (a === b ? `الآية ${ar(a)}` : `الآيات ${ar(a)}–${ar(b)}`);
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const remember = (v) => store.set('last', JSON.stringify({ n, v, name }));

    const surahAyahOnPage = (d) => {
      for (const r of d.rows) {
        if (!r.words) continue;
        for (const w of r.words) {
          const s = +w.v.split(':')[0];
          if (s === n) return +w.v.split(':')[1];
        }
      }
      return null;
    };

    function renderPage(d, qcf, bas, L = linesEl) {
      const rows = d.rows.map((r) => (r.words ? { words: r.words.map((w) => ({ ...w })) } : r));
      let last = null;
      for (const r of rows) {
        if (r.band || r.bas) { last = null; continue; }
        if (!r.words) continue;
        while (r.words.length && (r.words[0].k === 'pause' || r.words[0].k === 'sajdah')) {
          const mark = r.words.shift();
          if (last) { last.t += ` ${mark.t}`; last.g = (last.g || '') + (mark.g || ''); }
        }
        if (r.words.length) last = r.words[r.words.length - 1];
      }
      const textRows = rows.filter((r) => r.words && r.words.length).length;
      L.classList.toggle('sparse', textRows <= 8);
      L.classList.toggle('qcf', qcf);
      L.style.fontFamily = qcf ? `qcf${d.p}` : '';
      // the opening pages (Fatiha, Baqara) end in empty rows: drop them so the text sits mid-page
      if (textRows <= 8) while (rows.length && rows[rows.length - 1].blank) rows.pop();
      L.style.setProperty('--rows', rows.length);
      const G = (w) => esc(qcf ? w.g : w.t);
      let wi = 0; // index among the page's words: the key into /words/<kind>/<page>.json
      L.innerHTML = rows.map((r) => {
        if (r.band) return `<div class="m-band"><span>سورة ${esc(r.band.name)}</span></div>`;
        if (r.bas) return bas && basGlyphs
          ? `<div class="m-bas qcf-bas">${basGlyphs.map(esc).join(' ')}</div>`
          : `<div class="m-bas">${BASMALA}</div>`;
        if (r.blank) return `<div class="m-line blank"></div>`;
        const raw = r.words || [];
        const ws = [];
        for (const w of raw) {
          if ((w.k === 'pause' || w.k === 'sajdah') && ws.length) {
            ws[ws.length - 1].t += ` ${w.t}`;
            ws[ws.length - 1].g = (ws[ws.length - 1].g || '') + (w.g || '');
          } else {
            ws.push({ t: w.t, v: w.v, k: w.k, g: w.g });
          }
        }
        const basmala = ws.length && ws.every((w) => w.v === '1:1');
        const center = (!qcf && ws.length <= 3) || basmala ? ' center' : '';
        return `<div class="m-line${center}">` + ws.map((w) => {
          if (w.k === 'end') {
            return `<span class="m-num" data-v="${w.v}" role="button" tabindex="0" aria-label="الآية ${w.v.split(':')[1]}">${G(w)}</span>`;
          }
          if (w.k === 'pause' || w.k === 'sajdah') {
            return `<span class="m-pause" data-v="${w.v}">${G(w)}</span>`;
          }
          return `<span class="w" data-v="${w.v}" data-i="${wi++}">${G(w)}</span>`;
        }).join('') + `</div>`;
      }).join('');
      fit(L);
    }

    function headInto(panel, d) {
      panel.querySelector('.m-start').textContent = `سورة ${d.s.name}`;
      panel.querySelector('.m-page-no').textContent = ar(d.p);
      panel.querySelector('.m-juz').textContent = d.juz ? `الجزء ${ar(d.juz)}` : '';
    }

    function setHead(d) {
      headInto(curPanel, d);
      const i = pages.indexOf(d.p);
      countEl.textContent = `الصفحة ${ar((i < 0 ? 0 : i) + 1)} من ${ar(pages.length)}`;
      prevBtn.disabled = d.p <= 1;
      nextBtn.disabled = d.p >= BOOK;
    }

    /* One font size for the whole page, as large as the screen allows: the widest line fills the
       width (QCF lines are all about as wide as in print), and 15 rows fill the height. If the
       height is the limit (wide screens), the page narrows to the text and stays centred. */
    function fit(L = linesEl) {
      const box = L.parentElement;
      const W = box.clientWidth - 14, H = L.clientHeight || box.clientHeight;
      if (!W || !H) return;
      const lines = [...L.querySelectorAll('.m-line:not(.blank)')];
      L.style.width = '';
      L.style.fontSize = '100px';
      L.classList.add('measure');
      const nat = lines.map((l) => l.scrollWidth);
      L.classList.remove('measure');
      const widest = Math.max(1, ...nat);
      const qcf = L.classList.contains('qcf');
      const sparse = L.classList.contains('sparse');
      const LH = qcf ? 1.75 : 1.9; // row height needed, in font sizes
      const byH = H / 15 / LH * (sparse ? 1.35 : 1);
      const byW = (W * 0.985 * 100) / widest;
      const px = Math.max(10, Math.min(byW, byH));
      L.style.fontSize = `${px}px`;
      const pw = Math.min(W, (widest * px) / 100 / 0.985);
      L.style.width = `${pw}px`;
      box.style.setProperty('--pw', `${pw}px`); // the header line keeps to the text's width
      // a line much shorter than the widest (end of the Quran's short surahs) is centred, not stretched
      lines.forEach((l, i) => l.classList.toggle('short', qcf && nat[i] < widest * 0.8));
    }

    function highlight(v) {
      $$('.w.on, .m-num.on, .m-pause.on').forEach((e) => e.classList.remove('on'));
      if (wordMode() && anchor && anchor.isConnected) { anchor.classList.add('on'); return; } // the word alone
      $$(`[data-v="${n}:${v}"]`, linesEl).forEach((e) => e.classList.add('on'));
    }

    let tafReq = 0;
    async function renderWord(v) {
      const my = ++tafReq;
      const { i, p, t, g } = curW;
      note.hidden = true;
      let x = null;
      try { x = (await loadWords(mode, p))[i]; } catch { /* offline, not cached yet */ }
      if (my !== tafReq || !curW) return;
      bodyEl.innerHTML = x ? wordHtml(x) : '<p>تعذّر التحميل</p>';
      if (!harakat) strip(bodyEl);
      // the Qur'an's word keeps its marks: drawn as on the page (its glyph in the page font) when that font is loaded
      bodyEl.insertAdjacentHTML('afterbegin', g ? `<p class="wd" style="font-family:qcf${p}">${esc(g)}</p>` : `<p class="wd">${esc(t)}</p>`);
      sub.textContent = `${WKINDS[mode]} · ${label(v, v)}`;
      highlight(v);
      bmBtn.setAttribute('aria-pressed', String(isSaved(n, v)));
      $('.tp-body', sheet).scrollTop = 0;
      place();
    }
    async function renderTaf(v) {
      syncTabs();
      if (wordMode()) return renderWord(v);
      const my = ++tafReq;
      if (kind === 'saadi') {
        const x = sadiFor(v);
        bodyEl.innerHTML = x ? x.ps.map((p) => p.outerHTML).join('') : '';
        sub.textContent = x ? `${SHORT[kind]} · ${x.label}` : SHORT[kind];
        note.hidden = full;
      } else {
        note.hidden = true;
        let x = null;
        try { x = extraFor(await loadExtra(kind), v); } catch { /* offline, not cached yet */ }
        if (my !== tafReq) return;
        bodyEl.innerHTML = x ? extraHtml(x.t) : '<p>تعذّر تحميل التفسير</p>';
        sub.textContent = x ? `${SHORT[kind]} · ${label(x.a, x.b)}` : SHORT[kind];
      }
      if (!harakat) strip(bodyEl);
      highlight(v);
      const on = isSaved(n, v);
      bmBtn.setAttribute('aria-pressed', String(on));
      $('.tp-body', sheet).scrollTop = 0;
      place();
    }

    /* The tafsir opens in a small pop-up next to the tapped word (like a footnote), with its
       arrow pointing at it: below the word when there is room, else above. */
    let anchor = null;
    const anchorEl = () => (anchor && anchor.isConnected && linesEl.contains(anchor) ? anchor
      : $(`.w[data-v="${n}:${cur}"]`, linesEl) || $(`[data-v="${n}:${cur}"]`, linesEl));
    function place() {
      if (sheet.hidden) return;
      const a = anchorEl();
      const vw = document.documentElement.clientWidth, vh = innerHeight;
      const r = a ? a.getBoundingClientRect() : { left: vw / 2, width: 0, top: vh / 3, bottom: vh / 3 };
      sheet.style.maxHeight = '';
      const below = vh - r.bottom - 24, above = r.top - 24;
      const down = below >= Math.min(sheet.offsetHeight, vh * 0.55) || below >= above;
      sheet.style.maxHeight = `${Math.max(160, Math.min(down ? below : above, vh * 0.7))}px`;
      const w = sheet.offsetWidth, h = sheet.offsetHeight, mid = r.left + r.width / 2;
      const left = Math.max(8, Math.min(mid - w / 2, vw - w - 8));
      const top = down ? r.bottom + 10 : r.top - h - 10;
      sheet.classList.toggle('up', !down);
      sheet.style.left = `${left}px`;
      sheet.style.top = `${Math.max(8, Math.min(top, vh - h - 8))}px`;
      sheet.style.setProperty('--ax', `${Math.max(18, Math.min(mid - left, w - 18))}px`);
    }

    function showSheet(v, scroll, el = null) {
      if (v < 1 || v > count) return;
      cur = v;
      anchor = el;
      const wd = el && el.classList.contains('w') && el.dataset.i != null && pageData
        ? pageData.rows.flatMap((r) => r.words || []).filter((w) => w.k === 'word')[+el.dataset.i] : null;
      curW = wd ? { i: +el.dataset.i, p: page, t: wd.t, g: linesEl.classList.contains('qcf') ? el.textContent : '' } : null;
      sheet.hidden = false;
      renderTaf(v);
      history.replaceState(null, '', `${location.pathname}#${v}`);
      remember(v);
    }

    function closeSheet() {
      sheet.hidden = true;
      anchor = null;
      curW = null;
      $$('.on').forEach((e) => e.classList.remove('on'));
      const a = pageData ? surahAyahOnPage(pageData) : null;
      history.replaceState(null, '', a ? `${location.pathname}#${a}` : location.pathname);
    }

    async function drawSide(k, p) {
      const L = sideLines(k);
      side[k].dataset.p = p;
      if (!inBook(p)) {
        L.innerHTML = '';
        side[k].querySelectorAll('.m-head span').forEach((e) => { e.textContent = ''; });
        return;
      }
      try {
        const d = await getPage(p);
        const [qcf, bas] = await Promise.all([fontFor(p), d.rows.some((r) => r.bas) ? basReady : false]);
        if (side[k].dataset.p !== String(p)) return;
        renderPage(d, qcf && qcfOk(d), bas, L);
        headInto(side[k], d);
      } catch { /* drawn when it is turned to */ }
    }

    async function load(p, opts = {}) {
      if (p < first || p > last) { opts.before?.(); return; }
      const my = ++req;
      let d;
      try {
        d = await getPage(p);
      } catch {
        if (my === req) { opts.before?.(); toast('تعذّر تحميل الصفحة'); }
        return;
      }
      const [qcf, bas] = await Promise.all([fontFor(p), d.rows.some((r) => r.bas) ? basReady : false]);
      if (my !== req) return;
      page = p;
      pageData = d;
      opts.before?.(); // the slide ends in the same frame the page is drawn: no flash
      renderPage(d, qcf && qcfOk(d), bas);
      // the neighbours are drawn after this frame, so the next swipe shows real pages
      setTimeout(() => { drawSide(-1, p - 1); drawSide(1, p + 1); }, 60);
      setHead(d);
      window.dispatchEvent(new Event('pageshown'));
      const a = surahAyahOnPage(d);
      if (opts.hash) history.replaceState(null, '', `${location.pathname}#${opts.hash}`);
      else if (!opts.keepHash && a) history.replaceState(null, '', `${location.pathname}#${a}`);
      if (opts.open) { showSheet(opts.open, false, opts.wi != null ? $(`.w[data-i="${opts.wi}"]`, linesEl) : null); }
      else {
        if (opts.highlight) highlight(opts.highlight);
        remember(opts.highlight || a || d.s.a);
      }
    }

    linesEl.addEventListener('click', (e) => {
      const el = e.target.closest('[data-v]');
      if (!el) return;
      const [s, a] = el.dataset.v.split(':').map(Number);
      if (s !== n) { // a word of the other surah on a shared page
        const wi = mode !== 'taf' && tabsEl && el.classList.contains('w') ? el.dataset.i : null; // keep the tapped word
        switchTo(s).then(() => load(wi != null ? page : map[a] || page, { hash: a, open: a, wi }), () => { location.href = `/surah/${s}/#${a}`; });
        return;
      }
      const word = mode !== 'taf' && tabsEl && el.classList.contains('w'); // word texts: stay on the tapped word
      if (!sheet.hidden && a === cur && !(word && el !== anchor)) { closeSheet(); return; } // the same ayah (word) again: close
      if (!word && map[a] && map[a] !== page) load(map[a], { hash: a, open: a });
      else showSheet(a, false, el);
    });
    // a tap anywhere outside the pop-up (except another ayah) only closes it
    document.addEventListener('click', (e) => {
      if (sheet.hidden || sheet.contains(e.target)) return;
      if (linesEl.contains(e.target) && e.target.closest('[data-v]')) return;
      e.stopPropagation(); e.preventDefault();
      closeSheet();
    }, true);

    sheet.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
    backHandlers.push(() => !sheet.hidden && (closeSheet(), true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sheet.hidden) closeSheet();
    });

    bmBtn.addEventListener('click', () => {
      const on = toggleSaved(n, cur, name);
      bmBtn.setAttribute('aria-pressed', String(on));
      toast(on ? 'تم الحفظ' : 'أُزيل من المحفوظات');
    });

    const passageText = async () => {
      let p = '', l = '';
      if (wordMode()) {
        const x = await loadWords(mode, curW.p).then((d) => d[curW.i], () => '');
        return { label: label(cur, cur), title: WKINDS[mode], text: `﴿${curW.t}﴾\n\n${x}\n\n${WKINDS[mode]} · ${WSOURCE}\n${ORIGIN}/surah/${n}/#${cur}` };
      }
      if (kind === 'saadi') {
        const x = sadiFor(cur);
        p = x ? x.ps.map((e) => e.textContent.trim()).join('\n\n') : '';
        l = x ? x.label : '';
      } else {
        const x = extraFor(await loadExtra(kind).catch(() => []), cur);
        p = x ? extraPlain(x.t) : '';
        l = x ? label(x.a, x.b) : '';
      }
      return { label: l, title: KINDS[kind], text: `﴿${ayahs[cur - 1]}﴾\n\n${p}\n\n${KINDS[kind]}\n${ORIGIN}/surah/${n}/#${cur}` };
    };

    const copyText = async (text) => {
      try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
      catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.append(ta);
        ta.select();
        try { document.execCommand('copy'); toast('تم النسخ'); } catch { toast('تعذّر النسخ'); }
        ta.remove();
      }
    };

    $('#taf-copy').addEventListener('click', async () => copyText((await passageText()).text));
    $('#taf-share').addEventListener('click', async () => {
      const { text, label: l, title } = await passageText();
      if (native?.share) { native.share(text); return; }
      if (navigator.share) {
        try { await navigator.share({ title: `${title} · ${name} · ${l}`, text, url: `${ORIGIN}/surah/${n}/#${cur}` }); } catch { /* cancelled */ }
        return;
      }
      copyText(text);
    });

    window.addEventListener('harakat', () => { if (!sheet.hidden) renderTaf(cur); });
    tabsEl?.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b || b.disabled) return;
      mode = b.dataset.mode;
      store.set('pop', mode);
      // a tafsir tab picks that tafsir, like the settings sheet (which listens for 'tafsir')
      if (b.dataset.kind && b.dataset.kind !== kind) {
        store.set('tafsir', b.dataset.kind);
        window.dispatchEvent(new CustomEvent('tafsir', { detail: b.dataset.kind }));
        return;
      }
      renderTaf(cur);
    });
    window.addEventListener('tafsir', (e) => { kind = e.detail; if (!sheet.hidden) renderTaf(cur); });

    /* reader tools: page mark, share, help, fullscreen */
    const markBtn = $('#r-mark');
    const pageAyah = () => (pageData && surahAyahOnPage(pageData)) || 1;
    const syncMark = () => markBtn?.setAttribute('aria-pressed', String(isSaved(n, pageAyah())));
    markBtn?.addEventListener('click', () => {
      const on = toggleSaved(n, pageAyah(), name);
      syncMark();
      toast(on ? 'تم الحفظ في المحفوظات' : 'أُزيل من المحفوظات');
    });
    $('#r-share')?.addEventListener('click', async () => {
      const url = `${ORIGIN}/surah/${n}/#${pageAyah()}`;
      if (native?.share) { native.share(`سورة ${name}\n${url}`); return; }
      if (navigator.share) { try { await navigator.share({ title: `سورة ${name}`, url }); } catch { /* cancelled */ } return; }
      copyText(url);
    });
    $('#r-help')?.addEventListener('click', () => toast('اضغط أي كلمة لعرض تفسيرها، واضغط خارج الكلمات لإظهار القائمة، واسحب الصفحة للتنقل'));
    $('#r-full')?.addEventListener('click', () => {
      if (native) { native.fullscreen(); return; }
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => toast('ملء الشاشة غير متاح'));
    });
    window.addEventListener('pageshown', syncMark);

    // tap the page outside the words: show / hide the bars
    const bar = $('.bar');
    const setBarH = () => document.documentElement.style.setProperty('--bar-h', `${bar?.offsetHeight || 60}px`);
    setBarH();
    document.fonts?.ready.then(() => { fit(); fit(sideLines(-1)); fit(sideLines(1)); place(); });
    // in the app the phone's own status/navigation bars hide and show with ours
    const cut = native?.cutoutTop ? native.cutoutTop() : 0;
    document.documentElement.style.setProperty('--cut-top', `${cut}px`);
    const syncNative = () => native?.immersive?.(!document.body.classList.contains('chrome'));
    syncNative();
    $('.m-frame').addEventListener('click', (e) => {
      if (e.target.closest('[data-v]')) return;
      document.body.classList.toggle('chrome');
      syncNative();
    });
    if (!store.get('hint-bars')) {
      store.set('hint-bars', '1');
      setTimeout(() => toast('اضغط خارج الكلمات لإظهار القائمة'), 600);
    }

    /* The page follows the finger; let go past half the width, or with a flick, and it slides on.
       RTL book order: dragging to the right brings in the next page (it waits on the left). */
    let busy = false;
    const setX = (x, ms = 0) => {
      track.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.75,.25,1)` : 'none';
      track.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    };
    const has = (k) => inBook(page + k);
    /* Another surah without reloading (a reload makes the screen blink): its page HTML is fetched
       (pre-cached) and its data, Saadi templates and nav are swapped into this page. */
    const surahDocs = {};
    async function switchTo(s) {
      surahDocs[s] ||= fetch(`/surah/${s}/`).then((r) => { if (!r.ok) throw new Error('surah'); return r.text(); })
        .catch((e) => { delete surahDocs[s]; throw e; });
      const doc = new DOMParser().parseFromString(await surahDocs[s], 'text/html');
      const m = doc.getElementById('mushaf');
      if (!m) throw new Error('surah');
      for (const k of ['n', 'name', 'full', 'first', 'last', 'pages', 'map', 'passes']) mushaf.dataset[k] = m.dataset[k];
      const ayahEl = $('#m-ayahs');
      $$('template[data-pass]', mushaf).forEach((t) => t.remove());
      $$('template[data-pass]', m).forEach((t) => ayahEl.before(document.importNode(t, true)));
      ayahEl.textContent = doc.getElementById('m-ayahs').textContent;
      const nav = $('.r-nav'), nav2 = doc.querySelector('.r-nav');
      if (nav && nav2) nav.innerHTML = nav2.innerHTML;
      document.title = doc.title;
      readSurah();
      for (const k in extra) delete extra[k];
      history.replaceState(null, '', `/surah/${s}/`); // replace: back still leaves the reader
    }
    // the next surah's first page going forward, the previous surah's last going back
    async function cross(p, done) {
      let s;
      try {
        const d = await getPage(p);
        s = p > last ? d.s.n : d.e.n;
        await switchTo(s);
      } catch {
        if (s) location.replace(`/surah/${s}/?p=${p}`);
        else { done(); toast('تعذّر تحميل الصفحة'); }
        return;
      }
      load(p, { before: done });
    }
    // coming back from the page cache after a cross: the track is still slid over
    addEventListener('pageshow', (e) => { if (e.persisted) { setX(0); busy = false; } });
    function turn(k, from = 0, v = 0) {
      if (busy) return;
      if (!sheet.hidden) closeSheet();
      const W = track.clientWidth;
      if (!has(k)) { setX(0, from ? 220 : 0); return; }
      busy = true;
      const to = k > 0 ? W : -W; // next (k = 1) slides in from the left, so the track moves right
      const rest = Math.abs(to - from);
      const ms = Math.round(Math.max(170, Math.min(340, rest / Math.max(Math.abs(v), W / 340) )));
      if (!from) setX(0);
      requestAnimationFrame(() => setX(to, ms));
      setTimeout(() => {
        const done = () => { setX(0); busy = false; };
        if (page + k < first || page + k > last) cross(page + k, done);
        else load(page + k, { before: done });
      }, ms + 20);
    }

    prevBtn.addEventListener('click', () => turn(-1));
    nextBtn.addEventListener('click', () => turn(1));

    const frameEl = $('.m-frame');
    let drag = null, dragged = false;
    frameEl.addEventListener('pointerdown', (e) => {
      if (busy || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, on: false, pts: [[e.timeStamp, e.clientX]] };
      dragged = false;
    });
    addEventListener('pointermove', (e) => {
      if (!drag || !e.isPrimary) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.on = dragged = true;
        drag.x = e.clientX; // start from here: no jump of 8 px
      }
      drag.dx = e.clientX - drag.x;
      drag.pts.push([e.timeStamp, e.clientX]);
      if (drag.pts.length > 6) drag.pts.shift();
      const k = drag.dx > 0 ? 1 : -1;
      setX(has(k) ? drag.dx : drag.dx * 0.25); // no page there: it only gives a little
    });
    const release = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.on) return;
      const [t0, x0] = d.pts[0];
      const v = e && e.type === 'pointerup' && e.timeStamp > t0 ? (e.clientX - x0) / (e.timeStamp - t0) : 0; // px per ms
      const W = track.clientWidth;
      const k = d.dx > 0 ? 1 : -1;
      const flick = Math.abs(v) > 0.35 && Math.sign(v) === Math.sign(d.dx);
      if (has(k) && (Math.abs(d.dx) > W / 2 || flick)) turn(k, d.dx, v);
      else setX(0, 220);
    };
    addEventListener('pointerup', release);
    addEventListener('pointercancel', release);
    // a drag is not a tap: no word opens, the bars don't toggle
    frameEl.addEventListener('click', (e) => {
      if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
    }, true);

    let rz;
    addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => { setBarH(); fit(); fit(sideLines(-1)); fit(sideLines(1)); place(); }, 150);
    });

    const h = parseInt(location.hash.slice(1), 10);
    const wantsTafsir = new URLSearchParams(location.search).get('t') === '1';
    const atPage = +new URLSearchParams(location.search).get('p');
    if (h >= 1 && h <= count) load(map[h] || first, { hash: h, highlight: h, open: wantsTafsir ? h : 0 });
    else if (atPage >= first && atPage <= last) load(atPage);
    else load(first, { keepHash: true });
  }

  /* ── saved page ────────────────────────────────────── */
  const savedEl = $('#saved');
  if (savedEl) {
    const renderSaved = () => {
      const list = savedList();
      if (!list.length) {
        savedEl.innerHTML = `<div class="empty"><p>لا محفوظات بعد.</p><p>اضغط «حفظ» في نافذة التفسير لحفظ الآية.</p></div>`;
        return;
      }
      savedEl.innerHTML = `<div class="card results" style="overflow:hidden">${
        list.map((x) => `<div class="row" data-n="${x.n}" data-v="${x.v}">
          <a href="/surah/${x.n}/?t=1#${x.v}" style="flex:1;min-width:0;display:block;color:inherit">
            <b>${x.name} · ${ar(x.v)}</b><small>اضغط للقراءة</small>
          </a>
          <button class="iconbtn" data-del aria-label="إزالة">✕</button>
        </div>`).join('')
      }</div>`;
    };
    savedEl.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      const row = del.closest('.row');
      toggleSaved(+row.dataset.n, +row.dataset.v, '');
      renderSaved();
      toast('أُزيل');
    });
    renderSaved();
  }

  /* ── service worker ────────────────────────────────── */
  if ('serviceWorker' in navigator && !native) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* offline only */ });
    });
  }
})();
