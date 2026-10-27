/* NotchNote - maskot Notnot (burung hantu vektor yang hidup) */
(function () {
  'use strict';
  const NN = window.NN;
  let uid = 0;

  /* opsi: {full: badan + kertas, live: ikut kursor & ekspresi, sparks: tampilkan garis kuning} */
  NN.owl = function (size, o) {
    o = o || {};
    const id = 'ow' + (++uid);
    const full = !!o.full;
    const vb = full ? '0 0 120 136' : '0 4 120 96';
    const eye = (cx, side) =>
      '<g class="eye eye-' + side + '"><circle cx="' + cx + '" cy="56" r="17.5" fill="#f7f5ff"/>' +
      '<g clip-path="url(#' + id + 'c' + side + ')">' +
      '<g class="pupil"><circle cx="' + cx + '" cy="56" r="8.8" fill="#170f45"/><circle cx="' + (cx + 3.2) + '" cy="52.3" r="2.8" fill="#fff"/></g>' +
      '<rect class="lid" x="' + (cx - 19) + '" y="37" width="38" height="38" fill="url(#' + id + 'g)"/></g>' +
      '<path class="happy" d="M' + (cx - 9) + ' 59 Q' + cx + ' 48 ' + (cx + 9) + ' 59" fill="none" stroke="#170f45" stroke-width="4.2" stroke-linecap="round"/></g>';
    const body = full ?
      '<g class="owl-body">' +
      '<path d="M20 82 C10 100 16 130 52 133 C88 130 94 100 84 82 Z" fill="url(#' + id + 'g)"/>' +
      '<ellipse class="wing wing-l" cx="19" cy="106" rx="10" ry="19" transform="rotate(14 19 106)" fill="#5d4de8"/>' +
      '<ellipse class="wing wing-r" cx="85" cy="106" rx="10" ry="19" transform="rotate(-14 85 106)" fill="#5d4de8"/>' +
      '<path d="M30 96 Q30 90 36 90 L44 90 Q48 86 52 90 L68 90 Q74 90 74 96 L74 124 Q74 129 68 129 L36 129 Q30 129 30 124 Z" fill="#efecff"/>' +
      '<rect x="38" y="101" width="28" height="5.5" rx="2.75" fill="#8f80f6"/><rect x="38" y="113" width="20" height="5.5" rx="2.75" fill="#8f80f6"/>' +
      '</g>' : '';
    return '<svg class="owl' + (o.live ? ' live' : '') + (o.sparks ? ' sparky' : '') + (full ? ' full' : '') + '" width="' + size + '" height="' + Math.round(size * (full ? 136 : 96) / 120) +
      '" viewBox="' + vb + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6bf6"/><stop offset="1" stop-color="#4b39dd"/></linearGradient>' +
      '<clipPath id="' + id + 'cl"><circle cx="35" cy="56" r="17.5"/></clipPath><clipPath id="' + id + 'cr"><circle cx="69" cy="56" r="17.5"/></clipPath></defs>' +
      body +
      '<g class="owl-head">' +
      '<path d="M15 46 C11 31 13 17 20 9 C24 17 31 21 41 22 Z" fill="#6656ee"/>' +
      '<path d="M89 46 C93 31 91 17 84 9 C80 17 73 21 63 22 Z" fill="#6656ee"/>' +
      '<path d="M13 52 C11 33 23 21 40 20.5 C47 20.2 57 20.2 64 20.5 C81 21 93 33 91 52 C92 76 76 93 52 93 C28 93 12 76 13 52 Z" fill="url(#' + id + 'g)"/>' +
      eye(35, 'l') + eye(69, 'r') +
      '<path class="brow" d="M23 36 L42 32 M81 36 L62 32" stroke="#170f45" stroke-width="3.6" stroke-linecap="round" fill="none"/>' +
      '<g class="glasses" fill="none" stroke="#170f45" stroke-width="2.8"><circle cx="35" cy="56" r="19.5"/><circle cx="69" cy="56" r="19.5"/></g>' +
      '<path class="beak" d="M46 64.5 Q52 61.5 58 64.5 Q57 70.5 53.2 75.8 Q52 77.3 50.8 75.8 Q47 70.5 46 64.5 Z" fill="#f7a928"/>' +
      '</g>' +
      '<g class="sparks" stroke="#f9b934" stroke-width="4.6" stroke-linecap="round"><path d="M99 30 L104 21"/><path d="M102 41 L111 37"/><path d="M101 51 L110 53"/></g>' +
      '<g class="notes" fill="#f9b934"><g class="n1"><ellipse cx="100" cy="40" rx="4" ry="3.2"/><path d="M103.6 40 V26 L109 24" stroke="#f9b934" stroke-width="2" fill="none"/></g>' +
      '<g class="n2"><ellipse cx="108" cy="30" rx="3.2" ry="2.6"/><path d="M111 30 V19" stroke="#f9b934" stroke-width="1.8" fill="none"/></g></g>' +
      '<g class="zzz" fill="#c4bcff" font-family="Segoe UI, sans-serif" font-weight="800"><text class="z1" x="94" y="34" font-size="13">z</text><text class="z2" x="103" y="22" font-size="10">z</text></g>' +
      '<g class="stars" fill="#f9b934"><path class="s1" d="M100 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path class="s2" d="M9 22 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"/></g>' +
      '</svg>';
  };

  // ------------------------------------------------------------------ pengendali ekspresi
  const STATES = ['alert', 'worry', 'focus', 'music', 'sleep', 'happy'];
  const C = NN.owlCtl = {
    state: 'idle', cur: null, near: false,
    cfg() { return NN.cfg.mascot; },
    all() { return NN.$$('svg.owl.live'); },
    compute() {
      const m = C.cfg(); if (!m || !m.on) return 'idle';
      const r = m.react || {}, isl = NN.isl;
      if (r.alert && isl.view === 'alert' && isl.alert && isl.alert.kind !== 'toast') return 'alert';
      if (r.distract && NN.track && NN.track.cat === 'distracting' && NN.track.streak > 60) return 'worry';
      const p = NN.st.ui && NN.st.ui.pomo;
      if (r.focus && p && p.running && p.mode === 'focus') return 'focus';
      if (r.music && NN.media && NN.media.s.has && NN.media.s.playing) return 'music';
      const h = new Date().getHours();
      if (r.sleep && ((NN.track && NN.track.cat === 'idle') || h >= 23 || h < 4)) return 'sleep';
      if (r.happy && NN.tasks) { const t = NN.tasks.on(NN.today()); if (t.length && t.every(x => x.done)) return 'happy'; }
      return 'idle';
    },
    preview: null,
    apply() {
      const s = C.preview || C.compute();
      C.state = s;
      C.all().forEach(el => {
        STATES.forEach(x => el.classList.toggle('st-' + x, x === s));
        el.classList.toggle('perk', C.near && s === 'idle');
      });
    },
    react(cls, ms) {
      const m = C.cfg(); if (!m || !m.on) return;
      C.all().forEach(el => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); });
      setTimeout(() => C.all().forEach(el => el.classList.remove(cls)), ms || 800);
    },
    look(x, y) { C.cur = { x, y }; if (!C._raf) C._raf = requestAnimationFrame(C.paintEyes); },
    paintEyes() {
      C._raf = 0;
      const m = C.cfg(), follow = m && m.on && m.eyes && C.cur;
      let near = false;
      C.all().forEach(el => {
        const pupils = el.querySelectorAll('.pupil');
        if (!follow || /st-(sleep|happy)/.test(el.getAttribute('class'))) { pupils.forEach(p => p.style.transform = ''); return; }
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width * 0.43, cy = r.top + r.height * (el.classList.contains('full') ? 0.41 : 0.55);
        const dx = C.cur.x - cx, dy = C.cur.y - cy, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 160) * 3.6;
        pupils.forEach(p => { p.style.transform = 'translate(' + (dx / d * k).toFixed(2) + 'px,' + (dy / d * k * 0.85).toFixed(2) + 'px)'; });
        if (d < 150 && r.width < 60) near = true;
      });
      if (near !== C.near) { C.near = near; C.apply(); }
    },
    blinkLoop() {
      const t = 2200 + Math.random() * 4200;
      setTimeout(() => {
        if (C.state !== 'sleep' && C.state !== 'happy') C.react('blink', 170);
        C.blinkLoop();
      }, t);
    },
    try(state) {
      clearTimeout(C._pt);
      C.preview = state; C.apply();
      C._pt = setTimeout(() => { C.preview = null; C.apply(); }, 3500);
    },
  };

  NN.tickers.push(() => { if (NN.ready) C.apply(); });
  const boot = setInterval(() => {
    if (!NN.ready) return;
    clearInterval(boot);
    C.blinkLoop();
    NN.on('cursor', s => { const p = s.split(','); C.look(+p[0], +p[1]); });
    document.addEventListener('mousemove', e => C.look(e.clientX, e.clientY), { passive: true });
    document.addEventListener('click', e => { if (e.target.closest('svg.owl.live')) C.react('flap', 900); });
    NN.isl.el.addEventListener('pointerenter', () => { const m = C.cfg(); if (m && m.react && m.react.hover) C.react('wiggle', 760); });
    C.apply();
  }, 60);
})();
