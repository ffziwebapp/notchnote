/* NotchNote - Catatan: teks, checklist, dan daftar prioritas */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const COLORS = ['', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
  const KINDS = { text: ['text', 'Teks'], check: ['checklist', 'Checklist'], prio: ['flag', 'Prioritas'] };
  const PRIO = () => NN.PRIO || { 1: ['Tinggi', '#f87171'], 2: ['Sedang', '#fb923c'], 3: ['Rendah', '#60a5fa'] };
  const kindOf = n => (n.kind === 'check' || n.kind === 'prio') ? n.kind : 'text';
  const isList = n => kindOf(n) !== 'text';

  const lines = n => (n.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const title = n => (isList(n) ? (n.title || '').trim() : (lines(n)[0] || '').slice(0, 80)) || (isList(n) ? (kindOf(n) === 'prio' ? 'Daftar prioritas' : 'Checklist') : 'Catatan baru');
  const snippet = n => {
    if (!isList(n)) return lines(n)[1] || '';
    const it = (n.items || []).filter(i => i.text.trim());
    if (kindOf(n) === 'check') return it.length ? it.filter(i => i.done).length + '/' + it.length + ' selesai' : 'Kosong';
    const hi = it.filter(i => !i.done && (i.prio || 2) === 1).length, open = it.filter(i => !i.done).length;
    return it.length ? (hi ? hi + ' tinggi · ' : '') + open + ' belum selesai' : 'Kosong';
  };
  const isEmpty = n => isList(n) ? !(n.title || '').trim() && !(n.items || []).some(i => (i.text || '').trim()) : !(n.text || '').trim();
  const when = ts => { const d = new Date(ts), iso = NN.iso(d); return iso === NN.today() ? NN.hm(d) : NN.dayLabel(iso); };
  const today = () => { const d = new Date(); return (NN.HARI || NN.HR)[d.getDay()] + ', ' + d.getDate() + ' ' + NN.BLN[d.getMonth()] + ' ' + d.getFullYear(); };
  const item = (text, extra) => Object.assign({ id: NN.uid(), text: text || '', done: false, prio: 2 }, extra || {});

  // "!1 Kirim laporan" atau "Kirim laporan !1" -> prioritas
  function parsePrio(s) {
    let p = 0;
    s = s.replace(/(^|\s)!([123])(?=\s|$)/, (m, a, d) => { p = +d; return a; }).trim();
    return [s, p];
  }
  // baris teks -> item daftar (buang tanda list di depannya)
  function lineToItem(l) {
    let done = false;
    l = l.replace(/^\s*(?:[-*•–]\s+)?(\[( |x|X)\]\s*)?/, (m, b, c) => { if (c && c.toLowerCase() === 'x') done = true; return ''; })
      .replace(/^\s*(?:\d+[.)]\s+|[-*•–]\s+)/, '');
    const [t, p] = parsePrio(l);
    return item(t, { done, prio: p || 2 });
  }

  const TEMPLATES = [
    ['text', 'Notulen rapat', () => ({ text: 'Rapat ' + today() + '\nPeserta: \n\nPoin pembahasan\n- \n\nKeputusan\n- \n\nTindak lanjut\n- ' })],
    ['check', 'Daftar belanja', () => ({ title: 'Belanja', items: [] })],
    ['prio', 'Prioritas minggu ini', () => ({ title: 'Prioritas minggu ini', items: [] })],
    ['check', 'Persiapan berangkat', () => ({ title: 'Bawaan', items: ['Dompet', 'HP', 'Charger', 'Kunci', 'Botol minum'].map(t => item(t)) })],
    ['text', 'Jurnal harian', () => ({ text: 'Jurnal ' + today() + '\n\nYang berjalan baik\n- \n\nYang perlu diperbaiki\n- \n\nBesok fokus ke\n- ' })],
    ['text', 'Ide', () => ({ text: 'Ide: \n\nMasalahnya\n- \n\nSolusinya\n- \n\nLangkah pertama\n- ' })],
  ];

  NN.page('notes', {
    icon: 'note', label: 'Catatan',
    size: () => [720, 450],
    init() { this.q = ''; this.filt = 'all'; this.cur = (NN.st.notes[0] || {}).id || null; },
    list() {
      const q = this.q.toLowerCase();
      return NN.st.notes.filter(n => (this.filt === 'all' || kindOf(n) === this.filt) &&
        (!q || [n.text, n.title].concat((n.items || []).map(i => i.text)).join('\n').toLowerCase().includes(q)))
        .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
    },
    get(id) { return NN.st.notes.find(n => n.id === id); },
    touch(n) { n.updated = Date.now(); NN.save('notes'); const s = NN.$('#nSaved', this.el); if (s) s.textContent = 'Tersimpan ' + NN.hm(new Date()); },
    render(el, keepFocus) {
      this.el = el;
      this.cleanup();
      if (!this.get(this.cur)) this.cur = (this.list()[0] || {}).id || null;
      const n = this.get(this.cur);
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('note', 20) + 'Catatan</h2><div class="sp"></div>' +
        '<div class="nnew"><span class="faint">Baru</span>' + Object.keys(KINDS).map(k => '<button class="btn sm" data-new="' + k + '" title="Catatan ' + KINDS[k][1].toLowerCase() + ' baru">' + icon(KINDS[k][0], 14) + KINDS[k][1] + '</button>').join('') +
        '<button class="btn sm ghost" data-n="tpl" title="Mulai dari template">' + icon('layers', 14) + 'Template</button></div></div>' +
        '<div class="notes"><div class="nlist">' +
        '<input class="inp" id="nSearch" placeholder="Cari catatan" value="' + esc(this.q) + '" style="height:32px;border-radius:10px">' +
        '<div class="seg nfilt">' + [['all', 'Semua', null]].concat(Object.keys(KINDS).map(k => [k, KINDS[k][1], KINDS[k][0]])).map(f =>
          '<button class="' + (this.filt === f[0] ? 'on' : '') + '" data-filt="' + f[0] + '" title="' + f[1] + '">' + (f[2] ? icon(f[2], 14) : f[1]) + '</button>').join('') + '</div>' +
        '<div class="nitems scroll" id="nItems">' + this.itemsHtml() + '</div></div>' +
        (n ? this.editorHtml(n) :
          '<div class="neditor"><div class="empty">' + (NN.cfg.mascot.on ? NN.owl(62, { live: true, full: true }) : icon('note', 30)) + '<b>' + (this.q || this.filt !== 'all' ? 'Tidak ada yang cocok' : 'Belum ada catatan') + '</b>' +
          '<span>Tulis ide, buat checklist, atau susun daftar prioritas.</span>' +
          '<div style="display:flex;gap:6px;margin-top:6px">' + Object.keys(KINDS).map(k => '<button class="btn sm' + (k === 'text' ? ' pri' : '') + '" data-new="' + k + '">' + icon(KINDS[k][0], 14) + KINDS[k][1] + '</button>').join('') + '</div></div></div>') +
        '</div>';
      this.bind(el);
      this.autosize();
      if (keepFocus) this.focus(keepFocus.id, keepFocus.pos);
    },
    itemsHtml() {
      const l = this.list();
      if (!l.length) return '<div class="faint" style="padding:10px 6px;font-size:12px">' + (this.q ? 'Tidak ada yang cocok' : 'Kosong') + '</div>';
      return l.map(n => {
        const k = kindOf(n), it = (n.items || []).filter(i => i.text.trim()), done = it.filter(i => i.done).length;
        const prog = k === 'check' && it.length ? '<i class="nmini"><b style="width:' + Math.round(100 * done / it.length) + '%"></b></i>' : '';
        return '<div class="nitem' + (n.id === this.cur ? ' on' : '') + '" data-id="' + n.id + '" style="--nc:' + (n.color || 'transparent') + '">' +
          '<b><span class="nk">' + icon(KINDS[k][0], 13) + '</span>' + (n.pinned ? '<span class="npin">' + icon('pin', 11) + '</span>' : '') + '<span class="nt">' + esc(title(n)) + '</span></b>' +
          '<small><span>' + esc(when(n.updated)) + '</span><span>' + esc(snippet(n)) + '</span>' + prog + '</small></div>';
      }).join('');
    },
    toolHtml(n) {
      const k = kindOf(n);
      return '<div class="ntool">' +
        '<div class="seg nkind">' + Object.keys(KINDS).map(x => '<button class="' + (x === k ? 'on' : '') + '" data-kind="' + x + '" title="' + (x === k ? KINDS[x][1] : 'Ubah jadi ' + KINDS[x][1].toLowerCase()) + '">' + icon(KINDS[x][0], 14) + '</button>').join('') + '</div>' +
        '<div class="ncols">' + COLORS.map(c => '<button class="ncol' + (c ? '' : ' none') + ((n.color || '') === c ? ' on' : '') + '" data-col="' + c + '" style="--c:' + (c || 'transparent') + '" title="Warna"></button>').join('') + '</div>' +
        '<div class="sp"></div>' +
        (k !== 'text' ? '<button class="ibtn sm" data-n="todo" title="Kirim yang belum selesai ke To-do">' + icon('checklist', 16) + '</button>' : '') +
        '<button class="ibtn sm' + (n.pinned ? ' on' : '') + '" data-n="pin" title="' + (n.pinned ? 'Lepas sematan' : 'Sematkan di atas') + '">' + icon('pin', 15) + '</button>' +
        '<button class="ibtn sm" data-n="copy" title="Salin isi catatan">' + icon('copy', 15) + '</button>' +
        '<button class="ibtn sm' + (this.delArm === n.id ? ' danger' : '') + '" data-n="del" title="' + (this.delArm === n.id ? 'Klik lagi untuk menghapus' : 'Hapus catatan') + '">' + icon('trash', 15) + '</button></div>';
    },
    editorHtml(n) {
      const k = kindOf(n);
      if (k === 'text') {
        const words = ((n.text || '').match(/\S+/g) || []).length;
        return '<div class="neditor">' + this.toolHtml(n) +
          '<textarea class="ntext scroll" id="nText" placeholder="Mulai menulis. Baris pertama jadi judul.\nAwali baris dengan - atau 1. untuk membuat daftar." spellcheck="false">' + esc(n.text || '') + '</textarea>' +
          '<div class="nmeta"><span id="nWords">' + words + ' kata</span><span id="nSaved">Tersimpan ' + when(n.updated) + '</span></div></div>';
      }
      n.items = n.items || [];
      const it = n.items.filter(i => i.text.trim()), done = it.filter(i => i.done).length;
      const P = PRIO();
      let body = '';
      const row = i => '<div class="nrow' + (i.done ? ' done' : '') + '" data-iid="' + i.id + '">' +
        '<span class="grip" title="Geser untuk mengubah urutan">' + icon('grip', 14) + '</span>' +
        '<button class="cbx' + (i.done ? ' on' : '') + '" data-i="tg" title="' + (i.done ? 'Tandai belum' : 'Tandai selesai') + '">' + icon('check', 12) + '</button>' +
        (k === 'prio' ? '<button class="nflag" data-i="flag" style="--pc:' + P[i.prio || 2][1] + '" title="Prioritas ' + P[i.prio || 2][0].toLowerCase() + ' (klik untuk ganti)">' + icon('flag', 14) + '</button>' : '') +
        '<textarea class="nin" rows="1" spellcheck="false" placeholder="Tulis item">' + esc(i.text) + '</textarea>' +
        '<button class="ibtn x" data-i="del" title="Hapus item">' + icon('x', 13) + '</button></div>';
      const vis = i => !(n.hideDone && i.done);
      if (k === 'check') body = '<div class="ngroup" data-g="0">' + n.items.filter(vis).map(row).join('') + '</div>';
      else body = [1, 2, 3].map(p => {
        const g = n.items.filter(i => (i.prio || 2) === p);
        const open = g.filter(i => !i.done).length;
        return '<div class="ngh" style="--pc:' + P[p][1] + '"><i></i>' + P[p][0] + '<span>' + (g.length ? open + (g.length - open ? ' / ' + g.length : '') : '') + '</span></div>' +
          '<div class="ngroup" data-g="' + p + '">' + g.filter(i => !i.done).concat(g.filter(i => i.done && vis(i))).map(row).join('') + '</div>';
      }).join('');
      const np = this.newPrio || 2;
      return '<div class="neditor">' + this.toolHtml(n) +
        '<input class="ntitle" id="nTitle" maxlength="120" spellcheck="false" placeholder="' + (k === 'prio' ? 'Judul daftar prioritas' : 'Judul checklist') + '" value="' + esc(n.title || '') + '">' +
        (k === 'check' && it.length ? '<div class="nprog"><div class="pbar"><i style="width:' + Math.round(100 * done / it.length) + '%"></i></div><span>' + done + '/' + it.length + '</span></div>' : '') +
        '<div class="nrows scroll" id="nRows">' + body +
        '<div class="nrow add">' + (k === 'prio' ? '<button class="nflag" data-n="np" style="--pc:' + P[np][1] + '" title="Prioritas item baru: ' + P[np][0].toLowerCase() + '">' + icon('flag', 14) + '</button>' : '<span class="nplus">' + icon('plus', 14) + '</span>') +
        '<textarea class="nin" id="nAdd" rows="1" spellcheck="false" placeholder="' + (k === 'prio' ? 'Tambah prioritas, Enter untuk simpan (!1 tinggi, !3 rendah)' : 'Tambah item, Enter untuk simpan') + '"></textarea></div></div>' +
        '<div class="nmeta"><span>' + (it.length ? done + ' dari ' + it.length + ' selesai' : 'Belum ada item') +
        (done ? ' · <a data-n="hide">' + (n.hideDone ? 'Tampilkan yang selesai' : 'Sembunyikan yang selesai') + '</a> · <a data-n="clear">Hapus yang selesai</a>' : '') +
        '</span><span id="nSaved">Tersimpan ' + when(n.updated) + '</span></div></div>';
    },
    autosize(scope) { NN.$$('.nin', scope || this.el).forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }); },
    focus(iid, pos) {
      const go = () => {
        const t = iid === 'add' ? NN.$('#nAdd', this.el) : iid === 'title' ? NN.$('#nTitle', this.el) : iid === 'text' ? NN.$('#nText', this.el) : NN.$('.nrow[data-iid="' + iid + '"] .nin', this.el);
        if (!t) return false;
        if (!NN.windowActive) NN.call('activate');
        t.focus();
        const p = pos === undefined || pos < 0 ? t.value.length : Math.min(pos, t.value.length);
        try { t.selectionStart = t.selectionEnd = p; } catch (e) { /* abaikan */ }
        return true;
      };
      if (!go()) setTimeout(go, 60);
    },
    refreshList() { const l = NN.$('#nItems', this.el); if (l) l.innerHTML = this.itemsHtml(); },
    bind(el) {
      const self = this;
      const s = NN.$('#nSearch', el);
      s.addEventListener('input', () => { self.q = s.value; self.refreshList(); });
      const n = self.get(self.cur);
      const ta = NN.$('#nText', el);
      if (ta) {
        ta.addEventListener('input', () => {
          n.text = ta.value; self.touch(n);
          NN.$('#nWords', el).textContent = (n.text.match(/\S+/g) || []).length + ' kata';
          const it = NN.$('.nitem[data-id="' + n.id + '"] .nt', el); if (it) it.textContent = title(n);
        });
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) self.continueList(e, ta, n); });
      }
      const ti = NN.$('#nTitle', el);
      if (ti) {
        ti.addEventListener('input', () => { n.title = ti.value; self.touch(n); const it = NN.$('.nitem[data-id="' + n.id + '"] .nt', el); if (it) it.textContent = title(n); });
        ti.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); const f = NN.$('.nrow:not(.add) .nin', el); self.focus(f ? f.closest('.nrow').dataset.iid : 'add', 0); } });
      }
      NN.$$('.nrow .nin', el).forEach(t => {
        const r = t.closest('.nrow'), add = r.classList.contains('add');
        t.addEventListener('input', () => {
          t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
          if (add) return;
          const i = n.items.find(x => x.id === r.dataset.iid); if (i) { i.text = t.value.replace(/\n/g, ' '); self.touch(n); }
        });
        t.addEventListener('blur', () => { if (!add && !t.value.trim()) setTimeout(() => { if (!el.contains(document.activeElement) || !document.activeElement.closest || !document.activeElement.closest('.nrow[data-iid="' + r.dataset.iid + '"]')) self.dropEmpty(n, r.dataset.iid); }, 120); });
        t.addEventListener('keydown', e => self.itemKey(e, t, r, n, add));
      });
      NN.$$('.grip', el).forEach(g => g.addEventListener('pointerdown', e => self.drag(e, g.closest('.nrow'), n)));
      el.onclick = e => {
        if (self.pop && !e.target.closest('.npop')) { self.closePop(); if (e.target.closest('[data-n="tpl"],[data-n="todo"]')) return; }
        const it = e.target.closest('.nitem');
        if (it) { self.cur = it.dataset.id; self.delArm = null; self.render(el); if (kindOf(self.get(self.cur)) === 'text') self.focusEnd(); return; }
        const f = e.target.closest('[data-filt]');
        if (f) { self.filt = f.dataset.filt; self.render(el); return; }
        const nw = e.target.closest('[data-new]');
        if (nw) { self.newNote('', nw.dataset.new); return; }
        const kd = e.target.closest('[data-kind]');
        if (kd && n) { self.convert(n, kd.dataset.kind); return; }
        const c = e.target.closest('[data-col]');
        if (c && n) { n.color = c.dataset.col; self.touch(n); self.render(el); return; }
        const tp = e.target.closest('[data-tpl]');
        if (tp) { self.closePop(); self.fromTemplate(+tp.dataset.tpl); return; }
        const td = e.target.closest('[data-todo]');
        if (td && n) { self.closePop(); self.toTodo(n, td.dataset.todo); return; }
        const ib = e.target.closest('[data-i]');
        if (ib && n) { self.itemAction(n, ib.closest('.nrow').dataset.iid, ib.dataset.i); return; }
        const b = e.target.closest('[data-n]'); if (!b) return;
        const a = b.dataset.n;
        if (a === 'tpl') self.openPop(b, '<div class="npt">Mulai dari template</div>' + TEMPLATES.map((t, i) => '<button class="dd-o" data-tpl="' + i + '">' + icon(KINDS[t[0]][0], 14) + t[1] + '</button>').join(''));
        if (!n) return;
        if (a === 'pin') { n.pinned = !n.pinned; self.touch(n); self.render(el); }
        else if (a === 'copy') { NN.call('copyText', self.asText(n)); NN.toast('Catatan disalin', 'copy'); }
        else if (a === 'del') {
          if (self.delArm !== n.id) { self.delArm = n.id; clearTimeout(self._arm); self._arm = setTimeout(() => { self.delArm = null; if (self.visible()) self.render(el); }, 2600); self.render(el); return; }
          self.delArm = null;
          NN.st.notes.splice(NN.st.notes.indexOf(n), 1); NN.save('notes');
          self.cur = (self.list()[0] || {}).id || null; self.render(el); NN.toast('Catatan dihapus', 'trash', 'var(--fg2)');
        }
        else if (a === 'todo') {
          const open = (n.items || []).filter(i => !i.done && i.text.trim()).length;
          if (!open) { NN.toast('Tidak ada item yang belum selesai', 'info', 'var(--warn)'); return; }
          self.openPop(b, '<div class="npt">Kirim ' + open + ' item ke To-do</div><button class="dd-o" data-todo="0">' + icon('calendar', 14) + 'Hari ini</button><button class="dd-o" data-todo="1">' + icon('calendar', 14) + 'Besok</button>', true);
        }
        else if (a === 'np') { self.newPrio = ((self.newPrio || 2) % 3) + 1; const add = NN.$('#nAdd', el), v = add ? add.value : ''; self.render(el, { id: 'add' }); const a2 = NN.$('#nAdd', el); if (a2) a2.value = v; }
        else if (a === 'hide') { n.hideDone = !n.hideDone; self.touch(n); self.render(el); }
        else if (a === 'clear') { const k = n.items.filter(i => i.done).length; n.items = n.items.filter(i => !i.done); self.touch(n); self.render(el); NN.toast(k + ' item selesai dihapus', 'trash', 'var(--fg2)'); }
      };
    },
    visible() { return NN.isl.page === 'notes' && NN.isl.view === 'page'; },
    openPop(btn, html, right) {
      this.closePop();
      const p = document.createElement('div');
      p.className = 'npop dd-m'; p.innerHTML = html;
      const r = btn.getBoundingClientRect(), host = this.el.getBoundingClientRect();
      p.style.top = (r.bottom - host.top + 4) + 'px';
      this.el.appendChild(p); this.pop = p;
      if (right || r.left - host.left + p.offsetWidth > host.width - 12) p.style.right = Math.max(12, host.right - r.right) + 'px';
      else p.style.left = Math.max(0, r.left - host.left) + 'px';
    },
    closePop() { if (this.pop) { this.pop.remove(); this.pop = null; } },
    // Enter di catatan teks: lanjutkan tanda daftar (- , •, 1., [ ])
    continueList(e, ta, n) {
      const v = ta.value, at = ta.selectionStart;
      const ls = v.lastIndexOf('\n', at - 1) + 1, line = v.slice(ls, at);
      const m = line.match(/^(\s*)([-*•–]|\d+[.)]|\[[ xX]\])(\s+)(.*)$/);
      if (!m) return;
      e.preventDefault();
      let pre;
      if (!m[4].trim()) { ta.value = v.slice(0, ls) + v.slice(at); ta.selectionStart = ta.selectionEnd = ls; }
      else {
        const num = m[2].match(/^(\d+)([.)])$/);
        pre = m[1] + (num ? (+num[1] + 1) + num[2] : /^\[/.test(m[2]) ? '[ ]' : m[2]) + m[3];
        ta.value = v.slice(0, at) + '\n' + pre + v.slice(at);
        ta.selectionStart = ta.selectionEnd = at + 1 + pre.length;
      }
      ta.dispatchEvent(new Event('input'));
    },
    itemKey(e, t, r, n, add) {
      const k = e.key;
      if (k === 'Enter') {
        e.preventDefault();
        if (add) {
          const v = t.value.trim(); if (!v) return;
          const [txt, p] = parsePrio(v);
          n.items.push(item(txt, { prio: p || (kindOf(n) === 'prio' ? (this.newPrio || 2) : 2) }));
          this.touch(n); this.render(this.el, { id: 'add' }); this.refreshList();
          const rows = NN.$('#nRows', this.el); if (rows) rows.scrollTop = rows.scrollHeight;
          return;
        }
        // Enter di tengah item: sisipkan item baru di bawahnya
        const idx = n.items.findIndex(x => x.id === r.dataset.iid); if (idx < 0) return;
        const cur = n.items[idx], at = t.selectionStart;
        const rest = t.value.slice(at).trim(); cur.text = t.value.slice(0, at).trim();
        const ni = item(rest, { prio: cur.prio || 2 });
        n.items.splice(idx + 1, 0, ni);
        this.touch(n); this.render(this.el, { id: ni.id, pos: 0 });
        return;
      }
      if (k === 'Backspace' && !add && t.selectionStart === 0 && t.selectionEnd === 0) {
        const rows = NN.$$('.nrow .nin', this.el), at = rows.indexOf(t);
        const prev = at > 0 ? rows[at - 1].closest('.nrow') : null;
        if (!t.value) { e.preventDefault(); n.items = n.items.filter(x => x.id !== r.dataset.iid); this.touch(n); this.render(this.el, prev && !prev.classList.contains('add') ? { id: prev.dataset.iid } : { id: 'title' }); }
        else if (prev && !prev.classList.contains('add')) {
          // gabung dengan item di atasnya
          e.preventDefault();
          const a = n.items.find(x => x.id === prev.dataset.iid), b = n.items.find(x => x.id === r.dataset.iid);
          const pos = a.text.length; a.text = (a.text + ' ' + b.text).trim(); n.items = n.items.filter(x => x !== b);
          this.touch(n); this.render(this.el, { id: a.id, pos: pos + (a.text.length > pos ? 1 : 0) });
        }
        return;
      }
      if ((k === 'ArrowUp' && t.selectionStart === 0) || (k === 'ArrowDown' && t.selectionEnd === t.value.length)) {
        const rows = NN.$$('.nrow .nin', this.el), at = rows.indexOf(t), to = rows[at + (k === 'ArrowUp' ? -1 : 1)];
        if (to) { e.preventDefault(); to.focus(); } else if (k === 'ArrowUp') { e.preventDefault(); this.focus('title'); }
        return;
      }
      if (k === 'Escape') t.blur();
    },
    dropEmpty(n, iid) {
      const i = (n.items || []).find(x => x.id === iid);
      if (i && !i.text.trim()) { n.items = n.items.filter(x => x !== i); NN.save('notes'); if (this.visible() && this.get(this.cur) === n) this.render(this.el); }
    },
    itemAction(n, iid, act) {
      const i = n.items.find(x => x.id === iid); if (!i) return;
      if (act === 'tg') {
        i.done = !i.done; this.touch(n); this.render(this.el); this.refreshList();
        const it = n.items.filter(x => x.text.trim());
        if (i.done && it.length > 1 && it.every(x => x.done)) { NN.toast('Semua selesai!', 'check'); NN.owlCtl && NN.owlCtl.react && NN.owlCtl.react('flap'); }
      }
      else if (act === 'flag') { i.prio = ((i.prio || 2) % 3) + 1; this.touch(n); this.render(this.el); this.refreshList(); }
      else if (act === 'del') { n.items = n.items.filter(x => x !== i); this.touch(n); this.render(this.el); this.refreshList(); }
    },
    // geser item: urutan baru, dan di daftar prioritas pindah kelompok = ganti prioritas
    drag(e, row, n) {
      e.preventDefault();
      const self = this, box = NN.$('#nRows', this.el);
      row.classList.add('dragging');
      NN.busy = true;
      const move = ev => {
        const groups = NN.$$('.ngroup', box);
        let placed = false;
        for (const g of groups) {
          const gr = g.getBoundingClientRect();
          if (ev.clientY < gr.top - 14 || ev.clientY > gr.bottom + 14) continue;
          const rows = NN.$$('.nrow', g).filter(x => x !== row);
          const before = rows.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
          if (before) g.insertBefore(row, before); else g.appendChild(row);
          placed = true; break;
        }
        if (!placed && groups.length === 1) groups[0].appendChild(row);
        const br = box.getBoundingClientRect();
        if (ev.clientY < br.top + 20) box.scrollTop -= 8; else if (ev.clientY > br.bottom - 20) box.scrollTop += 8;
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        row.classList.remove('dragging'); NN.busy = false;
        const order = [];
        NN.$$('.ngroup', box).forEach(g => NN.$$('.nrow', g).forEach(r => {
          const i = n.items.find(x => x.id === r.dataset.iid); if (!i) return;
          if (+g.dataset.g) i.prio = +g.dataset.g;
          order.push(i);
        }));
        n.items.filter(i => order.indexOf(i) < 0).forEach(i => order.push(i));
        n.items = order; self.touch(n); self.render(self.el); self.refreshList();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    },
    asText(n) {
      const k = kindOf(n); if (k === 'text') return n.text || '';
      const P = PRIO(), it = (n.items || []).filter(i => i.text.trim());
      if (k === 'check') return [title(n)].concat(it.map(i => (i.done ? '[x] ' : '[ ] ') + i.text)).join('\n');
      return [title(n)].concat([1, 2, 3].map(p => it.filter(i => (i.prio || 2) === p).map(i => '- ' + (i.done ? '[x] ' : '') + i.text + ' !' + p).join('\n')).filter(Boolean)).join('\n');
    },
    convert(n, to) {
      const from = kindOf(n); if (from === to) return;
      if (from === 'text') {
        const ls = (n.text || '').split('\n').map(s => s.trim()).filter(Boolean);
        n.title = ls.shift() || '';
        n.items = ls.filter(l => !/^[A-Za-zÀ-ÿ ]{2,30}:?$/.test(l) || /^[-*•\d\[]/.test(l)).map(lineToItem).filter(i => i.text);
        if (!n.items.length && ls.length) n.items = ls.map(lineToItem).filter(i => i.text);
      } else if (to === 'text') {
        n.text = this.asText(n);
        n.items = []; n.title = '';
      } else (n.items || []).forEach(i => { i.prio = i.prio || 2; });
      n.kind = to; this.touch(n); this.render(this.el); this.refreshList();
      NN.toast('Diubah jadi ' + KINDS[to][1].toLowerCase(), KINDS[to][0]);
    },
    toTodo(n, plus) {
      const date = NN.addDays(NN.today(), +plus || 0), open = (n.items || []).filter(i => !i.done && i.text.trim());
      if (!NN.tasks) return;
      open.forEach(i => NN.tasks.add(i.text.trim(), date, '', kindOf(n) === 'prio' ? (i.prio || 2) : 0));
      NN.toast(open.length + ' tugas masuk To-do ' + (+plus ? 'besok' : 'hari ini'), 'checklist');
    },
    fromTemplate(i) {
      const t = TEMPLATES[i]; if (!t) return;
      this.newNote('', t[0], t[2]());
    },
    focusEnd() {
      const n = this.get(this.cur); if (!n) return;
      if (kindOf(n) === 'text') this.focus('text');
      else this.focus((n.title || '').trim() ? 'add' : 'title');
    },
    newNote(text, kind, extra) {
      this.cleanup();
      kind = KINDS[kind] ? kind : 'text';
      const n = Object.assign({ id: NN.uid(), kind, text: text || '', title: '', items: [], color: '', pinned: false, created: Date.now(), updated: Date.now() }, extra || {});
      NN.st.notes.unshift(n); this.cur = n.id; this.q = ''; this.filt = 'all';
      NN.save('notes');
      if (this.visible()) this.render(this.el); else NN.open('notes');
      setTimeout(() => this.focusEnd(), 240);
      return n;
    },
    cleanup() {
      const before = NN.st.notes.length;
      NN.st.notes = NN.st.notes.filter(n => (n.id === this.cur && this.visible()) || !isEmpty(n));
      if (NN.st.notes.length !== before) NN.save('notes');
    },
    hide() { this.closePop(); this.delArm = null; const cur = this.get(this.cur); if (cur && isEmpty(cur)) { NN.st.notes = NN.st.notes.filter(n => n !== cur); NN.save('notes'); } },
    shown() { const n = this.get(this.cur); if (n && NN.windowActive && isEmpty(n)) this.focusEnd(); this.autosize(); },
  });
})();
