/* admin-core.js — helper bersama untuk semua halaman admin.
 *
 * KONTRAK (implementasi persis; jangan diubah tanpa koordinasi dengan
 * halaman admin lain yang memakai file ini):
 *   window.Admin = { api, guard, logout, toast, rupiah,
 *                    statusLabel, paymentLabel, orderTypeLabel, renderSidebar }
 */
'use strict';

  /* Animasi tap: tombol/link memantul kecil setiap diklik */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('button, a') : null;
    if (!el) return;
    el.classList.remove('ketuk');
    void el.offsetWidth;
    el.classList.add('ketuk');
  });


window.Admin = (function () {

  // Cache user hasil guard() agar renderSidebar tidak memanggil /me dua kali.
  var _user = null;

  /* Panggil API backend.
   * method : 'GET' | 'POST' | 'PATCH' | ...
   * path   : diawali '/', relatif terhadap /api — mis. '/admin/me'.
   * body   : objek (di-JSON-kan) atau undefined.
   * Mengembalikan JSON hasil parse; melempar Error(json.error || 'HTTP '+status)
   * bila respons tidak ok.
   */
  async function api(method, path, body) {
    var res = await fetch('/api' + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined
    });
    var json = {};
    try { json = await res.json(); } catch (e) { /* biarkan {} bila bukan JSON */ }
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
    return json;
  }

  /* Pastikan pengguna sudah login. Bila 401, lempar ke halaman login.
   * Mengembalikan objek user.
   */
  async function guard() {
    var res = await fetch('/api/admin/me', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('belum_login');
    }
    var json = {};
    try { json = await res.json(); } catch (e) { /* biarkan {} */ }
    if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
    _user = json.user || null;
    return _user;
  }

  /* Keluar (POST /api/admin/logout) lalu kembali ke halaman login. */
  async function logout() {
    try { await api('POST', '/admin/logout'); } catch (e) { /* abaikan, tetap keluar */ }
    window.location.href = '/admin/login.html';
  }

  /* Toast notifikasi fixed di kanan bawah.
   * tipe: 'info' | 'ok' | 'error'
   */
  function toast(pesan, tipe) {
    tipe = tipe || 'info';
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + tipe;
    el.textContent = pesan;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast-hide');
      setTimeout(function () { el.remove(); }, 350);
    }, 3200);
  }

  /* Format angka menjadi "Rp 25.000". */
  function rupiah(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return 'Rp ' + Math.round(v).toLocaleString('id-ID');
  }

  function statusLabel(s) {
    var map = {
      baru: 'New',
      dikonfirmasi: 'Confirmed',
      diproses: 'In Progress',
      siap: 'Ready',
      selesai: 'Completed',
      dibatalkan: 'Canceled'
    };
    return map[s] || s;
  }

  function paymentLabel(m) {
    var map = { qris: 'QRIS', tunai: 'Cash', transfer: 'Bank Transfer' };
    return map[m] || m;
  }

  function orderTypeLabel(t) {
    var map = { 'dine-in': 'Dine-In', takeaway: 'Take Away', delivery: 'Delivery' };
    return map[t] || t;
  }

  /* Escape HTML untuk string dari data API/pengguna (internal). */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var NAV = [
    { key: 'dashboard',  label: 'Dashboard',    href: '/admin/' },
    { key: 'pesanan',    label: 'Orders',       href: '/admin/pesanan.html' },
    { key: 'kds',        label: 'Kitchen (KDS)', href: '/admin/kds.html' },
    { key: 'menu',       label: 'Menu',          href: '/admin/menu.html' },
    { key: 'laporan',    label: 'Reports',      href: '/admin/laporan.html' },
    { key: 'qr-meja',      label: 'Table QR',     href: '/admin/qr-meja.html' },
    { key: 'promo',        label: 'Promos',       href: '/admin/promo.html' },
    { key: 'banner',       label: 'Ad Banner',    href: '/admin/banner.html' },
    { key: 'pengaturan', label: 'Settings',     href: '/admin/pengaturan.html' },
    { key: 'pengguna',   label: 'Users',        href: '/admin/pengguna.html' }
  ];

  /* Isi elemen <aside> dengan navigasi admin + info user + tombol Keluar.
   * el    : elemen aside
   * aktif : salah satu key nav ('dashboard', 'pesanan', 'kds', ...)
   * Tidak pernah melempar error (gagal memuat user -> tampil "Pengguna").
   */
  async function renderSidebar(el, aktif) {
    if (!el) return;
    var user = _user;
    if (!user) {
      try { user = (await api('GET', '/admin/me')).user || null; }
      catch (e) { user = null; }
      _user = user;
    }
    el.classList.add('sidebar');
    el.innerHTML =
      '<div class="sidebar-brand">\u2615 Admin Panel</div>' +
      '<nav class="sidebar-nav">' +
        NAV.map(function (item) {
          return '<a href="' + item.href + '" class="sidebar-link' +
            (item.key === aktif ? ' active' : '') + '">' + esc(item.label) + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="sidebar-user">' +
        '<div><div class="sidebar-user-name">' + esc(user && user.name ? user.name : 'User') + '</div>' +
        '<div class="sidebar-user-role">' + esc(user && user.role ? user.role : '') + '</div></div>' +
        '<button type="button" class="btn btn-ghost btn-block" id="sidebar-logout">Log Out</button>' +
      '</div>';
    var btn = el.querySelector('#sidebar-logout');
    if (btn) btn.addEventListener('click', function () { logout(); });
  }

  return {
    api: api,
    guard: guard,
    logout: logout,
    toast: toast,
    rupiah: rupiah,
    statusLabel: statusLabel,
    paymentLabel: paymentLabel,
    orderTypeLabel: orderTypeLabel,
    renderSidebar: renderSidebar
  };
})();
