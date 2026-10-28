/* NotchNote - pengaturan lengkap di dalam notch */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const ALL_PAGES = ['tasks', 'logbook', 'notes', 'clip', 'ai', 'music', 'prayer', 'focus', 'timer'];
  const SECTIONS = [
    ['look', 'palette', 'Tampilan'], ['notch', 'notch', 'Notch'], ['mascot', 'owl', 'Notnot'], ['todo', 'checklist', 'To-do'], ['logbook', 'book', 'Logbook'], ['pomo', 'timer', 'Pomodoro'],
    ['ai', 'sparkle', 'AI'], ['music', 'music', 'Musik'], ['prayer', 'mosque', 'Sholat'], ['clip', 'clipboard', 'Klip'], ['focus', 'target', 'Produktivitas'], ['general', 'gear', 'Umum'],
  ];
  const get = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), NN.cfg);
  const set = (p, v) => { const ks = p.split('.'); let o = NN.cfg; ks.slice(0, -1).forEach(k => { o = o[k]; }); o[ks[ks.length - 1]] = v; };

  // ------------------------------------------------------------------ pembangun kontrol
  const row = (label, hint, ctl, cls) => '<div class="srow' + (cls ? ' ' + cls : '') + '"><div class="sl"><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</div>' + (ctl || '') + '</div>';
  const group = (title, rows) => '<div class="sgroup">' + (title ? '<h4>' + title + '</h4>' : '') + '<div class="scard">' + rows + '</div></div>';
  const tog = p => '<button class="tog' + (get(p) ? ' on' : '') + '" data-tog="' + p + '" role="switch" aria-checked="' + !!get(p) + '"></button>';
  const num = (p, min, max, suf) => '<div style="display:flex;align-items:center;gap:6px"><input class="inp num" data-num="' + p + '" data-min="' + min + '" data-max="' + max + '" value="' + get(p) + '" inputmode="numeric">' + (suf ? '<span class="muted" style="font-size:12px;min-width:34px">' + suf + '</span>' : '') + '</div>';
  const time = p => '<input class="inp time" data-time="' + p + '" value="' + esc(get(p)) + '" maxlength="5">';
  const seg = (p, opts) => '<div class="seg">' + opts.map(o => '<button class="' + (String(get(p)) === String(o[0]) ? 'on' : '') + '" data-seg="' + p + '" data-v="' + esc(o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
  /* daftar pilihan buatan sendiri: tetap di dalam notch (pilihan bawaan Windows membuka jendela terpisah) */
  const dd = (key, cur, opts, w) => {
    const c = opts.find(o => String(o[0]) === String(cur)) || opts[0] || ['', ''];
    return '<div class="dd" data-ddp="' + key + '"' + (w ? ' style="width:' + w + 'px"' : '') + '><button class="inp dd-b" data-ddb type="button"><span>' + esc(c[1]) + '</span>' + icon('chev-d', 14) + '</button>' +
      '<div class="dd-m scroll">' + opts.map(o => '<button type="button" class="dd-o' + (String(o[0]) === String(cur) ? ' on' : '') + '" data-ddv="' + esc(o[0]) + '">' + esc(o[1]) + '</button>').join('') + '</div></div>';
  };
  const sel = (p, opts) => dd(p, get(p), opts);
  const slotRow = (label, k, opts) => '<div class="srow"><div class="sl"><b>' + label + '</b><small>Kalau kosong (misalnya musik tidak diputar), tampilkan pilihan cadangan</small></div>' +
    '<div class="slotsel">' + sel('notch.slots.' + k, opts) + '<span class="muted" style="font-size:11.5px">cadangan</span>' + sel('notch.slots.' + k + 'Alt', opts.filter(o => o[0] !== 'music')) + '</div></div>';
  const errline = id => '<div class="err-msg hide" id="' + id + '" style="padding:0 14px 8px"></div>';

  const S = {
    look() {
      const t = NN.cfg.theme;
      const bgs = NN.BGS.map(b => '<button class="bgsw' + (b.light ? ' light' : '') + (t.bg === b.id ? ' on' : '') + '" data-bg="' + b.id + '" style="--c:' + (b.stops.length > 1 ? 'linear-gradient(180deg,' + b.stops.join(',') + ')' : b.stops[0]) + '" title="' + b.name + '">' + b.name + '</button>').join('');
      const accs = NN.ACCENTS.map(a => '<button class="sw' + (t.accent.toLowerCase() === a[0] ? ' on' : '') + '" data-acc="' + a[0] + '" style="--c:' + a[0] + '" title="' + a[1] + '"></button>').join('');
      const custom = !NN.ACCENTS.some(a => a[0] === t.accent.toLowerCase());
      return group('Latar notch', '<div class="srow col"><div class="swatches" style="gap:10px">' + bgs + '</div></div>') +
        group('Warna aksen', '<div class="srow col"><div class="swatches">' + accs +
          '<label class="sw' + (custom ? ' on' : '') + '" style="--c:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);cursor:pointer" title="Warna sendiri"><input type="color" data-color onclick="NN.dialog=true" value="' + esc(t.accent) + '" style="opacity:0;width:100%;height:100%;cursor:pointer"></label></div></div>') +
        group('Tampilan', row('Ukuran notch', 'Perbesar kalau teks terasa kecil', seg('theme.scale', [[90, '90%'], [100, '100%'], [110, '110%'], [125, '125%']])) +
          row('Ketebalan huruf', 'Pilih yang paling nyaman dibaca di layarmu', seg('theme.weight', [['thin', 'Tipis'], ['normal', 'Normal'], ['bold', 'Tebal']])) +
          row('Kepekatan latar', 'Turunkan supaya sedikit tembus pandang', seg('theme.opacity', [[75, '75%'], [88, '88%'], [100, '100%']])) +
          row('Cahaya notifikasi', 'Pendar berwarna di sekeliling notch saat ada pemberitahuan', tog('theme.glow')) +
          row('Animasi', 'Kurangi gerak memakai animasi yang lebih tenang', seg('theme.motion', [['normal', 'Normal'], ['reduce', 'Kurangi gerak']])) +
          row('Mode kompatibilitas', 'Nyalakan kalau muncul kotak hitam di sekitar notch', tog('theme.compat')));
    },
    notch() {
      const d = NN.isl.layout.dock;
      const docks = [['top', 'Atas', 'left:18px;top:0;width:20px;height:5px;border-radius:0 0 3px 3px'], ['bottom', 'Bawah', 'left:18px;bottom:0;width:20px;height:5px;border-radius:3px 3px 0 0'],
        ['left', 'Kiri', 'left:0;top:10px;width:5px;height:14px;border-radius:0 3px 3px 0'], ['right', 'Kanan', 'right:0;top:10px;width:5px;height:14px;border-radius:3px 0 0 3px'],
        ['float', 'Melayang', 'left:16px;top:8px;width:22px;height:7px;border-radius:4px']];
      const pages = NN.cfg.notch.pages.concat(ALL_PAGES.filter(p => NN.cfg.notch.pages.indexOf(p) < 0));
      const slotOpts = NN.SLOT_ORDER.filter(id => NN.slots[id]).map(id => [id, NN.slots[id].label]);
      const vert = NN.vertical();
      return group('Posisi', '<div class="srow col"><div class="dockpick">' + docks.map(k => '<button class="dk' + (d === k[0] ? ' on' : '') + '" data-dock="' + k[0] + '"><span class="scr"><i style="' + k[2] + '"></i></span>' + k[1] + '</button>').join('') + '</div>' +
        '<small class="muted" style="font-size:11.5px;margin-top:8px">Bisa juga dengan menarik notch: dekatkan ke tepi layar untuk menempel, lepas di tengah layar untuk melayang.</small></div>' +
        row('Kunci posisi', 'Notch tidak bisa digeser', tog('notch.lock')) +
        row('Kembalikan ke tengah atas', '', '<button class="btn sm" data-do="resetpos">' + icon('refresh', 14) + 'Kembalikan</button>')) +
        group('Notch kecil', slotRow(vert ? 'Slot atas' : 'Slot kiri', 'left', slotOpts) +
          slotRow('Slot tengah', 'center', slotOpts) +
          slotRow(vert ? 'Slot bawah' : 'Slot kanan', 'right', slotOpts) +
          row('Info penting boleh mengambil alih', 'Timer berjalan dan sholat kurang dari 15 menit sementara tampil di slot ' + (vert ? 'bawah' : 'kanan'), tog('notch.takeover'))) +
        group('Perilaku', row('Buka saat kursor diarahkan', 'Tanpa perlu klik', tog('notch.hover')) +
          row('Jadwal sholat di notch kecil', 'Muncul 15 menit sebelum waktu sholat', tog('notch.peekPrayer')) +
          row('Sembunyikan saat layar penuh', 'Saat menonton video atau main game', tog('notch.hideFullscreen'))) +
        group('Halaman', '<div class="pgl">' + pages.map((p, i) => {
          const on = NN.cfg.notch.pages.indexOf(p) >= 0, P = NN.pages[p];
          return '<div class="pgi"><span style="color:var(--fg2)">' + icon(P.icon, 17) + '</span><span' + (on ? '' : ' class="faint"') + '>' + P.label + '</span>' +
            (on ? '<button class="ibtn" data-pmv="' + p + '" data-d="-1" title="Naikkan"' + (i === 0 ? ' disabled style="opacity:.3"' : '') + '>' + icon('chev-u', 15) + '</button><button class="ibtn" data-pmv="' + p + '" data-d="1" title="Turunkan">' + icon('chev-d', 15) + '</button>' : '') +
            '<button class="tog' + (on ? ' on' : '') + '" data-pg="' + p + '"></button></div>';
        }).join('') + '</div>') + errline('pgErr');
    },
    todo() {
      const r = NN.cfg.todo.remind;
      return group('Pengingat harian', row('Pengingat pagi', 'Daftar tugas hari ini muncul saat kamu mulai memakai komputer', time('todo.morningTime') + tog('todo.morning')) + errline('e-todo.morningTime') +
          row('Ajakan rencana besok', 'Kalau to-do besok masih kosong', time('todo.eveningTime') + tog('todo.evening')) + errline('e-todo.eveningTime') +
          row('Bawa tugas yang belum selesai', 'Pindah otomatis ke hari ini dengan label "dari kemarin"', tog('todo.carry'))) +
        group('Tugas berjam', '<div class="srow col"><div class="sl"><b>Pengingat bawaan</b><small>Dipakai saat menambah tugas yang punya jam</small></div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
          [[0, 'Tepat waktu'], [10, '10 menit'], [30, '30 menit'], [60, '1 jam'], [1440, '1 hari']].map(x => '<button class="chip sm' + (r.indexOf(x[0]) >= 0 ? ' on' : '') + '" data-rmd="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
          row('Bunyi pengingat', 'Bunyi singkat saat pengingat tugas muncul', tog('todo.sound')));
    },
    pomo() {
      const c = NN.cfg.pomo;
      return group('Durasi', row('Fokus', '', num('pomo.focus', 1, 180, 'menit')) + errline('e-pomo.focus') +
          row('Istirahat', '', num('pomo.short', 1, 60, 'menit')) + errline('e-pomo.short') +
          row('Istirahat panjang', '', num('pomo.long', 1, 90, 'menit')) + errline('e-pomo.long') +
          row('Istirahat panjang setiap', '', num('pomo.every', 2, 10, 'sesi')) + errline('e-pomo.every') +
          row('Lanjut otomatis', 'Sesi berikutnya langsung berjalan', tog('pomo.autoNext'))) +
        group('Alarm', row('Alarm saat selesai', 'Bunyi berulang sampai dimatikan', tog('pomo.alarm')) +
          row('Lama alarm', 'Berhenti sendiri setelah', num('pomo.alarmSec', 3, 600, 'detik')) + errline('e-pomo.alarmSec') +
          row('Suara alarm', c.sound ? esc(c.sound.split(/[\\/]/).pop()) : 'Bawaan (dua nada)',
            '<button class="btn sm" data-snd="pomo.sound">' + icon('folder', 14) + 'Pilih .wav</button>' + (c.sound ? '<button class="btn sm ghost" data-sndclr="pomo.sound">Bawaan</button>' : '') +
            '<button class="btn sm ghost" data-try="alarm" data-file="' + esc(c.sound) + '">' + icon('volume', 14) + 'Coba</button>'));
    },
    ai() {
      const keys = NN.ai.keys;
      const card = k => {
        const P = NN.PROV[k], has = keys[k];
        let body;
        if (P.local) {
          body = '<div class="srow col"><div class="sl"><b>AI lokal, gratis dan offline</b><small>Pasang Ollama dari ollama.com, lalu jalankan di Command Prompt: <span class="kbd">ollama pull ' + esc(NN.cfg.ai.models.ollama) + '</span>. Butuh RAM sekitar 8 GB atau lebih.</small></div>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><a class="muted" style="font-size:12px;cursor:pointer;text-decoration:underline" data-act="open-url" data-url="' + P.keyUrl + '">Unduh Ollama</a>' +
            '<button class="btn sm ghost" data-keytest="' + k + '">' + icon('refresh', 13) + 'Tes koneksi</button><span id="ktest-' + k + '" style="font-size:12px"></span></div></div>' +
            row('Alamat server', '', '<input class="inp" data-txt="ai.ollamaUrl" value="' + esc(NN.cfg.ai.ollamaUrl) + '" style="width:210px">');
        } else {
          body = '<div class="srow col"><div class="sl"><b>API key</b><small>' + (has ? 'Tersimpan (' + esc(has) + '). Chat langsung dari notch aktif.' :
              (P.free ? 'Belum ada. ' + P.name + ' punya pilihan gratis tanpa kartu kredit.' : 'Belum ada. Tanpa API key, pertanyaan dibuka di web ' + P.name + '.')) + '</small></div>' +
            '<div class="keyrow" style="margin-top:8px"><input class="inp" type="password" data-key="' + k + '" placeholder="' + (has ? 'Ganti API key' : 'Tempel API key di sini') + '" autocomplete="off" spellcheck="false">' +
            '<button class="btn sm pri" data-keysave="' + k + '">Simpan</button>' + (has ? '<button class="btn sm ghost danger" data-keydel="' + k + '">Hapus</button>' : '') + '</div>' +
            '<div class="err-msg hide" id="kerr-' + k + '"></div>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-top:4px"><a class="muted" style="font-size:12px;cursor:pointer;text-decoration:underline" data-act="open-url" data-url="' + P.keyUrl + '">Dapatkan API key</a>' +
            (has ? '<button class="btn sm ghost" data-keytest="' + k + '">' + icon('refresh', 13) + 'Tes koneksi</button><span id="ktest-' + k + '" style="font-size:12px"></span>' : '') + '</div></div>' +
            (k === 'claude' ? row('Workspace ID', 'Hanya perlu kalau API key tidak terikat ke workspace (diawali wrkspc_)', '<input class="inp" data-txt="ai.workspace" value="' + esc(NN.cfg.ai.workspace) + '" placeholder="opsional" style="width:190px">') : '');
        }
        return '<div class="sgroup"><h4 style="display:flex;align-items:center;gap:8px"><span class="plogo" style="--pc:' + P.color + '">' + P.mark + '</span>' + P.name +
          (P.free ? '<span class="pill ok" style="text-transform:none;letter-spacing:0">gratis</span>' : '') + '</h4><div class="scard">' + body +
          row('Model', 'Ganti kalau model lama sudah tidak tersedia', '<input class="inp" data-txt="ai.models.' + k + '" value="' + esc(NN.cfg.ai.models[k] || '') + '" style="width:190px">') +
          '</div></div>';
      };
      return group('AI utama', '<div class="srow col"><div class="sl"><b>Pilihan bawaan</b><small>Dipakai saat membuka AI dan pintasan Ctrl+Alt+Space</small></div><div style="margin-top:8px">' +
          seg('ai.provider', [['claude', 'Claude'], ['openai', 'ChatGPT'], ['gemini', 'Gemini'], ['groq', 'Groq'], ['openrouter', 'OpenRouter'], ['ollama', 'Ollama']]) + '</div></div>') +
        '<div class="faint" style="font-size:11.5px;line-height:1.5;margin:-4px 2px 12px">Gratis: Groq (sekitar 1.000 chat/hari), Gemini Flash-Lite, OpenRouter (model gratis, sekitar 50 chat/hari), dan Ollama (di komputermu sendiri). Batas gratis bisa berubah sewaktu-waktu.</div>' +
        ['groq', 'gemini', 'openrouter', 'ollama', 'claude', 'openai'].map(card).join('') +
        group('Gaya jawaban', '<div class="srow col"><div class="sl"><b>Instruksi untuk AI</b><small>Dikirim di awal setiap percakapan</small></div>' +
          '<textarea class="inp" data-txt="ai.system" rows="3" style="margin-top:8px">' + esc(NN.cfg.ai.system) + '</textarea></div>') +
        '<div class="faint" style="font-size:11.5px;line-height:1.5;margin:-4px 2px 10px">API key disimpan terenkripsi di komputer ini dan hanya dikirim ke penyedia AI-nya. Layanan gratis bisa memakai isi chat untuk melatih modelnya; hindari data sensitif.</div>';
    },
    mascot() {
      const m = NN.cfg.mascot;
      const reacts = [['hover', 'Bergoyang saat kursor datang'], ['music', 'Bersenandung saat musik diputar'], ['focus', 'Memakai kacamata saat sesi fokus'],
        ['distract', 'Cemas saat terlalu lama di aplikasi distraksi'], ['alert', 'Melompat saat ada pengingat'], ['sleep', 'Mengantuk saat komputer lama tidak dipakai atau sudah malam'],
        ['happy', 'Senang saat semua tugas hari ini selesai']];
      return '<div class="sgroup"><div class="scard"><div class="srow"><div class="owl-stage">' + NN.owl(84, { live: true, full: true }) +
        '<div class="sl"><b style="font-size:16px">Halo, aku Notnot!</b><small>Aku menemani di notch, mengikuti kursormu, dan berekspresi sesuai yang sedang kamu kerjakan. Klik aku untuk menyapa.</small>' +
        '<div class="owl-try">' + [['idle', 'Biasa'], ['music', 'Musik'], ['focus', 'Fokus'], ['worry', 'Cemas'], ['alert', 'Pengingat'], ['sleep', 'Mengantuk'], ['happy', 'Senang']]
          .map(x => '<button class="chip sm" data-owl="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div></div></div></div></div>' +
        group('Notnot', row('Tampilkan Notnot', 'Di notch kecil dan di bagian atas panel', tog('mascot.on')) +
          row('Mata mengikuti kursor', 'Membaca posisi kursor di seluruh layar (ringan)', tog('mascot.eyes'))) +
        group('Ekspresi', reacts.map(r => row(r[1], '', tog('mascot.react.' + r[0]))).join(''));
    },
    prayer() {
      const c = NN.cfg.prayer, inList = NN.CITIES.some(x => x[0] === c.city);
      const cities = NN.CITIES.map(x => [x[0], x[0]]).concat([['__custom', 'Lainnya (isi koordinat)']]);
      const names = [['imsak', 'Imsak'], ['subuh', 'Subuh'], ['terbit', 'Terbit'], ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya']];
      return group('Lokasi', row('Kota', 'Dipakai juga untuk cuaca', dd('__city', inList ? c.city : '__custom', cities, 200)) +
          (!inList || this._custom ? row('Koordinat', 'Lintang dan bujur, contoh -6.20 dan 106.84',
            '<input class="inp" data-coord="lat" value="' + c.lat + '" style="width:86px"><input class="inp" data-coord="lon" value="' + c.lon + '" style="width:86px"><input class="inp" data-coord="name" value="' + esc(inList ? '' : c.city) + '" placeholder="Nama" style="width:90px">') + errline('e-coord') : '')) +
        group('Perhitungan', row('Metode', '', sel('prayer.method', Object.keys(PrayCalc.METHODS).map(k => [k, PrayCalc.METHODS[k].name]))) +
          row('Ashar', '', seg('prayer.asr', [['std', "Syafi'i"], ['hanafi', 'Hanafi']])) +
          row('Ihtiyat', 'Tambahan menit pengaman (Kemenag memakai 2)', num('prayer.ihtiyat', 0, 10, 'menit')) + errline('e-prayer.ihtiyat') +
          row('Koreksi per waktu', 'Geser beberapa menit kalau berbeda dengan masjid setempat', '<div style="display:flex;gap:4px">' +
            [['subuh', 'Sbh'], ['dzuhur', 'Dzh'], ['ashar', 'Asr'], ['maghrib', 'Mgr'], ['isya', 'Isy']].map(k => '<label style="display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:var(--fg2)"><input class="inp num" style="width:44px;padding:0 4px" data-adj="' + k[0] + '" value="' + (c.adj[k[0]] || 0) + '">' + k[1] + '</label>').join('') + '</div>')) +
        group('Pengingat', '<div class="srow col"><div class="sl"><b>Beri tahu saat waktu</b></div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
          names.map(n => '<button class="chip sm' + (c.notify[n[0]] ? ' on' : '') + '" data-pn="' + n[0] + '">' + n[1] + '</button>').join('') + '</div></div>' +
          row('Ingatkan sebelumnya', 'Isi 0 untuk mematikan', num('prayer.before', 0, 60, 'menit')) + errline('e-prayer.before') +
          row('Suara', c.sound === 'file' && c.soundFile ? esc(c.soundFile.split(/[\\/]/).pop()) : '', seg('prayer.sound', [['chime', 'Lembut'], ['file', 'Berkas sendiri'], ['none', 'Tanpa suara']])) +
          (c.sound === 'file' ? row('Berkas suara (.wav)', 'Misalnya rekaman adzan', '<button class="btn sm" data-snd="prayer.soundFile">' + icon('folder', 14) + 'Pilih .wav</button><button class="btn sm ghost" data-try="file" data-file="' + esc(c.soundFile) + '">' + icon('volume', 14) + 'Coba</button>') : ''));
    },
    clip() {
      return group('Klip', row('Simpan teks yang disalin', 'Teks dari pengelola kata sandi tidak ikut disimpan', tog('clip.text')) +
          row('Notifikasi screenshot', 'Muncul pratinjau saat screenshot tersimpan', tog('clip.notify')) +
          row('Jumlah maksimum', 'Item lama terhapus otomatis, kecuali yang disematkan', num('clip.max', 10, 300, 'item')) + errline('e-clip.max') +
          row('Hapus semua klip', '', '<button class="btn sm ghost danger" data-do="clearclips">' + icon('trash', 14) + 'Hapus semua</button>'));
    },
    focus() {
      const ta = (p, t) => '<div class="srow col"><div class="sl"><b>' + t + '</b></div><textarea class="inp textarea-list" data-list="' + p + '" spellcheck="false" style="margin-top:6px">' + esc(get(p).join('\n')) + '</textarea></div>';
      return group('Pengingat', row('Pengingat distraksi', 'Isi 0 untuk mematikan', num('focus.distract', 0, 180, 'menit')) + errline('e-focus.distract') +
          row('Saat sesi Pomodoro', '', num('focus.distractPomo', 0, 60, 'menit')) + errline('e-focus.distractPomo') +
          row('Dianggap idle setelah', 'Tanpa gerakan mouse/keyboard', num('focus.idle', 30, 3600, 'detik')) + errline('e-focus.idle')) +
        group('Daftar (satu baris satu entri)', ta('focus.productive_apps', 'Aplikasi produktif (nama .exe)') + ta('focus.distracting_apps', 'Aplikasi distraksi') +
          ta('focus.productive_keywords', 'Kata kunci produktif (judul jendela/tab)') + ta('focus.distracting_keywords', 'Kata kunci distraksi'));
    },
    logbook() {
      const txt = p => '<input class="inp" data-txt="' + p + '" value="' + esc(get(p) || '') + '" maxlength="80" style="width:230px">';
      return group('Pencatatan', row('Catat to-do yang selesai otomatis', 'Saat tugas dicentang selesai, langsung masuk logbook beserta jamnya', tog('logbook.auto')) +
          row('Ringkasan sore', 'Pengingat untuk memeriksa logbook sebelum pulang (Senin sampai Jumat)', time('logbook.recapTime') + tog('logbook.recap')) + errline('e-logbook.recapTime')) +
        group('Kepala laporan', row('Nama', 'Muncul di bagian atas laporan', txt('logbook.name')) +
          row('Jabatan', '', txt('logbook.role')) +
          row('Unit kerja', '', txt('logbook.unit'))) +
        group('Isi laporan', row('Ringkasan produktivitas', 'Waktu produktif, persentase, dan aplikasi yang paling sering dipakai', tog('logbook.prod')) +
          row('Tulis prioritas tugas', 'Misalnya "(prioritas tinggi)" di belakang kegiatan', tog('logbook.prio')));
    },
    music() {
      return group('Lirik', row('Lirik di halaman Musik', 'Matikan kalau hanya ingin kontrol musik. Bisa juga lewat tombol lirik di halaman Musik.', tog('music.showLyr')) +
          row('Lirik di notch kecil', 'Baris lirik berjalan di notch saat lagu diputar', tog('notch.lyrics')) +
          row('Ukuran lirik', 'Di halaman Musik', seg('music.lyrSize', [['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']])) +
          row('Majukan lirik (semua lagu)', 'Kalau lirik sering terlambat dari suara penyanyi, pilih nilai plus. Untuk satu lagu saja, atur di halaman Musik.',
            seg('music.lead', [[-0.5, '−0,5 d'], [0, '0'], [0.3, '+0,3 d'], [0.6, '+0,6 d'], [1, '+1 d']]))) +
        group('Tampilan', row('Latar dari sampul album', 'Warna halaman Musik mengikuti sampul lagu yang diputar', tog('music.artBg')));
    },
    general() {
      const hk = [['Ctrl+Alt+Space', 'Tanya AI'], ['Ctrl+Alt+N', 'Catatan baru'], ['Ctrl+Alt+T', 'Tambah tugas'], ['Ctrl+Alt+H', 'Buka atau tutup notch']];
      return group('Umum', row('Mulai bersama Windows', 'NotchNote menyala otomatis saat komputer hidup', '<button class="tog" id="autoTog" data-auto></button>') +
          row('Pintasan keyboard', hk.map(h => '<span class="kbd">' + h[0] + '</span> ' + h[1]).join('<br>'), tog('general.hotkeys')) +
          row('Cuaca di baris status', 'Dari Open-Meteo, memakai kota di pengaturan Sholat', tog('general.weather'))) +
        group('Coba pengingat', '<div class="srow col"><div class="sl"><b>Lihat contoh setiap pemberitahuan</b><small>Muncul di notch persis seperti aslinya, lengkap dengan bunyinya. Datamu tidak berubah.</small></div>' +
          '<div class="demos">' + NN.DEMOS.map(d => '<button class="chip sm" data-demo="' + d[0] + '">' + icon(d[1], 14) + d[2] + '</button>').join('') + '</div></div>') +
        group('Data', row('Folder data', 'Semua data tersimpan hanya di komputer ini', '<button class="btn sm" data-do="folder">' + icon('folder', 14) + 'Buka folder</button>') +
          row('Reset statistik fokus hari ini', '', '<button class="btn sm ghost danger" data-do="resetstats">Reset</button>')) +
        group('Tentang', row('NotchNote ' + esc((NN.init && NN.init.version) || ''), 'Berjalan dari: ' + esc((NN.init && NN.init.appPath) || '-') + '. Folder versi lama boleh dihapus.', '') +
          row('Keluar dari NotchNote', 'Bisa dibuka lagi dari menu Start atau shortcut', '<button class="btn sm danger" data-do="quit">' + icon('power', 14) + (this._quit > Date.now() ? 'Yakin? Klik lagi' : 'Keluar') + '</button>'));
    },
  };

  NN.page('settings', {
    icon: 'gear', label: 'Pengaturan',
    size: () => [760, 500],
    init() {
      this.sec = 'look';
      NN.on('ai', s => {
        const ev = JSON.parse(s);
        if (!String(ev.id).startsWith('test-')) return;
        const k = ev.id.split('-')[1], n = NN.$('#ktest-' + k);
        if (!n) return;
        if (ev.type === 'chunk') { n._ok = true; return; }
        if (ev.type === 'error') { n.style.color = 'var(--bad)'; n.textContent = ev.text; }
        else { n.style.color = 'var(--ok)'; n.textContent = 'Terhubung'; }
      });
    },
    back() { return false; },
    render(el, sub) {
      this.el = el;
      if (sub && S[sub]) this.sec = sub;
      const body = S[this.sec].call(this);
      el.innerHTML = '<div class="hdr"><h2>' + icon('gear', 20) + 'Pengaturan</h2><div class="sp"></div><span class="faint" style="font-size:12px" id="setSaved"></span>' +
        '<button class="ibtn" data-do="close" title="Tutup">' + icon('x', 16) + '</button></div>' +
        '<div class="set"><div class="snav">' + SECTIONS.map(s => '<button class="' + (s[0] === this.sec ? 'on' : '') + '" data-sec="' + s[0] + '">' + icon(s[1], 17) + s[2] + '</button>').join('') + '</div>' +
        '<div class="sbody scroll" id="sbody">' + body + '</div></div>';
      if (this.sec === 'general') NN.call('getAutostart').then(v => { const t = NN.$('#autoTog'); if (t) t.classList.toggle('on', !!v); });
      this.bind(el);
    },
    rerender() { const sb = NN.$('#sbody', this.el), top = sb ? sb.scrollTop : 0; this.render(this.el); const nb = NN.$('#sbody', this.el); if (nb) nb.scrollTop = top; },
    saved(p) {
      NN.save('cfg');
      effects(p);
      const s = NN.$('#setSaved', this.el); if (s) { s.textContent = 'Tersimpan'; clearTimeout(s._t); s._t = setTimeout(() => { s.textContent = ''; }, 1400); }
    },
    bind(el) {
      const self = this;
      const showErr = (id, msg, inp) => { const e = NN.$('#' + CSS.escape(id), el); if (e) { e.textContent = msg; e.classList.toggle('hide', !msg); } if (inp) inp.classList.toggle('err', !!msg); };
      el.onclick = e => {
        const t = e.target;
        const dm = t.closest('[data-demo]'); if (dm) { NN.demo(dm.dataset.demo); return; }
        const ddb = t.closest('[data-ddb]'), ddo = t.closest('[data-ddv]');
        NN.$$('.dd.open', el).forEach(d => { if (!ddb || d !== ddb.parentNode) d.classList.remove('open', 'up'); });
        if (ddb) {
          const d = ddb.parentNode, body = NN.$('#sbody', el);
          if (d.classList.contains('open')) { d.classList.remove('open', 'up'); return; }
          const r = d.getBoundingClientRect(), b = body.getBoundingClientRect();
          d.classList.toggle('up', b.bottom - r.bottom < 236 && r.top - b.top > b.bottom - r.bottom);
          d.classList.add('open');
          const on = NN.$('.dd-o.on', d); if (on) on.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (ddo) {
          const d = ddo.closest('.dd'), key = d.dataset.ddp, v = ddo.dataset.ddv;
          d.classList.remove('open', 'up');
          if (key === '__city') {
            if (v === '__custom') { self._custom = true; self.rerender(); return; }
            const c = NN.CITIES.find(x => x[0] === v); self._custom = false;
            Object.assign(NN.cfg.prayer, { city: c[0], lat: c[1], lon: c[2] }); self.saved('prayer.city'); self.rerender(); return;
          }
          const cur = get(key);
          set(key, typeof cur === 'number' ? +v : v); self.saved(key); self.rerender(); return;
        }
        const sec = t.closest('[data-sec]'); if (sec) { self.sec = sec.dataset.sec; self.render(el); return; }
        const tg = t.closest('[data-tog]'); if (tg) { const p = tg.dataset.tog; set(p, !get(p)); tg.classList.toggle('on', get(p)); self.saved(p); return; }
        const sg = t.closest('[data-seg]'); if (sg) { const p = sg.dataset.seg, cur = get(p); set(p, typeof cur === 'number' ? +sg.dataset.v : sg.dataset.v); self.saved(p); self.rerender(); return; }
        const bg = t.closest('[data-bg]'); if (bg) { NN.cfg.theme.bg = bg.dataset.bg; self.saved('theme.bg'); self.rerender(); return; }
        const ac = t.closest('[data-acc]'); if (ac) { NN.cfg.theme.accent = ac.dataset.acc; self.saved('theme.accent'); self.rerender(); return; }
        const dk = t.closest('[data-dock]'); if (dk) { NN.call('setDock', dk.dataset.dock); setTimeout(() => self.rerender(), 400); return; }
        const pg = t.closest('[data-pg]');
        if (pg) {
          const p = pg.dataset.pg, list = NN.cfg.notch.pages, i = list.indexOf(p);
          if (i >= 0) { if (list.length <= 1) { showErr('pgErr', 'Minimal satu halaman harus tampil'); return; } list.splice(i, 1); } else list.push(p);
          self.saved('notch.pages'); self.rerender(); return;
        }
        const mv = t.closest('[data-pmv]');
        if (mv) { const list = NN.cfg.notch.pages, i = list.indexOf(mv.dataset.pmv), j = i + +mv.dataset.d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; self.saved('notch.pages'); self.rerender(); return; }
        const rm = t.closest('[data-rmd]');
        if (rm) { const r = NN.cfg.todo.remind, v = +rm.dataset.rmd, i = r.indexOf(v); if (i >= 0) r.splice(i, 1); else r.push(v); r.sort((a, b) => a - b); self.saved('todo.remind'); self.rerender(); return; }
        const pn = t.closest('[data-pn]'); if (pn) { const n = NN.cfg.prayer.notify; n[pn.dataset.pn] = !n[pn.dataset.pn]; self.saved('prayer.notify'); self.rerender(); return; }
        const snd = t.closest('[data-snd]');
        if (snd) { NN.dialog = true; NN.call('pickSound').then(path => { NN.dialog = false; if (path) { set(snd.dataset.snd, path); self.saved(snd.dataset.snd); self.rerender(); } }); return; }
        const ow = t.closest('[data-owl]'); if (ow) { NN.owlCtl.try(ow.dataset.owl === 'idle' ? 'none' : ow.dataset.owl); return; }
        const sc = t.closest('[data-sndclr]'); if (sc) { set(sc.dataset.sndclr, ''); self.saved(sc.dataset.sndclr); self.rerender(); return; }
        const tr = t.closest('[data-try]');
        if (tr) { const f = tr.dataset.file; NN.call('playSound', f, f ? 'file' : tr.dataset.try, false, 4); clearTimeout(self._tt); self._tt = setTimeout(() => NN.call('stopSound'), 4000); return; }
        const ks = t.closest('[data-keysave]');
        if (ks) {
          const k = ks.dataset.keysave, inp = NN.$('[data-key="' + k + '"]', el), v = inp.value.trim();
          if (!v) { showErr('kerr-' + k, 'Tempel API key-nya dulu', inp); inp.focus(); return; }
          if (v.length < 20 || /\s/.test(v)) { showErr('kerr-' + k, 'API key terlihat tidak lengkap. Salin ulang dari halaman penyedia.', inp); return; }
          NN.call('setApiKey', k, v).then(st => { if (st) NN.ai.keys = JSON.parse(st); self.rerender(); NN.toast('API key ' + NN.PROV[k].name + ' tersimpan', 'key'); });
          return;
        }
        const kd = t.closest('[data-keydel]'); if (kd) { NN.call('setApiKey', kd.dataset.keydel, '').then(st => { if (st) NN.ai.keys = JSON.parse(st); self.rerender(); }); return; }
        const kt = t.closest('[data-keytest]');
        if (kt) { const k = kt.dataset.keytest, n = NN.$('#ktest-' + k, el); n.style.color = 'var(--fg2)'; n.textContent = 'Menguji…'; NN.call('aiSend', 'test-' + k + '-' + NN.uid(), k, NN.cfg.ai.models[k], JSON.stringify([{ role: 'user', content: 'Balas satu kata: OK' }]), ''); return; }
        const au = t.closest('[data-auto]');
        if (au) { const want = !au.classList.contains('on'); NN.call('setAutostart', want).then(ok => { au.classList.toggle('on', ok ? want : !want); if (!ok) NN.toast('Gagal mengubah pengaturan mulai otomatis', 'warning', 'var(--bad)'); else self.saved(); }); return; }
        const d = t.closest('[data-do]'); if (!d) return;
        const k = d.dataset.do;
        if (k === 'close') NN.collapse();
        else if (k === 'resetpos') NN.call('setDock', 'reset');
        else if (k === 'clearclips') { NN.call('clearClips'); NN.toast('Klip dibersihkan', 'trash', 'var(--fg2)'); }
        else if (k === 'folder') NN.call('openDataFolder');
        else if (k === 'resetstats') { NN.call('resetStats'); NN.toast('Statistik hari ini direset', 'refresh'); }
        else if (k === 'quit') { if (self._quit > Date.now()) { NN.flushSaves(); setTimeout(() => NN.call('quit'), 400); } else { self._quit = Date.now() + 3000; self.rerender(); } }
      };
      el.oninput = e => {
        const t = e.target;
        if (t.dataset.txt) { set(t.dataset.txt, t.value); self.saved(t.dataset.txt); return; }
        if (t.dataset.list) { set(t.dataset.list, t.value.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)); self.saved(t.dataset.list); return; }
        if (t.dataset.color !== undefined && t.type === 'color') { NN.dialog = false; NN.cfg.theme.accent = t.value; self.saved('theme.accent'); return; }
        if (t.dataset.key) { showErr('kerr-' + t.dataset.key, '', t); }
        if (t.classList.contains('err')) { t.classList.remove('err'); }
      };
      el.onchange = e => {
        const t = e.target;
        if (t.dataset.num) {
          const p = t.dataset.num, v = Number(t.value.trim()), lo = +t.dataset.min, hi = +t.dataset.max;
          if (!t.value.trim() || !Number.isInteger(v) || v < lo || v > hi) { showErr('e-' + p, 'Isi angka bulat ' + lo + '–' + hi, t); return; }
          showErr('e-' + p, '', t); set(p, v); self.saved(p); return;
        }
        if (t.dataset.time) {
          const p = t.dataset.time, v = NN.normTime(t.value);
          if (!v) { showErr('e-' + p, 'Format jam belum benar. Contoh: 07:00', t); return; }
          showErr('e-' + p, '', t); t.value = v; set(p, v); self.saved(p); return;
        }
        if (t.dataset.sel) { set(t.dataset.sel, t.value); self.saved(t.dataset.sel); self.rerender(); return; }
        if (t.dataset.color !== undefined && t.type === 'color') { self.rerender(); return; }
        if (t.dataset.city !== undefined) {
          if (t.value === '__custom') { self._custom = true; self.rerender(); return; }
          const c = NN.CITIES.find(x => x[0] === t.value); self._custom = false;
          Object.assign(NN.cfg.prayer, { city: c[0], lat: c[1], lon: c[2] }); self.saved('prayer.city'); self.rerender(); return;
        }
        if (t.dataset.coord) {
          const lat = parseFloat(NN.$('[data-coord="lat"]', el).value), lon = parseFloat(NN.$('[data-coord="lon"]', el).value), name = NN.$('[data-coord="name"]', el).value.trim();
          if (!(lat >= -66 && lat <= 66) || !(lon >= -180 && lon <= 180)) { showErr('e-coord', 'Lintang harus -66 sampai 66 dan bujur -180 sampai 180', t); return; }
          showErr('e-coord', '', t);
          Object.assign(NN.cfg.prayer, { lat, lon, city: name || 'Lokasi saya' }); self.saved('prayer.city'); return;
        }
        if (t.dataset.adj) {
          const v = Number(t.value);
          if (!Number.isInteger(v) || v < -30 || v > 30) { t.classList.add('err'); NN.toast('Koreksi harus angka -30 sampai 30', 'warning', 'var(--bad)'); return; }
          t.classList.remove('err'); NN.cfg.prayer.adj[t.dataset.adj] = v; self.saved('prayer.adj');
        }
      };
    },
  });

  function effects(p) {
    p = p || '';
    if (p.startsWith('theme')) NN.applyTheme();
    if (p.startsWith('mascot')) { NN.renderStatus(); NN.owlCtl.apply(); NN.isl.ckey = ''; }
    if (p.startsWith('notch.slots')) NN.isl.ckey = '';
    if (p === 'notch.pages') NN.refreshTabs();
    if (p === 'ai.provider') { NN.chatProv = NN.cfg.ai.provider; NN.st.chat.provider = NN.chatProv; NN.save('chat'); }
    if (p.startsWith('prayer')) NN.prayer.cache = {};
    NN.renderCompact();
  }
})();
