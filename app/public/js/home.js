/* Beranda pelanggan: tipe pesanan, pesanan aktif otomatis, flash sale,
   rekomendasi, pesan lagi, info toko. */
(function () {
  'use strict';

  var KUNCI_TIPE = 'nordic_tipe';
  var KUNCI_KODE = 'nordic_codes';
  var KUNCI_KERANJANG = 'nordic_cart';
  var PLACEHOLDER = 'img/placeholder.svg';

  var daftarMenu = [];   // semua item, untuk buka modal & pesan lagi
  var menuById = {};
  var promoAktif = [];

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rupiah(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
  }

  function gambarMenu(it) {
    return it && it.image ? it.image : PLACEHOLDER;
  }

  /* ---------- QR meja: teruskan ke halaman menu ---------- */
  function cekQrMeja() {
    try {
      var m = new URLSearchParams(window.location.search).get('meja');
      if (m) window.location.replace('/menu.html?meja=' + encodeURIComponent(m));
    } catch (e) { /* abaikan */ }
  }

  /* ---------- Segmen tipe pesanan (dinamis dari admin) ---------- */
  function tipeSimpan() {
    try { return localStorage.getItem(KUNCI_TIPE) || null; }
    catch (e) { return null; }
  }

  var LABEL_SEGMEN = {
    'dine-in': (window.IKON?IKON.dinein:'☕')+'<span>Dine-In</span>',
    'takeaway': (window.IKON?IKON.takeaway:'🥤')+'<span>Take Away</span>',
    'delivery': (window.IKON?IKON.delivery:'🛵')+'<span>Delivery</span>'
  };

  function renderSegmen(daftarTipe) {
    var seg = $('segmenTipe');
    var types = (Array.isArray(daftarTipe) && daftarTipe.length) ? daftarTipe : ['dine-in', 'takeaway'];
    var aktif = tipeSimpan();
    if (aktif && types.indexOf(aktif) < 0) {
      aktif = null;
      try { localStorage.removeItem(KUNCI_TIPE); } catch (e) { /* abaikan */ }
    }
    seg.classList.toggle('ada-pilih', !!aktif);
    seg.innerHTML = types.map(function (t) {
      return '<button type="button" data-tipe="' + esc(t) + '" role="tab"' +
        (t === aktif ? ' class="aktif" aria-selected="true"' : ' aria-selected="false"') + '>' +
        (LABEL_SEGMEN[t] || esc(t)) + '</button>';
    }).join('');
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        try { localStorage.setItem(KUNCI_TIPE, b.getAttribute('data-tipe')); } catch (e) { /* abaikan */ }
        // Alihkan kelas tanpa render ulang agar animasi menyusut/melebar terlihat
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) {
          var on = x === b;
          x.classList.toggle('aktif', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        seg.classList.add('ada-pilih');
      };
    });
  }

  function bukaItem(id) {
    try { sessionStorage.setItem('nordic_buka_item', String(id)); } catch (e) { /* abaikan */ }
    window.location.href = '/menu.html';
  }

  function kodeTersimpan() {
    try {
      var d = JSON.parse(localStorage.getItem(KUNCI_KODE) || '[]');
      return Array.isArray(d) ? d.filter(Boolean).slice(0, 10) : [];
    } catch (e) { return []; }
  }

  /* ---------- Flash sale ---------- */
  function detikKeBerakhir() {
    var min = null;
    promoAktif.forEach(function (p) {
      if (!p.ends_at) return;
      var t = new Date(p.ends_at.replace(' ', 'T')).getTime();
      if (!isNaN(t) && (min === null || t < min)) min = t;
    });
    return min;
  }

  function formatHitung(ms) {
    if (ms < 0) ms = 0;
    var d = Math.floor(ms / 86400000);
    var h = Math.floor(ms % 86400000 / 3600000);
    var m = Math.floor(ms % 3600000 / 60000);
    var s = Math.floor(ms % 60000 / 1000);
    function p2(x) { return (x < 10 ? '0' : '') + x; }
    return (d > 0 ? d + (d === 1 ? ' day ' : ' days ') : '') + p2(h) + ':' + p2(m) + ':' + p2(s);
  }

  function jalanHitungMundur() {
    var akhir = detikKeBerakhir();
    if (akhir === null) { $('hitungMundur').textContent = ''; return; }
    function tick() {
      $('hitungMundur').textContent = '⏳ ' + formatHitung(akhir - Date.now());
    }
    tick();
    setInterval(tick, 1000);
  }

  function renderPromo() {
    var seksi = $('seksiPromo');
    if (!promoAktif.length) { seksi.classList.add('sembunyi'); return; }
    seksi.classList.remove('sembunyi');
    var html = '';
    promoAktif.forEach(function (p) {
      html +=
        '<article class="kartu-promo">' +
        '<img class="gambar" src="' + esc(gambarMenu({ image: p.item_image })) + '" alt="' + esc(p.item_name) + '" loading="lazy" ' +
        'onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">' +
        '<div class="badan">' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p class="nama-item">' + esc(p.item_name) + '</p>' +
        '<div class="harga-row harga-tumpuk"><div><s class="harga-coret">' + rupiah(p.item_price) + '</s></div>' +
        '<div><span class="harga-promo">' + rupiah(p.final_price) + '</span></div></div>' +
        '<button class="btn-bulat btn-beli" data-id="' + esc(p.menu_item_id) + '" aria-label="Beli ' + esc(p.item_name) + '">' + (window.IKON ? window.IKON.keranjang : '🛒') + '<span class="plus" aria-hidden="true">+</span></button>' +
        '</div></article>';
    });
    $('relPromo').innerHTML = html;
    Array.prototype.forEach.call($('relPromo').querySelectorAll('.btn-beli'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        bukaItem(b.getAttribute('data-id'));
      });
    });
    jalanHitungMundur();
  }

  /* ---------- Produk baru ---------- */
  function renderUntukmu() {
    var baru = daftarMenu.filter(function (it) { return it.is_new; }).slice(0, 8);
    var tampil = baru.length ? baru : daftarMenu.slice(0, 8);
    if (!tampil.length) { $('relUntukmu').innerHTML = '<div class="kosong">Menu not available yet.</div>'; return; }
    var html = '';
    tampil.forEach(function (it) {
      var harga = it.promo
        ? '<s class="harga-coret">' + rupiah(it.price) + '</s> <span class="harga-promo">' + rupiah(it.promo.final_price) + '</span>'
        : rupiah(it.price);
      html +=
        '<article class="kartu-rel" data-id="' + esc(it.id) + '" tabindex="0" role="button" aria-label="' + esc(it.name) + '">' +
        (it.promo ? '<span class="badge-promo">'+(window.IKON?IKON.api:'🔥')+'</span>' : (it.is_new ? '<span class="badge-new-mini">'+(window.IKON?IKON.kilau:'✨')+' New</span>' : '')) +
        '<img class="gambar" src="' + esc(gambarMenu(it)) + '" alt="' + esc(it.name) + '" loading="lazy" ' +
        'onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">' +
        '<div class="badan"><h3>' + esc(it.name) + '</h3>' +
        '<div class="harga">' + harga + '</div></div></article>';
    });
    $('relUntukmu').innerHTML = html;
    Array.prototype.forEach.call($('relUntukmu').querySelectorAll('.kartu-rel'), function (el) {
      function go() { bukaItem(el.getAttribute('data-id')); }
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    });
  }

  /* ---------- Pesan lagi ---------- */
  function muatPesanLagi() {
    var codes = kodeTersimpan();
    if (!codes.length) return;
    fetch('/api/orders/by-codes?codes=' + encodeURIComponent(codes.join(',')))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var selesai = (d.orders || [])
          .filter(function (o) { return o.status === 'selesai'; })
          .slice(0, 3);
        if (!selesai.length) return;
        var html = '';
        selesai.forEach(function (o) {
          var tgl = '';
          try { tgl = new Date(o.created_at.replace(' ', 'T')).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); } catch (e) { /* abaikan */ }
          html +=
            '<div class="baris-lagi">' +
            '<div><p class="kode">#' + esc(o.code) + ' • ' + esc(tgl) + '</p>' +
            '<p class="total">' + esc(o.item_count) + ' item • ' + rupiah(o.total) + '</p></div>' +
            '<button class="tombol tombol-kecil" data-code="' + esc(o.code) + '">Order Again</button>' +
            '</div>';
        });
        $('daftarPesanLagi').innerHTML = html;
        $('seksiPesanLagi').classList.remove('sembunyi');
        Array.prototype.forEach.call($('daftarPesanLagi').querySelectorAll('button'), function (b) {
          b.addEventListener('click', function () { pesanLagi(b.getAttribute('data-code'), b); });
        });
      })
      .catch(function () { /* abaikan */ });
  }

  function pesanLagi(code, btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    fetch('/api/orders/' + encodeURIComponent(code))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var order = d.order;
        if (!order || !order.items || !order.items.length) throw new Error('kosong');
        var baris = order.items.map(function (oi) {
          var item = menuById[oi.menu_item_id] || {
            id: oi.menu_item_id, name: oi.item_name, price: oi.base_price,
            image: '', description: '', option_groups: [],
          };
          var pilihan = (oi.options || []).map(function (o) {
            return {
              option_id: o.option_id || null,
              group_name: o.group_name,
              option_name: o.option_name,
              price_delta: o.price_delta || 0,
            };
          });
          var delta = pilihan.reduce(function (a, p) { return a + (Number(p.price_delta) || 0); }, 0);
          return {
            kunci: 'lagi|' + oi.menu_item_id + '|' + pilihan.map(function (p) { return p.option_id; }).join(',') + '|' + (oi.note || ''),
            item: item,
            qty: oi.qty,
            catatan: oi.note || '',
            pilihan: pilihan,
            hargaSatuan: (Number(oi.base_price) || 0) + delta,
          };
        });
        try {
          var lama = JSON.parse(localStorage.getItem(KUNCI_KERANJANG) || '[]');
          if (!Array.isArray(lama)) lama = [];
          baris.forEach(function (br) {
            var ada = lama.find(function (x) { return x.kunci === br.kunci; });
            if (ada) ada.qty += br.qty; else lama.push(br);
          });
          localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(lama));
          sessionStorage.setItem('nordic_buka_drawer', '1');
        } catch (e) { /* abaikan */ }
        window.location.href = '/menu.html';
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Order Again';
      });
  }

  /* ---------- Banner iklan (korsel) ---------- */
  var bannerTimer = null;
  function renderBanner(daftar) {
    var seksi = $('seksiBanner');
    if (!seksi) return;
    if (!daftar || !daftar.length) { seksi.classList.add('sembunyi'); return; }
    seksi.classList.remove('sembunyi');
    var kor = $('korselBanner');
    var dots = $('titikBanner');
    kor.innerHTML = daftar.map(function (b, i) {
      if (b.gambar) {
        return '<button type="button" class="banner-iklan gbr" data-i="' + i + '">' +
          '<img src="' + esc(b.gambar) + '" alt="' + esc(b.judul) + '"></button>';
      }
      var tema = (b.tema === 'emas' || b.tema === 'kopi') ? b.tema : 'hijau';
      return '<button type="button" class="banner-iklan tema-' + tema + '" data-i="' + i + '">' +
        '<span class="blatar"></span><span class="bgrad"></span>' +
        '<span class="bisi"><h3>' + esc(b.judul) + '</h3>' +
        (b.subjudul ? '<p>' + esc(b.subjudul) + '</p>' : '') +
        (b.tombol_teks ? '<span class="banner-cta">' + esc(b.tombol_teks) + '</span>' : '') +
        '</span></button>';
    }).join('');
    dots.innerHTML = daftar.map(function (_, i) {
      return '<span class="' + (i === 0 ? 'on' : '') + '"></span>';
    }).join('');
    Array.prototype.forEach.call(kor.querySelectorAll('.banner-iklan'), function (el) {
      el.addEventListener('click', function () {
        var t = daftar[Number(el.getAttribute('data-i'))].tautan;
        if (t) window.location.href = t;
      });
    });
    function tandaiTitik() {
      var tengah = kor.scrollLeft + kor.clientWidth / 2;
      var aktif = 0, jarakMin = Infinity;
      Array.prototype.forEach.call(kor.children, function (anak, i) {
        var j = Math.abs((anak.offsetLeft + anak.offsetWidth / 2) - tengah);
        if (j < jarakMin) { jarakMin = j; aktif = i; }
      });
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.classList.toggle('on', i === aktif);
      });
    }
    var tunggu = false;
    kor.onscroll = function () {
      if (tunggu) return; tunggu = true;
      requestAnimationFrame(function () { tandaiTitik(); tunggu = false; });
    };
    if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
    if (daftar.length > 1) {
      var idx = 0, sedangSentuh = false;
      kor.addEventListener('pointerdown', function () { sedangSentuh = true; }, { passive: true });
      window.addEventListener('pointerup', function () { sedangSentuh = false; }, { passive: true });
      bannerTimer = setInterval(function () {
        if (sedangSentuh || document.hidden) return;
        idx = (idx + 1) % daftar.length;
        var anak = kor.children[idx];
        if (anak) kor.scrollTo({ left: Math.max(0, anak.offsetLeft - 16), behavior: 'smooth' });
      }, 5000);
    }
  }

  /* ---------- Info toko ---------- */
  function renderInfoToko(info) {
    var jam = info.opening_hours || 'Closed at 7:00 PM · Takeaway 9:00 AM–5:00 PM';
    $('infoToko').innerHTML =
      '<h3>'+(window.IKON?IKON.pin:'📍')+' ' + esc(info.store_name || 'Nordic by The Founders') + '</h3>' +
      '<p>' + esc(info.address || '') + '</p>' +
      '<p>'+(window.IKON?IKON.jam:'🕖')+' ' + esc(jam) + '</p>' +
      (info.whatsapp ? '<p>'+(window.IKON?IKON.chat:'💬')+' <a href="https://wa.me/' + esc(String(info.whatsapp).replace(/[^0-9]/g, '')) + '">' + esc(info.whatsapp) + '</a></p>' : '');
  }

  /* ---------- Mulai ---------- */
  function mulai() {
    cekQrMeja();
    renderSegmen();

    Promise.all([
      fetch('/api/info').then(function (r) { return r.json(); }),
      fetch('/api/menu').then(function (r) { return r.json(); }),
      fetch('/api/promos').then(function (r) { return r.json(); }),
      fetch('/api/banners').then(function (r) { return r.json(); }).catch(function () { return { banners: [] }; }),
    ]).then(function (hasil) {
      var info = hasil[0] || {};
      var elNama = $('namaTokoHome');
      if (elNama && info.store_name) elNama.textContent = info.store_name;
      document.title = info.store_name || 'Nordic by The Founders';
      renderInfoToko(info);
      renderSegmen(info.order_types); // tipe pesanan dari admin
      renderBanner(hasil[3].banners || []);

      (hasil[1].categories || []).forEach(function (k) {
        (k.items || []).forEach(function (it) {
          if (menuById[it.id]) return;
          daftarMenu.push(it);
          menuById[it.id] = it;
        });
      });
      renderUntukmu();

      promoAktif = (hasil[2].promos || []).filter(function (p) { return p.menu_item_id; });
      renderPromo();
    }).catch(function () {
      $('relUntukmu').innerHTML = '<div class="kosong">Failed to load. Please check your connection and reload.</div>';
    });

    muatPesanLagi();
  }

  mulai();
})();
