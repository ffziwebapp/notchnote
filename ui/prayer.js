/* NotchNote - jadwal sholat (perhitungan astronomis offline) */
(function () {
  'use strict';
  const DEG = Math.PI / 180;
  const dsin = d => Math.sin(d * DEG), dcos = d => Math.cos(d * DEG), dtan = d => Math.tan(d * DEG);
  const dasin = x => Math.asin(x) / DEG, dacos = x => Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
  const datan2 = (y, x) => Math.atan2(y, x) / DEG, dacot = x => Math.atan(1 / x) / DEG;
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

  const METHODS = {
    kemenag: { name: 'Kemenag RI', fajr: 20, isha: 18 },
    jakim: { name: 'JAKIM Malaysia', fajr: 20, isha: 18 },
    muis: { name: 'MUIS Singapura', fajr: 20, isha: 18 },
    mwl: { name: 'Liga Muslim Dunia', fajr: 18, isha: 17 },
    makkah: { name: 'Umm al-Qura', fajr: 18.5, ishaMin: 90 },
    egypt: { name: 'Mesir', fajr: 19.5, isha: 17.5 },
    isna: { name: 'ISNA (Amerika)', fajr: 15, isha: 15 },
  };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sun(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = datan2(dcos(e) * dsin(L), dcos(L)) / 15;
    return { decl: dasin(dsin(e) * dsin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  /* Mengembalikan jam desimal waktu lokal untuk tanggal tsb. */
  function rawTimes(date, lat, lon, method, asrFactor) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const noonLocal = new Date(y, m - 1, d, 12);
    const tz = -noonLocal.getTimezoneOffset() / 60;
    const jd = julian(y, m, d) - lon / (15 * 24);
    const mid = t => fix(12 - sun(jd + t).eqt, 24);
    const angle = (a, t, ccw) => {
      const decl = sun(jd + t).decl, noon = mid(t);
      const T = dacos((-dsin(a) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15;
      return noon + (ccw ? -T : T);
    };
    const asr = (f, t) => { const decl = sun(jd + t).decl; return angle(-dacot(f + dtan(Math.abs(lat - decl))), t); };
    const M = METHODS[method] || METHODS.kemenag;
    const t = {
      subuh: angle(M.fajr, 5 / 24, true),
      terbit: angle(0.833, 6 / 24, true),
      dzuhur: mid(12 / 24),
      ashar: asr(asrFactor, 13 / 24),
      maghrib: angle(0.833, 18 / 24),
      isya: M.ishaMin ? null : angle(M.isha, 18 / 24),
    };
    for (const k in t) if (t[k] != null) t[k] += tz - lon / 15;
    if (M.ishaMin) t.isya = t.maghrib + M.ishaMin / 60;
    return t;
  }

  const ORDER = ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  const NAMES = { imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
  const ICONS_ = { imsak: 'moon', subuh: 'dawn', terbit: 'sunrise', dzuhur: 'sun', ashar: 'cloud-sun', maghrib: 'sunset', isya: 'moon' };

  /* opsi: {lat, lon, method, asr:'std'|'hanafi', ihtiyat, adj:{}} -> {nama: Date} */
  function times(date, o) {
    const r = rawTimes(date, o.lat, o.lon, o.method, o.asr === 'hanafi' ? 2 : 1);
    const iht = Number(o.ihtiyat) || 0, adj = o.adj || {};
    const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const toDate = (h, add) => new Date(base.getTime() + Math.round(h * 60 + add) * 60000);
    const out = {
      subuh: toDate(r.subuh, iht + (adj.subuh || 0), true),
      terbit: toDate(r.terbit, -iht, false),
      dzuhur: toDate(r.dzuhur, iht + (adj.dzuhur || 0), true),
      ashar: toDate(r.ashar, iht + (adj.ashar || 0), true),
      maghrib: toDate(r.maghrib, iht + (adj.maghrib || 0), true),
      isya: toDate(r.isya, iht + (adj.isya || 0), true),
    };
    out.imsak = new Date(out.subuh.getTime() - 10 * 60000);
    return out;
  }
  window.PrayCalc = { times, rawTimes, METHODS, ORDER, NAMES };

  const CITIES = [
    ['Banda Aceh', 5.55, 95.32], ['Medan', 3.59, 98.67], ['Padang', -0.95, 100.35], ['Pekanbaru', 0.51, 101.45],
    ['Jambi', -1.61, 103.61], ['Palembang', -2.99, 104.76], ['Bengkulu', -3.80, 102.27], ['Bandar Lampung', -5.43, 105.26],
    ['Pangkal Pinang', -2.13, 106.11], ['Tanjung Pinang', 0.92, 104.45], ['Batam', 1.13, 104.05], ['Serang', -6.12, 106.15],
    ['Tangerang', -6.18, 106.63], ['Jakarta', -6.1667, 106.8167], ['Bogor', -6.60, 106.80], ['Depok', -6.40, 106.82],
    ['Bekasi', -6.24, 106.99], ['Bandung', -6.91, 107.61], ['Cirebon', -6.71, 108.56], ['Tasikmalaya', -7.33, 108.22],
    ['Purwokerto', -7.42, 109.23], ['Semarang', -6.97, 110.42], ['Surakarta', -7.57, 110.82], ['Yogyakarta', -7.80, 110.36],
    ['Kediri', -7.82, 112.01], ['Surabaya', -7.25, 112.75], ['Malang', -7.98, 112.63], ['Jember', -8.17, 113.70],
    ['Denpasar', -8.65, 115.22], ['Mataram', -8.58, 116.12], ['Kupang', -10.18, 123.61], ['Pontianak', -0.03, 109.33],
    ['Palangka Raya', -2.21, 113.92], ['Banjarmasin', -3.32, 114.59], ['Samarinda', -0.50, 117.15], ['Balikpapan', -1.27, 116.83],
    ['Tanjung Selor', 2.84, 117.37], ['Manado', 1.47, 124.84], ['Gorontalo', 0.54, 123.06], ['Palu', -0.90, 119.87],
    ['Mamuju', -2.68, 118.89], ['Makassar', -5.15, 119.43], ['Kendari', -3.97, 122.51], ['Ambon', -3.70, 128.18],
    ['Ternate', 0.79, 127.38], ['Manokwari', -0.86, 134.06], ['Sorong', -0.88, 131.26], ['Jayapura', -2.53, 140.72],
    ['Merauke', -8.49, 140.40], ['Kuala Lumpur', 3.14, 101.69], ['Singapura', 1.35, 103.82], ['Bandar Seri Begawan', 4.90, 114.94],
    ['Makkah', 21.42, 39.83], ['Madinah', 24.47, 39.61], ['Kairo', 30.04, 31.24], ['Istanbul', 41.01, 28.98],
    ['London', 51.51, -0.13], ['Tokyo', 35.68, 139.69], ['Sydney', -33.87, 151.21],
  ];

  if (!window.NN) return;
  const NN = window.NN;
  NN.CITIES = CITIES;
  const HIJRI = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];
  NN.hijri = function (d) {
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
      const g = t => +((parts.find(p => p.type === t) || {}).value || '').replace(/\D/g, '');
      const mo = g('month');
      if (!mo) return '';
      return g('day') + ' ' + HIJRI[mo - 1] + ' ' + g('year') + ' H';
    } catch (e) { return ''; }
  };

  const P = {
    cache: {},
    opts() { const c = NN.cfg.prayer; return { lat: c.lat, lon: c.lon, method: c.method, asr: c.asr, ihtiyat: c.ihtiyat, adj: c.adj }; },
    day(iso) {
      const key = iso + JSON.stringify(this.opts());
      if (!this.cache[key]) { this.cache = {}; this.cache[key] = times(NN.parseISO(iso), this.opts()); }
      return this.cache[key];
    },
    /* waktu sholat wajib berikutnya & sebelumnya */
    around(now) {
      const t0 = this.day(NN.iso(now)), t1 = this.day(NN.addDays(NN.iso(now), 1)), tm = this.day(NN.addDays(NN.iso(now), -1));
      const list = [];
      [[tm, -1], [t0, 0], [t1, 1]].forEach(([t]) => ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].forEach(k => list.push({ k, at: t[k] })));
      let i = list.findIndex(x => x.at > now);
      return { next: list[i], prev: list[i - 1] };
    },
  };
  NN.prayer = P;

  NN.page('prayer', {
    icon: 'mosque', label: 'Sholat',
    size: () => [580, 352],
    render(el) {
      const now = new Date(), c = NN.cfg.prayer, t = P.day(NN.iso(now)), a = P.around(now);
      const left = (a.next.at - now) / 60000, span = (a.next.at - a.prev.at) / 60000;
      const nextToday = a.next.at.toDateString() === now.toDateString() ? a.next.k : null;
      const cards = ORDER.map(k => {
        const past = t[k] <= now;
        const isNext = k === nextToday;
        const on = c.notify[k];
        return '<div class="pr' + (isNext ? ' now' : past ? ' past' : '') + '"' + (isNext ? ' title="Berikutnya"' : '') + '>' + icon(ICONS_[k], 18) + '<small>' + NAMES[k] + '</small><b>' + NN.hm(t[k]) + '</b>' +
          '<button class="ibtn nb' + (on ? ' on' : '') + '" data-pr="' + k + '" title="' + (on ? 'Matikan' : 'Nyalakan') + ' pengingat">' + icon(on ? 'bell' : 'bell-off', 14) + '</button></div>';
      }).join('');
      el.innerHTML =
        '<div class="hdr"><h2>' + icon('mosque', 20) + 'Jadwal Sholat</h2><div class="sp"></div>' +
        '<button class="chip sm" data-pg="loc">' + icon('location', 14) + NN.esc(c.city) + '</button></div>' +
        '<div class="pr-top"><div class="ring-big" style="width:70px;height:70px">' + NN.ring(70, 5, 1 - left / span, 'var(--acc)') +
        '<div class="val" style="color:var(--acc-text)">' + icon(ICONS_[a.next.k], 24) + '</div></div>' +
        '<div class="pr-next"><b>' + NAMES[a.next.k] + ' · ' + NN.hm(a.next.at) + '</b><span>dalam ' + NN.relMin(Math.ceil(left)) + ' · ' +
        NN.HARI[now.getDay()] + ', ' + now.getDate() + ' ' + NN.BLN[now.getMonth()] + (NN.hijri(now) ? ' · ' + NN.hijri(now) : '') + '</span></div></div>' +
        '<div class="pr-list">' + cards + '</div>' +
        '<div class="pr-foot">' + icon('info', 14) + '<span>' + (METHODS[c.method] || METHODS.kemenag).name + ' · ihtiyat ' + c.ihtiyat + ' menit' +
        (c.before ? ' · pengingat ' + c.before + ' menit sebelumnya' : '') + '</span><div style="flex:1"></div>' +
        '<button class="btn sm ghost" data-pg="set">' + icon('gear', 14) + 'Atur</button></div>';
      el.onclick = e => {
        const b = e.target.closest('[data-pr]');
        if (b) { const k = b.dataset.pr; c.notify[k] = !c.notify[k]; NN.save('cfg'); this.render(el); NN.toast('Pengingat ' + NAMES[k] + (c.notify[k] ? ' menyala' : ' mati'), c.notify[k] ? 'bell' : 'bell-off'); return; }
        const g = e.target.closest('[data-pg]');
        if (g) NN.open('settings', 'prayer');
      };
      el._min = now.getMinutes();
    },
    tick(now) { if (now.getSeconds() === 0 || this._m !== now.getMinutes()) { this._m = now.getMinutes(); this.render(NN.$('.page[data-p="prayer"]')); } },
  });

  // pengingat sholat
  NN.tickers.push(now => {
    if (!NN.ready) return;
    const c = NN.cfg.prayer, ui = NN.st.ui, today = NN.iso(now);
    if (!ui.prFired || ui.prFired.d !== today) ui.prFired = { d: today, k: {} };
    const t = P.day(today);
    ORDER.forEach(k => {
      if (!c.notify[k]) return;
      const at = t[k], diff = (now - at) / 1000;
      if (c.before > 0 && ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].indexOf(k) >= 0) {
        const pre = at.getTime() - c.before * 60000, pd = (now - pre) / 1000;
        if (pd >= 0 && pd < 120 && diff < 0 && !ui.prFired.k[k + ':pre']) {
          ui.prFired.k[k + ':pre'] = 1; NN.save('ui');
          NN.alert({
            kind: 'prayer-pre', color: 'var(--acc)', icon: 'mosque', live: true, timeout: 25000, size: [520, 92],
            cap: () => { const m = Math.ceil((at - new Date()) / 60000); return m > 0 ? m + ' menit lagi' : 'sebentar lagi'; },
            title: NAMES[k] + ' · ' + NN.hm(at), sub: 'Bersiap untuk sholat · ' + c.city,
            ring: () => NN.clamp((at - new Date()) / (c.before * 60000), 0, 1),
            actions: [{ label: 'Oke', cls: '', act: () => { } }], onClick: () => NN.open('prayer'),
          });
        }
      }
      if (diff >= 0 && diff < 180 && !ui.prFired.k[k]) {
        ui.prFired.k[k] = 1; NN.save('ui');
        const fard = ['imsak', 'terbit'].indexOf(k) < 0;
        const snd = c.sound === 'none' ? null : { kind: c.sound === 'file' && c.soundFile ? 'file' : 'chime', file: c.sound === 'file' ? c.soundFile : '', loop: false, secs: c.sound === 'file' ? 600 : 0 };
        NN.alert({
          kind: 'prayer', color: '#2dd4bf', icon: ICONS_[k] === 'sun' || !fard ? ICONS_[k] : 'mosque', timeout: 90000, size: [540, 96],
          cap: fard ? 'Waktunya sholat' : (k === 'imsak' ? 'Waktu imsak' : 'Matahari terbit'),
          title: NAMES[k] + ' · ' + NN.hm(at), sub: NN.dayLabel(today, true) + ' · ' + c.city + (NN.hijri(now) ? ' · ' + NN.hijri(now) : ''),
          ring: () => 1, sound: snd,
          actions: [{ label: 'Oke', cls: 'pri', icon: 'check', act: () => NN.call('stopSound') }],
          onClose: () => NN.call('stopSound'), onClick: () => NN.open('prayer'),
        });
      }
    });
  });

  NN.compactProvider(vert => {
    if (!NN.cfg.notch.peekPrayer) return null;
    const now = new Date(), a = P.around(now), left = (a.next.at - now) / 60000;
    if (left > 15) return null;
    const txt = Math.max(1, Math.ceil(left)) + 'm';
    return vert ? { prio: 5, kind: 'prayer', html: '<span style="color:var(--acc-text)">' + icon('mosque', 16) + '</span>' + txt }
      : { prio: 5, kind: 'prayer', html: '<span style="color:var(--acc-text)">' + icon('mosque', 16) + '</span>' + NAMES[a.next.k] + ' ' + txt };
  });
  NN.slot('prayer', {
    label: 'Sholat berikutnya',
    render(vert) {
      const now = new Date(), a = P.around(now), left = (a.next.at - now) / 60000;
      const soon = left <= 15, col = soon ? 'var(--acc-text)' : 'var(--fg2)';
      return { kind: 'prayer', html: '<span class="c-stat" style="color:' + col + '">' + icon('mosque', 15) + (vert ? '' : ' ' + NAMES[a.next.k]) + '</span>' +
        '<span class="c-stat">' + (soon ? Math.max(1, Math.ceil(left)) + 'm' : (vert ? NN.hm(a.next.at).replace(':', '<br>') : NN.hm(a.next.at))) + '</span>' };
    },
  });
})();
