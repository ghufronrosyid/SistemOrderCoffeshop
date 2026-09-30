/* dashboard.js — ringkasan statistik, diagram 7 hari, 10 pesanan terbaru. */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.guard();
  Admin.renderSidebar(document.getElementById('sidebar'), 'dashboard');

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const now = new Date();
  const today = ymd(now);

  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  try {
    // --- Ringkasan hari ini ---
    const ring = await Admin.api('GET', '/admin/reports/ringkasan?from=' + today + '&to=' + today);
    const r = ring.ringkasan || {};

    // --- Pesanan aktif = status baru + dikonfirmasi + diproses ---
    const list = await Admin.api('GET', '/admin/orders?limit=100');
    const aktif = (list.orders || []).filter((o) =>
      o.status === 'baru' || o.status === 'dikonfirmasi' || o.status === 'diproses'
    ).length;

    const stats = [
      { label: "Today's Revenue", value: Admin.rupiah(r.total_omzet) },
      { label: "Today's Orders", value: r.jumlah_pesanan == null ? 0 : r.jumlah_pesanan },
      { label: 'Active Orders', value: aktif },
      { label: 'Avg / Order', value: Admin.rupiah(r.rata_rata) }
    ];
    document.getElementById('stat-grid').innerHTML = stats.map((s) =>
      '<div class="stat-card"><div class="stat-label">' + esc(s.label) + '</div>' +
      '<div class="stat-value">' + esc(s.value) + '</div></div>'
    ).join('');

    // --- Diagram batang 7 hari terakhir (div murni, tanpa library) ---
    const from7 = new Date(now);
    from7.setDate(from7.getDate() - 6);
    const ring7 = await Admin.api('GET', '/admin/reports/ringkasan?from=' + ymd(from7) + '&to=' + today);
    renderChart(ring7.per_hari || [], from7, now, ymd);

    // --- 10 pesanan terbaru ---
    const latest = await Admin.api('GET', '/admin/orders?limit=10');
    renderLatest(latest.orders || []);
  } catch (e) {
    Admin.toast('Failed to load dashboard: ' + e.message, 'error');
  }

  function renderChart(perHari, from, to, ymdFn) {
    const map = {};
    perHari.forEach((d) => { map[d.tanggal] = d; });
    const days = [];
    const cur = new Date(from);
    while (cur <= to) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    const namaHari = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maks = Math.max.apply(null, [1].concat(days.map((d) => {
      const m = map[ymdFn(d)] || {};
      return Number(m.omzet) || 0;
    })));
    document.getElementById('chart-7h').innerHTML = days.map((d) => {
      const m = map[ymdFn(d)] || {};
      const omzet = Number(m.omzet) || 0;
      const pesanan = Number(m.pesanan) || 0;
      const tinggi = Math.max(2, Math.round((omzet / maks) * 100));
      return '<div class="bar" title="' + esc(Admin.rupiah(omzet)) + ' · ' + pesanan + ' orders">' +
        '<div class="bar-val">' + (omzet > 0 ? esc(shortRp(omzet)) : '') + '</div>' +
        '<div class="bar-col"><div class="bar-fill" style="height:' + tinggi + '%"></div></div>' +
        '<div class="bar-label">' + namaHari[d.getDay()] + '</div>' +
      '</div>';
    }).join('');
  }

  function renderLatest(orders) {
    const tbody = document.querySelector('#latest-table tbody');
    tbody.innerHTML = orders.map((o) =>
      '<tr>' +
        '<td><a class="link" href="/admin/pesanan.html?q=' + encodeURIComponent(o.code) + '">' + esc(o.code) + '</a></td>' +
        '<td class="nowrap">' + esc(fmtWaktu(o.created_at)) + '</td>' +
        '<td>' + esc(o.customer_name || '-') + '</td>' +
        '<td>' + esc(Admin.orderTypeLabel(o.order_type)) + '</td>' +
        '<td class="num">' + esc(Admin.rupiah(o.total)) + '</td>' +
        '<td><span class="badge badge-' + esc(o.status) + '">' + esc(Admin.statusLabel(o.status)) + '</span></td>' +
      '</tr>'
    ).join('');
  }

  // Compact Rupiah for chart labels: Rp1.5M / Rp250K.
  function shortRp(v) {
    if (v >= 1000000) return 'Rp' + (v / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
    if (v >= 1000) return 'Rp' + Math.round(v / 1000) + 'K';
    return Admin.rupiah(v);
  }

  function fmtWaktu(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
});
