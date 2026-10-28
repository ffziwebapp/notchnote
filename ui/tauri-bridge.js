/* NotchNote - jembatan antarmuka ke aplikasi Rust (Tauri). Nama panggilan & sinyal sama dengan versi Python. */
(function () {
  'use strict';
  const T = window.__TAURI__;
  if (!T || !T.core) return;
  const SIGNALS = ['layout', 'active', 'hotkey', 'status', 'clips', 'clipNew', 'apiStatus', 'ai', 'media', 'lyrics', 'track', 'stats', 'cursor', 'lyricsResults'];

  /* Koreksi skala: aplikasi menghitung posisi dengan anggapan 1 piksel CSS = pz piksel layar (skala Windows x ukuran notch).
     Kalau WebView2 ternyata memakai skala lain (misalnya ukuran notch 90% belum diterapkan), semua posisi disesuaikan di sini,
     supaya notch tetap di tepi layar dan area klik tetap pas. */
  let K = 1, rawLayout = null, layoutFn = null;
  const factor = L => (L && L.pz ? L.pz / (window.devicePixelRatio || 1) : 1);
  function fix(L) {
    if (!L) return L;
    const f = factor(L);
    K = f;
    if (Math.abs(f - 1) < 0.002) return L;
    const o = Object.assign({}, L, { ax: L.ax * f, ay: L.ay * f });
    if (L.scr) o.scr = { x: L.scr.x * f, y: L.scr.y * f, w: L.scr.w * f, h: L.scr.h * f };
    return o;
  }
  window.addEventListener('resize', () => {
    if (!rawLayout || !layoutFn) return;
    const before = K, L = fix(rawLayout);
    if (Math.abs(K - before) > 0.002) layoutFn(JSON.stringify(L));
  });

  const cache = {};
  window.TauriBridge = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string') return undefined;
      if (cache[name]) return cache[name];
      if (SIGNALS.indexOf(name) >= 0) {
        cache[name] = {
          connect(fn) {
            if (name === 'layout') layoutFn = fn;
            T.event.listen(name, e => {
              let v = e.payload;
              try {
                if (name === 'layout') { rawLayout = JSON.parse(v); v = JSON.stringify(fix(rawLayout)); }
                else if (name === 'cursor' && K !== 1) { const p = String(v).split(','); v = Math.round(p[0] * K) + ',' + Math.round(p[1] * K); }
                fn(v);
              } catch (err) { console.error(name, err); }
            });
          },
        };
      } else {
        cache[name] = function () {
          const a = Array.prototype.slice.call(arguments);
          const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null;
          if (name === 'setRect' && K !== 1) for (let i = 0; i < 5; i++) a[i] = a[i] / K;
          if (name === 'dragStart' && K !== 1) { a[0] /= K; a[1] /= K; }
          T.core.invoke('call', { name, args: a }).then(r => {
            if (name === 'init' && r) {
              try { const o = JSON.parse(r); if (o.layout) { rawLayout = o.layout; o.layout = fix(o.layout); } r = JSON.stringify(o); } catch (err) { console.error(err); }
            }
            if (cb) cb(r);
          }, err => { console.error('call', name, err); if (cb) cb(null); });
        };
      }
      return cache[name];
    },
  });

  // kursor keluar dari notch (dilaporkan aplikasi): pastikan antarmuka tahu, walau WebView2 tidak mengirim pointerleave
  T.event.listen('hoverOut', () => {
    const NN = window.NN, el = document.getElementById('island');
    if (!NN || !NN.isl || !el || (!NN.isl.hovered && NN.isl.view !== 'page')) return;
    const ev = new PointerEvent('pointerleave', { bubbles: false });
    ev.nnSynthetic = true;
    el.dispatchEvent(ev);
  });
  // tanpa menu klik kanan bawaan browser
  document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, [contenteditable]')) e.preventDefault(); });
})();
