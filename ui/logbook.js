/* NotchNote - Logbook harian: pekerjaan selesai + ringkasan produktivitas untuk laporan ke atasan */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const pad = n => String(n).padStart(2, '0');

  NN.DEFAULTS.logbook = { added: false, auto: true, name: '', role: '', unit: '', prod: true, prio: false, recap: false, recapTime: '16:30' };

  const L = NN.logbook = {
    cfg: () => NN.cfg.logbook,
    all: () => NN.st.logbook.entries,
    save() { NN.save('logbook'); },
    on: d => L.all().filter(e => e.date === d && !e.removed),
    range: (a, b) => L.all().filter(e => !e.removed && e.date >= a && e.date <= b),
    sortKey: e => e.date + ' ' + (e.time || '99:99') + ' ' + (e.created || 0),
    /* to-do yang dicentang selesai otomatis masuk logbook; dicentang batal = keluar lagi */
    sync() {
      if (!NN.st.logbook || !L.cfg().auto) return false;
      const E = L.all(), byTid = {};
      let changed = false;
      E.forEach(e => { if (e.tid) byTid[e.tid] = e; });
      NN.st.tasks.forEach(t => {
        const e = byTid[t.id];
        if (!t.done) { if (e && !e.removed) { E.splice(E.indexOf(e), 1); changed = true; } return; }
        const d = t.doneAt ? new Date(t.doneAt) : null;
        const date = d ? NN.iso(d) : t.date, time = d ? NN.hm(d) : (t.time || '');
        if (!e) { E.push({ id: NN.uid(), src: 'task', tid: t.id, date, time, title: t.title, note: '', prio: t.prio || 0, created: Date.now() }); changed = true; }
        else if (!e.edited && (e.title !== t.title || (e.prio || 0) !== (t.prio || 0) || (d && (e.date !== date || e.time !== time)))) {
          Object.assign(e, { title: t.title, prio: t.prio || 0 }); if (d) Object.assign(e, { date, time }); changed = true;
        }
      });
      if (changed) L.save();
      return changed;
    },
  };

  // ------------------------------------------------------------------ tanggal
  const D = s => NN.parseISO(s);
  const longDate = s => { const d = D(s); return NN.HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NN.BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  const shortDate = s => { const d = D(s); return NN.HR[d.getDay()] + ' ' + d.getDate() + ' ' + NN.BLN[d.getMonth()]; };
  const weekStart = s => { const d = D(s), dow = (d.getDay() + 6) % 7; return NN.addDays(s, -dow); };
  const monthStart = s => s.slice(0, 8) + '01';
  const monthEnd = s => { const d = D(monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return NN.iso(d); };
  function span(mode, s) {
    if (mode === 'week') { const a = weekStart(s); return [a, NN.addDays(a, 6)]; }
    if (mode === 'month') return [monthStart(s), monthEnd(s)];
    return [s, s];
  }
  function spanLabel(mode, s) {
    const [a, b] = span(mode, s);
    if (mode === 'day') return longDate(s);
    if (mode === 'month') { const d = D(a); return NN.BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
    const da = D(a), db = D(b);
    return da.getDate() + (da.getMonth() !== db.getMonth() ? ' ' + NN.BLN[da.getMonth()] : '') + ' – ' + db.getDate() + ' ' + NN.BLN[db.getMonth()] + ' ' + db.getFullYear();
  }
  const days = (a, b) => { const out = []; for (let d = a; d <= b; d = NN.addDays(d, 1)) out.push(d); return out; };
  const hrs = sec => { sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), m = Math.round(sec / 60) % 60; return h ? h + ' j ' + pad(m) + ' m' : m + ' m'; };
  const PRIO = () => NN.PRIO || {};

  // "09:00 Rapat", "Rapat 09.00", "08:00-10:00 Rapat"
  function parseEntry(v) {
    let time = '';
    v = v.replace(/^\s*(\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?)\s+/, (m, t) => { time = t; return ''; });
    if (!time) v = v.replace(/\s+(\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?)\s*$/, (m, t) => { time = t; return ''; });
    return [v.trim(), normRange(time)];
  }
  function normRange(t) {
    if (!t) return '';
    const p = String(t).split(/\s*[-–]\s*/).map(x => NN.normTime(x.replace('.', ':'))).filter(Boolean);
    return p.join('–');
  }

  // ------------------------------------------------------------------ ringkasan
  function summarize(stats, a, b) {
    const s = { productive: 0, neutral: 0, distracting: 0, pomodoro: 0, active: 0, apps: {} };
    days(a, b).forEach(d => {
      const x = stats[d]; if (!x) return;
      s.productive += x.productive || 0; s.neutral += x.neutral || 0; s.distracting += x.distracting || 0; s.pomodoro += x.pomodoro || 0;
      if ((x.productive || 0) + (x.neutral || 0) + (x.distracting || 0) > 600) s.active++;
      (x.apps || []).forEach(([k, v]) => { s.apps[k] = (s.apps[k] || 0) + v; });
    });
    s.total = s.productive + s.neutral + s.distracting;
    s.pct = s.total ? Math.round(100 * s.productive / s.total) : 0;
    s.top = Object.entries(s.apps).sort((x, y) => y[1] - x[1]).slice(0, 3);
    return s;
  }

  // ------------------------------------------------------------------ laporan
  function reportText(mode, sel, stats) {
    const c = L.cfg(), [a, b] = span(mode, sel), list = L.range(a, b).filter(e => !e.hidden).sort((x, y) => L.sortKey(x) < L.sortKey(y) ? -1 : 1);
    const head = { day: 'LOGBOOK HARIAN', week: 'LAPORAN KEGIATAN MINGGUAN', month: 'LAPORAN KEGIATAN BULANAN' }[mode];
    const out = [head];
    if (c.name) out.push('Nama     : ' + c.name);
    if (c.role) out.push('Jabatan  : ' + c.role);
    if (c.unit) out.push('Unit     : ' + c.unit);
    out.push((mode === 'day' ? 'Tanggal  : ' : 'Periode  : ') + spanLabel(mode, sel), '');
    const line = (e, i) => (i + 1) + '. ' + (e.time ? '[' + e.time + '] ' : '') + e.title +
      (c.prio && e.prio && PRIO()[e.prio] ? ' (prioritas ' + PRIO()[e.prio][0].toLowerCase() + ')' : '') + (e.note ? '\n   ' + e.note.replace(/\n/g, '\n   ') : '');
    if (!list.length) out.push('Belum ada kegiatan yang tercatat.');
    else if (mode === 'day') { out.push('Uraian kegiatan:'); list.forEach((e, i) => out.push(line(e, i))); }
    else days(a, b).forEach(d => {
      const l = list.filter(e => e.date === d); if (!l.length) return;
      out.push(longDate(d) + ':'); l.forEach((e, i) => out.push(line(e, i))); out.push('');
    });
    if (c.prod && stats) {
      const s = summarize(stats, a, b);
      out.push('', 'Ringkasan produktivitas:');
      out.push('- Jumlah kegiatan   : ' + list.length);
      if (s.total) {
        out.push('- Waktu produktif   : ' + hrs(s.productive) + ' (' + s.pct + '% dari waktu aktif ' + hrs(s.total) + ')');
        if (mode !== 'day') out.push('- Hari aktif        : ' + s.active + ' hari');
        if (s.pomodoro) out.push('- Sesi Pomodoro     : ' + s.pomodoro);
        if (s.top.length) out.push('- Paling banyak di  : ' + s.top.map(x => x[0]).join(', '));
      }
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function reportCsv(mode, sel) {
    const [a, b] = span(mode, sel), list = L.range(a, b).filter(e => !e.hidden).sort((x, y) => L.sortKey(x) < L.sortKey(y) ? -1 : 1);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['No', 'Tanggal', 'Hari', 'Jam', 'Uraian Kegiatan', 'Keterangan / Hasil', 'Sumber', 'Prioritas'].map(q).join(';')];
    list.forEach((e, i) => {
      const d = D(e.date);
      rows.push([i + 1, pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(), NN.HARI[d.getDay()], e.time || '', e.title, e.note || '',
        e.src === 'task' ? 'To-do' : 'Manual', e.prio && PRIO()[e.prio] ? PRIO()[e.prio][0] : ''].map(q).join(';'));
    });
    return rows.join('\r\n') + '\r\n';
  }
  L.reportText = reportText;

  // ------------------------------------------------------------------ halaman
  NN.page('logbook', {
    icon: 'book', label: 'Logbook',
    size: () => [740, 470],
    init(init) {
      NN.st.logbook = (init && init.logbook && Array.isArray(init.logbook.entries)) ? init.logbook : { entries: [] };
      const c = NN.cfg.logbook, pages = NN.cfg.notch.pages;
      // halaman baru: tampilkan sekali di bilah tab (setelah To-do), sesudahnya ikut pilihan pengguna
      if (!c.added) {
        c.added = true;
        if (pages.indexOf('logbook') < 0) { const i = pages.indexOf('tasks'); pages.splice(i >= 0 ? i + 1 : 0, 0, 'logbook'); }
        setTimeout(() => NN.save('cfg'), 600);
      }
      this.mode = 'day'; this.sel = NN.today(); this.stats = {}; this.open = null;
      // ikut setiap kali daftar to-do disimpan
      const T = NN.tasks, orig = T.save;
      T.save = function () { orig.apply(T, arguments); if (L.sync() && NN.isl.page === 'logbook' && NN.isl.view === 'page') NN.pages.logbook.render(NN.pages.logbook.el); };
      L.sync();
    },
    async loadStats() {
      const [a, b] = span(this.mode, this.sel), key = a + '|' + b;
      const r = await NN.call('statsRange', a, b);
      try { this.stats = JSON.parse(r || '{}') || {}; } catch (e) { this.stats = {}; }
      this.statsKey = key;
      const box = NN.$('#lbSum', this.el); if (box) box.innerHTML = this.sumHtml();
    },
    render(el) {
      this.el = el;
      const [a, b] = span(this.mode, this.sel), isNow = this.sel >= a && NN.today() >= a && NN.today() <= b;
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('book', 20) + 'Logbook</h2>' +
        '<div class="seg lbmode">' + [['day', 'Harian'], ['week', 'Mingguan'], ['month', 'Bulanan']].map(m => '<button class="' + (this.mode === m[0] ? 'on' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
        '<div class="sp"></div>' +
        '<button class="btn sm" data-lb="copy" title="Salin laporan untuk ditempel di WhatsApp, email, atau dokumen">' + icon('copy', 14) + 'Salin laporan</button>' +
        '<button class="btn sm" data-lb="csv" title="Simpan sebagai file Excel (CSV)">' + icon('download', 14) + 'Excel</button></div>' +
        '<div class="lbnav"><button class="ibtn sm" data-lb="prev" title="Sebelumnya">' + icon('chev-l', 16) + '</button>' +
        '<b>' + esc(spanLabel(this.mode, this.sel)) + '</b>' +
        '<button class="ibtn sm" data-lb="next" title="Berikutnya">' + icon('chev-r', 16) + '</button>' +
        (isNow ? '' : '<button class="btn sm ghost" data-lb="now">' + (this.mode === 'day' ? 'Hari ini' : this.mode === 'week' ? 'Minggu ini' : 'Bulan ini') + '</button>') +
        '<div class="sp"></div><span class="faint" id="lbCount"></span></div>' +
        '<div class="lbwrap"><div class="lblist scroll" id="lbList">' + this.listHtml() + '</div>' +
        '<div class="lbsum" id="lbSum">' + this.sumHtml() + '</div></div>';
      this.bind(el);
      if (this.statsKey !== a + '|' + b || b >= NN.today()) this.loadStats();
    },
    listHtml() {
      const [a, b] = span(this.mode, this.sel), all = L.range(a, b).sort((x, y) => L.sortKey(x) < L.sortKey(y) ? -1 : 1);
      setTimeout(() => { const c = NN.$('#lbCount', this.el); if (c) c.textContent = all.length ? all.filter(e => !e.hidden).length + ' kegiatan' : ''; }, 0);
      const add = this.mode === 'day' ? '<div class="lbadd">' + icon('plus', 15) + '<input class="inp" id="lbAdd" maxlength="200" spellcheck="false" placeholder="Tambah kegiatan lain… (contoh: 09:00 Rapat koordinasi)"></div>' : '';
      if (!all.length) return add + '<div class="empty lbempty">' + icon('book', 26) + '<b>Belum ada kegiatan</b><span>' +
        (L.cfg().auto ? 'To-do yang kamu centang selesai otomatis tercatat di sini, lengkap dengan jamnya.' : 'Tambahkan kegiatan secara manual di atas.') + '</span></div>';
      if (this.mode === 'day') return add + all.map(e => this.rowHtml(e)).join('');
      return days(a, b).map(d => {
        const l = all.filter(e => e.date === d); if (!l.length) return '';
        const st = this.stats[d];
        return '<div class="lbday" data-day="' + d + '"><span>' + esc(shortDate(d)) + '</span><i>' + l.filter(e => !e.hidden).length + ' kegiatan' +
          (st && st.productive ? ' · ' + hrs(st.productive) + ' produktif' : '') + '</i></div>' + l.map(e => this.rowHtml(e)).join('');
      }).join('');
    },
    rowHtml(e) {
      const P = PRIO()[e.prio];
      if (this.open === e.id) return '<div class="lbrow edit" data-id="' + e.id + '">' +
        '<input class="inp lbt" id="lbT" value="' + esc(e.time || '') + '" placeholder="Jam" maxlength="11" title="Jam, misalnya 09:00 atau 08:00-10:00">' +
        '<div class="lbed"><input class="inp" id="lbTitle" maxlength="200" value="' + esc(e.title) + '" placeholder="Uraian kegiatan">' +
        '<textarea class="inp" id="lbNote" rows="2" maxlength="600" placeholder="Keterangan atau hasil (opsional), misalnya: 3 dokumen selesai diverifikasi">' + esc(e.note || '') + '</textarea>' +
        '<div class="lbedb"><button class="btn sm ghost danger" data-lb="del">' + icon('trash', 14) + 'Hapus dari logbook</button><div class="sp"></div>' +
        '<button class="btn sm ghost" data-lb="cancel">Batal</button><button class="btn sm pri" data-lb="ok">Simpan</button></div></div></div>';
      return '<div class="lbrow' + (e.hidden ? ' hid' : '') + '" data-id="' + e.id + '">' +
        '<span class="lbtime">' + esc(e.time || '—').replace('–', '<br>–') + '</span>' +
        '<div class="lbtx"><b>' + (P ? '<i class="pdot" style="background:' + P[1] + '"></i>' : '') + esc(e.title) + '</b>' + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</div>' +
        '<span class="pill' + (e.src === 'task' ? ' acc' : '') + '">' + (e.src === 'task' ? 'To-do' : 'Manual') + '</span>' +
        '<button class="ibtn sm lbeye" data-lb="hide" title="' + (e.hidden ? 'Masukkan lagi ke laporan' : 'Jangan masukkan ke laporan') + '">' + icon(e.hidden ? 'eye-off' : 'eye', 15) + '</button>' +
        '<button class="ibtn sm" data-lb="edit" title="Ubah atau beri keterangan">' + icon('edit', 15) + '</button></div>';
    },
    sumHtml() {
      const [a, b] = span(this.mode, this.sel), s = summarize(this.stats || {}, a, b);
      const n = L.range(a, b).filter(e => !e.hidden).length;
      const seg = (v, c) => s.total ? '<i style="flex:' + v + ';background:' + c + '"></i>' : '';
      let h = '<div class="lbk"><div><b>' + n + '</b><span>pekerjaan<br>selesai</span></div><div><b>' + (s.total ? hrs(s.productive).replace(' 00 m', '') : '—') + '</b><span>waktu<br>produktif</span></div></div>';
      if (s.total) {
        h += '<div class="lbbar">' + seg(s.productive, 'var(--prod)') + seg(s.neutral, 'var(--neu)') + seg(s.distracting, 'var(--dis)') + '</div>' +
          '<div class="lbleg"><span><i style="background:var(--prod)"></i>Produktif ' + s.pct + '%</span><span><i style="background:var(--dis)"></i>Gangguan ' + Math.round(100 * s.distracting / s.total) + '%</span></div>';
        if (this.mode !== 'day') {
          const ds = days(a, b), max = Math.max(3600, ...ds.map(d => (this.stats[d] || {}).productive || 0));
          h += '<div class="lbchart" title="Waktu produktif per hari">' + ds.map(d => {
            const v = (this.stats[d] || {}).productive || 0, dd = D(d);
            return '<div class="' + (d === NN.today() ? 'now' : '') + '" title="' + esc(shortDate(d)) + ': ' + hrs(v) + '"><i style="height:' + Math.max(v ? 4 : 0, Math.round(100 * v / max)) + '%"></i>' +
              (ds.length <= 7 ? '<small>' + NN.HR[dd.getDay()] + '</small>' : '') + '</div>';
          }).join('') + '</div>';
        }
        h += '<div class="lbrows">' +
          (this.mode !== 'day' ? '<div><span>Hari aktif</span><b>' + s.active + ' hari</b></div><div><span>Rata-rata produktif</span><b>' + hrs(s.active ? s.productive / s.active : 0) + '</b></div>' : '<div><span>Waktu aktif</span><b>' + hrs(s.total) + '</b></div>') +
          (s.pomodoro ? '<div><span>Sesi Pomodoro</span><b>' + s.pomodoro + '</b></div>' : '') + '</div>';
        if (s.top.length) h += '<div class="lbapps"><span>Paling banyak di</span>' + s.top.map(x => '<em>' + esc(x[0]) + '</em>').join('') + '</div>';
      } else h += '<div class="faint lbnone">Data produktivitas untuk ' + (this.mode === 'day' ? 'hari ini' : 'periode ini') + ' belum ada. Data dicatat otomatis selama NotchNote menyala.</div>';
      return h;
    },
    bind(el) {
      const self = this;
      const add = NN.$('#lbAdd', el);
      if (add) add.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const [title, time] = parseEntry(add.value);
        if (!title) { add.classList.add('err'); return; }
        L.all().push({ id: NN.uid(), src: 'manual', date: self.sel, time: time || (self.sel === NN.today() ? NN.hm(new Date()) : ''), title, note: '', created: Date.now() });
        L.save(); self.render(el); const a2 = NN.$('#lbAdd', el); if (a2) a2.focus();
      });
      const ed = NN.$('.lbrow.edit', el);
      if (ed) NN.$$('input', ed).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') self.commit(); if (e.key === 'Escape') { self.open = null; self.render(el); } }));
      el.onclick = e => {
        const m = e.target.closest('[data-mode]');
        if (m) { self.mode = m.dataset.mode; self.open = null; self.render(el); return; }
        const day = e.target.closest('.lbday');
        if (day) { self.mode = 'day'; self.sel = day.dataset.day; self.render(el); return; }
        const b = e.target.closest('[data-lb]'); if (!b) return;
        const k = b.dataset.lb, row = b.closest('.lbrow'), en = row && L.all().find(x => x.id === row.dataset.id);
        if (k === 'prev' || k === 'next') self.step(k === 'next' ? 1 : -1);
        else if (k === 'now') { self.sel = NN.today(); self.render(el); }
        else if (k === 'copy') self.copy();
        else if (k === 'csv') self.saveCsv();
        else if (k === 'edit' && en) { self.open = en.id; self.render(el); setTimeout(() => { const t = NN.$('#lbTitle', el); if (t) { NN.call('activate'); t.focus(); } }, 30); }
        else if (k === 'hide' && en) { en.hidden = !en.hidden; L.save(); self.render(el); }
        else if (k === 'cancel') { self.open = null; self.render(el); }
        else if (k === 'ok') self.commit();
        else if (k === 'del' && en) {
          if (en.src === 'task') en.removed = true; else L.all().splice(L.all().indexOf(en), 1);
          self.open = null; L.save(); self.render(el); NN.toast('Dihapus dari logbook', 'trash', 'var(--fg2)');
        }
      };
    },
    commit() {
      const en = L.all().find(x => x.id === this.open); if (!en) return;
      const t = NN.$('#lbTitle', this.el), n = NN.$('#lbNote', this.el), tm = NN.$('#lbT', this.el);
      const title = t.value.trim(); if (!title) { t.classList.add('err'); t.focus(); return; }
      const time = tm.value.trim() ? normRange(tm.value) : '';
      if (tm.value.trim() && !time) { tm.classList.add('err'); tm.focus(); return; }
      if (title !== en.title) en.edited = true;
      Object.assign(en, { title, note: n.value.trim(), time });
      this.open = null; L.save(); this.render(this.el);
    },
    step(d) {
      const s = this.sel;
      if (this.mode === 'day') this.sel = NN.addDays(s, d);
      else if (this.mode === 'week') this.sel = NN.addDays(weekStart(s), 7 * d);
      else { const x = D(monthStart(s)); x.setMonth(x.getMonth() + d); this.sel = NN.iso(x); }
      this.open = null; this.render(this.el);
    },
    async copy() {
      if (this.statsKey !== span(this.mode, this.sel).join('|')) await this.loadStats();
      NN.call('copyText', reportText(this.mode, this.sel, this.stats));
      NN.toast('Laporan disalin, tinggal tempel', 'copy');
    },
    async saveCsv() {
      const [a, b] = span(this.mode, this.sel);
      NN.dialog = true;
      const path = await NN.call('saveReport', 'Logbook ' + (a === b ? a : a + ' sd ' + b) + '.csv', reportCsv(this.mode, this.sel));
      if (path) NN.toast('Tersimpan: ' + String(path).split(/[\\/]/).pop(), 'download');
    },
    shown() { if (span(this.mode, this.sel)[1] >= NN.today()) this.loadStats(); },
  });

  // ------------------------------------------------------------------ ringkasan sore (opsional)
  NN.tickers.push(now => {
    const c = L.cfg(); if (!c.recap || !NN.st.logbook) return;
    const ui = NN.st.ui, today = NN.today(), hm = NN.hm(now);
    if (ui.lbRecap === today || hm < c.recapTime || now.getDay() === 0 || now.getDay() === 6) return;
    if (NN.track && NN.track.cat === 'idle') return;
    ui.lbRecap = today; NN.save('ui');
    const n = L.on(today).filter(e => !e.hidden).length;
    const go = () => { const p = NN.pages.logbook; p.mode = 'day'; p.sel = today; NN.open('logbook'); return 'keep'; };
    NN.alert({
      kind: 'logbook', color: '#34d399', icon: 'book', size: [600, 96], timeout: 30000,
      cap: 'Logbook hari ini', title: n ? n + ' pekerjaan tercatat hari ini' : 'Logbook hari ini masih kosong',
      sub: n ? 'Periksa sebentar, lalu salin laporannya' : 'Tambahkan kegiatan yang sudah kamu kerjakan',
      actions: [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Buka logbook', cls: 'pri', icon: 'book', act: go }],
      onClick: go,
    });
  });
})();
