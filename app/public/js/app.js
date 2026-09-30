/* Logika halaman pemesanan — vanilla JS, tanpa CDN */
(function () {
  'use strict';

  /* ---------- Util ---------- */
  var PLACEHOLDER = 'img/placeholder.svg';

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

  function gambarMenu(item) {
    return item && item.image ? item.image : PLACEHOLDER;
  }

  /* ---------- State ---------- */
  var info = null;        // hasil /api/info
  var kategori = [];      // hasil /api/menu
  var daftarMeja = [];    // hasil /api/tables
  var kategoriAktif = 'semua';
  var keranjang = [];     // [{kunci, item, qty, catatan, pilihan:[{group_id,group_name,option_id,option_name,price_delta}], hargaSatuan}]
  var KUNCI_KERANJANG = 'nordic_cart';
  var KUNCI_KODE = 'nordic_codes';
  var KUNCI_TIPE = 'nordic_tipe';

  // Harga dasar item: pakai harga promo bila ada.
  function hargaDasarItem(it) {
    if (it && it.promo && it.promo.final_price != null) return Number(it.promo.final_price) || 0;
    return Number(it && it.price) || 0;
  }
  function simpanKeranjang() {
    try { localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(keranjang)); } catch (e) { /* abaikan */ }
  }
  function muatKeranjang() {
    try {
      var d = JSON.parse(localStorage.getItem(KUNCI_KERANJANG) || '[]');
      if (Array.isArray(d)) keranjang = d.filter(function (b) { return b && b.item && b.qty > 0; });
    } catch (e) { /* abaikan */ }
  }
  // Kode pesanan perangkat ini (untuk tab "Pesanan Saya" tanpa ketik kode).
  function simpanKode(code) {
    if (!code) return;
    try {
      var d = JSON.parse(localStorage.getItem(KUNCI_KODE) || '[]');
      d = [code].concat(d.filter(function (c) { return c !== code; })).slice(0, 20);
      localStorage.setItem(KUNCI_KODE, JSON.stringify(d));
    } catch (e) { /* abaikan */ }
  }
  var itemModal = null;   // item yang sedang dikustomisasi
  var qtyModal = 1;

  var LABEL_TIPE = {
    'dine-in': (window.IKON?IKON.dinein:"☕") + ' Dine-In',
    'takeaway': (window.IKON?IKON.takeaway:"🥤") + ' Take Away',
    'delivery': (window.IKON?IKON.delivery:"🛵") + ' Delivery'
  };
  var LABEL_BAYAR = {
    'qris': 'QRIS',
    'tunai': 'Cash',
    'transfer': 'Bank Transfer'
  };

  /* ---------- Muat data awal ---------- */
  function muatAwal() {
    muatKeranjang(); // pulihkan keranjang lintas halaman
    Promise.all([
      fetch('/api/info').then(function (r) { return r.json(); }),
      fetch('/api/menu').then(function (r) { return r.json(); }),
      fetch('/api/tables').then(function (r) { return r.ok ? r.json() : { tables: [] }; })
    ]).then(function (hasil) {
      info = hasil[0];
      kategori = hasil[1].categories || [];
      daftarMeja = (hasil[2].tables || []);
      terapkanInfo();
      renderTab();
      renderMenu();
      renderPilihanTipe();
      terapkanMode();
      renderPilihanBayar();
      renderMeja();
      perbaruiBadge(); // tampilkan badge dari keranjang tersimpan
      // Dukungan deep-link dari Beranda: buka modal item / drawer otomatis.
      try {
        var bukaId = sessionStorage.getItem('nordic_buka_item');
        if (bukaId) {
          sessionStorage.removeItem('nordic_buka_item');
          bukaModal(bukaId);
        } else if (sessionStorage.getItem('nordic_buka_drawer')) {
          sessionStorage.removeItem('nordic_buka_drawer');
          bukaDrawer();
        }
      } catch (e) { /* abaikan */ }
    }).catch(function () {
      $('gridMenu').innerHTML = '<div class="kosong">Failed to load menu. Please check your connection and reload the page.</div>';
      $('namaToko').textContent = 'Coffee Shop';
    });
  }

  function terapkanInfo() {
    $('namaToko').textContent = info.store_name || 'Coffee Shop';
    document.title = 'Order — ' + (info.store_name || 'Coffee Shop');
  }

  /* ---------- Tab kategori & grid menu ---------- */
  function renderTab() {
    var html = '<button class="tab' + (kategoriAktif === 'semua' ? ' aktif' : '') +
      '" data-kat="semua">All</button>';
    kategori.forEach(function (k) {
      html += '<button class="tab' + (kategoriAktif === k.id ? ' aktif' : '') +
        '" data-kat="' + esc(k.id) + '">' + esc(k.name) + '</button>';
    });
    $('tabKategori').innerHTML = html;
    Array.prototype.forEach.call($('tabKategori').querySelectorAll('.tab'), function (btn) {
      btn.addEventListener('click', function () {
        kategoriAktif = btn.getAttribute('data-kat');
        renderTab();
        renderMenu();
      });
    });
  }

  function cariItem(id) {
    for (var i = 0; i < kategori.length; i++) {
      var items = kategori[i].items || [];
      for (var j = 0; j < items.length; j++) {
        if (String(items[j].id) === String(id)) return items[j];
      }
    }
    return null;
  }

  function renderMenu() {
    var daftar = [];
    var judul = 'All Menu';
    var sudah = {};
    kategori.forEach(function (k) {
      if (kategoriAktif === 'semua' || String(k.id) === String(kategoriAktif)) {
        if (String(k.id) === String(kategoriAktif)) judul = k.name;
        (k.items || []).forEach(function (it) {
          if (sudah[it.id]) return;
          sudah[it.id] = 1;
          daftar.push(it);
        });
      }
    });
    $('judulKategori').textContent = judul;

    if (!daftar.length) {
      $('gridMenu').innerHTML = '<div class="kosong">No menu items in this category yet.</div>';
      return;
    }
    var html = '';
    daftar.forEach(function (it) {
      html +=
        '<article class="kartu" data-id="' + esc(it.id) + '" tabindex="0" role="button" aria-label="' + esc(it.name) + '">' +
        (it.is_best_seller ? '<span class="badge-best">' + (window.IKON?IKON.bintang:'⭐') + ' Best Seller</span>' : '') +
        (it.is_new ? '<span class="badge-new"' + (it.is_best_seller ? ' style="top:36px"' : '') + '>' + (window.IKON?IKON.kilau:'✨') + ' New</span>' : '') +
        '<img class="gambar" src="' + esc(gambarMenu(it)) + '" alt="' + esc(it.name) + '" loading="lazy" ' +
        'onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">' +
        (it.promo
          ? '<span class="badge-promo">' + (window.IKON?IKON.api:'🔥') + ' Promo</span>'
          : '') +
        '<div class="badan">' +
        '<h3 class="nama">' + esc(it.name) + '</h3>' +
        (it.description ? '<p class="deskripsi">' + esc(it.description) + '</p>' : '<p class="deskripsi"></p>') +
        (it.promo
          ? '<div class="harga"><s class="harga-coret">' + rupiah(it.price) + '</s> <span class="harga-promo">' + rupiah(it.promo.final_price) + '</span></div>'
          : '<div class="harga">' + rupiah(it.price) + '</div>') +
        '</div></article>';
    });
    $('gridMenu').innerHTML = html;

    Array.prototype.forEach.call($('gridMenu').querySelectorAll('.kartu'), function (el) {
      function buka() { bukaModal(el.getAttribute('data-id')); }
      el.addEventListener('click', buka);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buka(); }
      });
    });
  }

  /* ---------- Modal kustomisasi ---------- */
  function bukaModal(id) {
    itemModal = cariItem(id);
    if (!itemModal) return;
    qtyModal = 1;

    $('modalGambar').src = gambarMenu(itemModal);
    $('modalGambar').alt = itemModal.name;
    $('modalGambar').onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    $('modalNama').innerHTML = esc(itemModal.name) +
      (itemModal.is_new ? ' <span class="tag-new">' + (window.IKON ? IKON.kilau : '\u2728') + ' New</span>' : '');
    $('modalDeskripsi').textContent = itemModal.description || '';
    if (itemModal.promo) {
      $('modalHargaDasar').innerHTML = '<s class="harga-coret">' + rupiah(itemModal.price) + '</s> ' +
        '<span class="harga-promo">' + rupiah(itemModal.promo.final_price) + '</span><br>' +
        '<span class="badge-promo">' + (window.IKON?IKON.api:'🔥') + ' ' + esc(itemModal.promo.title) + '</span>';
    } else {
      $('modalHargaDasar').textContent = rupiah(itemModal.price);
    }
    $('modalCatatan').value = '';
    $('qtyNilai').textContent = '1';
    sembunyikanError('errModal');

    renderGrupOpsi();
    perbaruiHargaModal();
    $('modalOverlay').classList.remove('sembunyi');
    document.body.style.overflow = 'hidden';
  }

  function tutupModal() {
    $('modalOverlay').classList.add('sembunyi');
    document.body.style.overflow = '';
    itemModal = null;
  }

  function renderGrupOpsi() {
    var wadah = $('opsiContainer');
    var groups = itemModal.option_groups || [];
    if (!groups.length) { wadah.innerHTML = ''; return; }

    var html = '';
    groups.forEach(function (g, gi) {
      html += '<div class="grup-opsi" data-group="' + esc(g.id) + '" data-type="' + esc(g.type) +
        '" data-required="' + (g.required ? '1' : '0') + '">' +
        '<div class="judul">' + esc(g.name) +
        (g.required ? ' <span class="wajib">*</span>' : '') + '</div>';

      if (g.type === 'single') {
        // Dropdown agar modal ringkas (tidak scroll panjang).
        html += '<select class="input" data-gi="' + gi + '">';
        html += '<option value="">' + (g.required ? '— Select ' + esc(g.name) + ' —' : 'No selection') + '</option>';
        (g.options || []).forEach(function (o) {
          var delta = Number(o.price_delta) || 0;
          html += '<option value="' + esc(o.id) + '">' + esc(o.name) +
            (delta > 0 ? ' (+' + rupiah(delta) + ')' : '') + '</option>';
        });
        html += '</select>';
      } else {
        (g.options || []).forEach(function (o) {
          html += '<label class="opsi"><input type="checkbox" value="' + esc(o.id) + '">' +
            '<span class="nama-opsi">' + esc(o.name) + '</span>' +
            '<span class="delta' + (Number(o.price_delta) === 0 ? ' gratis' : '') + '">' +
            (Number(o.price_delta) > 0 ? '+' + rupiah(o.price_delta) : 'Included') + '</span></label>';
        });
      }
      html += '</div>';
    });
    wadah.innerHTML = html;

    // Harga live berubah setiap ada pilihan yang diubah
    Array.prototype.forEach.call(wadah.querySelectorAll('input, select'), function (inp) {
      inp.addEventListener('change', perbaruiHargaModal);
    });
  }

  // Ambil pilihan opsi yang sedang terpilih di modal
  function pilihanTerpilih() {
    var hasil = [];
    var groups = itemModal.option_groups || [];
    var wadah = $('opsiContainer').querySelectorAll('.grup-opsi');
    Array.prototype.forEach.call(wadah, function (el, gi) {
      var g = groups[gi];
      if (!g) return;
      if (g.type === 'single') {
        var sel = el.querySelector('select');
        var val = sel ? sel.value : '';
        if (val !== '') {
          var opt = cariOpsi(g, val);
          if (opt) hasil.push({
            group_id: g.id, group_name: g.name,
            option_id: opt.id, option_name: opt.name,
            price_delta: Number(opt.price_delta) || 0
          });
        }
      } else {
        Array.prototype.forEach.call(el.querySelectorAll('input[type="checkbox"]:checked'), function (cb) {
          var opt = cariOpsi(g, cb.value);
          if (opt) hasil.push({
            group_id: g.id, group_name: g.name,
            option_id: opt.id, option_name: opt.name,
            price_delta: Number(opt.price_delta) || 0
          });
        });
      }
    });
    return hasil;
  }

  function cariOpsi(group, optionId) {
    var opts = group.options || [];
    for (var i = 0; i < opts.length; i++) {
      if (String(opts[i].id) === String(optionId)) return opts[i];
    }
    return null;
  }

  function hargaSatuanModal() {
    var total = hargaDasarItem(itemModal);
    pilihanTerpilih().forEach(function (p) { total += p.price_delta; });
    return total;
  }

  function perbaruiHargaModal() {
    $('qtyNilai').textContent = String(qtyModal);
    $('qtyKurang').disabled = qtyModal <= 1;
    $('hargaModal').textContent = rupiah(hargaSatuanModal() * qtyModal);
    $('btnTambah').textContent = 'Add to Cart • ' + rupiah(hargaSatuanModal() * qtyModal);
  }

  function tambahKeKeranjang() {
    // Validasi: grup single yang required harus sudah dipilih
    var groups = itemModal.option_groups || [];
    var wadah = $('opsiContainer').querySelectorAll('.grup-opsi');
    for (var gi = 0; gi < wadah.length; gi++) {
      var g = groups[gi];
      if (g && g.type === 'single' && g.required) {
        var sel = wadah[gi].querySelector('select');
        if (!sel || sel.value === '') {
          tampilkanError('errModal', 'Please select "' + g.name + '" first (required).');
          return;
        }
      }
    }

    var pilihan = pilihanTerpilih();
    var hargaSatuan = hargaSatuanModal();
    var catatan = $('modalCatatan').value.trim();
    var kunci = String(itemModal.id) + '|' +
      pilihan.map(function (p) { return String(p.option_id); }).sort().join(',') + '|' + catatan;

    var ada = null;
    keranjang.forEach(function (baris) { if (baris.kunci === kunci) ada = baris; });
    if (ada) {
      ada.qty += qtyModal;
    } else {
      keranjang.push({
        kunci: kunci,
        item: itemModal,
        qty: qtyModal,
        catatan: catatan,
        pilihan: pilihan,
        hargaSatuan: hargaSatuan
      });
    }

    tutupModal();
    perbaruiBadge();
    renderKeranjang();
    bukaDrawer();
  }

  /* ---------- Keranjang ---------- */
  function jumlahItem() {
    return keranjang.reduce(function (a, b) { return a + b.qty; }, 0);
  }

  function subtotalKeranjang() {
    return keranjang.reduce(function (a, b) { return a + b.hargaSatuan * b.qty; }, 0);
  }

  function perbaruiBadge() {
    var jml = jumlahItem();
    var badge = $('fabBadge');
    badge.textContent = String(jml);
    badge.classList.toggle('sembunyi', jml === 0);
    simpanKeranjang(); // keranjang lintas halaman via localStorage
  }

  function ringkasanOpsi(baris) {
    if (!baris.pilihan.length) return '';
    // Kelompokkan per nama grup: "Ukuran: Large, Susu: Oat Milk"
    var perGrup = {};
    var urutan = [];
    baris.pilihan.forEach(function (p) {
      if (!perGrup[p.group_name]) { perGrup[p.group_name] = []; urutan.push(p.group_name); }
      perGrup[p.group_name].push(p.option_name);
    });
    return urutan.map(function (gn) { return gn + ': ' + perGrup[gn].join(', '); }).join(' • ');
  }

  /* ---------- Tiga modal terpisah: keranjang, data pesanan, pembayaran ---------- */
  function kunciScroll() { document.body.style.overflow = 'hidden'; }
  function lepasScroll() { document.body.style.overflow = ''; }
  function bukaData() {
    $('dataJudul').innerHTML = (window.IKON?IKON.catatan:'📝') + ' <span>Order Details</span>';
    sembunyikanError('errData');
    var isi = document.querySelector('#dataModal .isi');
    if (isi) isi.scrollTop = 0;
    $('dataOverlay').classList.remove('sembunyi');
    $('dataModal').classList.remove('sembunyi');
    kunciScroll();
  }
  function tutupData() {
    $('dataOverlay').classList.add('sembunyi');
    $('dataModal').classList.add('sembunyi');
    lepasScroll();
  }
  function bukaBayar() {
    $('bayarJudul').innerHTML = (window.IKON?IKON.dompet:'💳') + ' <span>Payment</span>';
    sembunyikanError('errCheckout');
    renderPilihanBayar();
    renderRingkasan();
    var isi = document.querySelector('#bayarModal .isi');
    if (isi) isi.scrollTop = 0;
    $('bayarOverlay').classList.remove('sembunyi');
    $('bayarModal').classList.remove('sembunyi');
    kunciScroll();
  }
  function tutupBayar() {
    $('bayarOverlay').classList.add('sembunyi');
    $('bayarModal').classList.add('sembunyi');
    lepasScroll();
  }
  function tutupSemuaModal() { tutupDrawer(); tutupData(); tutupBayar(); }

  function renderKeranjang() {
    var wadah = $('cartList');
    if (!keranjang.length) {
      wadah.innerHTML = '<div class="kosong">Your cart is empty.<br>Pick your favorites!</div>';
      $('kakiKeranjang').classList.add('sembunyi');
      return;
    }
    $('subtotalKaki').textContent = rupiah(subtotalKeranjang());
    $('kakiKeranjang').classList.remove('sembunyi');

    var html = '';
    keranjang.forEach(function (baris, idx) {
      var ringkas = ringkasanOpsi(baris);
      html += '<div class="baris-keranjang" data-idx="' + idx + '">' +
        '<div class="atas"><div class="nama">' + esc(baris.item.name) + '</div>' +
        '<button class="tombol-hapus" data-aksi="hapus" aria-label="Remove">' + (window.IKON?IKON.hapus:'🗑️') + '</button></div>' +
        (ringkas ? '<div class="ringkasan-opsi">' + esc(ringkas) + '</div>' : '') +
        (baris.catatan ? '<p class="catatan-item">"' + esc(baris.catatan) + '"</p>' : '') +
        '<div class="bawah"><div class="stepper kecil">' +
        '<button data-aksi="kurang" aria-label="Decrease">' + (window.IKON?IKON.kurang:'−') + '</button>' +
        '<span class="nilai">' + baris.qty + '</span>' +
        '<button data-aksi="tambah" aria-label="Add">' + (window.IKON?IKON.tambah:'+') + '</button>' +
        '</div><div class="subtotal">' + rupiah(baris.hargaSatuan * baris.qty) + '</div></div>' +
        '</div>';
    });
    wadah.innerHTML = html;

    Array.prototype.forEach.call(wadah.querySelectorAll('.baris-keranjang'), function (el) {
      var idx = Number(el.getAttribute('data-idx'));
      el.querySelector('[data-aksi="hapus"]').addEventListener('click', function () {
        keranjang.splice(idx, 1);
        perbaruiBadge(); renderKeranjang();
      });
      el.querySelector('[data-aksi="kurang"]').addEventListener('click', function () {
        keranjang[idx].qty -= 1;
        if (keranjang[idx].qty <= 0) keranjang.splice(idx, 1);
        perbaruiBadge(); renderKeranjang();
      });
      el.querySelector('[data-aksi="tambah"]').addEventListener('click', function () {
        keranjang[idx].qty += 1;
        perbaruiBadge(); renderKeranjang();
      });
    });

    renderRingkasan();
  }

  function renderRingkasan() {
    var subtotal = subtotalKeranjang();
    var pajakPersen = info ? Number(info.tax_percent) || 0 : 0;
    var layananPersen = info ? Number(info.service_percent) || 0 : 0;
    var pajak = Math.round(subtotal * pajakPersen / 100);
    var layanan = Math.round(subtotal * layananPersen / 100);
    var total = subtotal + pajak + layanan;

    var html = '<div class="baris-ringkasan"><span>Subtotal</span><span>' + rupiah(subtotal) + '</span></div>';
    if (pajakPersen > 0) {
      html += '<div class="baris-ringkasan"><span>Tax (' + pajakPersen + '%)</span><span>' + rupiah(pajak) + '</span></div>';
    }
    if (layananPersen > 0) {
      html += '<div class="baris-ringkasan"><span>Service (' + layananPersen + '%)</span><span>' + rupiah(layanan) + '</span></div>';
    }
    html += '<div class="baris-ringkasan total"><span>TOTAL</span><span>' + rupiah(total) + '</span></div>';
    $('ringkasan').innerHTML = html;
  }

  function bukaDrawer() {
    renderKeranjang();
    $('drawerOverlay').classList.remove('sembunyi');
    $('drawer').classList.remove('sembunyi');
    kunciScroll();
  }

  function tutupDrawer() {
    $('drawerOverlay').classList.add('sembunyi');
    $('drawer').classList.add('sembunyi');
    document.body.style.overflow = '';
  }

  /* ---------- Form checkout ---------- */
  function renderPilihanTipe() {
    var types = (info && info.order_types && info.order_types.length) ? info.order_types : ['dine-in', 'takeaway'];
    var tipeSimpan = null;
    try { tipeSimpan = localStorage.getItem(KUNCI_TIPE); } catch (e) { /* abaikan */ }
    // Selaras dengan beranda: hanya tampilkan tipe yang sudah dipilih di home.
    // Kalau belum ada pilihan tersimpan, tampilkan semua agar tetap bisa memilih.
    if (types.indexOf(tipeSimpan) >= 0) types = [tipeSimpan];
    var idxDefault = 0;
    types.forEach(function (t, i) { if (t === tipeSimpan) idxDefault = i; });
    var html = '';
    types.forEach(function (t, i) {
      html += '<label class="opsi' + (i === idxDefault ? ' terpilih' : '') + '">' +
        '<input type="radio" name="tipe" value="' + esc(t) + '"' + (i === idxDefault ? ' checked' : '') + '>' +
        '<span class="nama-opsi">' + esc(LABEL_TIPE[t] || t) + '</span></label>';
    });
    $('pilihanTipe').innerHTML = html;
    Array.prototype.forEach.call($('pilihanTipe').querySelectorAll('input'), function (inp) {
      inp.addEventListener('change', function () {
        Array.prototype.forEach.call($('pilihanTipe').querySelectorAll('label.opsi'), function (l) {
          l.classList.toggle('terpilih', l.querySelector('input').checked);
        });
        try { localStorage.setItem(KUNCI_TIPE, inp.value); } catch (e) { /* abaikan */ }
        perbaruiTampilanTipe();
        terapkanMode();
      });
    });
    perbaruiTampilanTipe();
  }

  function tipeTerpilih() {
    var r = $('pilihanTipe').querySelector('input[name="tipe"]:checked');
    return r ? r.value : '';
  }

  function perbaruiTampilanTipe() {
    var t = tipeTerpilih();
    $('wrapMeja').style.display = (t === 'dine-in') ? '' : 'none';
    $('wrapAlamat').style.display = (t === 'delivery') ? '' : 'none';
  }

  /* ---------- Penanda mode: chip inline di judul ---------- */
  function terapkanMode() {
    var t = tipeTersimpan();
    var label = t ? (t === 'dine-in' ? 'Dine-In' : 'Take Away') : '';
    Array.prototype.forEach.call(document.querySelectorAll('.mode-chip'), function (chip) {
      if (t) { chip.textContent = label; chip.classList.add('tampil'); }
      else chip.classList.remove('tampil');
      chip.onclick = function () { window.location.href = '/'; };
    });
  }

  function renderPilihanBayar() {
    var baku = [{ id: 'qris', label: 'QRIS' }, { id: 'tunai', label: 'Cash' }, { id: 'transfer', label: 'Bank Transfer' }];
    var mentah = (info && info.payment_methods && info.payment_methods.length) ? info.payment_methods : baku;
    // API mengembalikan [{id,label}]; tetap dukung format lama [string].
    var methods = mentah.map(function (m) {
      return (typeof m === 'string') ? { id: m, label: LABEL_BAYAR[m] || m } : m;
    });
    var html = '';
    methods.forEach(function (m, i) {
      html += '<label class="opsi' + (i === 0 ? ' terpilih' : '') + '">' +
        '<input type="radio" name="bayar" value="' + esc(m.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="nama-opsi">' + esc(m.label || m.id) + '</span></label>';
    });
    $('pilihanBayar').innerHTML = html;
    Array.prototype.forEach.call($('pilihanBayar').querySelectorAll('input'), function (inp) {
      inp.addEventListener('change', function () {
        Array.prototype.forEach.call($('pilihanBayar').querySelectorAll('label.opsi'), function (l) {
          l.classList.toggle('terpilih', l.querySelector('input').checked);
        });
      });
    });
  }

  function renderMeja() {
    var sel = $('mejaSelect');
    var html = '<option value="">-- Select table --</option>';
    daftarMeja.forEach(function (m) {
      html += '<option value="' + esc(m.id) + '">Table ' + esc(m.number) + '</option>';
    });
    sel.innerHTML = html;
    // Dukungan QR meja: ?meja=NOMOR -> otomatis pilih dine-in + nomor meja tsb.
    try {
      var param = new URLSearchParams(window.location.search).get('meja');
      if (param) {
        var cari = String(param).trim().toLowerCase();
        var cocok = null;
        daftarMeja.forEach(function (m) {
          if (String(m.number).trim().toLowerCase() === cari) cocok = m;
        });
        if (cocok) {
          try { localStorage.setItem(KUNCI_TIPE, 'dine-in'); } catch (e) { /* abaikan */ }
          renderPilihanTipe();
          terapkanMode();
          var radio = $('pilihanTipe').querySelector('input[name="tipe"][value="dine-in"]');
          if (radio) {
            radio.checked = true;
            Array.prototype.forEach.call($('pilihanTipe').querySelectorAll('label.opsi'), function (l) {
              l.classList.toggle('terpilih', l.querySelector('input').checked);
            });
            perbaruiTampilanTipe();
          }
          sel.value = String(cocok.id);
        }
      }
    } catch (e) { /* abaikan */ }
  }

  function bayarTerpilih() {
    var r = $('pilihanBayar').querySelector('input[name="bayar"]:checked');
    return r ? r.value : '';
  }

  function tampilkanError(id, pesan) {
    var el = $(id);
    el.textContent = pesan;
    el.classList.add('tampil');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function sembunyikanError(id) {
    var el = $(id);
    el.classList.remove('tampil');
    el.textContent = '';
  }

  /* ---------- Buat pesanan ---------- */
  function validasiData() {
    sembunyikanError('errData');
    var nama = $('nama').value.trim();
    if (!nama) {
      tampilkanError('errData', 'Please enter your name (required).');
      $('nama').focus();
      return null;
    }
    var tipe = tipeTerpilih();
    if (!tipe) {
      tampilkanError('errData', 'Please choose an order type.');
      return null;
    }
    var mejaId = $('mejaSelect').value;
    if (tipe === 'dine-in' && !mejaId) {
      tampilkanError('errData', 'Please select a table number (required for dine-in).');
      return null;
    }
    var alamat = $('alamat').value.trim();
    if (tipe === 'delivery' && !alamat) {
      tampilkanError('errData', 'Please enter the delivery address (required for delivery).');
      $('alamat').focus();
      return null;
    }
    return { nama: nama, tipe: tipe, mejaId: mejaId, alamat: alamat };
  }

  function buatPesanan() {
    sembunyikanError('errCheckout');

    if (!keranjang.length) {
      tampilkanError('errCheckout', 'Your cart is empty. Please choose your menu first!');
      return;
    }
    var data = validasiData();
    if (!data) { tutupBayar(); bukaData(); return; }
    var bayar = bayarTerpilih();
    if (!bayar) {
      tampilkanError('errCheckout', 'Please choose a payment method.');
      return;
    }

    var items = keranjang.map(function (b) {
      return {
        menu_item_id: b.item.id,
        qty: b.qty,
        note: b.catatan || '',
        options: b.pilihan.map(function (p) { return p.option_id; })
      };
    });

    var body = {
      customer_name: data.nama,
      customer_phone: $('wa').value.trim(),
      order_type: data.tipe,
      note: $('catatan').value.trim(),
      payment_method: bayar,
      items: items
    };
    if (data.tipe === 'dine-in') body.table_id = data.mejaId;
    if (data.tipe === 'delivery') body.address = data.alamat;

    var btn = $('btnPesan');
    btn.disabled = true;
    btn.textContent = 'Sending order...';

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (hasil) {
      btn.disabled = false;
      btn.textContent = 'Place Order';
      if (hasil.status === 201 && hasil.data.order) {
        tampilkanSukses(hasil.data.order);
      } else {
        tampilkanError('errCheckout', (hasil.data && hasil.data.error) ||
          'Failed to create order. Please try again.');
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Place Order';
      tampilkanError('errCheckout', 'Cannot connect to the server. Please check your connection and try again.');
    });
  }

  /* ---------- Modal status pesanan (muncul di halaman mana pun saat order dibuat) ---------- */
  var URUT_STATUS = ['baru', 'dikonfirmasi', 'diproses', 'siap'];
  var JUDUL_STATUS = {
    baru: 'Order Received!',
    dikonfirmasi: 'Confirmed by Cashier',
    diproses: 'Being Prepared...',
    siap: 'Ready for Pickup!',
    selesai: 'Order Completed',
    dibatalkan: 'Order Canceled'
  };
  var LANGKAH_STATUS = [
    { ikon: 'catatan', label: 'Received' },
    { ikon: 'sukses', label: 'Confirmed' },
    { ikon: 'dinein', label: 'Being prepared' },
    { ikon: 'bel', label: 'Ready' }
  ];
  var kodeStatus = null;
  var timerStatus = null;

  function renderLangkahStatus(status) {
    var box = $('statusLangkah');
    if (!box) return;
    if (status === 'dibatalkan') { box.innerHTML = ''; return; }
    var idx = URUT_STATUS.indexOf(status);
    if (idx < 0) idx = (status === 'selesai' ? 4 : 0);
    box.innerHTML = LANGKAH_STATUS.map(function (l, i) {
      var cls = i < idx ? 'lewat' : (i === idx ? 'kini' : '');
      var ikon = (window.IKON && IKON[l.ikon]) ? IKON[l.ikon] : '';
      return '<div class="langkah ' + cls + '"><span class="langkah-ikon">' + ikon + '</span>' +
        '<span class="langkah-label">' + l.label + '</span></div>' +
        (i < LANGKAH_STATUS.length - 1 ? '<div class="langkah-garis' + (i < idx ? ' lewat' : '') + '"></div>' : '');
    }).join('');
  }

  function pantauStatus() {
    if (!kodeStatus) return;
    fetch('/api/orders/by-codes?codes=' + encodeURIComponent(kodeStatus))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var o = (d.orders || [])[0];
        if (!o) return;
        $('statusJudul').textContent = JUDUL_STATUS[o.status] || o.status;
        renderLangkahStatus(o.status);
      })
      .catch(function () { /* abaikan, coba lagi nanti */ });
  }

  function tutupStatus() {
    kodeStatus = null;
    if (timerStatus) { clearInterval(timerStatus); timerStatus = null; }
    $('statusOverlay').classList.add('sembunyi');
  }

  function tampilkanSukses(order) {
    simpanKode(order.code);
    keranjang = [];
    perbaruiBadge();
    tutupSemuaModal();

    kodeStatus = order.code;
    $('kodeSukses').textContent = order.code || '------';
    $('totalSukses').textContent = 'Total: ' + rupiah(order.total);
    $('statusJudul').textContent = JUDUL_STATUS[order.status] || 'Order Received!';
    renderLangkahStatus(order.status || 'baru');
    var ket = [];
    if (order.payment_status) ket.push('Payment: ' + order.payment_status);
    $('infoSukses').textContent = ket.join(' • ');
    $('btnLacak').href = '/pesanan.html';

    $('statusOverlay').classList.remove('sembunyi');
    if (timerStatus) clearInterval(timerStatus);
    timerStatus = setInterval(pantauStatus, 15000); // pantau status otomatis selagi modal terbuka
    window.scrollTo(0, 0);
  }

  function pesanBaru() {
    tutupStatus();
    window.scrollTo(0, 0);
  }

  /* ---------- Pasang event ---------- */
  function pasangEvent() {
    $('modalTutup').addEventListener('click', tutupModal);
    $('modalOverlay').addEventListener('click', function (e) {
      if (e.target === $('modalOverlay')) tutupModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('modalOverlay').classList.contains('sembunyi')) tutupModal();
        if (!$('drawer').classList.contains('sembunyi')) tutupDrawer();
        if (!$('statusOverlay').classList.contains('sembunyi')) tutupStatus();
      }
    });

    $('qtyKurang').addEventListener('click', function () {
      if (qtyModal > 1) { qtyModal--; perbaruiHargaModal(); }
    });
    $('qtyTambah').addEventListener('click', function () {
      if (qtyModal < 99) { qtyModal++; perbaruiHargaModal(); }
    });
    $('btnTambah').addEventListener('click', tambahKeKeranjang);

    $('fab').addEventListener('click', bukaDrawer);
    $('drawerTutup').addEventListener('click', tutupDrawer);
    $('drawerOverlay').addEventListener('click', tutupDrawer);
    $('btnCheckout').addEventListener('click', function () {
      if (keranjang.length) { tutupDrawer(); bukaData(); }
    });
    $('dataTutup').addEventListener('click', tutupData);
    $('dataOverlay').addEventListener('click', tutupData);
    $('btnKembaliData').addEventListener('click', function () { tutupData(); bukaDrawer(); });
    $('btnLanjutBayar').addEventListener('click', function () {
      if (validasiData()) { tutupData(); bukaBayar(); }
    });
    $('bayarTutup').addEventListener('click', tutupBayar);
    $('bayarOverlay').addEventListener('click', tutupBayar);
    $('btnKembaliBayar').addEventListener('click', function () { tutupBayar(); bukaData(); });

    $('btnPesan').addEventListener('click', buatPesanan);
    $('btnBaru').addEventListener('click', pesanBaru);
    $('statusTutup').addEventListener('click', tutupStatus);
    $('statusOverlay').addEventListener('click', function (e) {
      if (e.target === $('statusOverlay')) tutupStatus();
    });
  }

  /* ---------- Mulai ---------- */
  pasangEvent();
  muatAwal();
})();
