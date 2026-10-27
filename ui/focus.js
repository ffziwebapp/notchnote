/* NotchNote - pelacak fokus & timer Pomodoro */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const C = { productive: 'var(--prod)', neutral: 'var(--neu)', distracting: 'var(--dis)', idle: 'var(--fg3)' };
  const CN = { productive: 'produktif', neutral: 'netral', distracting: 'distraksi', idle: 'idle' };
  NN.track = { cat: 'neutral', label: '-', streak: 0 };
  NN.stats = { today: { productive: 0, neutral: 0, distracting: 0, idle: 0, pomodoro: 0, apps: [] }, week: [] };
  const score = () => { const t = NN.stats.today, s = t.productive + t.distracting; return s > 0 ? t.productive / s : null; };
  const scoreColor = s => s == null ? 'var(--fg3)' : s >= 0.7 ? 'var(--prod)' : s >= 0.45 ? 'var(--warn)' : 'var(--dis)';

  NN.page('focus', {
    icon: 'target', label: 'Fokus',
    size: () => [580, 372],
    init() {
      NN.on('track', s => { NN.track = JSON.parse(s); checkDistract(); });
      NN.on('stats', s => { NN.stats = JSON.parse(s); if (NN.isl.page === 'focus' && NN.isl.view === 'page') this.render(this.el); });
    },
    render(el) {
      this.el = el;
      const t = NN.stats.today, sc = score(), tot = t.productive + t.neutral + t.distracting || 1, tr = NN.track;
      const apps = (t.apps || []).slice(0, 4), top = apps.length ? apps[0][1] : 1;
      const week = NN.stats.week || [], wmax = Math.max(3600, ...week.map(w => w.p || 0));
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('target', 20) + 'Fokus hari ini</h2><div class="sp"></div>' +
        '<span class="pill"><span style="width:7px;height:7px;border-radius:50%;background:' + C[tr.cat] + '"></span>' + esc(tr.label) + ' · ' + CN[tr.cat] + '</span></div>' +
        '<div class="fgrid"><div class="ring-big">' + NN.ring(132, 10, sc || 0, scoreColor(sc)) +
        '<div class="val"><b>' + (sc == null ? '–' : Math.round(sc * 100) + '%') + '</b><small>skor fokus</small></div></div>' +
        '<div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><b style="font-size:14px">Aktif ' + NN.fmtDur(t.productive + t.neutral + t.distracting) + '</b>' +
        '<span class="muted" style="font-size:12px">' + icon('timer', 13).replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-2px"') + ' ' + (t.pomodoro || 0) + ' sesi pomodoro</span></div>' +
        '<div class="sbar"><i style="width:' + 100 * t.productive / tot + '%;background:var(--prod)"></i><i style="width:' + 100 * t.neutral / tot + '%;background:var(--neu)"></i><i style="width:' + 100 * t.distracting / tot + '%;background:var(--dis)"></i></div>' +
        '<div class="legend"><span style="--c:var(--prod)">' + NN.fmtDur(t.productive) + '</span><span style="--c:var(--neu)">' + NN.fmtDur(t.neutral) + '</span><span style="--c:var(--dis)">' + NN.fmtDur(t.distracting) + '</span></div>' +
        '<div class="apps">' + (apps.length ? apps.map(a => '<div class="app" style="--w:' + (100 * a[1] / top).toFixed(1) + '%"><span>' + esc(a[0]) + '</span><span>' + NN.fmtDur(a[1]) + '</span></div>').join('')
          : '<div class="faint" style="font-size:12px">Belum ada aktivitas tercatat hari ini</div>') + '</div></div></div>' +
        '<div class="wchart">' + (week.length ? week.map(w => {
          const d = NN.parseISO(w.d);
          return '<div class="' + (w.d === NN.today() ? 'today' : '') + '" title="' + NN.fmtDur(w.p) + ' produktif"><i style="height:' + Math.max(6, 100 * (w.p || 0) / wmax) + '%"></i><small>' + NN.HR[d.getDay()] + '</small></div>';
        }).join('') : '') + '</div>';
    },
    tick(now) { if (now.getSeconds() % 5 === 0) this.render(this.el); },
  });

  let lastAlertAt = 0;
  function checkDistract() {
    const tr = NN.track, c = NN.cfg && NN.cfg.focus; if (!c) return;
    const p = NN.st.ui.pomo, inPomo = p && p.running && p.mode === 'focus';
    const lim = (inPomo ? c.distractPomo : c.distract) * 60;
    if (lim > 0 && tr.cat === 'distracting' && tr.streak >= lim && tr.streak % lim < 2 && Date.now() - lastAlertAt > 30000) {
      lastAlertAt = Date.now();
      NN.alert({
        kind: 'distract', color: '#fb7185', icon: 'warning', size: [560, 92], timeout: 12000,
        cap: inPomo ? 'Sedang sesi fokus' : 'Pengingat distraksi', title: tr.label + ' sudah ' + Math.floor(tr.streak / 60) + ' menit',
        sub: 'Yuk kembali ke pekerjaan.',
        actions: inPomo ? [{ label: 'Oke', cls: 'pri', act: () => { } }] : [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Mulai fokus', cls: 'pri', icon: 'play', act: () => { P.start('focus'); } }],
        onClick: () => NN.open('focus'),
      });
    }
  }

  NN.compactProvider(vert => {
    const sc = score();
    if (sc == null) return null;
    const col = scoreColor(sc);
    const dot = NN.track.cat === 'distracting' ? '<span class="c-dot"></span>' : '';
    return { prio: 1, kind: 'focus', html: dot + NN.ring(17, 2.6, sc, col) + (vert ? '' : '<span style="color:' + col + '">' + Math.round(sc * 100) + '%</span>') };
  });
  NN.slot('focus', { label: 'Skor fokus', render: vert => {
    const sc = score(), col = scoreColor(sc);
    return { kind: 'focus', html: NN.ring(17, 2.6, sc || 0, col) + (vert ? '' : '<span class="c-stat" style="color:' + col + '">' + (sc == null ? '–' : Math.round(sc * 100) + '%') + '</span>') };
  } });

  // ------------------------------------------------------------------ Pomodoro
  const MODES = { focus: 'Fokus', short: 'Istirahat', long: 'Istirahat panjang' };
  const P = NN.pomo = {
    st() { const u = NN.st.ui; if (!u.pomo) u.pomo = { mode: 'focus', running: false, remain: null, round: 0 }; return u.pomo; },
    len(mode) { const c = NN.cfg.pomo; return 60 * (mode === 'focus' ? c.focus : mode === 'short' ? c.short : c.long); },
    left() { const s = P.st(); return s.running ? Math.max(0, (s.endAt - Date.now()) / 1000) : (s.remain == null ? P.len(s.mode) : s.remain); },
    started() { const s = P.st(); return s.running || (s.remain != null && s.remain < P.len(s.mode)); },
    start(mode) {
      const s = P.st();
      if (mode && mode !== s.mode) { s.mode = mode; s.remain = null; }
      s.endAt = Date.now() + P.left() * 1000; s.running = true; NN.save('ui'); P.redraw();
      if (NN.isl.view === 'page') NN.shake(140);
    },
    pause() { const s = P.st(); s.remain = P.left(); s.running = false; NN.save('ui'); P.redraw(); },
    reset() { const s = P.st(); s.running = false; s.remain = null; NN.save('ui'); P.redraw(); },
    setMode(m) { const s = P.st(); s.mode = m; s.running = false; s.remain = null; NN.save('ui'); P.redraw(); },
    skip() { P.finish(true); },
    finish(skipped) {
      const s = P.st(), done = s.mode, c = NN.cfg.pomo;
      if (done === 'focus' && !skipped) { s.round = (s.round || 0) + 1; NN.call('addPomodoro'); }
      const next = done === 'focus' ? ((s.round || 0) % c.every === 0 && s.round ? 'long' : 'short') : 'focus';
      s.mode = next; s.remain = null; s.running = false;
      if (c.autoNext && !skipped) { s.endAt = Date.now() + P.len(next) * 1000; s.running = true; }
      NN.save('ui'); P.redraw();
      if (skipped) return;
      const nextLabel = next === 'focus' ? 'fokus' : (next === 'long' ? 'istirahat panjang' : 'istirahat');
      const color = done === 'focus' ? '#34d399' : '#60a5fa';
      NN.alert({
        kind: 'pomo', color, icon: 'alarm', size: [600, 96], timeout: c.alarm ? (c.alarmSec + 20) * 1000 : 15000, ring: () => 1,
        cap: done === 'focus' ? 'Sesi fokus selesai' : 'Istirahat selesai',
        title: done === 'focus' ? 'Waktunya ' + nextLabel + ' ' + Math.round(P.len(next) / 60) + ' menit' : 'Siap fokus lagi?',
        sub: (done === 'focus' ? 'Sesi ke-' + s.round + ' selesai. ' : '') + (c.alarm ? 'Alarm berbunyi.' : ''),
        sound: c.alarm ? { kind: c.sound ? 'file' : 'alarm', file: c.sound, loop: true, secs: c.alarmSec } : { kind: 'chime' },
        actions: [{ label: c.alarm ? 'Matikan' : 'Tutup', cls: 'ghost', act: () => NN.call('stopSound') },
          { label: s.running ? 'Oke' : 'Mulai ' + nextLabel, cls: 'pri', icon: s.running ? 'check' : 'play', act: () => { NN.call('stopSound'); if (!P.st().running) P.start(); } }],
        onClose: () => { NN.call('stopSound'); clearInterval(P.shk); },
        onClick: () => { NN.call('stopSound'); NN.open('timer'); },
      });
      clearInterval(P.shk);
      if (c.alarm) { const end = Date.now() + c.alarmSec * 1000; P.shk = setInterval(() => { if (Date.now() > end || !(NN.isl.alert && NN.isl.alert.kind === 'pomo')) clearInterval(P.shk); else NN.shake(380); }, 1600); }
    },
    redraw() { if (NN.isl.page === 'timer' && NN.isl.view === 'page') NN.pages.timer.render(NN.pages.timer.el); NN.renderCompact(); },
  };
  NN.tickers.push(() => { const s = P.st(); if (s.running && Date.now() >= s.endAt) P.finish(false); });

  NN.page('timer', {
    icon: 'timer', label: 'Timer',
    size: () => [560, 336],
    render(el) {
      this.el = el;
      const s = P.st(), c = NN.cfg.pomo, left = P.left(), len = P.len(s.mode);
      const col = s.mode === 'focus' ? 'var(--warn)' : '#60a5fa';
      const roundIn = (s.round || 0) % c.every;
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('timer', 20) + 'Pomodoro</h2><div class="seg">' +
        Object.keys(MODES).map(m => '<button class="' + (s.mode === m ? 'on' : '') + '" data-pm="' + m + '">' + MODES[m] + '</button>').join('') + '</div><div class="sp"></div>' +
        '<button class="ibtn" data-pt="set" title="Atur durasi dan alarm">' + icon('gear', 16) + '</button></div>' +
        '<div class="fgrid" style="grid-template-columns:170px 1fr"><div class="ring-big" style="width:160px;height:160px">' + NN.ring(160, 10, left / len, col) +
        '<div class="val"><b id="pmTime" style="font-size:32px">' + NN.fmtClock(left) + '</b><small>' + (s.running ? 'berjalan' : P.started() ? 'dijeda' : MODES[s.mode].toLowerCase()) + '</small></div></div>' +
        '<div><b style="font-size:16px;display:block">' + MODES[s.mode] + ' ' + Math.round(len / 60) + ' menit</b>' +
        '<div class="muted" style="font-size:12.5px;margin:4px 0 10px">Putaran ' + (roundIn + (s.mode === 'focus' ? 1 : 0) || c.every) + ' dari ' + c.every + ' · ' + (NN.stats.today.pomodoro || 0) + ' sesi selesai hari ini</div>' +
        '<div class="dots-row" style="margin-bottom:16px">' + Array.from({ length: c.every }, (_, i) => '<i class="' + (i < roundIn ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<div style="display:flex;gap:8px">' +
        (s.running ? '<button class="btn lg pri" data-pt="pause">' + icon('pause', 15) + 'Jeda</button>' : '<button class="btn lg pri" data-pt="start">' + icon('play', 15) + (P.started() ? 'Lanjut' : 'Mulai') + '</button>') +
        '<button class="btn lg" data-pt="reset">' + icon('refresh', 15) + 'Reset</button><button class="btn lg ghost" data-pt="skip" title="Lewati ke sesi berikutnya">' + icon('next', 15) + 'Lewati</button></div>' +
        '<div class="faint" style="font-size:12px;margin-top:12px;display:flex;align-items:center;gap:6px">' + icon(c.alarm ? 'alarm' : 'bell-off', 14) +
        (c.alarm ? 'Alarm ' + c.alarmSec + ' detik saat selesai' : 'Alarm mati, hanya bunyi singkat') + (c.autoNext ? ' · lanjut otomatis' : '') + '</div></div></div>';
      el.onclick = e => {
        const m = e.target.closest('[data-pm]');
        if (m) { if (P.st().running && !confirmSwitch(this)) return; P.setMode(m.dataset.pm); return; }
        const b = e.target.closest('[data-pt]'); if (!b) return;
        const k = b.dataset.pt;
        if (k === 'start') P.start(); else if (k === 'pause') P.pause(); else if (k === 'reset') P.reset(); else if (k === 'skip') P.skip();
        else if (k === 'set') NN.open('settings', 'pomo');
      };
    },
    tick() { const n = NN.$('#pmTime', this.el); if (n && P.st().running) this.render(this.el); },
  });
  function confirmSwitch(page) {
    if (page._confirm && page._confirm > Date.now()) { page._confirm = 0; return true; }
    page._confirm = Date.now() + 2500; NN.toast('Timer sedang berjalan. Klik lagi untuk ganti mode', 'warning', 'var(--warn)');
    return false;
  }

  NN.compactProvider(vert => {
    const s = P.st();
    if (!P.started()) return null;
    const col = s.mode === 'focus' ? 'var(--warn)' : '#60a5fa', left = P.left();
    const txt = NN.fmtClock(left);
    return { prio: s.running ? 6 : 1.5, kind: 'pomo', html: NN.ring(17, 2.6, left / P.len(s.mode), col) + '<span class="c-stat" style="color:' + col + (s.running ? '' : ';opacity:.6') + '">' + (vert ? txt.replace(':', '<br>') : txt) + '</span>' };
  });
  NN.slot('pomo', { label: 'Timer Pomodoro', render: vert => {
    const s = P.st(), col = s.mode === 'focus' ? 'var(--warn)' : '#60a5fa', left = P.left(), txt = NN.fmtClock(left);
    return { kind: 'pomo', html: NN.ring(17, 2.6, left / P.len(s.mode), col) + '<span class="c-stat" style="color:' + col + (s.running ? '' : ';opacity:.6') + '">' + (vert ? txt.replace(':', '<br>') : txt) + '</span>' };
  } });
})();
