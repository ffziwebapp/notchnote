/* NotchNote - jembatan antarmuka ke aplikasi Rust (Tauri). Nama panggilan & sinyal sama dengan versi Python. */
(function () {
  'use strict';
  const T = window.__TAURI__;
  if (!T || !T.core) return;
  const SIGNALS = ['layout', 'active', 'hotkey', 'status', 'clips', 'clipNew', 'apiStatus', 'ai', 'media', 'lyrics', 'track', 'stats', 'cursor', 'lyricsResults'];
  const cache = {};
  window.TauriBridge = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string') return undefined;
      if (cache[name]) return cache[name];
      if (SIGNALS.indexOf(name) >= 0) {
        cache[name] = { connect(fn) { T.event.listen(name, e => { try { fn(e.payload); } catch (err) { console.error(name, err); } }); } };
      } else {
        cache[name] = function () {
          const a = Array.prototype.slice.call(arguments);
          const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null;
          T.core.invoke('call', { name, args: a }).then(r => { if (cb) cb(r); }, err => { console.error('call', name, err); if (cb) cb(null); });
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
