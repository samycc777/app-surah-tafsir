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
    const n = +mushaf.dataset.n;
    const name = mushaf.dataset.name;
    const full = mushaf.dataset.full === 'true';
    const first = +mushaf.dataset.first;
    const last = +mushaf.dataset.last;
    const pages = JSON.parse(mushaf.dataset.pages);
    const map = JSON.parse(mushaf.dataset.map);
    const passes = JSON.parse(mushaf.dataset.passes);
    const ayahs = JSON.parse($('#m-ayahs').textContent);
    const count = ayahs.length;
    const sheet = $('#taf');
    const bodyEl = $('#taf-body');
    const ayahBox = $('#taf-ayah');
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

    const tplFor = (i) => document.querySelector(`template[data-pass="${i}"]`);
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

    function renderPage(d) {
      const rows = d.rows.map((r) => (r.words ? { words: r.words.map((w) => ({ ...w })) } : r));
      let last = null;
      for (const r of rows) {
        if (r.band || r.bas) { last = null; continue; }
        if (!r.words) continue;
        while (r.words.length && (r.words[0].k === 'pause' || r.words[0].k === 'sajdah')) {
          const mark = r.words.shift();
          if (last) last.t += ` ${mark.t}`;
        }
        if (r.words.length) last = r.words[r.words.length - 1];
      }
      const textRows = rows.filter((r) => r.words && r.words.length).length;
      linesEl.classList.toggle('sparse', textRows <= 8);
      linesEl.innerHTML = rows.map((r) => {
        if (r.band) return `<div class="m-band"><span><b>سورة ${esc(r.band.name)}</b></span></div>`;
        if (r.bas) return `<div class="m-bas">${BASMALA}</div>`;
        if (r.blank) return `<div class="m-line blank"></div>`;
        const raw = r.words || [];
        const ws = [];
        for (const w of raw) {
          if ((w.k === 'pause' || w.k === 'sajdah') && ws.length) {
            ws[ws.length - 1].t += ` ${w.t}`;
          } else {
            ws.push({ t: w.t, v: w.v, k: w.k });
          }
        }
        const basmala = ws.length && ws.every((w) => w.v === '1:1');
        const center = ws.length <= 3 || basmala ? ' center' : '';
        return `<div class="m-line${center}">` + ws.map((w) => {
          if (w.k === 'end') {
            return `<span class="m-num" data-v="${w.v}" role="button" tabindex="0" aria-label="الآية ${w.v.split(':')[1]}">${esc(w.t)}</span>`;
          }
          if (w.k === 'pause' || w.k === 'sajdah') {
            return `<span class="m-pause" data-v="${w.v}">${esc(w.t)}</span>`;
          }
          return `<span class="w" data-v="${w.v}">${esc(w.t)}</span>`;
        }).join('') + `</div>`;
      }).join('');
      fit();
    }

    function setHead(d) {
      const a = d.s, b = d.e;
      startEl.textContent = a.n === b.n
        ? `${a.name} ${ar(a.a)}–${ar(b.a)}`
        : `${a.name} ${ar(a.a)} · ${b.name} ${ar(b.a)}`;
      pageEl.textContent = ar(d.p);
      juzEl.textContent = d.juz ? `الجزء ${ar(d.juz)}` : '';
      const i = pages.indexOf(d.p);
      countEl.textContent = `الصفحة ${ar((i < 0 ? 0 : i) + 1)} من ${ar(pages.length)}`;
      prevBtn.disabled = d.p <= first;
      nextBtn.disabled = d.p >= last;
    }

    function fit() {
      linesEl.style.fontSize = '';
      let size = parseFloat(getComputedStyle(linesEl).fontSize);
      for (let i = 0; i < 30; i++) {
        const over = [...linesEl.querySelectorAll('.m-line')].some((l) => l.scrollWidth > l.clientWidth + 1);
        if (!over || size < 11) break;
        size -= 0.4;
        linesEl.style.fontSize = `${size}px`;
      }
    }

    function highlight(v) {
      $$('.w.on, .m-num.on, .m-pause.on').forEach((e) => e.classList.remove('on'));
      $$(`[data-v="${n}:${v}"]`, linesEl).forEach((e) => e.classList.add('on'));
    }

    function renderTaf(v) {
      const t = tplFor(passes[v - 1]);
      bodyEl.innerHTML = t ? t.innerHTML : '';
      if (!harakat) strip(bodyEl);
      ayahBox.textContent = `${ayahs[v - 1]} ﴿${ar(v)}﴾`;
      sub.textContent = t ? `${name} · ${label(+t.dataset.a, +t.dataset.b)}` : name;
      note.hidden = full;
      highlight(v);
      $('#taf-prev').disabled = v <= 1;
      $('#taf-next').disabled = v >= count;
      const on = isSaved(n, v);
      bmBtn.setAttribute('aria-pressed', String(on));
      $('.sheet-body', sheet).scrollTop = 0;
    }

    function showSheet(v, scroll) {
      if (v < 1 || v > count) return;
      cur = v;
      renderTaf(v);
      sheet.hidden = false;
      document.body.style.overflow = 'hidden';
      history.replaceState(null, '', `${location.pathname}#${v}`);
      remember(v);
      if (scroll) {
        const el = $(`[data-v="${n}:${v}"]`, linesEl);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    function closeSheet() {
      sheet.hidden = true;
      document.body.style.overflow = '';
      $$('.on').forEach((e) => e.classList.remove('on'));
      const a = pageData ? surahAyahOnPage(pageData) : null;
      history.replaceState(null, '', a ? `${location.pathname}#${a}` : location.pathname);
    }

    async function load(p, opts = {}) {
      if (p < first || p > last) return;
      const my = ++req;
      let d;
      try {
        const res = await fetch(`/mushaf/pages/${p}.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error('page');
        d = await res.json();
      } catch {
        if (my === req) toast('تعذّر تحميل الصفحة');
        return;
      }
      if (my !== req) return;
      page = p;
      pageData = d;
      renderPage(d);
      setHead(d);
      window.dispatchEvent(new Event('pageshown'));
      const a = surahAyahOnPage(d);
      if (opts.hash) history.replaceState(null, '', `${location.pathname}#${opts.hash}`);
      else if (!opts.keepHash && a) history.replaceState(null, '', `${location.pathname}#${a}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (opts.open) { showSheet(opts.open, false); }
      else {
        if (opts.highlight) {
          highlight(opts.highlight);
          const el = $(`[data-v="${n}:${opts.highlight}"]`, linesEl);
          if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        remember(opts.highlight || a || d.s.a);
      }
    }

    function open(v, scroll) {
      if (v < 1 || v > count) return;
      const p = map[v];
      if (p && p !== page) load(p, { hash: v, open: v });
      else showSheet(v, scroll);
    }

    linesEl.addEventListener('click', (e) => {
      const el = e.target.closest('[data-v]');
      if (!el) return;
      const [s, a] = el.dataset.v.split(':').map(Number);
      if (s !== n) { location.href = `/surah/${s}/#${a}`; return; }
      if (map[a] && map[a] !== page) load(map[a], { hash: a, open: a });
      else showSheet(a, false);
    });

    sheet.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
    backHandlers.push(() => !sheet.hidden && (closeSheet(), true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sheet.hidden) closeSheet();
    });
    $('#taf-prev').addEventListener('click', () => open(cur - 1, true));
    $('#taf-next').addEventListener('click', () => open(cur + 1, true));

    bmBtn.addEventListener('click', () => {
      const on = toggleSaved(n, cur, name);
      bmBtn.setAttribute('aria-pressed', String(on));
      toast(on ? 'تم الحفظ' : 'أُزيل من المحفوظات');
    });

    const passageText = () => {
      const t = tplFor(passes[cur - 1]);
      const p = t ? [...t.content.querySelectorAll('p')].map((x) => x.textContent.trim()).join('\n\n') : '';
      return {
        label: t ? label(+t.dataset.a, +t.dataset.b) : '',
        text: `﴿${ayahs[cur - 1]}﴾\n\n${p}\n\n${ORIGIN}/surah/${n}/#${cur}`,
      };
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

    $('#taf-copy').addEventListener('click', () => copyText(passageText().text));
    $('#taf-share').addEventListener('click', async () => {
      const { text, label: l } = passageText();
      if (native?.share) { native.share(text); return; }
      if (navigator.share) {
        try { await navigator.share({ title: `تفسير السعدي · ${name} · ${l}`, text, url: `${ORIGIN}/surah/${n}/#${cur}` }); } catch { /* cancelled */ }
        return;
      }
      copyText(text);
    });

    window.addEventListener('harakat', () => { if (!sheet.hidden) renderTaf(cur); });

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
    $('#r-help')?.addEventListener('click', () => toast('اضغط أي كلمة لعرض تفسيرها، واسحب الصفحة للتنقل'));
    $('#r-full')?.addEventListener('click', () => {
      if (native) { native.fullscreen(); return; }
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => toast('ملء الشاشة غير متاح'));
    });
    window.addEventListener('pageshown', syncMark);

    prevBtn.addEventListener('click', () => load(page - 1));
    nextBtn.addEventListener('click', () => load(page + 1));

    // swipe the page horizontally (RTL: right = previous page)
    let sx = 0, sy = 0;
    linesEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    linesEl.addEventListener('touchend', (e) => {
      if (!e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) load(page + (dx > 0 ? -1 : 1));
    }, { passive: true });

    let rz;
    addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(fit, 150);
    });

    const h = parseInt(location.hash.slice(1), 10);
    const wantsTafsir = new URLSearchParams(location.search).get('t') === '1';
    if (h >= 1 && h <= count) load(map[h] || first, { hash: h, highlight: h, open: wantsTafsir ? h : 0 });
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
