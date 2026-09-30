/* Logika halaman lacak pesanan — vanilla JS, tanpa CDN */
(function () {
  'use strict';

  function rupiah(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(Math.round(n || 0));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(id) { return document.getElementById(id); }

  // Urutan tahap status pesanan
  var TAHAP = [
    { status: 'baru', nama: 'Received', keterangan: 'Your order has been received by the cashier.' },
    { status: 'dikonfirmasi', nama: 'Confirmed', keterangan: 'The cashier has confirmed your order.' },
    { status: 'diproses', nama: 'Being prepared', keterangan: 'The barista is preparing your order.' },
    { status: 'siap', nama: 'Ready', keterangan: 'Your order is ready for pickup/delivery.' },
    { status: 'selesai', nama: 'Completed', keterangan: 'Thank you for your order!' }
  ];

  var LABEL_TIPE = {
    'dine-in': 'Dine-In',
    'takeaway': 'Take Away',
    'delivery': 'Delivery'
  };
  var LABEL_BAYAR = {
    'qris': 'QRIS',
    'tunai': 'Cash',
    'transfer': 'Bank Transfer'
  };

  function tampilkanError(pesan) {
    var el = $('errLacak');
    el.textContent = pesan;
    el.classList.add('tampil');
  }

  function sembunyikanError() {
    var el = $('errLacak');
    el.classList.remove('tampil');
    el.textContent = '';
  }

  function indeksTahap(status) {
    for (var i = 0; i < TAHAP.length; i++) {
      if (TAHAP[i].status === status) return i;
    }
    return -1;
  }

  function renderTimeline(status) {
    if (status === 'dibatalkan') {
      return '<div class="banner-batal">'+(window.IKON?IKON.batal:'❌')+' Order canceled</div>';
    }
    var aktif = indeksTahap(status);
    var html = '<ol class="timeline">';
    TAHAP.forEach(function (t, i) {
      var kelas = '';
      if (aktif >= 0 && i < aktif) kelas = 'selesai';
      else if (aktif >= 0 && i === aktif) kelas = 'selesai saat-ini';
      // Status tak dikenal: tandai tahap pertama sebagai posisi saat ini
      if (aktif < 0 && i === 0) kelas = 'saat-ini';
      html += '<li class="' + kelas + '"><span class="titik"></span>' +
        '<div class="nama-tahap">' + esc(t.nama) + '</div>' +
        '<div class="keterangan">' + esc(t.keterangan) + '</div></li>';
    });
    html += '</ol>';
    return html;
  }

  function renderHasil(order) {
    var tipeLabel = LABEL_TIPE[order.order_type] || order.order_type || '-';
    var infoTipe = tipeLabel;
    if (order.order_type === 'dine-in' && order.table_number) {
      infoTipe += ' — Table ' + order.table_number;
    } else if (order.order_type === 'delivery' && order.address) {
      infoTipe += ' — ' + order.address;
    }
    var bayarLabel = LABEL_BAYAR[order.payment_method] || order.payment_method || '-';
    var statusBayar = order.payment_status || '-';
    var kelasBayar = /lunas|dibayar|paid/i.test(statusBayar) ? 'lunas' : 'belum';

    var html = '';

    // Banner / timeline
    html += renderTimeline(order.status);

    // Info pesanan
    html += '<div class="kartu-form"><h3>'+(window.IKON?IKON.menu:'📋')+' Order Details</h3>' +
      '<dl class="info-pesanan">' +
      '<dt>Order Code</dt><dd>' + esc(order.code) + '</dd>' +
      '<dt>Name</dt><dd>' + esc(order.customer_name) + '</dd>' +
      '<dt>Order Type</dt><dd>' + esc(infoTipe) + '</dd>' +
      '<dt>Payment</dt><dd>' + esc(bayarLabel) +
      ' <span class="status-bayar ' + kelasBayar + '">' + esc(statusBayar) + '</span></dd>' +
      '<dt>Order Time</dt><dd>' + esc(formatWaktu(order.created_at)) + '</dd>' +
      '</dl></div>';

    // Daftar item
    html += '<div class="kartu-form"><h3>'+(window.IKON?IKON.dinein:'☕')+' Order Items</h3>';
    (order.items || []).forEach(function (it) {
      var opsi = (it.options || []).map(function (o) {
        var teks = o.group_name + ': ' + o.option_name;
        if (Number(o.price_delta) > 0) teks += ' (+' + rupiah(o.price_delta) + ')';
        return teks;
      }).join(' • ');
      html += '<div class="item-pesanan">' +
        '<div class="baris"><div><span class="nama">' + esc(it.qty) + '× ' + esc(it.item_name) + '</span>' +
        (opsi ? '<div class="opsi-item">' + esc(opsi) + '</div>' : '') +
        (it.note ? '<div class="catatan-item">"' + esc(it.note) + '"</div>' : '') +
        '</div><div style="font-weight:700;white-space:nowrap">' + rupiah(it.subtotal) + '</div></div>' +
        '</div>';
    });
    html += '</div>';

    // Ringkasan biaya
    html += '<div class="kartu-form"><h3>'+(window.IKON?IKON.tunai:'💰')+' Order Summary</h3>' +
      '<div class="baris-ringkasan"><span>Subtotal</span><span>' + rupiah(order.subtotal) + '</span></div>';
    if (Number(order.discount) > 0) {
      html += '<div class="baris-ringkasan"><span>Discount</span><span>−' + rupiah(order.discount) + '</span></div>';
    }
    if (Number(order.tax) > 0) {
      html += '<div class="baris-ringkasan"><span>Tax</span><span>' + rupiah(order.tax) + '</span></div>';
    }
    if (Number(order.service) > 0) {
      html += '<div class="baris-ringkasan"><span>Service</span><span>' + rupiah(order.service) + '</span></div>';
    }
    html += '<div class="baris-ringkasan total"><span>TOTAL</span><span>' + rupiah(order.total) + '</span></div>' +
      '</div>';

    // Tombol aksi
    html += '<div class="tombol-baris">' +
      '<button class="tombol sekunder" id="btnPerbarui">' + (window.IKON?IKON.segarkan:'🔄') + ' Refresh</button>';
    if (order.status === 'baru') {
      html += '<button class="tombol bahaya" id="btnBatal">' + (window.IKON?IKON.batal:'❌') + ' Cancel Order</button>';
    }
    html += '</div>';

    $('hasilLacak').innerHTML = html;

    $('btnPerbarui').addEventListener('click', function () {
      lacak($('kodeInput').value.trim());
    });
    var btnBatal = $('btnBatal');
    if (btnBatal) {
      btnBatal.addEventListener('click', function () {
        if (confirm('Are you sure you want to cancel order ' + order.code + '?')) {
          batalkan(order.code);
        }
      });
    }
  }

  function formatWaktu(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function lacak(kode) {
    sembunyikanError();
    kode = (kode || '').trim().toUpperCase();
    if (!kode) {
      tampilkanError('Please enter your order code first.');
      return;
    }
    $('kodeInput').value = kode;
    $('hasilLacak').innerHTML = '<div class="muatan">Searching for your order...</div>';

    fetch('/api/orders/' + encodeURIComponent(kode))
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (hasil) {
        if (hasil.status === 200 && hasil.data.order) {
          renderHasil(hasil.data.order);
        } else {
          $('hasilLacak').innerHTML = '';
          tampilkanError('Code "' + kode + '" not found. Please double-check your order code.');
        }
      })
      .catch(function () {
        $('hasilLacak').innerHTML = '';
        tampilkanError('Cannot connect to the server. Please check your connection and try again.');
      });
  }

  function batalkan(kode) {
    fetch('/api/orders/' + encodeURIComponent(kode) + '/batal', { method: 'POST' })
      .then(function (res) { return res.json(); })
      .then(function () { lacak(kode); })
      .catch(function () {
        tampilkanError('Failed to cancel order. Please try again.');
      });
  }

  // Nama toko dari /api/info
  fetch('/api/info').then(function (r) { return r.json(); })
    .then(function (info) {
      $('namaToko').textContent = info.store_name || 'Coffee Shop';
      document.title = 'Track Order — ' + (info.store_name || 'Coffee Shop');
    })
    .catch(function () { $('namaToko').textContent = 'Coffee Shop'; });

  $('btnLacak').addEventListener('click', function () {
    lacak($('kodeInput').value);
  });
  $('kodeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') lacak($('kodeInput').value);
  });

  // Dukung query param ?kode=
  var params = new URLSearchParams(window.location.search);
  var kodeAwal = params.get('kode');
  if (kodeAwal) {
    lacak(kodeAwal);
  }
})();
