/* NotchNote - chat AI langsung dari notch */
(function () {
  'use strict';
  const NN = window.NN, esc = NN.esc;
  const PROV = {
    claude: { name: 'Claude', color: '#D97757', mark: 'Cl', web: 'https://claude.ai/new?q={q}', home: 'https://claude.ai/new', keyUrl: 'https://platform.claude.com/settings/keys' },
    openai: { name: 'ChatGPT', color: '#10A37F', mark: 'GP', web: 'https://chatgpt.com/?q={q}', home: 'https://chatgpt.com/', keyUrl: 'https://platform.openai.com/api-keys' },
    gemini: { name: 'Gemini', color: '#4F8DF5', mark: 'Ge', web: '', home: 'https://gemini.google.com/app', keyUrl: 'https://aistudio.google.com/apikey', free: true },
    groq: { name: 'Groq', color: '#F55036', mark: 'Gq', web: '', home: 'https://console.groq.com/playground', keyUrl: 'https://console.groq.com/keys', free: true },
    openrouter: { name: 'OpenRouter', color: '#6467F2', mark: 'OR', web: '', home: 'https://openrouter.ai/chat', keyUrl: 'https://openrouter.ai/settings/keys', free: true },
    ollama: { name: 'Ollama', color: '#3f3f46', mark: 'Ol', web: '', home: 'https://ollama.com/download', keyUrl: 'https://ollama.com/download', free: true, local: true },
  };
  NN.PROV = PROV;
  const SUGGEST = ['Ringkas teks berikut jadi 3 poin:', 'Terjemahkan ke bahasa Inggris:', 'Buatkan balasan email yang sopan untuk:', 'Jelaskan dengan sederhana:'];

  // ------------------------------------------------------------------ markdown sederhana
  function inline(h) {
    return h.replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a data-act="open-url" data-url="$2">$1</a>');
  }
  function md(src) {
    const blocks = [];
    src = String(src || '').replace(/```[\w+-]*\n?([\s\S]*?)(```|$)/g, (m, code) => { blocks.push(code.replace(/\n$/, '')); return '\n\u0000' + (blocks.length - 1) + '\u0000\n'; });
    const lines = esc(src).split('\n');
    let out = '', list = null, para = [];
    const fp = () => { if (para.length) { out += '<p>' + inline(para.join('<br>')) + '</p>'; para = []; } };
    const cl = () => { if (list) { out += '</' + list + '>'; list = null; } };
    for (const line of lines) {
      const ph = /^\u0000(\d+)\u0000$/.exec(line.trim());
      const li = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (ph) { fp(); cl(); out += '<pre><code>' + esc(blocks[+ph[1]]) + '</code></pre>'; }
      else if (li) { fp(); const t = /\d/.test(li[1]) ? 'ol' : 'ul'; if (list !== t) { cl(); out += '<' + t + '>'; list = t; } out += '<li>' + inline(li[2]) + '</li>'; }
      else if (/^#{1,4}\s+/.test(line)) { fp(); cl(); out += '<p><b>' + inline(line.replace(/^#{1,4}\s+/, '')) + '</b></p>'; }
      else if (!line.trim()) { fp(); cl(); }
      else { cl(); para.push(line); }
    }
    fp(); cl();
    return out;
  }
  NN.md = md;

  const A = {
    keys: {}, req: null,
    chat: () => NN.st.chat,
    prov: () => NN.chatProv || NN.cfg.ai.provider,
    hasKey: p => { p = p || A.prov(); return p === 'ollama' || !!A.keys[p]; },
  };
  NN.ai = A;

  NN.page('ai', {
    icon: 'sparkle', label: 'AI',
    size: () => [600, 470],
    init(init) {
      A.keys = init.api || {};
      NN.on('apiStatus', s => { A.keys = JSON.parse(s); if (NN.isl.page === 'ai' && NN.isl.view === 'page') this.render(this.el); });
      NN.on('ai', s => this.onEvent(JSON.parse(s)));
      if (NN.st.chat.provider) NN.chatProv = NN.st.chat.provider;
    },
    render(el) {
      this.el = el;
      const p = A.prov(), P = PROV[p], ms = A.chat().messages || [];
      const provs = Object.keys(PROV).map(k => '<button class="prov' + (k === p ? ' on' : '') + '" data-pv="' + k + '" title="' + PROV[k].name + (PROV[k].local ? ' · AI lokal di komputermu' : A.hasKey(k) ? ' · API key tersimpan' : ' · tanpa API key') + (PROV[k].free ? ' · ada pilihan gratis' : '') + '">' +
        '<span class="plogo" style="--pc:' + PROV[k].color + '">' + PROV[k].mark + '</span>' + (k === p ? PROV[k].name : '') + '</button>').join('');
      let body;
      if (ms.length) body = ms.map((m, i) => msgHtml(m, i)).join('');
      else body = '<div class="empty" style="gap:10px">' + (NN.cfg.mascot.on ? NN.owl(58, { live: true, sparks: true }) : icon('sparkle', 30)) + '<b>Tanya cepat ke ' + P.name + '</b>' +
        (A.hasKey(p) ? '<span>Jawaban muncul langsung di sini.</span>' :
          '<span>' + (P.free ? P.name + ' punya pilihan gratis. Buat API key-nya, lalu tempel di Pengaturan → AI.' : 'Belum ada API key ' + P.name + ', jadi pertanyaan akan dibuka di web.<br>Tambahkan API key supaya bisa chat langsung dari notch.') + '</span>' +
          '<button class="btn sm" data-ai="key">' + icon('key', 14) + 'Atur API key</button>') +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:470px;margin-top:4px">' +
        SUGGEST.map(s => '<button class="chip sm" data-sg="' + esc(s) + '">' + esc(s.replace(/:$/, '')) + '</button>').join('') + '</div></div>';
      const busy = !!A.req;
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('sparkle', 20) + 'AI</h2><div class="provs">' + provs + '</div><div class="sp"></div>' +
        '<button class="ibtn" data-ai="new" title="Percakapan baru">' + icon('plus', 17) + '</button>' +
        '<button class="ibtn" data-ai="web" title="Buka ' + P.name + ' di browser">' + icon('external', 16) + '</button></div>' +
        '<div class="msgs scroll" id="aiMsgs">' + body + '</div>' +
        '<div class="composer" id="aiComp"><textarea id="aiIn" rows="1" placeholder="Tanya ' + P.name + '…" spellcheck="false">' + esc(this.draft || '') + '</textarea>' +
        '<button class="sendb" data-ai="' + (busy ? 'stop' : 'send') + '" title="' + (busy ? 'Hentikan' : 'Kirim (Enter)') + '">' + icon(busy ? 'stop' : 'send', 16) + '</button></div>' +
        '<div class="ai-note"><span>Enter kirim · Shift+Enter baris baru · <span class="kbd">Ctrl+Alt+Space</span></span><span>' +
        (A.hasKey(p) ? esc(NN.cfg.ai.models[p]) : 'dibuka di web') + '</span></div>';
      this.bind(el);
      this.scrollEnd(true);
    },
    bind(el) {
      const ta = NN.$('#aiIn', el), comp = NN.$('#aiComp', el);
      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; };
      grow();
      ta.addEventListener('input', () => { this.draft = ta.value; grow(); comp.style.borderColor = ''; });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } });
      el.onclick = e => {
        const pv = e.target.closest('[data-pv]');
        if (pv) { NN.chatProv = pv.dataset.pv; NN.st.chat.provider = NN.chatProv; NN.save('chat'); this.render(el); ta.focus(); return; }
        const sg = e.target.closest('[data-sg]');
        if (sg) { const t = NN.$('#aiIn', el); t.value = sg.dataset.sg + ' '; this.draft = t.value; t.focus(); return; }
        const cp = e.target.closest('[data-cp]');
        if (cp) { const m = A.chat().messages[+cp.dataset.cp]; if (m) { NN.call('copyText', m.text); NN.toast('Jawaban disalin', 'copy'); } return; }
        const pre = e.target.closest('.msg pre');
        if (pre && e.detail === 2) { NN.call('copyText', pre.textContent); NN.toast('Kode disalin', 'copy'); return; }
        const b = e.target.closest('[data-ai]'); if (!b) return;
        const k = b.dataset.ai;
        if (k === 'send') this.send();
        else if (k === 'stop') { if (A.req) NN.call('aiCancel', A.req); }
        else if (k === 'new') { if (A.req) NN.call('aiCancel', A.req); A.req = null; NN.st.chat.messages = []; NN.save('chat'); this.render(el); NN.$('#aiIn', el).focus(); }
        else if (k === 'web') { const P = PROV[A.prov()]; NN.call('openUrl', P.home); }
        else if (k === 'key') NN.open('settings', 'ai');
      };
    },
    send() {
      const el = this.el, ta = NN.$('#aiIn', el), q = ta.value.trim(), p = A.prov(), P = PROV[p];
      if (!q) { NN.$('#aiComp', el).style.borderColor = 'var(--bad)'; ta.focus(); return; }
      if (A.req) return;
      if (!A.hasKey(p)) {
        if (P.web) NN.call('openUrl', P.web.replace('{q}', encodeURIComponent(q)));
        else { NN.call('copyText', q); NN.call('openUrl', P.home); }
        NN.toast(P.web ? 'Dibuka di ' + P.name : 'Pertanyaan disalin. Tempel di ' + P.name + ' dengan Ctrl+V', 'external');
        ta.value = ''; this.draft = '';
        return;
      }
      const chat = A.chat();
      chat.messages = chat.messages || [];
      chat.messages.push({ role: 'user', text: q });
      chat.messages.push({ role: 'assistant', text: '', pending: true, prov: p });
      chat.provider = p; chat.updated = Date.now();
      const hist = chat.messages.filter(m => !m.err && !m.pending && m.text).slice(-20).map(m => ({ role: m.role, content: m.text }));
      A.req = NN.uid();
      this.draft = '';
      NN.busy = true;
      NN.call('aiSend', A.req, p, NN.cfg.ai.models[p] || '', JSON.stringify(hist), NN.cfg.ai.system || '');
      this.render(el);
      NN.$('#aiIn', el).focus();
    },
    onEvent(ev) {
      if (ev.id !== A.req) return;
      const chat = A.chat(), m = chat.messages[chat.messages.length - 1];
      if (!m || !m.pending) return;
      if (ev.type === 'chunk') { m.text += ev.text; this.paintLast(); return; }
      m.pending = false;
      if (ev.type === 'error') { m.err = true; m.text = ev.text || 'Terjadi kesalahan'; }
      if (ev.type === 'done' && !m.text) { m.err = true; m.text = 'Jawaban kosong. Coba lagi.'; }
      A.req = null; NN.busy = false;
      NN.save('chat');
      if (NN.isl.page === 'ai' && NN.isl.view === 'page') this.render(this.el);
      else if (ev.type === 'done') NN.alert({ kind: 'ai', color: PROV[m.prov || A.prov()].color, icon: 'sparkle', size: [520, 88], timeout: 8000, cap: PROV[m.prov || A.prov()].name + ' selesai menjawab', title: m.text.replace(/\s+/g, ' ').slice(0, 90), sub: 'Klik untuk membaca', onClick: () => NN.open('ai') });
    },
    paintLast() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        if (!(NN.isl.page === 'ai' && NN.isl.view === 'page')) return;
        const chat = A.chat(), i = chat.messages.length - 1, n = NN.$('#aiMsgs .msg[data-i="' + i + '"]');
        if (n) { n.innerHTML = md(chat.messages[i].text) || typing(); this.scrollEnd(); }
      });
    },
    scrollEnd(force) {
      const box = NN.$('#aiMsgs'); if (!box) return;
      if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 120) box.scrollTop = box.scrollHeight;
    },
    shown() { const t = NN.$('#aiIn'); if (t && NN.windowActive) t.focus(); this.scrollEnd(true); },
  });
  const typing = () => '<span class="typing"><i></i><i></i><i></i></span>';
  function msgHtml(m, i) {
    if (m.role === 'user') return '<div class="msg u" data-i="' + i + '">' + esc(m.text) + '</div>';
    if (m.err) return '<div class="msg e" data-i="' + i + '">' + icon('warning', 15) + ' ' + esc(m.text) + '</div>';
    return '<div class="msg a" data-i="' + i + '">' + (md(m.text) || typing()) +
      (m.pending ? '' : '<div class="mact"><button class="ibtn" data-cp="' + i + '" title="Salin jawaban">' + icon('copy', 15) + '</button></div>') + '</div>';
  }

  NN.compactProvider(vert => {
    if (!A.req) return null;
    const P = PROV[A.prov()];
    return { prio: 4, kind: 'ai', html: '<span style="color:' + P.color + '">' + icon('sparkle', 16) + '</span>' + (vert ? '' : '<span class="typing"><i></i><i></i><i></i></span>') };
  });
})();
