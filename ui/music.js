/* NotchNote - pemutar musik + lirik tersinkron */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const M = NN.media = { s: { available: true, has: false }, lyr: null, lines: [], idx: -1 };
  const LEAD = 0.3; // lirik tampil sedikit lebih awal supaya terasa pas dengan suara

  /* ------------------------------------------------------------ jam lagu
     Posisi dari Windows datang tiap 0,5-2,5 detik dan kadang sedikit meleset.
     Jam ini berjalan sendiri dengan mulus; selisih kecil dikejar pelan-pelan,
     selisih besar (lompat/seek, ganti lagu) langsung disamakan. */
  const C = { base: 0, at: performance.now(), rate: 1, playing: false, key: '' };
  const clockNow = () => C.base + (C.playing ? (performance.now() - C.at) / 1000 * C.rate : 0);
  M.sync = function (n) {
    if (!n.has) { C.playing = false; return; }
    const sample = (n.pos || 0) + (n.playing ? Math.max(0, Date.now() - (n.ts || Date.now())) / 1000 : 0);
    const key = (n.title || '') + '|' + (n.artist || '');
    const local = clockNow(), err = sample - local;
    if (key !== C.key || !n.playing || !C.playing || Math.abs(err) > 0.7) { C.base = sample; C.rate = 1; }
    else { C.base = local; C.rate = 1 + NN.clamp(err / 2, -0.12, 0.12); }
    C.at = performance.now(); C.playing = !!n.playing; C.key = key;
  };
  M.setLocal = function (pos, playing) { C.base = pos; C.at = performance.now(); C.rate = 1; if (playing !== undefined) C.playing = playing; M.s.pos = pos; M.s.ts = Date.now(); };
  M.pos = () => {
    const s = M.s; if (!s.has) return 0;
    const p = Math.max(0, clockNow());
    return s.dur ? Math.min(p, s.dur) : p;
  };

  function parseLRC(str) {
    const out = [];
    let shift = 0;
    String(str || '').split(/\r?\n/).forEach(line => {
      const off = line.match(/^\[offset:\s*([+-]?\d+)\]/i); if (off) { shift = +off[1] / 1000; return; }
      const tags = [], re = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
      let m, last = 0;
      while ((m = re.exec(line))) { tags.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.'))); last = re.lastIndex; }
      const text = line.slice(last).replace(/<\d{1,2}:\d{2}(?:\.\d+)?>/g, '').trim();
      tags.forEach(t => out.push({ t, text }));
    });
    out.forEach(l => { l.t = Math.max(0, l.t - shift); });
    out.sort((a, b) => a.t - b.t);
    // jeda musik: baris kosong di tengah lagu, dan intro panjang sebelum baris pertama
    const res = [];
    if (out.length && out[0].t > 6) res.push({ t: 0, text: '', gap: true });
    out.forEach((l, i) => {
      if (!l.text) { const nx = out[i + 1]; if (nx && nx.t - l.t >= 5) res.push({ t: l.t, text: '', gap: true }); return; }
      res.push(l);
    });
    return res;
  }
  M.key = () => (M.s.title || '') + '|' + (M.s.artist || '');
  M.offset = () => { const o = NN.st.ui && NN.st.ui.lyrOff; return (o && o[M.key()]) || 0; };
  M.shift = () => LEAD + M.offset() + (+((NN.cfg.music || {}).lead) || 0);
  M.active = () => {
    const L = M.lines; if (!L.length) return -1;
    const p = M.pos() + M.shift();
    let lo = 0, hi = L.length - 1, i = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (L[mid].t <= p) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    return i;
  };
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + NN.pad(s % 60); };
  const offTxt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + 's';

  NN.page('music', {
    icon: 'music', label: 'Musik',
    size: () => (NN.cfg.music && NN.cfg.music.showLyr === false && M.s.has && !M.s.ad) ? [430, 330] : [700, 380],
    init() {
      M.cache = {};
      NN.on('media', s => {
        const o = M.s, n = JSON.parse(s);
        if (n.art === undefined) n.art = o.art;
        const key = (n.title || '') + '|' + (n.artist || '');
        // lagu benar-benar berganti? ("tidak ada lagu" sesaat tidak dihitung, supaya lirik tidak hilang)
        const changed = n.has && key !== M.curKey;
        if (n.has) M.curKey = key;
        M.s = n; M.sync(n);
        if (changed) {
          const c = M.cache[key];
          M.lyr = c || null; M.lines = c ? c.lines : []; M.idx = -1; this.searchOpen = false; this.results = null;
          // lirik belum datang dalam 4 detik: minta lagi ke aplikasi
          clearTimeout(this._lt);
          if (!c) this._lt = setTimeout(() => { if (M.curKey === key && (!M.lyr || M.lyr.status === 'loading')) NN.call('lyricsGet'); }, 4000);
        }
        if (this.visible()) { if (changed || o.has !== n.has || o.ad !== n.ad || o.art !== n.art) this.render(this.el); else this.refresh(true); }
      });
      NN.on('lyrics', s => {
        const l = JSON.parse(s);
        if (l.key !== M.key()) return;
        // lirik yang sudah ada jangan ditimpa status "mencari" dari permintaan ulang
        if (l.status === 'loading' && M.lyr && M.lyr.status === 'ok') return;
        l.lines = l.synced ? parseLRC(l.synced) : [];
        if (l.status !== 'loading' && l.status !== 'error') M.cache[l.key] = l;
        // server lirik sedang sibuk: coba lagi otomatis sekali setelah 15 detik
        if (l.status === 'error' && !(M.retried || {})[l.key]) {
          M.retried = M.retried || {}; M.retried[l.key] = 1;
          setTimeout(() => { if (M.key() === l.key && M.lyr && M.lyr.status === 'error') NN.call('lyricsRetry'); }, 15000);
        }
        M.lyr = l; M.lines = l.lines; M.idx = -1;
        if (this.visible()) this.render(this.el);
      });
      NN.on('lyricsResults', s => {
        const r = JSON.parse(s);
        if (r.key !== M.key()) return;
        this.results = r.results; this.searching = false;
        if (this.visible()) this.render(this.el);
      });
    },
    visible() { return NN.isl.page === 'music' && NN.isl.view === 'page' && this.el; },
    render(el) {
      this.el = el;
      const s = M.s;
      if (!s.available) {
        el.innerHTML = head() + '<div class="empty">' + icon('music', 30) + '<b>Kontrol musik belum aktif</b><span>Paket media Windows belum terpasang. Jalankan di Command Prompt:<br>' +
          '<span class="kbd">py -m pip install winrt-Windows.Media.Control winrt-Windows.Storage.Streams</span></span></div>';
        return;
      }
      if (!s.has) {
        el.innerHTML = head() + '<div class="empty">' + icon('music', 30) + '<b>Tidak ada yang diputar</b><span>Putar lagu di Spotify, YouTube Music, atau browser.<br>Judul, kontrol, dan liriknya akan muncul di sini.</span></div>';
        return;
      }
      if (s.ad) {
        el.innerHTML = head(s.source || s.app) + '<div class="empty">' + (NN.cfg.mascot.on ? NN.owl(60, { live: true }) : icon('music', 30)) +
          '<b>Iklan sedang diputar</b><span>Lirik dan judul lagu akan muncul lagi setelah iklannya selesai.</span></div>';
        return;
      }
      const mc = NN.cfg.music || {};
      const artBg = s.art && mc.artBg !== false;
      const art = s.art ? ' style="background-image:url(\'' + esc(s.art) + '\')"' : '';
      const showLyr = mc.showLyr !== false;
      el.innerHTML = head(s.source || s.app) +
        '<div class="mus' + (artBg ? ' has-art' : '') + (showLyr ? '' : ' nolyr') + ' ls-' + (mc.lyrSize || 'm') + '">' +
        (artBg ? '<div class="mus-bg"' + art + '></div>' : '') +
        '<div class="mus-l">' +
          '<div class="mus-h"><div class="art ' + (s.playing ? 'play' : 'paused') + '" id="mArt"' + art + '>' + (s.art ? '' : icon('music', 22)) + '</div>' +
          '<div class="mus-t"><b title="' + esc(s.title) + '">' + esc(s.title) + '</b><span>' + esc(s.artist || '—') + '</span></div>' +
          '<div class="eq' + (s.playing ? ' on' : '') + '" id="mEq"><i></i><i></i><i></i><i></i></div></div>' +
          '<div class="mus-p"><span id="mPos">0:00</span><div class="bar' + (s.canSeek ? ' seek' : '') + '" id="mBar" title="' + (s.canSeek ? 'Klik untuk lompat' : '') + '"><i id="mFill"></i></div><span id="mLeft">' + (s.dur ? '-' + fmt(s.dur) : '') + '</span></div>' +
          '<div class="mus-c"><button class="ibtn" data-m="prev" title="Sebelumnya">' + icon('prev', 22) + '</button>' +
          '<button class="ibtn playb" data-m="toggle" id="mPlay" title="Putar/jeda">' + icon(s.playing ? 'pause' : 'play', 22) + '</button>' +
          '<button class="ibtn" data-m="next" title="Berikutnya">' + icon('next', 22) + '</button>' +
          '<button class="ibtn lyrtog' + (showLyr ? ' on' : '') + '" data-lyrtog title="' + (showLyr ? 'Sembunyikan lirik' : 'Tampilkan lirik') + '">' + icon('lines', 18) + '</button></div>' +
        '</div>' +
        (showLyr ? '<div class="mus-r">' + this.lyricsHtml() + '</div>' : '') + '</div>';
      this.bind(el);
      M.idx = -2;
      this.refresh(true);
    },
    bind(el) {
      const s = M.s, self = this;
      const view = NN.$('#lyrView', el);
      if (view) {
        view.addEventListener('wheel', e => {
          e.preventDefault();
          self.free = Date.now() + 3500;
          self.drift = NN.clamp((self.drift || 0) - e.deltaY * 0.6, -self.maxDrift(), self.maxDrift());
          view.classList.add('free'); self.place(true);
          clearTimeout(self._free); self._free = setTimeout(() => { self.free = 0; self.drift = 0; view.classList.remove('free'); self.place(); }, 3500);
        }, { passive: false });
      }
      el.onclick = e => {
        if (e.target.closest('[data-lyrtog]')) {
          NN.cfg.music.showLyr = NN.cfg.music.showLyr === false;
          NN.save('cfg'); self.render(el); NN.retarget();
          return;
        }
        const b = e.target.closest('[data-m]');
        if (b) {
          NN.call('mediaCmd', b.dataset.m);
          if (b.dataset.m === 'toggle') { M.s.playing = !M.s.playing; M.setLocal(M.pos(), M.s.playing); self.refresh(true); }
          return;
        }
        const ly = e.target.closest('.ly[data-t]');
        if (ly && !ly.classList.contains('gap')) {
          if (!s.canSeek) { NN.toast('Pemutar ini tidak mendukung lompat waktu', 'info', 'var(--warn)'); return; }
          const t = Math.max(0, +ly.dataset.t - M.shift() + 0.05);
          NN.call('seek', t); M.setLocal(t); self.free = 0; self.drift = 0; const v = NN.$('#lyrView', el); if (v) v.classList.remove('free'); self.refresh(true); return;
        }
        const bar = e.target.closest('#mBar');
        if (bar && s.canSeek && s.dur) { const r = bar.getBoundingClientRect(); const t = NN.clamp((e.clientX - r.left) / r.width, 0, 1) * s.dur; NN.call('seek', t); M.setLocal(t); self.refresh(true); return; }
        const lb = e.target.closest('[data-lyr]');
        if (!lb) return;
        const k = lb.dataset.lyr;
        if (k === 'retry') { NN.call('lyricsRetry'); M.lyr = { status: 'loading' }; self.results = null; self.render(el); }
        else if (k === 'find') { self.searchOpen = true; self.render(el); const q = NN.$('#lyrQ', el); if (q) { NN.call('activate'); q.focus(); q.select(); } }
        else if (k === 'close') { self.searchOpen = false; self.results = null; self.render(el); }
        else if (k === 'go') self.search();
        else if (k === 'pick') { NN.call('lyricsPick', +lb.dataset.id); self.searchOpen = false; self.results = null; M.lyr = { status: 'loading' }; self.render(el); }
        else if (k === 'tap') self.tapSync();
        else if (k === 'off-' || k === 'off+' || k === 'off0') self.setOffset(k === 'off0' ? 0 : M.offset() + (k === 'off+' ? 0.25 : -0.25));
      };
      const q = NN.$('#lyrQ', el);
      if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') self.search(); });
    },
    setOffset(v) {
      v = Math.round(NN.clamp(v, -30, 30) * 100) / 100;
      const ui = NN.st.ui; ui.lyrOff = ui.lyrOff || {};
      if (v) ui.lyrOff[M.key()] = v; else delete ui.lyrOff[M.key()];
      NN.save('ui'); M.idx = -2;
      const o = NN.$('#lyrOff', this.el); if (o) o.textContent = offTxt(v);
      this.refresh(true);
    },
    /* ketuk tepat saat penyanyi mulai menyanyikan sebuah baris: waktu lirik disamakan dengan lagu */
    tapSync() {
      const L = M.lines.filter(l => !l.gap); if (!L.length) return;
      const now = M.pos(), cur = now + M.shift();
      let best = null;
      L.forEach(l => { const d = l.t - cur; if (d > -4 && d < 6 && (!best || Math.abs(d) < Math.abs(best.t - cur))) best = l; });
      if (!best) { NN.toast('Ketuk saat sebuah baris mulai dinyanyikan', 'info', 'var(--warn)'); return; }
      const v = best.t - now - LEAD - (+((NN.cfg.music || {}).lead) || 0);
      this.setOffset(v);
      NN.toast('Lirik disamakan (' + offTxt(Math.round(v * 100) / 100) + ')', 'check');
    },
    search() {
      const q = NN.$('#lyrQ', this.el); if (!q) return;
      const v = q.value.trim();
      if (v.length < 2) { q.classList.add('err'); q.focus(); return; }
      this.lastQ = v; this.searching = true; this.results = null;
      NN.call('lyricsSearch', v); this.render(this.el);
    },
    searchHtml() {
      const l = M.lyr || {}, s = M.s;
      const def = this.lastQ || l.query || ((s.artist ? s.artist + ' - ' : '') + (s.title || ''));
      let list = '';
      if (this.searching) list = '<div class="faint" style="padding:10px 4px">Mencari…</div>';
      else if (this.results && !this.results.length) list = '<div class="faint" style="padding:10px 4px">Tidak ada hasil. Coba tulis judul saja, atau periksa ejaan.</div>';
      else if (this.results) list = this.results.map(r => {
        const dd = r.dur && s.dur ? Math.abs(r.dur - s.dur) : null;
        return '<button class="lres" data-lyr="pick" data-id="' + r.id + '"><b>' + esc(r.track) + '</b><span>' + esc(r.artist || '') +
          (r.dur ? ' · ' + fmt(r.dur) + (dd !== null && dd <= 3 ? ' · durasi cocok' : '') : '') + '</span>' + (r.synced ? '<i class="pill ok">tersinkron</i>' : '<i class="pill">teks</i>') + '</button>';
      }).join('');
      return '<div class="lsearch"><div class="keyrow"><input id="lyrQ" class="inp" value="' + esc(def) + '" placeholder="Artis - judul lagu" spellcheck="false">' +
        '<button class="btn sm pri" data-lyr="go">Cari</button><button class="ibtn" data-lyr="close" title="Tutup">' + icon('x', 15) + '</button></div>' +
        '<div class="lres-list scroll">' + list + '</div></div>';
    },
    lyricsHtml() {
      const l = M.lyr;
      if (this.searchOpen) return this.searchHtml();
      if (!l || l.status === 'loading') return '<div class="empty">' + icon('lines', 24) + '<span>Mencari lirik…</span></div>';
      if (l.status === 'error') return '<div class="empty">' + icon('warning', 24) + '<b>Gagal memuat lirik</b><span>Periksa koneksi internet.</span><button class="btn sm" data-lyr="retry">Coba lagi</button></div>';
      if (l.status === 'none' || (!M.lines.length && !l.plain)) return '<div class="empty">' + icon('lines', 24) + '<b>Lirik tidak ditemukan</b><span>' +
        (l.instrumental ? 'Lagu ini instrumental.' : 'Judul dari pemutar kadang berbeda dengan judul aslinya. Coba cari manual.') + '</span>' +
        '<div style="display:flex;gap:6px"><button class="btn sm pri" data-lyr="find">' + icon('search', 14) + 'Cari manual</button><button class="btn sm" data-lyr="retry">' + icon('refresh', 14) + 'Coba lagi</button></div></div>';
      const synced = M.lines.length > 0, off = M.offset();
      const durWarn = synced && l.ldur && M.s.dur && Math.abs(l.ldur - M.s.dur) > 6;
      const headH = '<div class="lhead"><b>Lirik</b>' + (synced ? '<span class="lsync" title="' + esc(l.match || '') + '">LIVE SYNC</span>' : '<span class="lsync off">TEKS</span>') +
        (durWarn ? '<span class="pill warn" title="Durasi lagu di pemutar (' + fmt(M.s.dur) + ') berbeda dengan lirik (' + fmt(l.ldur) + '). Versi video klip sering punya intro lebih panjang. Pakai tombol ketuk untuk menyamakan.">versi beda</span>' : '') +
        '<div class="sp"></div>' +
        (synced ? '<button class="ibtn sm" data-lyr="tap" title="Ketuk tepat saat penyanyi mulai menyanyikan baris berikutnya untuk menyamakan waktu lirik">' + icon('target', 15) + '</button>' +
          '<div class="offc" title="Geser waktu lirik lagu ini"><button data-lyr="off-" title="Lirik lebih lambat">' + icon('minus', 12) + '</button><span id="lyrOff" data-lyr="off0" title="Klik untuk reset">' + offTxt(off) + '</span><button data-lyr="off+" title="Lirik lebih cepat">' + icon('plus', 12) + '</button></div>' : '') +
        '<button class="ibtn sm" data-lyr="find" title="Lirik salah? Cari yang benar">' + icon('search', 15) + '</button></div>';
      if (synced) return headH + '<div class="lview" id="lyrView"><div class="ltrack" id="lyrTrack">' + M.lines.map((x, i) =>
        '<div class="ly' + (x.gap ? ' gap' : '') + '" data-i="' + i + '" data-t="' + x.t.toFixed(2) + '">' + (x.gap ? '<i></i><i></i><i></i>' : esc(x.text)) + '</div>').join('') + '</div></div>';
      return headH + '<div class="lview plain scroll" id="lyrPlain">' + l.plain.split('\n').map(x => '<div class="ly">' + (esc(x) || '&nbsp;') + '</div>').join('') + '</div>';
    },
    maxDrift() { const t = NN.$('#lyrTrack', this.el); return t ? t.offsetHeight : 0; },
    /* geser lirik supaya baris aktif ada di sekitar sepertiga atas */
    place(instant) {
      const view = NN.$('#lyrView', this.el), track = NN.$('#lyrTrack', this.el); if (!view || !track) return;
      const i = Math.max(0, M.idx), cur = track.children[i]; if (!cur) return;
      const y = view.clientHeight * 0.36 - cur.offsetTop - cur.offsetHeight / 2 + (this.free ? (this.drift || 0) : 0);
      track.classList.toggle('instant', !!instant);
      track.style.transform = 'translate3d(0,' + Math.round(y) + 'px,0)';
    },
    refresh(force) {
      const el = this.el, s = M.s; if (!el || !s.has) return;
      const p = M.pos();
      const fill = NN.$('#mFill', el), pos = NN.$('#mPos', el), left = NN.$('#mLeft', el), play = NN.$('#mPlay', el), art = NN.$('#mArt', el), eq = NN.$('#mEq', el);
      if (fill) fill.style.transform = 'scaleX(' + (s.dur ? NN.clamp(p / s.dur, 0, 1) : 0) + ')';
      if (pos) pos.textContent = fmt(p);
      if (left && s.dur) left.textContent = '-' + fmt(s.dur - p);
      if (force) {
        if (play) { const want = s.playing ? 'pause' : 'play'; if (play._i !== want) { play._i = want; play.innerHTML = icon(want, 22); } }
        if (art) art.className = 'art ' + (s.playing ? 'play' : 'paused');
        if (eq) eq.classList.toggle('on', !!s.playing);
      }
      const track = NN.$('#lyrTrack', el);
      if (!track || !M.lines.length) return;
      const i = M.active();
      if (i !== M.idx || force) {
        const first = M.idx === -2;
        M.idx = i;
        const kids = track.children;
        for (let k = 0; k < kids.length; k++) {
          const d = k - Math.max(0, i), n = kids[k];
          n.className = 'ly' + (M.lines[k].gap ? ' gap' : '') + (k === i ? ' on' : '') + ' d' + Math.min(3, Math.abs(d)) + (d < 0 ? ' past' : '');
        }
        if (!this.free) this.place(first);
      }
      // titik-titik jeda musik terisi sesuai sisa waktu
      const cur = i >= 0 && M.lines[i].gap ? track.children[i] : null;
      if (cur) {
        const nx = M.lines[i + 1], t0 = M.lines[i].t, t1 = nx ? nx.t : t0 + 5, f = NN.clamp((p + M.shift() - t0) / Math.max(0.5, t1 - t0), 0, 1);
        cur.style.setProperty('--gp', f.toFixed(3));
      }
    },
    loop() {
      cancelAnimationFrame(this.raf);
      let last = 0;
      const tick = ts => {
        if (!this.visible()) return;
        if (ts - last > 33) { last = ts; this.refresh(); }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },
    shown() { this.loop(); this.place(true); },
    hide() { cancelAnimationFrame(this.raf); },
  });
  function head(app) {
    return '<div class="hdr"><h2>' + icon('music', 20) + 'Musik</h2>' + (app ? NN.srcBadge(app, true) : '') + '<div class="sp"></div></div>';
  }

  // lencana sumber pemutar (teks + warna, bukan logo); hanya di halaman Musik
  NN.SRC = {
    'YouTube Music': ['YT Music', 'YouTube Music', '#ff0033'], 'YouTube': ['YT', 'YouTube', '#ff0033'], 'Spotify': ['Spotify', 'Spotify', '#1db954'],
    'SoundCloud': ['SC', 'SoundCloud', '#ff5500'], 'Apple Music': ['Apple', 'Apple Music', '#fa2d48'], 'JOOX': ['JOOX', 'JOOX', '#16c784'],
    'Deezer': ['Deezer', 'Deezer', '#a238ff'], 'Chrome': ['Chrome', 'Chrome', '#4285f4'], 'Edge': ['Edge', 'Edge', '#0c8ce9'],
    'Firefox': ['Firefox', 'Firefox', '#ff7139'], 'Brave': ['Brave', 'Brave', '#fb542b'], 'Opera': ['Opera', 'Opera', '#ff1b2d'],
  };
  NN.srcBadge = function (src, full) {
    const d = NN.SRC[src] || [String(src || 'Media').slice(0, 10), String(src || 'Media'), '#71717a'];
    return '<span class="src" style="--sc:' + d[2] + '" title="Diputar dari ' + esc(d[1]) + '">' + esc(full ? d[1] : d[0]) + '</span>';
  };
  const waves = () => '<div class="waves"><i></i><i></i><i></i><i></i><i></i></div>';

  // lirik di notch kecil
  NN.slot('music', {
    label: 'Lirik / musik',
    render(vert) {
      const s = M.s;
      if (!s.has || !s.playing || s.ad) return null;
      if (vert) return { kind: 'music', html: '<span class="c-stat" style="color:var(--acc-text)">' + icon('music', 16) + '</span>' };
      if (NN.cfg.notch.lyrics && M.lines.length) {
        const i = M.active(), L = i >= 0 ? M.lines[i] : null;
        // visualizer kecil tetap tampil di samping baris lirik
        if (L && L.gap) return { kind: 'music', html: waves() + '<span class="lyr gapdots" data-i="' + i + '"><i></i><i></i><i></i></span>' };
        if (L && L.text) return { kind: 'music', html: waves() + '<span class="lyr" data-i="' + i + '">' + esc(L.text) + '</span>' };
      }
      return { kind: 'music', html: '<span class="c-title">' + esc(s.title) + '</span>' + waves() };
    },
  });
  NN.compactProvider(vert => {
    const s = M.s;
    if (!s.has || !s.playing || s.ad) return null;
    return { prio: 3, kind: 'music', html: vert ? '<span style="color:var(--acc-text)">' + icon('music', 15) + '</span>' : waves() };
  });
  let lastIdx = -9;
  setInterval(() => {
    if (!NN.ready || NN.isl.view !== 'compact' || !M.s.playing || !M.lines.length || !NN.cfg.notch.lyrics) return;
    const i = M.active(); if (i !== lastIdx) { lastIdx = i; NN.renderCompact(); }
  }, 100);
})();
