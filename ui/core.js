/* NotchNote - inti: utilitas, bridge, state, mesin notch, navigasi, notifikasi */
(function () {
  'use strict';
  const NN = window.NN = { pages: {}, st: {}, tickers: [], compactProviders: [], ready: false };

  // ------------------------------------------------------------------ utilitas
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  Object.assign(NN, {
    $, $$, pad,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    iso: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    today: () => NN.iso(new Date()),
    parseISO: s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
    addDays: (s, n) => { const d = NN.parseISO(s); d.setDate(d.getDate() + n); return NN.iso(d); },
    hm: d => pad(d.getHours()) + ':' + pad(d.getMinutes()),
    HARI: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    HR: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    BULAN: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    BLN: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  });
  NN.dayLabel = function (s, long) {
    const t = NN.today();
    if (s === t) return 'Hari ini';
    if (s === NN.addDays(t, 1)) return 'Besok';
    if (s === NN.addDays(t, -1)) return 'Kemarin';
    const d = NN.parseISO(s);
    return (long ? NN.HARI[d.getDay()] : NN.HR[d.getDay()]) + ', ' + d.getDate() + ' ' + NN.BLN[d.getMonth()] +
      (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  };
  NN.normTime = function (s) {
    s = String(s || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{1,2})(?:[:.]?(\d{1,2}))?$/);
    if (!m) return null;
    let h, mi;
    if (m[2] === undefined && (s.length === 3 || s.length === 4)) { h = +s.slice(0, -2); mi = +s.slice(-2); }
    else { h = +m[1]; mi = +(m[2] || 0); }
    if (h > 23 || mi > 59) return null;
    return pad(h) + ':' + pad(mi);
  };
  NN.fmtDur = function (sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + 'd';
    const m = Math.floor(sec / 60), h = Math.floor(m / 60);
    return h ? h + 'j ' + pad(m % 60) + 'm' : m + 'm';
  };
  NN.fmtClock = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
  };
  NN.relMin = function (min) {
    min = Math.round(min);
    if (min < 60) return min + ' menit';
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + ' jam' + (m ? ' ' + m + ' menit' : '');
    const d = Math.round(h / 24);
    return d + ' hari';
  };
  NN.tzLabel = function () {
    const off = -new Date().getTimezoneOffset() / 60;
    return off === 7 ? 'WIB' : off === 8 ? 'WITA' : off === 9 ? 'WIT' : 'GMT' + (off >= 0 ? '+' : '') + off;
  };
  NN.ring = function (size, stroke, frac, color, cls) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = NN.clamp(frac || 0, 0, 1);
    return '<svg class="ring ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle class="trk" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(2) +
      '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="transition:stroke-dashoffset .6s"/></svg>';
  };
  NN.debounce = function (fn, ms) {
    let t = null;
    const d = function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
    d.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    return d;
  };
  NN.selectOpen = function () {
    const a = document.activeElement;
    return (a && a.tagName === 'SELECT') || (Date.now() - (NN.isl.selectAt || 0) < 1500);
  };
  NN.isTyping = function () {
    const a = document.activeElement;
    return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|color|button)$/.test(a.type)));
  };
  const measureCtx = document.createElement('canvas').getContext('2d');
  NN.textWidth = function (s, font) { measureCtx.font = font || (getComputedStyle(document.documentElement).getPropertyValue('--w-s').trim() || '560') + ' 12.5px ' + getComputedStyle(document.body).fontFamily; return measureCtx.measureText(s).width; };

  // ------------------------------------------------------------------ bridge
  NN.call = function (name) {
    const args = Array.prototype.slice.call(arguments, 1);
    return new Promise(resolve => {
      const b = NN.bridge;
      if (!b || typeof b[name] !== 'function') { resolve(null); return; }
      try { b[name].apply(b, args.concat([r => resolve(r)])); } catch (e) { console.error('bridge', name, e); resolve(null); }
    });
  };
  function connect(cb) {
    if (window.qt && window.qt.webChannelTransport && window.QWebChannel) {
      new QWebChannel(qt.webChannelTransport, ch => { NN.bridge = ch.objects.bridge; cb(); });
    } else if (window.TauriBridge) { NN.bridge = window.TauriBridge; cb(); }
    else if (window.MockBridge) { NN.bridge = window.MockBridge; cb(); }
    else setTimeout(() => connect(cb), 40);
  }
  NN.on = function (sig, fn) {
    const s = NN.bridge && NN.bridge[sig];
    if (s && s.connect) s.connect(fn);
  };

  // ------------------------------------------------------------------ pengaturan bawaan
  NN.DEFAULTS = {
    v: 2,
    theme: { bg: 'notnot', accent: '#7c6cf7', opacity: 100, glow: true, motion: 'normal', scale: 100, compat: false, weight: 'normal' },
    music: { artBg: true, lyrSize: 'm', lead: 0 },
    notch: { hover: false, lyrics: true, hideFullscreen: false, lock: false, peekPrayer: true, takeover: true,
      slots: { left: 'clock', center: 'music', right: 'auto', leftAlt: 'none', centerAlt: 'nexttask', rightAlt: 'none' },
      pages: ['tasks', 'notes', 'clip', 'ai', 'music', 'prayer', 'focus', 'timer'] },
    mascot: { on: true, eyes: true, react: { hover: true, music: true, focus: true, distract: true, alert: true, sleep: true, happy: true } },
    todo: { morning: true, morningTime: '07:00', evening: true, eveningTime: '20:00', carry: true, remind: [0, 10], sound: true },
    pomo: { focus: 25, short: 5, long: 15, every: 4, autoNext: false, alarm: true, alarmSec: 30, sound: '' },
    ai: { provider: 'claude', workspace: '', ollamaUrl: 'http://localhost:11434',
      models: { claude: 'claude-haiku-5-5', openai: 'gpt-5-mini', gemini: 'gemini-3.5-flash-lite', groq: 'openai/gpt-oss-120b', openrouter: 'openrouter/free', ollama: 'llama3.2' },
      system: 'Kamu asisten yang ringkas dan membantu. Jawab singkat, jelas, dan pakai bahasa yang sama dengan pengguna.' },
    prayer: { city: 'Jakarta', lat: -6.1667, lon: 106.8167, method: 'kemenag', asr: 'std', ihtiyat: 2, before: 10,
      notify: { imsak: false, subuh: true, terbit: false, dzuhur: true, ashar: true, maghrib: true, isya: true },
      sound: 'chime', soundFile: '', adj: { subuh: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0 } },
    clip: { text: true, max: 40, notify: true },
    focus: { distract: 5, distractPomo: 1, idle: 90,
      productive_apps: ['code.exe', 'cursor.exe', 'pycharm64.exe', 'idea64.exe', 'devenv.exe', 'sublime_text.exe', 'notepad++.exe',
        'winword.exe', 'excel.exe', 'powerpnt.exe', 'onenote.exe', 'notion.exe', 'obsidian.exe', 'figma.exe',
        'windowsterminal.exe', 'powershell.exe', 'cmd.exe', 'acrobat.exe', 'claude.exe'],
      distracting_apps: ['steam.exe', 'epicgameslauncher.exe', 'riotclientservices.exe', 'valorant.exe'],
      productive_keywords: ['google docs', 'google sheets', 'google slides', 'apps script', 'github', 'stack overflow', 'claude',
        'chatgpt', 'gemini', 'notion', 'canva', 'figma', 'drive', 'classroom', 'localhost', 'notchnote'],
      distracting_keywords: ['youtube', 'instagram', 'tiktok', 'facebook', 'netflix', 'twitter', ' / x', 'reddit', 'shopee',
        'tokopedia', 'twitch', '9gag'] },
    general: { hotkeys: true, weather: true },
  };
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over.slice() : base.slice();
    if (base && typeof base === 'object') {
      const o = {};
      for (const k of Object.keys(base)) o[k] = merge(base[k], over && typeof over === 'object' ? over[k] : undefined);
      if (over && typeof over === 'object') for (const k of Object.keys(over)) if (!(k in o)) o[k] = over[k];
      return o;
    }
    return over === undefined || over === null ? base : over;
  }
  NN.merge = merge;

  // ------------------------------------------------------------------ penyimpanan
  const savers = {};
  NN.save = function (name) {
    if (!savers[name]) savers[name] = NN.debounce(() => {
      const data = name === 'cfg' ? NN.cfg : NN.st[name];
      NN.call('save', name === 'cfg' ? 'config' : name, JSON.stringify(data));
    }, 350);
    savers[name]();
  };
  NN.flushSaves = () => Object.values(savers).forEach(s => s.flush());
  window.addEventListener('beforeunload', NN.flushSaves);

  // ------------------------------------------------------------------ tema
  NN.BGS = [
    { id: 'notnot', name: 'Notnot', stops: ['#1e1559', '#130d3b'] },
    { id: 'notnot-light', name: 'Notnot terang', stops: ['#f6f4ff'], light: true },
    { id: 'black', name: 'Hitam', stops: ['#000000'] },
    { id: 'graphite', name: 'Grafit', stops: ['#1a1a1e'] },
    { id: 'midnight', name: 'Malam', stops: ['#0a1122'] },
    { id: 'forest', name: 'Hutan', stops: ['#0a1812'] },
    { id: 'cocoa', name: 'Kopi', stops: ['#1a130e'] },
    { id: 'aurora', name: 'Aurora', stops: ['#0b0a1c', '#0f1f33', '#0b2b2a'] },
    { id: 'dusk', name: 'Senja', stops: ['#120a16', '#251126', '#2c1a10'] },
    { id: 'ocean', name: 'Samudra', stops: ['#06121c', '#0a2236'] },
    { id: 'glass', name: 'Kaca', stops: ['rgba(16,16,20,.72)'], glass: true },
    { id: 'light', name: 'Terang', stops: ['#f6f6f8'], light: true },
    { id: 'cream', name: 'Krem', stops: ['#f7f2e8'], light: true },
  ];
  NN.ACCENTS = [
    ['#7c6cf7', 'Notnot'], ['#3b82f6', 'Biru'], ['#6366f1', 'Indigo'], ['#a855f7', 'Ungu'], ['#ec4899', 'Merah muda'], ['#ef4444', 'Merah'],
    ['#f97316', 'Oranye'], ['#eab308', 'Kuning'], ['#22c55e', 'Hijau'], ['#14b8a6', 'Toska'], ['#0ea5e9', 'Langit'], ['#a1a1aa', 'Netral'],
  ];
  function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0.3;
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const f = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  NN.bgPreset = () => NN.BGS.find(b => b.id === NN.cfg.theme.bg) || NN.BGS[0];
  NN.applyTheme = function () {
    const t = NN.cfg.theme, b = NN.bgPreset(), root = document.documentElement.style;
    const s = b.stops;
    root.setProperty('--bg', s.length > 1 ? 'linear-gradient(180deg,' + s.join(',') + ')' : s[0]);
    root.setProperty('--ear-a', s[0]);
    root.setProperty('--ear-b', s[s.length - 1]);
    root.setProperty('--bg-solid', s[0].startsWith('rgba') ? '#101014' : s[0]);
    root.setProperty('--acc', t.accent);
    root.setProperty('--acc-ink', lum(t.accent) > 0.45 ? '#111114' : '#ffffff');
    root.setProperty('--bg-op', String(NN.clamp((t.opacity || 100) / 100, 0.6, 1)));
    document.documentElement.classList.toggle('light', !!b.light);
    document.documentElement.classList.toggle('w-thin', t.weight === 'thin');
    document.documentElement.classList.toggle('w-bold', t.weight === 'bold');
    isl.spring.k = t.motion === 'reduce' ? 520 : 250;
    isl.spring.d = t.motion === 'reduce' ? 46 : 23;
    updateEars();
    updateGlow();
  };

  // ------------------------------------------------------------------ fisika pegas
  function Spring(v) { this.x = v; this.t = v; this.v = 0; }
  Spring.prototype.step = function (dt, k, d) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = k * (this.t - this.x) - d * this.v; this.v += a * h; this.x += this.v * h; }
  };
  Spring.prototype.done = function () { return Math.abs(this.t - this.x) < 0.4 && Math.abs(this.v) < 2; };

  // ------------------------------------------------------------------ mesin notch
  const isl = NN.isl = {
    el: null, layout: { dock: 'top', ax: 720, ay: 0, grow: 'down', scr: { x: 0, y: 0, w: 1440, h: 960 } },
    view: 'compact', page: 'tasks', sub: null, hovered: false, pinned: false, dragging: false,
    w: new Spring(220), h: new Spring(36), sx: new Spring(0), spring: { k: 250, d: 23 },
    tw: 220, th: 36, raf: 0, last: 0, rectSent: '', alert: null, queue: [], pendingView: null,
  };
  NN.vertical = () => isl.layout.dock === 'left' || isl.layout.dock === 'right';
  NN.docked = () => isl.layout.dock !== 'float';

  function compactSize() {
    const vert = NN.vertical(), d = isl.cdim && isl.cdim.vert === vert ? isl.cdim : (vert ? [46, 130] : [214, 36]);
    if (vert) return [d[0] + (isl.hovered ? 4 : 0), d[1] + (isl.hovered ? 10 : 0)];
    return [d[0] + (isl.hovered ? 14 : 0), isl.hovered ? 40 : 36];
  }
  function viewSize() {
    if (isl.view === 'compact') return compactSize();
    let s;
    if (isl.view === 'alert') s = isl.alert ? (isl.alert.size || [560, 96]) : [400, 80];
    else { const p = NN.pages[isl.page]; s = p && p.size ? p.size(isl.sub) : [520, 360]; }
    const sc = isl.layout.scr;
    return [Math.min(s[0], sc.w - 20), Math.min(s[1], sc.h - 20)];
  }
  NN.rectFor = function (w, h) {
    const L = isl.layout, s = L.scr, m = 8;
    let x, y;
    switch (L.dock) {
      case 'top': x = L.ax - w / 2; y = L.ay; break;
      case 'bottom': x = L.ax - w / 2; y = L.ay - h; break;
      case 'left': x = L.ax; y = L.ay - h / 2; break;
      case 'right': x = L.ax - w; y = L.ay - h / 2; break;
      default: x = L.ax - w / 2; y = L.grow === 'up' ? L.ay + 18 - h : L.ay - 18;
    }
    if (!isl.dragging) {
      if (L.dock !== 'left' && L.dock !== 'right') x = NN.clamp(x, s.x + m, s.x + s.w - m - w);
      if (L.dock !== 'top' && L.dock !== 'bottom') y = NN.clamp(y, s.y + m, s.y + s.h - m - h);
    }
    return { x, y, w, h };
  };
  function radii(w, h) {
    const d = isl.layout.dock, compact = isl.view === 'compact';
    const R = compact ? (NN.vertical() ? Math.min(20, w / 2) : (d === 'float' ? h / 2 : Math.min(16, h / 2))) : (isl.view === 'alert' ? 30 : 28);
    switch (d) {
      case 'top': return '0 0 ' + R + 'px ' + R + 'px';
      case 'bottom': return R + 'px ' + R + 'px 0 0';
      case 'left': return '0 ' + R + 'px ' + R + 'px 0';
      case 'right': return R + 'px 0 0 ' + R + 'px';
      default: return R + 'px';
    }
  }
  function updateEars() {
    const el = isl.el; if (!el) return;
    const d = isl.layout.dock, e = 14, w = isl.w.x, h = isl.h.x, A = 'var(--ear-a)', B = 'var(--ear-b)';
    const [l, r] = [$('.ear.a', el), $('.ear.b', el)];
    const g = (pos, col) => 'radial-gradient(circle at ' + pos + ', transparent ' + (e - 0.6) + 'px, ' + col + ' ' + e + 'px)';
    const set = (n, x, y, pos, col) => { n.style.left = x + 'px'; n.style.top = y + 'px'; n.style.background = g(pos, col); };
    el.classList.toggle('docked', d !== 'float');
    if (d === 'top') { set(l, -e, 0, '0 100%', A); set(r, w, 0, '100% 100%', A); }
    else if (d === 'bottom') { set(l, -e, h - e, '0 0', B); set(r, w, h - e, '100% 0', B); }
    else if (d === 'left') { set(l, 0, -e, '100% 0', A); set(r, 0, h, '100% 100%', B); }
    else if (d === 'right') { set(l, w - e, -e, '0 0', A); set(r, w - e, h, '0 100%', B); }
  }

  NN.retarget = function () {
    const [w, h] = viewSize();
    isl.tw = w; isl.th = h;
    isl.w.t = w; isl.h.t = h;
    const v = $('#v' + cap(isl.view));
    if (v) { v.style.width = w + 'px'; v.style.height = h + 'px'; }
    isl.el.style.borderRadius = radii(w, h);
    sendRect(true);
    kick();
  };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function sendRect(union) {
    const a = NN.rectFor(isl.w.x, isl.h.x), b = NN.rectFor(isl.tw, isl.th);
    let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    if (union) { x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, a.x + a.w); y2 = Math.max(y2, a.y + a.h); }
    const glow = isl.el.classList.contains('glow');
    const m = glow ? 30 : (NN.docked() ? 16 : 5);
    const shake = Math.abs(isl.sx.x) + Math.abs(isl.sx.v) / 30;
    x1 -= m + shake; x2 += m + shake; y1 -= m; y2 += m;
    const R = isl.view === 'compact' ? Math.min(isl.th / 2, 20) : 28;
    const key = [x1, y1, x2, y2].map(Math.round).join(',') + (isl.dragging ? 'd' : '');
    if (key === isl.rectSent) return;
    isl.rectSent = key;
    NN.call('setRect', Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1), R, isl.layout.dock);
  }

  function frame(ts) {
    isl.raf = 0;
    const dt = Math.min(0.034, isl.last ? (ts - isl.last) / 1000 : 0.016);
    isl.last = ts;
    const { k, d } = isl.spring;
    isl.w.step(dt, k, d); isl.h.step(dt, k, d); isl.sx.step(dt, 900, 14);
    const r = NN.rectFor(isl.w.x, isl.h.x);
    const s = isl.el.style;
    s.left = (r.x + isl.sx.x) + 'px'; s.top = r.y + 'px'; s.width = Math.max(10, r.w) + 'px'; s.height = Math.max(10, r.h) + 'px';
    updateEars();
    if (isl.pendingView && Math.abs(isl.w.x - isl.tw) < 40 && Math.abs(isl.h.x - isl.th) < 26) showPending();
    const settled = isl.w.done() && isl.h.done() && isl.sx.done();
    if (settled) {
      isl.w.x = isl.w.t; isl.h.x = isl.h.t; isl.sx.x = 0; isl.sx.v = 0; isl.last = 0;
      const rr = NN.rectFor(isl.w.x, isl.h.x);
      s.left = rr.x + 'px'; s.top = rr.y + 'px'; s.width = rr.w + 'px'; s.height = rr.h + 'px';
      updateEars();
      if (isl.pendingView) showPending();
      sendRect(false);
    } else isl.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!isl.raf) { isl.last = 0; isl.raf = requestAnimationFrame(frame); } }
  NN.shake = function (v) { isl.sx.v += v || 420; kick(); };
  NN.bump = function (dw, dh) { isl.w.v += dw || 0; isl.h.v += dh || 0; kick(); };

  // ------------------------------------------------------------------ tampilan (compact / panel / alert)
  function setView(v) {
    const prev = isl.view;
    if (v !== 'page') isl.engaged = false;
    isl.view = v;
    $$('.view', isl.el).forEach(n => { if (n.id !== 'v' + cap(v)) n.classList.remove('on'); });
    isl.pendingView = v;
    if (prev === v && v !== 'compact') isl.pendingView = v;
    updateGlow();
    NN.retarget();
  }
  function showPending() {
    const v = isl.pendingView; isl.pendingView = null;
    const n = $('#v' + cap(v));
    if (n) n.classList.add('on');
    if (v === 'page') { const p = NN.pages[isl.page]; if (p && p.shown) p.shown(isl.sub); }
  }
  function updateGlow() {
    if (!isl.el) return;
    const al = isl.view === 'alert' && isl.alert;
    const on = !!(NN.cfg && NN.cfg.theme.glow && al);
    isl.el.classList.toggle('glow', on);
    if (al) isl.el.style.setProperty('--gc', al.color || 'var(--acc)');
  }

  // ------------------------------------------------------------------ compact
  NN.compactProvider = fn => NN.compactProviders.push(fn);
  NN.slots = {};
  NN.slot = (id, def) => { def.id = id; NN.slots[id] = def; };
  NN.SLOT_ORDER = ['clock', 'date', 'clockdate', 'music', 'nexttask', 'taskcount', 'pomo', 'prayer', 'focus', 'weather', 'battery', 'auto', 'none'];
  function bestProvider(vert, exclude, minPrio) {
    let best = null;
    for (const fn of NN.compactProviders) {
      try {
        const r = fn(vert);
        if (!r || (exclude && exclude.has(r.kind)) || (minPrio && r.prio < minPrio)) continue;
        if (!best || r.prio > best.prio) best = r;
      } catch (e) { console.error(e); }
    }
    return best;
  }
  NN.renderCompact = function () {
    const vert = NN.vertical(), el = $('#vCompact'), sc = NN.cfg.notch.slots || {};
    if (!el._built) { el.innerHTML = '<div class="c-owl"></div><div class="slot sl"></div><div class="slot sc"></div><div class="slot sr"></div>'; el._built = true; }
    el.classList.toggle('vert', vert);
    const mon = !!(NN.cfg.mascot && NN.cfg.mascot.on), ob = $('.c-owl', el);
    if (mon && !ob.firstChild) ob.innerHTML = NN.owl(36, { live: true });
    if (!mon && ob.firstChild) ob.innerHTML = '';
    ob.classList.toggle('hide', !mon);
    const ids = [sc.left || 'clock', sc.center || 'none', sc.right || 'auto'], out = [null, null, null], shown = new Set();
    ids.forEach((id, i) => {
      if (id === 'auto' || id === 'none' || !NN.slots[id]) return;
      try { const r = NN.slots[id].render(vert, i); if (r) { out[i] = r; shown.add(r.kind || id); } } catch (e) { console.error(e); }
    });
    // cadangan: kalau slot utama kosong (misal tidak ada musik), tampilkan pilihan lain (didahulukan dari "Otomatis")
    ['leftAlt', 'centerAlt', 'rightAlt'].forEach((k, i) => {
      const alt = sc[k];
      if (out[i] || ids[i] === 'auto' || !alt || alt === 'none' || alt === 'auto') return;
      let r = null;
      if (NN.slots[alt]) { try { r = NN.slots[alt].render(vert, i); } catch (e) { console.error(e); } }
      if (r && !shown.has(r.kind)) { out[i] = r; shown.add(r.kind); }
    });
    ids.forEach((id, i) => {
      const useAuto = id === 'auto' || (!out[i] && sc[['leftAlt', 'centerAlt', 'rightAlt'][i]] === 'auto');
      if (useAuto && !out[i]) { const b = bestProvider(vert, shown); if (b) { out[i] = b; shown.add(b.kind); } }
    });
    if (NN.cfg.notch.takeover) { const u = bestProvider(vert, shown, 5); if (u) out[2] = u; }
    const parts = out.map(r => r ? r.html : '');
    ['.sl', '.sc', '.sr'].forEach((q, i) => { const n = $(q, el); if (n._k !== parts[i]) { n._k = parts[i]; n.innerHTML = parts[i]; } n.classList.toggle('empty', !parts[i]); });
    const key = parts.join('|') + vert + mon;
    if (key !== isl.ckey) {
      isl.ckey = key;
      const m = $('#cmeasure');
      m.className = vert ? 'vert' : '';
      m.innerHTML = (mon ? '<div class="c-owl"><i></i></div>' : '') + parts.filter(Boolean).map(x => '<div class="slot">' + x + '</div>').join('');
      const dim = vert ? [46, NN.clamp(m.offsetHeight + 4, 96, 320)] : [NN.clamp(Math.ceil(m.offsetWidth) + 10, 150, 560), 36];
      dim.vert = vert;
      const old = isl.cdim; isl.cdim = dim;
      if (isl.view === 'compact' && (!old || old[0] !== dim[0] || old[1] !== dim[1] || old.vert !== vert)) NN.retarget();
    }
  };

  // slot umum
  NN.slot('clock', { label: 'Jam', render: v => ({ kind: 'clock', html: '<span class="c-time">' + (v ? pad(new Date().getHours()) + '<br>' + pad(new Date().getMinutes()) : NN.hm(new Date())) + '</span>' }) });
  NN.slot('date', { label: 'Tanggal', render: v => { const d = new Date(); return { kind: 'date', html: '<span class="c-time">' + NN.HR[d.getDay()] + (v ? '<br>' : ' ') + d.getDate() + '</span>' }; } });
  NN.slot('clockdate', { label: 'Jam + tanggal', render: v => { const d = new Date(); return v ? NN.slots.clock.render(v) : { kind: 'clock', html: '<span class="c-time"><span class="c-sub">' + NN.HR[d.getDay()] + ' ' + d.getDate() + '</span> ' + NN.hm(d) + '</span>' }; } });
  NN.slot('weather', { label: 'Cuaca', render: v => { const w = NN.status.weather; return w ? { kind: 'weather', html: '<span class="c-stat">' + icon(w.icon, v ? 15 : 16) + (v ? '' : ' ') + Math.round(w.temp) + '°</span>' } : null; } });
  NN.slot('battery', { label: 'Baterai', render: v => { const b = NN.status.battery; return b == null ? null : { kind: 'battery', html: '<span class="c-stat"' + (b <= 15 && !NN.status.plugged ? ' style="color:var(--bad)"' : '') + '>' + icon(NN.status.plugged ? 'plug' : 'battery', 15) + (v ? '' : ' ') + Math.round(b) + '%</span>' }; } });
  NN.slot('auto', { label: 'Otomatis', render: () => null });
  NN.slot('none', { label: 'Kosong', render: () => null });

  // ------------------------------------------------------------------ panel & navigasi
  NN.page = function (id, def) { def.id = id; NN.pages[id] = def; };
  NN.enabledPages = () => NN.cfg.notch.pages.filter(p => NN.pages[p]);
  function renderTabs() {
    const bar = $('#tabs');
    const ids = NN.enabledPages();
    let h = '<i class="ind"></i>';
    ids.forEach(id => {
      const p = NN.pages[id];
      h += '<button class="tab" data-tab="' + id + '">' + icon(p.icon, 18) + '<span class="tip">' + p.label + '</span></button>';
    });
    h += '<i class="sep"></i><button class="tab" data-tab="settings">' + icon('gear', 18) + '<span class="tip">Pengaturan</span></button>';
    bar.innerHTML = h;
    bar._ids = ids.join();
    moveInd();
  }
  function moveInd() {
    const bar = $('#tabs'); if (!bar) return;
    if (bar._ids !== NN.enabledPages().join()) { renderTabs(); return; }
    const b = $('.tab[data-tab="' + isl.page + '"]', bar), ind = $('.ind', bar);
    $$('.tab', bar).forEach(t => t.classList.toggle('on', t === b));
    if (b) { ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; ind.style.opacity = 1; }
    else ind.style.opacity = 0;
    NN.pages.tasks && $$('.tab', bar).forEach(t => t.classList.toggle('dot', !!(NN.pages[t.dataset.tab] && NN.pages[t.dataset.tab].badge && NN.pages[t.dataset.tab].badge())));
  }
  NN.refreshTabs = moveInd;

  NN.open = function (id, sub, opts) {
    opts = opts || {};
    const p = NN.pages[id];
    if (!p) return;
    const prevPage = isl.page, prevSub = isl.sub, wasPanel = isl.view === 'page';
    if (wasPanel && prevPage && prevPage !== id && NN.pages[prevPage].hide) NN.pages[prevPage].hide();
    isl.page = id; isl.sub = sub == null ? null : sub;
    if (id !== 'settings') { NN.st.ui.page = id; NN.save('ui'); }
    $$('.page').forEach(n => { n.classList.remove('on', 'enter-l', 'enter-r', 'enter-u'); });
    const sec = $('.page[data-p="' + id + '"]');
    p.render(sec, isl.sub);
    sec.classList.add('on');
    if (wasPanel) {
      const ids = NN.enabledPages().concat(['settings']);
      const dir = prevPage === id ? 'enter-u' : (ids.indexOf(id) > ids.indexOf(prevPage) ? 'enter-r' : 'enter-l');
      void sec.offsetWidth; sec.classList.add(dir);
    }
    renderStatus();
    if (isl.view !== 'page') { if (isl.view === 'alert') dismissAlert(true); setView('page'); }
    else { NN.retarget(); if (p.shown) setTimeout(() => p.shown(isl.sub), 30); }
    moveInd();
    clearTimeout(isl.autoT);
    if (opts.autoClose) isl.autoT = setTimeout(() => {
      if (!isl.hovered && !NN.isTyping() && !isl.pinned && isl.view === 'page' && isl.page === id) NN.collapse();
    }, opts.autoClose);
    if (opts.focus) setTimeout(() => { const f = $(opts.focus, sec); if (f) { NN.call('activate'); f.focus(); } }, 260);
  };
  NN.rerender = function () { if (isl.view === 'page') { const p = NN.pages[isl.page]; p.render($('.page[data-p="' + isl.page + '"]'), isl.sub); } };
  NN.setSub = function (sub) { NN.open(isl.page, sub); };
  NN.collapse = function () {
    if (isl.view === 'compact') return;
    if (isl.view === 'alert') { dismissAlert(); return; }
    const p = NN.pages[isl.page];
    if (p && p.hide) p.hide();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setView('compact');
    NN.renderCompact();
  };
  NN.toggle = function () {
    if (isl.view === 'compact') NN.open(NN.st.ui.page && NN.pages[NN.st.ui.page] ? NN.st.ui.page : NN.enabledPages()[0] || 'tasks');
    else NN.collapse();
  };

  // ------------------------------------------------------------------ baris status
  NN.status = { battery: null, plugged: false, weather: null };
  function renderStatus() {
    const el = $('#status'); if (!el) return;
    if (!el._built) {
      el.innerHTML = '<div class="s-l"><span class="s-owl"></span><span class="s-bat"></span></div><div class="mid"></div><div class="end"></div>';
      el._built = true;
    }
    const now = new Date(), st = NN.status;
    const ob = $('.s-owl', el), mon = !!(NN.cfg.mascot && NN.cfg.mascot.on);
    if (mon && !ob.firstChild) ob.innerHTML = NN.owl(30, { live: true });
    if (!mon && ob.firstChild) ob.innerHTML = '';
    let bat = '';
    if (st.battery != null) {
      const lvl = NN.clamp(st.battery, 0, 100);
      bat = '<span class="bat">' + icon('battery', 20) + '<i class="lvl" style="width:' + (10 * lvl / 100).toFixed(1) + 'px;' +
        (lvl <= 15 && !st.plugged ? 'color:var(--bad)' : '') + '"></i></span>' + Math.round(lvl) + '%' + (st.plugged ? icon('plug', 13) : '');
    }
    const mid = NN.HR[now.getDay()] + ', ' + now.getDate() + ' ' + NN.BLN[now.getMonth()] + '&nbsp;&nbsp;' + NN.hm(now);
    let right = '';
    if (st.weather && NN.cfg.general.weather) right += icon(st.weather.icon, 16) + Math.round(st.weather.temp) + '°';
    right += '<button class="ibtn' + (isl.pinned ? ' on' : '') + '" data-act="pin" title="Sematkan agar tetap terbuka" style="width:26px;height:26px;margin-left:4px">' + icon('pin', 15) + '</button>';
    const set = (q, h) => { const n = $(q, el); if (n._k !== h) { n._k = h; n.innerHTML = h; } };
    set('.s-bat', bat); set('.mid', mid); set('.end', right);
  }
  NN.renderStatus = renderStatus;

  // ------------------------------------------------------------------ notifikasi (alert)
  NN.alert = function (a) {
    a.id = a.id || NN.uid();
    if (isl.alert && isl.view === 'alert') {
      if (a.replace && isl.alert.kind === a.kind) { showAlert(a); return a.id; }
      isl.queue.push(a); return a.id;
    }
    showAlert(a);
    return a.id;
  };
  function showAlert(a) {
    isl.alert = a; a.more = false;
    a.returnTo = isl.view === 'page' ? { page: isl.page, sub: isl.sub } : (a.returnTo || null);
    renderAlert();
    setView('alert');
    if (a.shake !== false) NN.shake(a.kind === 'toast' ? 160 : 460);
    clearTimeout(isl.alertTimer);
    if (a.timeout) isl.alertTimer = setTimeout(() => { if (isl.alert === a && !isl.hovered) dismissAlert(); else if (isl.alert === a) a._expire = true; }, a.timeout);
    if (a.kind !== 'toast') NN.call('attention');
    if (a.sound) NN.call('playSound', a.sound.file || '', a.sound.kind || 'chime', !!a.sound.loop, a.sound.secs || 0);
  }
  function renderAlert() {
    const a = isl.alert, el = $('#vAlert');
    if (!a) return;
    if (a.kind === 'toast') {
      el.className = 'view' + (el.classList.contains('on') ? ' on' : '');
      el.innerHTML = '<div class="toastv" style="width:100%;justify-content:center">' + (a.icon ? '<span style="color:' + (a.color || 'var(--acc)') + '">' + icon(a.icon, 18) + '</span>' : '') +
        '<span>' + NN.esc(a.title) + '</span></div>';
      return;
    }
    const ring = a.ring ? a.ring() : null;
    let ic;
    if (a.img) ic = '<div class="al-ic img"><div class="core" style="background-image:url(\'' + a.img + '\')"></div></div>';
    else ic = '<div class="al-ic" style="--ac:' + a.color + '">' + (ring != null ? NN.ring(52, 3.5, ring, a.color) : '') +
      '<div class="core">' + icon(a.icon || 'bell', 21) + '</div></div>';
    let acts = '';
    if (a.split) acts += '<div class="split"><button data-aa="split">' + NN.esc(a.split.label) + '</button><button data-aa="more" title="Pilihan lain">' + icon(a.more ? 'chev-u' : 'chev-d', 15) + '</button></div>';
    (a.actions || []).forEach((b, i) => {
      acts += '<button class="btn lg ' + (b.cls || '') + '" data-aa="' + i + '">' + (b.icon ? icon(b.icon, 16) : '') + NN.esc(b.label) + '</button>';
    });
    let more = '';
    if (a.more && a.split && a.split.more) {
      more = '<div class="al-more">' + a.split.more.map((m, i) => '<button class="chip sm" data-aa="m' + i + '">' + NN.esc(m.label) + '</button>').join('') + '</div>';
    }
    const cap = typeof a.cap === 'function' ? a.cap() : a.cap;
    el.innerHTML = ic + '<div class="al-body">' + (cap ? '<div class="al-cap" style="--ac:' + a.color + '">' + NN.esc(cap) + '</div>' : '') +
      '<div class="al-title">' + NN.esc(a.title) + '</div>' + (a.sub ? '<div class="al-sub">' + NN.esc(typeof a.sub === 'function' ? a.sub() : a.sub) + '</div>' : '') +
      '</div><div class="al-acts">' + acts + '</div>' +
      (a.close !== false ? '<button class="ibtn al-x" data-aa="x" title="Tutup">' + icon('x', 14) + '</button>' : '') + more;
    el.style.paddingBottom = a.more ? '46px' : '';
  }
  NN.updateAlert = function () { if (isl.alert && isl.view === 'alert' && isl.alert.kind !== 'toast') renderAlert(); };
  function dismissAlert(silent) {
    const a = isl.alert;
    clearTimeout(isl.alertTimer);
    if (a && a.onClose) a.onClose();
    isl.alert = null;
    if (silent) return;
    if (isl.queue.length) { const nx = isl.queue.shift(); if (!nx.returnTo && a && a.returnTo) nx.returnTo = a.returnTo; showAlert(nx); return; }
    if (a && a.then) { a.then(); return; }
    if (a && a.returnTo) { NN.open(a.returnTo.page, a.returnTo.sub); return; }
    setView('compact'); NN.renderCompact();
  }
  NN.dismissAlert = dismissAlert;
  NN.toast = function (title, ic, color) {
    if (isl.view === 'page') {
      const t = $('#ptoast');
      t.innerHTML = '<span style="color:' + (color || 'var(--ok)') + '">' + icon(ic || 'check', 15) + '</span>' + NN.esc(title);
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
      return;
    }
    NN.alertToast(title, ic, color);
  };
  NN.alertToast = (title, ic, color) => NN.alert({ kind: 'toast', title, icon: ic || 'check', color: color || 'var(--ok)', size: [Math.min(520, NN.textWidth(title, '650 13px ' + getComputedStyle(document.body).fontFamily) + 110), 48], timeout: 1700, close: false, replace: true });
  function onAlertClick(e) {
    const a = isl.alert; if (!a) return;
    const b = e.target.closest('[data-aa]');
    if (!b) { if (a.onClick) { const f = a.onClick; dismissAlert(true); f(); } return; }
    const k = b.dataset.aa;
    e.stopPropagation();
    if (k === 'x') { dismissAlert(); return; }
    if (k === 'more') { a.more = !a.more; a.size = [a.size[0], a.more ? a.size[1] + 46 : a.size[1] - 46]; renderAlert(); NN.retarget(); return; }
    let fn = null;
    if (k === 'split') fn = a.split.act;
    else if (k[0] === 'm') fn = a.split.more[+k.slice(1)].act;
    else fn = a.actions[+k].act;
    const keep = fn && fn() === 'keep';
    if (!keep) dismissAlert();
  }

  // ------------------------------------------------------------------ input pengguna
  let press = null, leaveT = null, hoverT = null;
  function interactive(t) { return !!t.closest('button,input,textarea,select,a,[data-act],[data-aa],.scroll,.nodrag,.cal,.ly'); }
  function bindIsland() {
    const el = isl.el;
    el.addEventListener('pointerenter', () => {
      isl.hovered = true; clearTimeout(leaveT);
      if (isl.view === 'compact') {
        NN.retarget();
        if (NN.cfg.notch.hover) { clearTimeout(hoverT); hoverT = setTimeout(() => { if (isl.hovered && isl.view === 'compact') NN.toggle(); }, 380); }
      }
    });
    el.addEventListener('pointerleave', () => {
      isl.hovered = false; clearTimeout(hoverT);
      if (isl.dragging) return;
      if (isl.view === 'compact') NN.retarget();
      if (isl.view === 'alert' && isl.alert && isl.alert._expire) dismissAlert();
      if (isl.view === 'page' && !isl.pinned) {
        clearTimeout(leaveT);
        // setelah diklik/dipakai, panel tidak menutup hanya karena kursor keluar (misal saat membuka daftar pilihan)
        const wait = isl.engaged ? 15000 : (NN.cfg.notch.hover ? 700 : 1300);
        leaveT = setTimeout(() => {
          if (!isl.hovered && isl.view === 'page' && !isl.pinned && !NN.isTyping() && !NN.busy && !NN.dialog && !NN.selectOpen() && !NN.$('.dd.open')) NN.collapse();
        }, wait);
      }
    });
    el.addEventListener('pointerdown', e => {
      if (isl.view === 'page') { isl.engaged = true; if (e.target.closest('select')) isl.selectAt = Date.now(); }
      if (e.button !== 0) return;
      const inPanelHead = isl.view === 'page' && e.target.closest('#status') && !e.target.closest('button');
      if (isl.view === 'page' && !inPanelHead) return;
      if (interactive(e.target) && !inPanelHead) return;
      press = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false };
      try { el.setPointerCapture(e.pointerId); } catch (_) { }
    });
    el.addEventListener('pointermove', e => {
      if (!press || press.drag) return;
      if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) < 7) return;
      if (NN.cfg.notch.lock) { press = null; NN.toast('Posisi terkunci. Buka kunci di Pengaturan', 'lock', 'var(--warn)'); return; }
      press.drag = true;
      isl.dragging = true;
      if (isl.view !== 'compact') { if (isl.view === 'alert') dismissAlert(true); setView('compact'); NN.renderCompact(); }
      const r = NN.rectFor(isl.w.x, isl.h.x);
      const offX = NN.clamp(e.clientX - (r.x + r.w / 2), -90, 90), offY = NN.clamp(e.clientY - (r.y + r.h / 2), -14, 14);
      NN.call('dragStart', offX, offY);
      el.classList.add('dragging');
    });
    const up = e => {
      if (!press) return;
      const p = press; press = null;
      try { el.releasePointerCapture(p.id); } catch (_) { }
      if (p.drag) {
        isl.dragging = false; el.classList.remove('dragging');
        NN.call('dragEnd');
        NN.bump(-60, 30);
        return;
      }
      if (e.type === 'pointerup' && isl.view === 'compact') NN.toggle();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', e => { e.preventDefault(); if (!NN.isTyping()) NN.open('settings'); });
    $('#vAlert').addEventListener('click', onAlertClick);
    el.addEventListener('wheel', e => {
      if (isl.view !== 'page' || !e.target.closest('.tabbar,#status')) return;
      e.preventDefault();
      NN.step(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1);
    }, { passive: false });
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (t) { NN.open(t.dataset.tab); return; }
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'pin') { isl.pinned = !isl.pinned; renderStatus(); NN.toast(isl.pinned ? 'Notch disematkan, tetap terbuka' : 'Sematan dilepas', 'pin'); setTimeout(() => NN.open(isl.page, isl.sub), 1300); }
      if (a && a.dataset.act === 'open-url') { e.preventDefault(); NN.call('openUrl', a.dataset.url); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const p = NN.pages[isl.page];
        if (isl.view === 'page' && p && p.back && p.back()) return;
        NN.collapse(); return;
      }
      if (NN.isTyping() || isl.view !== 'page') return;
      if (e.key === 'ArrowRight') NN.step(1);
      if (e.key === 'ArrowLeft') NN.step(-1);
    });
  }
  NN.step = function (d) {
    const ids = NN.enabledPages().concat(['settings']);
    const i = ids.indexOf(isl.page);
    const n = NN.clamp((i < 0 ? 0 : i) + d, 0, ids.length - 1);
    if (ids[n] !== isl.page) NN.open(ids[n]);
  };

  // ------------------------------------------------------------------ sinyal dari Python
  function bindSignals() {
    NN.on('layout', s => {
      const L = JSON.parse(s);
      const dockChanged = L.dock !== isl.layout.dock;
      isl.layout = L;
      isl.dragging = !!L.dragging;
      if (dockChanged) { NN.renderCompact(); if (isl.view === 'compact') NN.retarget(); NN.bump(30, 10); }
      isl.rectSent = '';
      NN.retarget();
      if (!L.dragging) { NN.cfg.notch.dock = L.dock; }
    });
    NN.on('active', a => {
      NN.windowActive = !!a;
      if (a) { setTimeout(() => { NN.dialog = false; }, 400); return; }
      if (isl.view === 'page' && !isl.pinned && !isl.dragging && !NN.busy && !NN.dialog && !NN.selectOpen())
        setTimeout(() => { if (!NN.windowActive && !isl.hovered && !NN.dialog && !NN.selectOpen()) NN.collapse(); }, 250);
    });
    NN.on('hotkey', name => {
      if (name === 'ai') NN.open('ai', null, { focus: 'textarea' });
      else if (name === 'note') { NN.pages.notes.newNote(); }
      else if (name === 'todo') NN.open('tasks', null, { focus: '#taskAdd' });
      else if (name === 'toggle') NN.toggle();
      else if (name === 'settings') NN.open('settings');
    });
    NN.on('status', s => { Object.assign(NN.status, JSON.parse(s)); renderStatus(); });
  }

  // ------------------------------------------------------------------ jam
  let lastMin = -1;
  function tick() {
    const now = new Date();
    for (const fn of NN.tickers) { try { fn(now); } catch (e) { console.error(e); } }
    if (isl.view === 'compact') NN.renderCompact();
    if (isl.view === 'page') {
      renderStatus();
      const p = NN.pages[isl.page];
      if (p && p.tick) try { p.tick(now); } catch (e) { console.error(e); }
    }
    if (isl.view === 'alert' && isl.alert && isl.alert.live) NN.updateAlert();
    if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); moveInd(); }
  }

  // ------------------------------------------------------------------ mulai
  NN.boot = function () {
    isl.el = $('#island');
    connect(async () => {
      const init = JSON.parse(await NN.call('init') || '{}');
      NN.init = init;
      NN.cfg = merge(NN.DEFAULTS, init.config || {});
      const oldv = init.config && Object.keys(init.config).length ? (init.config.v || 1) : 2;
      if (oldv < 2) {
        NN.cfg.theme.bg = 'notnot'; NN.cfg.theme.accent = '#7c6cf7';
        if (NN.cfg.ai.models.gemini === 'gemini-3.8-flash') NN.cfg.ai.models.gemini = 'gemini-3.5-flash-lite';
      }
      if (NN.cfg.v !== 2 || oldv < 2) { NN.cfg.v = 2; setTimeout(() => NN.save('cfg'), 500); }
      NN.st.ui = Object.assign({ page: 'tasks' }, init.ui || {});
      NN.st.tasks = init.tasks || [];
      NN.st.notes = init.notes || [];
      NN.st.chat = init.chat || { messages: [] };
      NN.platform = init.platform || 'win';
      if (init.layout) isl.layout = init.layout;
      NN.applyTheme();
      const pg = $('#pages');
      Object.keys(NN.pages).forEach(id => { const s = document.createElement('section'); s.className = 'page'; s.dataset.p = id; pg.appendChild(s); });
      Object.values(NN.pages).forEach(p => { if (p.init) try { p.init(init); } catch (e) { console.error('init', p.id, e); } });
      renderTabs();
      bindIsland();
      bindSignals();
      NN.ready = true;
      NN.renderCompact();
      isl.w.x = isl.w.t = 160; isl.h.x = isl.h.t = 30;
      setView('compact');
      setInterval(tick, 1000);
      tick();
      NN.call('ready');
    });
  };
})();
