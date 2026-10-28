/* NotchNote - coba pengingat: tampilkan contoh setiap jenis pemberitahuan tanpa mengubah data */
(function () {
  'use strict';
  const NN = window.NN;
  const AMBER = '#fbbf24';
  const inMin = m => { const d = new Date(Date.now() + m * 60000); return d; };

  const D = {
    task() {
      const at = inMin(10);
      NN.tasks.fire({ id: 'demo-' + NN.uid(), title: 'Contoh: Rapat koordinasi tim', date: NN.today(), time: NN.hm(at), remind: [10], done: false, created: Date.now() }, 10);
    },
    morning() {
      const now = new Date();
      NN.alert({
        kind: 'morning', color: AMBER, icon: 'sun', size: [580, 96], timeout: 12000,
        cap: 'Selamat pagi · ' + NN.HARI[now.getDay()] + ', ' + now.getDate() + ' ' + NN.BLN[now.getMonth()],
        title: '3 tugas untuk hari ini', sub: '09:00 Rapat koordinasi  ·  13:30 Revisi laporan  ·  Kirim SPJ',
        actions: [{ label: 'Lihat', cls: 'pri', act: () => { NN.open('tasks'); return 'keep'; } }],
        onClick: () => NN.open('tasks'),
      });
    },
    evening() {
      NN.alert({
        kind: 'evening', color: '#a78bfa', icon: 'moon', size: [600, 96], timeout: 30000,
        cap: 'Rencana besok', title: 'Tulis to-do untuk besok?', sub: 'Supaya pagi nanti langsung tahu mulai dari mana',
        actions: [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Tulis', cls: 'pri', icon: 'edit', act: () => { NN.open('tasks', null, { focus: '#taskAdd' }); return 'keep'; } }],
        onClick: () => NN.open('tasks'),
      });
    },
    pomo() {
      const c = NN.cfg.pomo;
      NN.alert({
        kind: 'pomo', color: '#34d399', icon: 'alarm', size: [600, 96], timeout: c.alarm ? (c.alarmSec + 20) * 1000 : 15000, ring: () => 1,
        cap: 'Sesi fokus selesai', title: 'Waktunya istirahat ' + c.short + ' menit', sub: 'Contoh pengingat Pomodoro. ' + (c.alarm ? 'Alarm berbunyi.' : ''),
        sound: c.alarm ? { kind: c.sound ? 'file' : 'alarm', file: c.sound, loop: true, secs: Math.min(c.alarmSec, 10) } : { kind: 'chime' },
        actions: [{ label: c.alarm ? 'Matikan' : 'Tutup', cls: 'ghost', act: () => NN.call('stopSound') }, { label: 'Oke', cls: 'pri', icon: 'check', act: () => NN.call('stopSound') }],
        onClose: () => NN.call('stopSound'), onClick: () => NN.call('stopSound'),
      });
    },
    prayerPre() {
      const c = NN.cfg.prayer, at = inMin(c.before || 10);
      NN.alert({
        kind: 'prayer-pre', color: 'var(--acc)', icon: 'mosque', live: true, timeout: 25000, size: [520, 92],
        cap: (c.before || 10) + ' menit lagi', title: 'Dzuhur · ' + NN.hm(at), sub: 'Bersiap untuk sholat · ' + c.city + ' (contoh)',
        ring: () => 0.6, actions: [{ label: 'Oke', cls: '', act: () => { } }], onClick: () => NN.open('prayer'),
      });
    },
    prayer() {
      const c = NN.cfg.prayer, now = new Date();
      const snd = c.sound === 'none' ? null : { kind: c.sound === 'file' && c.soundFile ? 'file' : 'chime', file: c.sound === 'file' ? c.soundFile : '', loop: false, secs: c.sound === 'file' ? 15 : 0 };
      NN.alert({
        kind: 'prayer', color: '#2dd4bf', icon: 'mosque', timeout: 30000, size: [540, 96],
        cap: 'Waktunya sholat', title: 'Dzuhur · ' + NN.hm(now), sub: NN.dayLabel(NN.today(), true) + ' · ' + c.city + ' (contoh)',
        ring: () => 1, sound: snd,
        actions: [{ label: 'Oke', cls: 'pri', icon: 'check', act: () => NN.call('stopSound') }],
        onClose: () => NN.call('stopSound'), onClick: () => NN.open('prayer'),
      });
    },
    distract() {
      NN.alert({
        kind: 'distract', color: '#fb7185', icon: 'warning', size: [560, 92], timeout: 12000,
        cap: 'Pengingat distraksi', title: 'YouTube sudah ' + (NN.cfg.focus.distract || 5) + ' menit', sub: 'Yuk kembali ke pekerjaan. (contoh)',
        actions: [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Mulai fokus', cls: 'pri', icon: 'play', act: () => { NN.open('timer'); return 'keep'; } }],
        onClick: () => NN.open('focus'),
      });
    },
    clip() {
      NN.alert({
        kind: 'clip', color: 'var(--acc)', img: 'assets/notnot-app.png', size: [560, 92], timeout: 6000, replace: true,
        cap: 'Screenshot tersimpan', title: 'Tersimpan ke Klip', sub: '1920 × 1080 px · contoh',
        actions: [{ label: 'Buka Klip', cls: 'pri', act: () => { NN.open('clip'); return 'keep'; } }],
        onClick: () => NN.open('clip'),
      });
    },
    logbook() {
      const n = NN.logbook ? NN.logbook.on(NN.today()).filter(e => !e.hidden).length : 0;
      NN.alert({
        kind: 'logbook', color: '#34d399', icon: 'book', size: [600, 96], timeout: 30000,
        cap: 'Logbook hari ini', title: n ? n + ' pekerjaan tercatat hari ini' : 'Logbook hari ini masih kosong',
        sub: n ? 'Periksa sebentar, lalu salin laporannya' : 'Tambahkan kegiatan yang sudah kamu kerjakan',
        actions: [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Buka logbook', cls: 'pri', icon: 'book', act: () => { NN.open('logbook'); return 'keep'; } }],
        onClick: () => NN.open('logbook'),
      });
    },
    ai() {
      NN.alert({ kind: 'ai', color: '#d97757', icon: 'sparkle', size: [520, 88], timeout: 8000, cap: 'AI selesai menjawab',
        title: 'Ini contoh pemberitahuan saat jawaban AI sudah siap dibaca.', sub: 'Klik untuk membaca', onClick: () => NN.open('ai') });
    },
  };

  NN.DEMOS = [
    ['task', 'bell', 'Tugas berjam'], ['morning', 'sun', 'Pengingat pagi'], ['evening', 'moon', 'Rencana besok'],
    ['pomo', 'alarm', 'Pomodoro selesai'], ['prayerPre', 'mosque', 'Menjelang sholat'], ['prayer', 'mosque', 'Waktu sholat'],
    ['distract', 'warning', 'Distraksi'], ['clip', 'clipboard', 'Screenshot'], ['logbook', 'book', 'Logbook sore'], ['ai', 'sparkle', 'Jawaban AI'],
  ];
  NN.demo = function (kind) {
    const f = D[kind]; if (!f) return;
    try { f(); } catch (e) { console.error('demo', kind, e); }
  };
})();
