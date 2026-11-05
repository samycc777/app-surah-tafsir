(() => {
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const en = (s) => String(s).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
  const $ = (s, r = document) => r.querySelector(s);
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

  /* ── home: continue reading ────────────────────────── */
  const resume = $('#resume');
  if (resume) {
    try {
      const last = JSON.parse(store.get('last') || 'null');
      if (last && last.n >= 1 && last.n <= 114) {
        resume.hidden = false;
        resume.href = `/surah/${last.n}/#${last.v}`;
        resume.querySelector('small').textContent = `سورة ${last.name} · الآية ${ar(last.v)}`;
      }
    } catch { /* ignore */ }
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

  /* ── reader ────────────────────────────────────────── */
  const rhead = $('#rhead');
  if (rhead) {
    const n = +rhead.dataset.n;
    const name = rhead.dataset.name;
    const count = +rhead.dataset.count;
    const full = rhead.dataset.full === 'true';
    const ayahs = $('#ayahs');
    const spans = $$('.ay', ayahs);
    const sheet = $('#taf');
    const body = $('#taf-body');
    const ayahBox = $('#taf-ayah');
    const sub = $('#taf-sub');
    const note = $('#taf-note');
    const bmBtn = $('#taf-bookmark');
    let cur = 0;

    const tplFor = (i) => document.querySelector(`template[data-pass="${i}"]`);

    const label = (a, b) => (a === b ? `الآية ${ar(a)}` : `الآيات ${ar(a)}–${ar(b)}`);

    function render(v) {
      const span = spans[v - 1];
      if (!span) return;
      cur = v;
      const t = tplFor(+span.dataset.p);
      body.innerHTML = t ? t.innerHTML : '';
      if (!harakat) strip(body);
      const txt = span.childNodes[0] ? span.childNodes[0].textContent.trim() : span.textContent.trim();
      ayahBox.textContent = `${txt} ﴿${ar(v)}﴾`;
      sub.textContent = t ? `${name} · ${label(+t.dataset.a, +t.dataset.b)}` : name;
      note.hidden = full;
      spans.forEach((s) => s.classList.remove('on'));
      span.classList.add('on');
      $('#taf-prev').disabled = v <= 1;
      $('#taf-next').disabled = v >= count;
      const on = isSaved(n, v);
      bmBtn.setAttribute('aria-pressed', String(on));
    }

    function open(v, jump = false) {
      if (v < 1 || v > count) return;
      sheet.hidden = false;
      document.body.style.overflow = 'hidden';
      render(v);
      body.scrollTop = 0;
      history.replaceState(null, '', `#${v}`);
      if (jump) spans[v - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
      remember(v);
    }

    function close() {
      sheet.hidden = true;
      document.body.style.overflow = '';
      spans.forEach((s) => s.classList.remove('on'));
      history.replaceState(null, '', location.pathname + location.search);
    }

    const remember = (v) => store.set('last', JSON.stringify({ n, v, name }));

    ayahs.addEventListener('click', (e) => {
      const a = e.target.closest('.ay');
      if (a) open(+a.dataset.v);
    });

    sheet.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sheet.hidden) close();
    });

    $('#taf-prev').addEventListener('click', () => open(cur - 1));
    $('#taf-next').addEventListener('click', () => open(cur + 1));

    bmBtn.addEventListener('click', () => {
      const on = toggleSaved(n, cur, name);
      bmBtn.setAttribute('aria-pressed', String(on));
      toast(on ? 'تم الحفظ' : 'أُزيل من المحفوظات');
    });

    const passageText = () => {
      const t = tplFor(+spans[cur - 1].dataset.p);
      const p = t ? [...t.content.querySelectorAll('p')].map((x) => x.textContent.trim()).join('\n\n') : '';
      const txt = spans[cur - 1].childNodes[0].textContent.trim();
      return {
        label: label(+t.dataset.a, +t.dataset.b),
        text: `﴿${txt}﴾\n\n${p}\n\n${location.origin}/surah/${n}/#${cur}`,
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
      if (navigator.share) {
        try { await navigator.share({ title: `تفسير السعدي · ${name} · ${l}`, text, url: `${location.origin}/surah/${n}/#${cur}` }); } catch { /* cancelled */ }
        return;
      }
      copyText(text);
    });

    window.addEventListener('harakat', () => { if (!sheet.hidden) render(cur); });

    // drag the sheet down to close it
    const sheetEl = sheet.querySelector('.sheet');
    let startY = null, dy = 0;
    const grab = sheet.querySelector('.grab');
    const onDown = (e) => {
      if (e.target.closest('button')) return;
      startY = e.clientY;
      dy = 0;
      sheetEl.style.transition = 'none';
    };
    const onMove = (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      sheetEl.style.transform = `translateY(${dy}px)`;
    };
    const onUp = () => {
      if (startY === null) return;
      startY = null;
      sheetEl.style.transition = '';
      sheetEl.style.transform = '';
      if (dy > 90) close();
      dy = 0;
    };
    [grab, sheet.querySelector('.sheet-head')].forEach((el) => {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });

    // remember the last ayah at the top of the viewport
    let timer;
    addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!sheet.hidden) return;
        const y = 140;
        const s = spans.find((x) => x.getBoundingClientRect().bottom > y);
        if (s && window.scrollY > 60) remember(+s.dataset.v);
      }, 600);
    }, { passive: true });

    if (!store.get('hint')) {
      store.set('hint', '1');
      setTimeout(() => { if (sheet.hidden) toast('اضغط أي آية لعرض تفسيرها'); }, 1200);
    }

    // deep link: /surah/2/#255
    const h = parseInt(location.hash.slice(1), 10);
    if (h >= 1 && h <= count) open(h, true);
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
          <a href="/surah/${x.n}/#${x.v}" style="flex:1;min-width:0;display:block;color:inherit">
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
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* offline only */ });
    });
  }
})();
