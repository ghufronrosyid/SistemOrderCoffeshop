/* Halaman "Pesanan Saya": daftar pesanan perangkat ini, terpantau otomatis.
   Kode disimpan di localStorage saat pesanan dibuat — tanpa ketik ulang. */
(function () {
  'use strict';

  var KUNCI_KODE = 'nordic_codes';
  var KUNCI_KERANJANG = 'nordic_cart';
  var menuById = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rupiah(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
  }

  var LANGKAH = [
    { id: 'baru', ikon: (window.IKON?IKON.catatan:'📝'), label: 'Received' },
    { id: 'dikonfirmasi', ikon: (window.IKON?IKON.sukses:'✅'), label: 'Confirmed' },
    { id: 'diproses', ikon: (window.IKON?IKON.dinein:'☕'), label: 'Being prepared' },
    { id: 'siap', ikon: (window.IKON?IKON.bel:'🛎️'), label: 'Ready' },
  ];

  var LABEL_STATUS = {
    baru: 'Received',
    dikonfirmasi: 'Confirmed',
    diproses: 'Being prepared',
    siap: 'Ready for pickup!',
    selesai: 'Completed',
    dibatalkan: 'Canceled',
  };

  function kodeTersimpan() {
    try {
      var d = JSON.parse(localStorage.getItem(KUNCI_KODE) || '[]');
      return Array.isArray(d) ? d.filter(Boolean).slice(0, 20) : [];
    } catch (e) { return []; }
  }

  function formatWaktu(iso) {
    try {
      return new Date(String(iso).replace(' ', 'T')).toLocaleString('en-US', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { return ''; }
  }

  function renderLangkah(status) {
    var idx = -1;
    LANGKAH.forEach(function (l, i) { if (l.id === status) idx = i; });
    if (status === 'selesai') idx = LANGKAH.length;
    return LANGKAH.map(function (l, i) {
      var cls = idx < 0 ? '' : (i < idx ? 'lewat' : (i === idx ? 'kini' : ''));
      return '<div class="langkah ' + cls + '"><span class="langkah-ikon">' + l.ikon + '</span>' +
        '<span class="langkah-label">' + l.label + '</span></div>' +
        (i < LANGKAH.length - 1 ? '<div class="langkah-garis' + (idx >= 0 && i < idx ? ' lewat' : '') + '"></div>' : '');
    }).join('');
  }

  function render(daftar) {
    var box = $('daftarPesanan');
    if (!daftar.length) {
      box.innerHTML =
        '<div class="kosong-box">'+(window.IKON?IKON.kosong:'📭')+'<p>No orders on this device yet.</p>' +
        '<a class="tombol tombol-kecil" href="/menu.html">Order Now</a></div>';
      return;
    }
    var html = '';
    daftar.forEach(function (o) {
      var pill = 'pill-' + o.status;
      html +=
        '<div class="kartu-pesanan">' +
        '<div class="kp-kepala"><div>' +
        '<p class="kp-kode">#' + esc(o.code) + '</p>' +
        '<p class="kp-waktu">' + esc(formatWaktu(o.created_at)) + ' • ' + esc(o.item_count) + ' item</p>' +
        '</div><span class="pill ' + pill + '">' + esc(LABEL_STATUS[o.status] || o.status) + '</span></div>';
      if (o.status !== 'selesai' && o.status !== 'dibatalkan') {
        html += '<div class="langkah-wrap">' + renderLangkah(o.status) + '</div>';
      }
      html +=
        '<div class="kp-kaki"><span class="kp-total">' + rupiah(o.total) + '</span>' +
        (o.status === 'selesai'
          ? '<button class="tombol tombol-kecil" data-ulang="' + esc(o.code) + '">'+(window.IKON?IKON.ulangi:'🔁')+' Order Again</button>'
          : (o.status === 'siap'
            ? '<span class="kp-siap">'+(window.IKON?IKON.pesta:'🎉')+' Show this code to the cashier</span>'
            : '')) +
        '</div></div>';
    });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('[data-ulang]'), function (b) {
      b.addEventListener('click', function () { pesanLagi(b.getAttribute('data-ulang'), b); });
    });
  }

  function muat() {
    var codes = kodeTersimpan();
    if (!codes.length) { render([]); return; }
    fetch('/api/orders/by-codes?codes=' + encodeURIComponent(codes.join(',')))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var daftar = d.orders || [];
        var urut = [];
        codes.forEach(function (c) {
          for (var i = 0; i < daftar.length; i++) {
            if (daftar[i].code === c) { urut.push(daftar[i]); break; }
          }
        });
        render(urut);
      })
      .catch(function () {
        $('daftarPesanan').innerHTML = '<div class="kosong">Failed to load. Please check your connection and reload.</div>';
      });
  }

  function pastikanMenu() {
    if (menuById) return Promise.resolve(menuById);
    return fetch('/api/menu')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        menuById = {};
        (d.categories || []).forEach(function (k) {
          (k.items || []).forEach(function (it) { menuById[it.id] = it; });
        });
        return menuById;
      });
  }

  function pesanLagi(code, btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    Promise.all([
      fetch('/api/orders/' + encodeURIComponent(code)).then(function (r) { return r.json(); }),
      pastikanMenu(),
    ]).then(function (hasil) {
      var order = hasil[0].order;
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
          var ada = null;
          for (var i = 0; i < lama.length; i++) {
            if (lama[i].kunci === br.kunci) { ada = lama[i]; break; }
          }
          if (ada) ada.qty += br.qty; else lama.push(br);
        });
        localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(lama));
        sessionStorage.setItem('nordic_buka_drawer', '1');
      } catch (e) { /* abaikan */ }
      window.location.href = '/menu.html';
    }).catch(function () {
      btn.disabled = false;
      btn.innerHTML = (window.IKON?IKON.ulangi:'🔁')+' Order Again';
    });
  }

  muat();
  setInterval(muat, 15000); // pantau status otomatis
})();
