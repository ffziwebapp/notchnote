/* NotchNote - Klip: riwayat clipboard & screenshot */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;

  function ago(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt';
    const d = new Date(ts), iso = NN.iso(d);
    return iso === NN.today() ? NN.hm(d) : NN.dayLabel(iso);
  }

  NN.page('clip', {
    icon: 'clipboard', label: 'Klip',
    size: () => [680, 430],
    init(init) { this.items = init.clips || []; this.filter = 'all'; this.confirm = 0; bindSignals(); },
    list() { return this.items.filter(c => this.filter === 'all' || c.type === this.filter).sort((a, b) => (b.pinned - a.pinned) || (b.ts - a.ts)); },
    render(el) {
      this.el = el;
      const l = this.list(), nImg = this.items.filter(c => c.type === 'image').length;
      const seg = [['all', 'Semua'], ['image', 'Gambar'], ['text', 'Teks']].map(f => '<button class="' + (this.filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>').join('');
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('clipboard', 20) + 'Klip</h2><div class="seg">' + seg + '</div><div class="sp"></div>' +
        (this.items.length ? '<button class="btn sm ghost danger" data-c="clear">' + icon('trash', 14) + (this.confirm > Date.now() ? 'Yakin? Klik lagi' : 'Hapus semua') + '</button>' : '') + '</div>' +
        (l.length ? '<div class="cgrid scroll">' + l.map(itemHtml).join('') + '</div>' :
          '<div class="empty">' + icon(this.filter === 'text' ? 'text' : 'image', 30) + '<b>' + (this.items.length ? 'Tidak ada item di filter ini' : 'Klip masih kosong') + '</b>' +
          '<span>Tekan <span class="kbd">PrtSc</span> atau <span class="kbd">Win+Shift+S</span> untuk screenshot,<br>atau salin teks. Semuanya tersimpan di sini.</span></div>') +
        '<div class="ai-note"><span>' + this.items.length + ' item · ' + nImg + ' gambar · klik item untuk menyalin lagi</span><span>Item yang disematkan tidak ikut terhapus</span></div>';
      el.onclick = e => this.onClick(e);
    },
    onClick(e) {
      const f = e.target.closest('[data-f]');
      if (f) { this.filter = f.dataset.f; this.render(this.el); return; }
      const c = e.target.closest('[data-c]');
      if (c && c.dataset.c === 'clear') {
        if (this.confirm > Date.now()) { this.confirm = 0; NN.call('clearClips'); NN.toast('Klip dibersihkan', 'trash', 'var(--fg2)'); }
        else { this.confirm = Date.now() + 3000; this.render(this.el); setTimeout(() => { if (this.confirm && this.confirm <= Date.now()) { this.confirm = 0; this.render(this.el); } }, 3100); }
        return;
      }
      const it = e.target.closest('.citem'); if (!it) return;
      const id = it.dataset.id, a = e.target.closest('[data-ca]');
      if (!a) { NN.call('copyClip', id); it.classList.remove('copied'); void it.offsetWidth; it.classList.add('copied'); return; }
      const k = a.dataset.ca;
      if (k === 'pin') { const x = this.items.find(i => i.id === id); NN.call('pinClip', id, !x.pinned); }
      else if (k === 'save') { NN.dialog = true; NN.call('saveClip', id).then(p => { NN.dialog = false; if (p) NN.toast('Disimpan', 'download'); }); }
      else if (k === 'open') NN.call('openClip', id);
      else if (k === 'note') { const x = this.items.find(i => i.id === id); NN.pages.notes.newNote(x.text); }
      else if (k === 'del') NN.call('deleteClip', id);
    },
    update(items) { this.items = items; if (NN.isl.view === 'page' && NN.isl.page === 'clip') this.render(this.el); },
  });

  function itemHtml(c) {
    const tags = '<div class="ctag">' + (c.pinned ? '<span>' + icon('pin', 11) + '</span>' : '') + '<span>' + esc(ago(c.ts)) + '</span></div>';
    const acts = '<div class="cact">' +
      '<button class="ibtn" data-ca="pin" title="' + (c.pinned ? 'Lepas sematan' : 'Sematkan') + '">' + icon('pin', 14) + '</button>' +
      (c.type === 'image' ? '<button class="ibtn" data-ca="save" title="Simpan sebagai file">' + icon('download', 14) + '</button>' +
        '<button class="ibtn" data-ca="open" title="Buka">' + icon('external', 14) + '</button>'
        : '<button class="ibtn" data-ca="note" title="Jadikan catatan">' + icon('note', 14) + '</button>') +
      '<button class="ibtn" data-ca="del" title="Hapus">' + icon('trash', 14) + '</button></div>';
    const body = c.type === 'image' ? '<img src="' + esc(c.thumb || c.url) + '" alt="" loading="lazy" draggable="false">' : '<div class="txt">' + esc(c.text) + '</div>';
    return '<div class="citem" data-id="' + c.id + '" title="Klik untuk menyalin">' + body + tags + acts + '</div>';
  }

  function bindSignals() {
    NN.on('clips', s => NN.pages.clip.update(JSON.parse(s)));
    NN.on('clipNew', s => {
      const c = JSON.parse(s);
      if (c.type !== 'image' || !NN.cfg.clip.notify) return;
      if (NN.isl.view === 'page' && NN.isl.page === 'clip') return;
      NN.alert({
        kind: 'clip', color: 'var(--acc)', img: c.thumb || c.url, size: [560, 92], timeout: 6000, replace: true,
        cap: 'Screenshot tersimpan', title: 'Tersimpan ke Klip', sub: (c.w ? c.w + ' × ' + c.h + ' px · ' : '') + 'klik untuk melihat',
        actions: [{ label: 'Simpan', icon: 'download', act: () => { NN.call('saveClip', c.id); } }, { label: 'Buka Klip', cls: 'pri', act: () => { NN.open('clip'); return 'keep'; } }],
        onClick: () => NN.open('clip'),
      });
    });
  }
})();
