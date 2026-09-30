// Halaman Laporan Penjualan: ringkasan omzet + per hari + per metode + menu terlaris.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'laporan');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);

// Tanggal lokal hari ini dalam format YYYY-MM-DD.
function hariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function muatLaporan() {
  const dari = $('tgl-dari').value, sampai = $('tgl-sampai').value;
  if (!dari || !sampai) { Admin.toast('Please fill in the from and to dates', 'error'); return; }
  try {
    const [ring, lar] = await Promise.all([
      Admin.api('GET', `/admin/reports/ringkasan?from=${dari}&to=${sampai}`),
      Admin.api('GET', `/admin/reports/terlaris?from=${dari}&to=${sampai}&limit=10`),
    ]);
    if (ring.error) throw new Error(ring.error);
    if (lar.error) throw new Error(lar.error);

    const rk = ring.ringkasan || {};
    $('st-omzet').textContent = Admin.rupiah(rk.total_omzet || 0);
    $('st-pesanan').textContent = rk.jumlah_pesanan || 0;
    $('st-rata').textContent = Admin.rupiah(rk.rata_rata || 0);

    const perHari = ring.per_hari || [];
    $('tbody-hari').innerHTML = perHari.length
      ? perHari.map((h) => `<tr><td>${esc(h.tanggal)}</td><td class="num">${esc(h.pesanan)}</td><td class="num">${Admin.rupiah(h.omzet)}</td></tr>`).join('')
      : '<tr><td colspan="3"><div class="empty-note">No orders in this range.</div></td></tr>';

    const perMetode = ring.per_metode || [];
    $('tbody-metode').innerHTML = perMetode.length
      ? perMetode.map((m) => `<tr><td>${esc(Admin.paymentLabel(m.payment_method))}</td><td class="num">${esc(m.pesanan)}</td><td class="num">${Admin.rupiah(m.omzet)}</td></tr>`).join('')
      : '<tr><td colspan="3"><div class="empty-note">No data.</div></td></tr>';

    const items = lar.items || [];
    $('tbody-terlaris').innerHTML = items.length
      ? items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td class="num">${esc(it.qty)}</td><td class="num">${Admin.rupiah(it.omzet)}</td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty-note">No data.</div></td></tr>';
  } catch (e) {
    Admin.toast('Failed to load report: ' + (e.message || 'error'), 'error');
  }
}

$('form-filter').addEventListener('submit', (e) => { e.preventDefault(); muatLaporan(); });

// Default: hari ini, langsung tampilkan.
$('tgl-dari').value = hariIni();
$('tgl-sampai').value = hariIni();
await muatLaporan();
