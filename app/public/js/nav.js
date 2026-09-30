/* Navigasi bawah pelanggan: Beranda • Menu • Pesanan • Tentang.
   Dipasang di semua halaman pelanggan. Badge jumlah keranjang tampil di tab Menu. */
(function () {
  'use strict';

  var IKON = window.IKON || {};

  var ITEMS = [
    { id: 'beranda', label: 'Home', href: '/' },
    { id: 'menu', label: 'Menu', href: '/menu.html' },
    { id: 'pesanan', label: 'Orders', href: '/pesanan.html' },
    { id: 'tentang', label: 'About', href: '/tentang' },
  ];

  function halamanAktif() {
    var p = window.location.pathname;
    if (p === '/' || p === '/index.html') return 'beranda';
    if (p.indexOf('/menu') === 0) return 'menu';
    if (p.indexOf('/pesanan') === 0 || p.indexOf('/lacak') === 0) return 'pesanan';
    if (p.indexOf('/tentang') === 0) return 'tentang';
    return '';
  }

  function jumlahKeranjang() {
    try {
      var d = JSON.parse(localStorage.getItem('nordic_cart') || '[]');
      if (!Array.isArray(d)) return 0;
      return d.reduce(function (a, b) { return a + (Number(b.qty) || 0); }, 0);
    } catch (e) { return 0; }
  }

  function render() {
    var aktif = halamanAktif();
    var nav = document.createElement('nav');
    nav.className = 'nav-bawah';
    nav.setAttribute('aria-label', 'Main navigation');

    var jml = jumlahKeranjang();

    ITEMS.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'nav-item' + (it.id === aktif ? ' aktif' : '');
      a.href = it.href;
      a.setAttribute('aria-label', it.label);
      var badge = '';
      if (it.id === 'menu' && jml > 0) {
        badge = '<span class="nav-badge">' + jml + '</span>';
      }
      a.innerHTML =
        '<span class="nav-ikon">' + (IKON[it.id] || '') + badge + '</span>';
      nav.appendChild(a);
    });

    document.body.appendChild(nav);
  }

  /* Animasi tap: tombol/link memantul kecil setiap diklik */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('button, a') : null;
    if (!el || el.classList.contains('tanpa-ketuk')) return;
    el.classList.remove('ketuk');
    void el.offsetWidth;
    el.classList.add('ketuk');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
