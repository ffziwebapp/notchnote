/* NotchNote - To-do dengan kalender, jam, dan pengingat */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const REMINDS = [[0, 'Tepat waktu'], [10, '10 menit'], [60, '1 jam'], [1440, '1 hari']];
  const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const AMBER = '#fbbf24';
  const PRIO = { 1: ['Tinggi', '#f87171'], 2: ['Sedang', '#fb923c'], 3: ['Rendah', '#60a5fa'] };
  const prank = t => (t.prio >= 1 && t.prio <= 3 ? t.prio : 4);
  NN.PRIO = PRIO;

  const T = NN.tasks = {
    all: () => NN.st.tasks,
    get: id => NN.st.tasks.find(t => t.id === id),
    on: d => NN.st.tasks.filter(t => t.date === d),
    save: () => { NN.save('tasks'); NN.refreshTabs && NN.refreshTabs(); },
    due(t) { if (!t.date || !t.time) return null; const d = NN.parseISO(t.date); const [h, m] = t.time.split(':').map(Number); d.setHours(h, m, 0, 0); return d; },
    sorted(list) {
      return list.slice().sort((a, b) => (a.done - b.done) || (prank(a) - prank(b)) || ((a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : 0) || (a.created - b.created));
    },
    add(title, date, time, prio) {
      const t = { id: NN.uid(), title, date, time: time || '', remind: time ? NN.cfg.todo.remind.slice() : [], done: false, created: Date.now(), prio: prio || 0 };
      NN.st.tasks.push(t); T.save(); return t;
    },
    toggle(id) {
      const t = T.get(id); if (!t) return;
      t.done = !t.done; t.doneAt = t.done ? Date.now() : null; T.save();
      return t;
    },
    remove(id) { NN.st.tasks = NN.st.tasks.filter(t => t.id !== id); T.save(); },
  };

  function weekend(iso) { const d = NN.parseISO(iso); const dow = d.getDay(); return NN.addDays(iso, dow === 6 ? 0 : dow === 0 ? 6 : 6 - dow); }
  function nextMonday(iso) { const d = NN.parseISO(iso); const dow = d.getDay(); return NN.addDays(iso, dow === 0 ? 1 : 8 - dow); }
  function remindText(t) {
    const due = T.due(t); if (!due || !t.remind.length) return '';
    const times = t.remind.slice().sort((a, b) => b - a).map(m => {
      const d = new Date(due.getTime() - m * 60000);
      return (m >= 1440 ? NN.dayLabel(NN.iso(d)).replace('Hari ini', 'hari ini') + ' ' : '') + NN.hm(d);
    });
    return 'Diingatkan pukul ' + (times.length > 1 ? times.slice(0, -1).join(', ') + ' dan ' + times[times.length - 1] : times[0]);
  }

  // ------------------------------------------------------------------ kalender kecil
  function calendar(month, sel, opts) {
    const first = NN.parseISO(month + '-01'), today = NN.today();
    const startDow = (first.getDay() + 6) % 7;
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let h = '<div class="cal-h"><b>' + NN.BULAN[first.getMonth()] + ' ' + first.getFullYear() + '</b>' +
      '<button class="ibtn" data-cal="-1" title="Bulan sebelumnya">' + icon('chev-l', 16) + '</button>' +
      '<button class="ibtn" data-cal="1" title="Bulan berikutnya">' + icon('chev-r', 16) + '</button></div><div class="cal">';
    h += DOW.map(d => '<div class="dn">' + d + '</div>').join('');
    for (let i = 0; i < startDow; i++) h += '<div></div>';
    const has = {};
    if (opts && opts.dots) NN.st.tasks.forEach(t => { if (t.date && !t.done) has[t.date] = 1; });
    for (let d = 1; d <= days; d++) {
      const iso = month + '-' + NN.pad(d);
      const cls = [iso < today ? 'past' : '', iso === today ? 'today' : '', iso === sel ? 'on' : '', has[iso] ? 'has' : ''].join(' ');
      h += '<button class="' + cls + '" data-day="' + iso + '">' + d + '</button>';
    }
    return h + '</div>';
  }
  const monthOf = iso => iso.slice(0, 7);
  const shiftMonth = (m, n) => { const d = NN.parseISO(m + '-01'); d.setMonth(d.getMonth() + n); return NN.iso(d).slice(0, 7); };

  // ------------------------------------------------------------------ halaman
  NN.page('tasks', {
    icon: 'checklist', label: 'To-do',
    size: sub => sub && sub.edit ? [740, 528] : [720, 430],
    badge: () => { const now = new Date(); return T.on(NN.today()).some(t => !t.done && T.due(t) && T.due(t) < now); },
    init() { this.sel = NN.today(); this.month = monthOf(this.sel); },
    back() { if (NN.isl.sub && NN.isl.sub.edit) { NN.setSub(null); return true; } return false; },
    render(el, sub) {
      this.el = el;
      if (sub && sub.edit) return this.renderEditor(el, sub);
      const sel = this.sel, list = T.sorted(T.on(sel)), done = list.filter(t => t.done).length;
      const rows = list.map(rowHtml).join('');
      el.innerHTML =
        '<div style="display:grid;grid-template-columns:280px minmax(0,1fr);gap:24px;flex:1;min-height:0">' +
        '<div style="display:flex;flex-direction:column;min-width:0">' +
        '<div class="hdr" style="margin-bottom:10px"><h2>' + icon('checklist', 20) + 'To-do</h2></div>' +
        '<div id="tcal">' + calendar(this.month, sel, { dots: true }) + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:auto;padding-top:8px">' +
        '<button class="chip sm' + (sel === NN.today() ? ' on' : '') + '" data-jump="0">Hari ini</button>' +
        '<button class="chip sm' + (sel === NN.addDays(NN.today(), 1) ? ' on' : '') + '" data-jump="1">Besok</button>' +
        '<button class="chip sm" data-jump="w">Akhir pekan</button></div></div>' +
        '<div style="display:flex;flex-direction:column;min-height:0;min-width:0">' +
        '<div class="hdr"><h2 style="font-size:16px">' + esc(NN.dayLabel(sel, true)) + '</h2>' +
        (sel !== NN.today() ? '<span class="pill">' + NN.HARI[NN.parseISO(sel).getDay()] + ', ' + NN.parseISO(sel).getDate() + ' ' + NN.BLN[NN.parseISO(sel).getMonth()] + '</span>' : '') +
        '<div class="sp"></div><span class="faint" style="font-size:12px">' + (list.length ? done + '/' + list.length + ' selesai' : '') + '</span></div>' +
        '<div class="addrow"><input id="taskAdd" class="inp" maxlength="200" placeholder="Tambah tugas… (contoh: Rapat 09:00 !1)" title="Tulis jam di akhir untuk mengatur jam. !1 = prioritas tinggi, !2 = sedang, !3 = rendah">' +
        '<button class="btn" data-t="full" title="Tambah dengan jam dan pengingat">' + icon('clock', 15) + 'Detail</button></div>' +
        '<div class="err-msg hide" id="taskErr"></div>' +
        '<div class="tlist scroll" id="tlist">' + (rows || emptyHtml(sel)) + '</div>' +
        '<div class="tfoot">' + (list.length ? '<div class="pbar"><i style="width:' + (100 * done / list.length) + '%"></i></div>' +
          (done ? '<button class="btn sm ghost" data-t="clean">' + icon('trash', 13) + 'Hapus yang selesai</button>' : '') : '') + '</div>' +
        '</div></div>';
      bindList.call(this, el);
    },
    renderEditor(el, sub) {
      const d = this.draft;
      const today = NN.today(), tmr = NN.addDays(today, 1);
      const quick = [['Hari ini', today], ['Besok', tmr], ['Akhir pekan', weekend(today)], ['Minggu depan', nextMonday(today)]];
      const due = d.time ? T.due(d) : null;
      const sum = '<b>' + esc(NN.dayLabel(d.date, true)) + (d.time ? ', ' + d.time : '') + '</b><span>' +
        (d.time ? (d.remind.length ? esc(remindText(d)) : 'Tanpa pengingat') : 'Tanpa jam · muncul di pengingat pagi') + '</span>';
      el.innerHTML =
        '<div class="hdr"><button class="ibtn solid round" data-e="back" title="Kembali">' + icon('back', 18) + '</button>' +
        '<input id="edTitle" class="inp titlein" maxlength="200" placeholder="Nama tugas" value="' + esc(d.title) + '">' +
        '<button class="btn pri lg" data-e="save">Simpan</button></div>' +
        '<div class="err-msg hide" id="edErr" style="margin:-4px 0 4px 44px"></div>' +
        '<div class="ed"><div class="ed-l"><div id="ecal">' + calendar(this.emonth, d.date) + '</div>' +
        '<div class="g2" style="margin-top:10px">' + quick.map(q => '<button class="chip sm' + (d.date === q[1] ? ' on' : '') + '" data-q="' + q[1] + '">' + q[0] + '</button>').join('') + '</div></div>' +
        '<div class="ed-r"><div class="lbl">Prioritas</div><div class="prio-seg">' +
        [[1], [2], [3], [0]].map(x => { const k = x[0], P = PRIO[k]; return '<button class="chip sm' + ((d.prio || 0) === k ? ' on' : '') + '" data-pr="' + k + '"' + (P ? ' style="--pc:' + P[1] + '"' : '') + '>' + (P ? icon('flag', 14) + P[0] : 'Tanpa') + '</button>'; }).join('') + '</div>' +
        '<div class="lbl" style="margin-top:14px">Jam</div>' +
        '<div class="timebox"><div class="tin"><input id="edTime" class="inp" maxlength="5" placeholder="--:--" value="' + esc(d.time) + '">' + icon('clock', 18) + '</div>' +
        '<span class="muted" style="font-weight:600">' + NN.tzLabel() + '</span>' +
        (d.time ? '<button class="btn sm ghost" data-e="notime">Tanpa jam</button>' : '') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' + ['08:00', '10:00', '13:00', '16:00', '20:00'].map(x => '<button class="chip sm' + (d.time === x ? ' on' : '') + '" data-tm="' + x + '">' + x + '</button>').join('') + '</div>' +
        '<div class="lbl" style="margin-top:14px">Ingatkan saya</div>' +
        '<div class="g2"' + (d.time ? '' : ' style="opacity:.4;pointer-events:none"') + '>' +
        REMINDS.map(r => '<button class="chip' + (d.remind.indexOf(r[0]) >= 0 ? ' on' : '') + '" data-rm="' + r[0] + '">' + (d.remind.indexOf(r[0]) >= 0 ? icon('check', 15) : '') + r[1] + '</button>').join('') + '</div>' +
        '</div></div>' +
        '<div class="sumbar">' + icon('bell', 18) + sum +
        (sub.edit !== 'new' ? '<button class="btn sm ghost danger" data-e="del">' + icon('trash', 14) + 'Hapus tugas</button>' : '') + '</div>';
      bindEditor.call(this, el, sub);
      void due;
    },
    paintSummary(el, sub) {
      const d = this.draft, bar = NN.$('.sumbar', el), grp = NN.$('[data-rm]', el);
      if (grp && grp.parentNode) grp.parentNode.style.cssText = d.time ? '' : 'opacity:.4;pointer-events:none';
      if (!bar) return;
      const b = NN.$('b', bar), sp = NN.$('span', bar);
      b.textContent = NN.dayLabel(d.date, true) + (d.time ? ', ' + d.time : '');
      sp.textContent = d.time ? (d.remind.length ? remindText(d) : 'Tanpa pengingat') : 'Tanpa jam · muncul di pengingat pagi';
    },
    edit(id, preset) {
      const t = id === 'new' ? null : T.get(id);
      this.draft = t ? { title: t.title, date: t.date || NN.today(), time: t.time || '', remind: (t.remind || []).slice(), prio: t.prio || 0 }
        : Object.assign({ title: '', date: this.sel, time: '', remind: NN.cfg.todo.remind.slice(), prio: 0 }, preset || {});
      this.emonth = monthOf(this.draft.date);
      NN.open('tasks', { edit: id });
      if (!t) setTimeout(() => { const i = NN.$('#edTitle'); if (i) { NN.call('activate'); i.focus(); } }, 280);
    },
    shown(sub) { if (!sub) { const i = NN.$('#taskAdd'); if (i && NN.windowActive) i.focus({ preventScroll: true }); } },
    tick(now) { if (!NN.isl.sub && now.getSeconds() === 0 && !NN.isTyping()) NN.rerender(); },
  });

  function emptyHtml(sel) {
    return '<div class="empty">' + (NN.cfg.mascot.on ? NN.owl(62, { live: true, full: true }) : icon(sel === NN.addDays(NN.today(), 1) ? 'moon' : 'sun', 28)) +
      '<b>' + (sel < NN.today() ? 'Tidak ada tugas' : 'Belum ada rencana') + '</b>' +
      '<span>' + (sel === NN.addDays(NN.today(), 1) ? 'Tulis apa saja yang mau dikerjakan besok.' : 'Ketik di kolom atas lalu tekan Enter.') + '</span></div>';
  }
  function rowHtml(t) {
    const now = new Date(), due = T.due(t);
    let meta = '';
    if (t.time) meta += '<span class="pill' + (!t.done && due < now ? ' bad' : ' acc') + '">' + icon('clock', 11) + t.time + '</span>';
    if (t.time && t.remind && t.remind.length && !t.done) meta += '<span class="pill">' + icon('bell', 11) + t.remind.length + '</span>';
    if (!t.done && due && due < now) meta += '<span class="pill bad">Terlambat</span>';
    if (t.prio && PRIO[t.prio] && !t.done) meta = '<span class="pill" style="color:' + PRIO[t.prio][1] + ';background:color-mix(in srgb,' + PRIO[t.prio][1] + ' 16%,transparent)">' + icon('flag', 11) + PRIO[t.prio][0] + '</span>' + meta;
    if (t.carried && !t.done && t.origDate && t.origDate < t.date) meta += '<span class="pill warn">dari ' + esc(NN.dayLabel(t.origDate || t.date).replace(/^(Kemarin|Hari ini|Besok)$/, m => m.toLowerCase())) + '</span>';
    return '<div class="trow' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
      '<button class="cbx' + (t.done ? ' on' : '') + '"' + (t.prio && PRIO[t.prio] ? ' style="--pc:' + PRIO[t.prio][1] + '"' : '') + ' data-t="tg" title="' + (t.done ? 'Tandai belum selesai' : 'Tandai selesai') + '">' + icon('check', 13) + '</button>' +
      '<div class="tt"><div class="t1">' + esc(t.title) + '</div>' + (meta ? '<div class="meta">' + meta + '</div>' : '') + '</div>' +
      '<button class="ibtn del" data-t="del" title="Hapus">' + icon('trash', 15) + '</button></div>';
  }

  function bindList(el) {
    const self = this, inp = NN.$('#taskAdd', el), err = NN.$('#taskErr', el);
    inp.addEventListener('input', () => err.classList.add('hide'));
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      let v = inp.value.trim();
      if (!v) { err.textContent = 'Tulis nama tugasnya dulu'; err.classList.remove('hide'); return; }
      let time = '', prio = 0;
      const pm = v.match(/(^|\s)!([123])(?=\s|$)/);
      if (pm) { prio = +pm[2]; v = (v.slice(0, pm.index) + v.slice(pm.index + pm[0].length)).replace(/\s+/g, ' ').trim(); }
      const m = v.match(/\s+(?:jam\s+|pukul\s+)?(\d{1,2}[:.]\d{2})$/i) || v.match(/\s+(?:jam|pukul)\s+(\d{1,2})$/i);
      if (m) { const nt = NN.normTime(m[1]); if (nt) { time = nt; v = v.slice(0, m.index).trim(); } }
      if (!v) { err.textContent = 'Tulis nama tugasnya, bukan hanya jamnya'; err.classList.remove('hide'); return; }
      T.add(v, self.sel, time, prio);
      self.render(el); NN.$('#taskAdd', el).focus();
      NN.bump(0, 14);
    });
    el.onclick = e => {
      const c = e.target.closest('[data-cal]');
      if (c) { self.month = shiftMonth(self.month, +c.dataset.cal); NN.$('#tcal', el).innerHTML = calendar(self.month, self.sel, { dots: true }); return; }
      const day = e.target.closest('[data-day]');
      if (day) { self.sel = day.dataset.day; self.render(el); return; }
      const j = e.target.closest('[data-jump]');
      if (j) { self.sel = j.dataset.jump === 'w' ? weekend(NN.today()) : NN.addDays(NN.today(), +j.dataset.jump); self.month = monthOf(self.sel); self.render(el); return; }
      const b = e.target.closest('[data-t]');
      const row = e.target.closest('.trow');
      if (b && b.dataset.t === 'full') { self.edit('new', { title: inp.value.trim() }); return; }
      if (b && b.dataset.t === 'clean') { NN.st.tasks = NN.st.tasks.filter(t => !(t.date === self.sel && t.done)); T.save(); self.render(el); return; }
      if (b && row && b.dataset.t === 'tg') {
        const t = T.toggle(row.dataset.id);
        b.classList.toggle('on', t.done); row.classList.toggle('done', t.done);
        if (t.done) NN.bump(18, 0);
        setTimeout(() => self.render(el), 420);
        return;
      }
      if (b && row && b.dataset.t === 'del') {
        const t = T.get(row.dataset.id); T.remove(row.dataset.id); self.render(el);
        NN.toast('Tugas dihapus', 'trash', 'var(--fg2)'); void t; return;
      }
      if (row) self.edit(row.dataset.id);
    };
  }

  function bindEditor(el, sub) {
    const self = this, d = this.draft;
    const title = NN.$('#edTitle', el), time = NN.$('#edTime', el), err = NN.$('#edErr', el);
    const showErr = (msg, inp) => { err.textContent = msg; err.classList.remove('hide'); if (inp) { inp.classList.add('err'); inp.focus(); } };
    title.addEventListener('input', () => { d.title = title.value; title.classList.remove('err'); err.classList.add('hide'); });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    const commitTime = rerender => {
      const nt = NN.normTime(time.value);
      if (nt === null) { showErr('Format jam belum benar. Contoh: 09:00, 9.30, atau 1400', time); return false; }
      if (nt !== d.time) {
        const had = !!d.time; d.time = nt;
        if (nt && !had && !d.remind.length) d.remind = NN.cfg.todo.remind.slice();
        if (rerender) self.renderEditor(el, sub);
        else { time.value = nt; self.paintSummary(el, sub); }
      }
      return true;
    };
    time.addEventListener('input', () => { time.classList.remove('err'); err.classList.add('hide'); });
    time.addEventListener('keydown', e => {
      if (e.key === 'Enter') { if (commitTime(false)) save(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = NN.normTime(time.value) || '09:00';
        let [h, m] = cur.split(':').map(Number);
        let mins = h * 60 + m + (e.key === 'ArrowUp' ? 15 : -15);
        mins = (mins + 1440) % 1440;
        time.value = NN.pad(Math.floor(mins / 60)) + ':' + NN.pad(mins % 60);
      }
    });
    time.addEventListener('blur', () => { if (time.value.trim() !== d.time) commitTime(false); });
    function save() {
      d.title = title.value.trim();
      if (!d.title) { showErr('Nama tugas belum diisi', title); return; }
      const nt = NN.normTime(time.value);
      if (nt === null) { showErr('Format jam belum benar. Contoh: 09:00', time); return; }
      d.time = nt;
      if (!d.time) d.remind = [];
      if (sub.edit === 'new') { const t = T.add(d.title, d.date, d.time, d.prio); t.remind = d.remind.slice(); }
      else {
        const t = T.get(sub.edit);
        if (t) { const moved = t.date !== d.date; Object.assign(t, { title: d.title, date: d.date, time: d.time, remind: d.remind.slice(), prio: d.prio || 0 }); if (moved) { t.carried = false; t.origDate = null; } }
      }
      T.save();
      self.sel = d.date; self.month = monthOf(d.date);
      NN.setSub(null);
      NN.toast(sub.edit === 'new' ? 'Tugas ditambahkan' : 'Tugas disimpan');
    }
    el.onclick = e => {
      const c = e.target.closest('[data-cal]');
      if (c) { self.emonth = shiftMonth(self.emonth, +c.dataset.cal); NN.$('#ecal', el).innerHTML = calendar(self.emonth, d.date); return; }
      const day = e.target.closest('[data-day]');
      if (day) { d.date = day.dataset.day; self.renderEditor(el, sub); return; }
      const q = e.target.closest('[data-q]');
      if (q) { d.date = q.dataset.q; self.emonth = monthOf(d.date); self.renderEditor(el, sub); return; }
      const tm = e.target.closest('[data-tm]');
      if (tm) { const had = !!d.time; d.time = tm.dataset.tm; if (!had && !d.remind.length) d.remind = NN.cfg.todo.remind.slice(); self.renderEditor(el, sub); return; }
      const pr = e.target.closest('[data-pr]');
      if (pr) { d.prio = +pr.dataset.pr; self.renderEditor(el, sub); return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { const v = +rm.dataset.rm, i = d.remind.indexOf(v); if (i >= 0) d.remind.splice(i, 1); else d.remind.push(v); self.renderEditor(el, sub); return; }
      const b = e.target.closest('[data-e]');
      if (!b) return;
      const k = b.dataset.e;
      if (k === 'back') NN.setSub(null);
      else if (k === 'save') save();
      else if (k === 'notime') { d.time = ''; self.renderEditor(el, sub); }
      else if (k === 'del') { T.remove(sub.edit); NN.setSub(null); NN.toast('Tugas dihapus', 'trash', 'var(--fg2)'); }
    };
  }

  // ------------------------------------------------------------------ pengingat
  function snooze(t, minutes, until) {
    NN.st.ui.snz = NN.st.ui.snz || {};
    NN.st.ui.snz[t.id] = until || Date.now() + minutes * 60000;
    NN.save('ui');
    NN.toast(until ? 'Diingatkan lagi besok pagi' : 'Diingatkan lagi ' + NN.relMin(minutes) + ' lagi', 'clock');
  }
  function fire(t, m) {
    const due = T.due(t);
    NN.alert({
      kind: 'task', color: AMBER, icon: 'bell', live: true, size: [600, 100], timeout: 120000,
      cap: () => {
        const left = (due - new Date()) / 60000;
        if (left > 0.5) return 'Jatuh tempo ' + NN.relMin(Math.ceil(left)) + ' lagi';
        if (left > -1.5) return 'Waktunya sekarang';
        return 'Terlewat ' + NN.relMin(Math.floor(-left));
      },
      title: t.title, sub: NN.dayLabel(t.date) + ', ' + t.time + ' · To-Do',
      ring: () => m > 0 ? NN.clamp((due - new Date()) / (m * 60000), 0, 1) : 1,
      split: {
        label: 'Tunda 10 mnt', act: () => snooze(t, 10),
        more: [
          { label: '5 mnt', act: () => snooze(t, 5) }, { label: '30 mnt', act: () => snooze(t, 30) },
          { label: '1 jam', act: () => snooze(t, 60) },
          { label: 'Besok pagi', act: () => { const d = new Date(); d.setDate(d.getDate() + 1); const [h, mm] = NN.cfg.todo.morningTime.split(':'); d.setHours(+h, +mm, 0, 0); return snooze(t, 0, d.getTime()); } },
        ],
      },
      actions: [{ label: 'Selesai', cls: 'pri', icon: 'check', act: () => { t.done = true; t.doneAt = Date.now(); T.save(); NN.toast('Mantap, tugas selesai'); } }],
      sound: NN.cfg.todo.sound ? { kind: 'chime' } : null,
      onClick: () => NN.pages.tasks.edit(t.id),
    });
  }
  NN.tasks.fire = fire;

  let lastDay = null;
  NN.tickers.push(now => {
    if (!NN.ready) return;
    const ui = NN.st.ui, today = NN.iso(now), hm = NN.hm(now), cfg = NN.cfg.todo;
    ui.fired = ui.fired || {};
    // bawa tugas yang belum selesai
    if (lastDay !== today) {
      lastDay = today;
      if (cfg.carry) {
        let n = 0;
        NN.st.tasks.forEach(t => { if (!t.done && t.date && t.date < today) { if (!t.origDate) t.origDate = t.date; t.date = today; t.carried = true; n++; } });
        if (n) T.save();
      }
      const cut = now.getTime() - 3 * 864e5;
      Object.keys(ui.fired).forEach(k => { if (ui.fired[k] < cut) delete ui.fired[k]; });
      if (NN.pages.tasks.sel < today && NN.isl.view !== 'page') NN.pages.tasks.sel = today;
    }
    // pengingat jam tugas
    NN.st.tasks.forEach(t => {
      if (t.done || !t.time || !t.date || !t.remind || !t.remind.length) return;
      const due = T.due(t), sorted = t.remind.slice().sort((a, b) => a - b);
      for (const m of sorted) {
        const at = due.getTime() - m * 60000, key = t.id + '|' + t.date + 'T' + t.time + '|' + m;
        if (now >= at && now - at < 15 * 60000 && !ui.fired[key]) {
          sorted.forEach(x => { if (x >= m) ui.fired[t.id + '|' + t.date + 'T' + t.time + '|' + x] = now.getTime(); });
          NN.save('ui'); fire(t, m); break;
        }
      }
    });
    if (ui.snz) Object.keys(ui.snz).forEach(id => {
      if (now.getTime() >= ui.snz[id]) { const t = T.get(id); delete ui.snz[id]; NN.save('ui'); if (t && !t.done) fire(t, 0); }
    });
    // pengingat pagi
    const active = !NN.track || NN.track.cat !== 'idle';
    if (cfg.morning && ui.morning !== today && hm >= cfg.morningTime && hm < '12:00' && active) {
      ui.morning = today; NN.save('ui');
      const list = T.sorted(T.on(today)).filter(t => !t.done);
      NN.alert({
        kind: 'morning', color: AMBER, icon: 'sun', size: [580, 96], timeout: 12000,
        cap: 'Selamat pagi · ' + NN.HARI[now.getDay()] + ', ' + now.getDate() + ' ' + NN.BLN[now.getMonth()],
        title: list.length ? list.length + ' tugas untuk hari ini' : 'Belum ada rencana hari ini',
        sub: list.length ? list.slice(0, 3).map(t => (t.time ? t.time + ' ' : '') + t.title).join('  ·  ') : 'Klik untuk menulis to-do hari ini',
        actions: [{ label: 'Lihat', cls: 'pri', act: () => { NN.pages.tasks.sel = today; NN.open('tasks'); return 'keep'; } }],
        then: () => { NN.pages.tasks.sel = today; NN.open('tasks', null, { autoClose: 9000 }); },
        onClick: () => { NN.pages.tasks.sel = today; NN.open('tasks', null, { focus: '#taskAdd' }); },
      });
    }
    // ajakan rencana besok
    const tmr = NN.addDays(today, 1);
    if (cfg.evening && ui.evening !== today && hm >= cfg.eveningTime && active) {
      ui.evening = today; NN.save('ui');
      if (!T.on(tmr).length) {
        const plan = () => { NN.pages.tasks.sel = tmr; NN.pages.tasks.month = tmr.slice(0, 7); NN.open('tasks', null, { focus: '#taskAdd' }); return 'keep'; };
        NN.alert({
          kind: 'evening', color: '#a78bfa', icon: 'moon', size: [600, 96], timeout: 30000,
          cap: 'Rencana besok', title: 'Tulis to-do untuk besok?', sub: 'Supaya pagi nanti langsung tahu mulai dari mana',
          actions: [{ label: 'Nanti', cls: 'ghost', act: () => { } }, { label: 'Tulis', cls: 'pri', icon: 'edit', act: plan }],
          onClick: plan,
        });
      }
    }
  });

  NN.compactProvider(vert => {
    const left = T.on(NN.today()).filter(t => !t.done);
    if (!left.length) return null;
    const late = left.some(t => T.due(t) && T.due(t) < new Date());
    const col = late ? 'var(--bad)' : 'var(--fg2)';
    return { prio: 2, kind: 'taskcount', html: '<span style="color:' + col + '">' + icon('checklist', vert ? 15 : 16) + '</span><span class="c-stat" style="color:' + col + '">' + left.length + '</span>' };
  });
  NN.slot('taskcount', { label: 'Jumlah tugas', render: vert => {
    const list = T.on(NN.today()), left = list.filter(t => !t.done);
    if (!list.length) return null;
    const late = left.some(t => T.due(t) && T.due(t) < new Date()), col = late ? 'var(--bad)' : left.length ? 'var(--fg2)' : 'var(--ok)';
    return { kind: 'taskcount', html: '<span style="color:' + col + '">' + icon(left.length ? 'checklist' : 'check', 15) + '</span><span class="c-stat" style="color:' + col + '">' + (left.length || (vert ? '' : 'Beres')) + '</span>' };
  } });
  NN.slot('nexttask', { label: 'Tugas berikutnya', render: vert => {
    const left = T.sorted(T.on(NN.today())).filter(t => !t.done);
    if (!left.length) return null;
    const t = left[0], P = PRIO[t.prio], late = T.due(t) && T.due(t) < new Date();
    if (vert) return { kind: 'taskcount', html: '<span style="color:' + (P ? P[1] : 'var(--fg2)') + '">' + icon('flag', 15) + '</span><span class="c-stat">' + left.length + '</span>' };
    return { kind: 'taskcount', html: (P ? '<span class="pdot" style="background:' + P[1] + '"></span>' : '') +
      (t.time ? '<span class="c-stat" style="color:' + (late ? 'var(--bad)' : 'var(--acc-text)') + '">' + t.time + '</span>' : '') +
      '<span class="c-title">' + esc(t.title) + '</span>' };
  } });
})();
