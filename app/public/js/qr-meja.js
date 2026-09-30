// Halaman QR Meja: tampilkan & cetak QR code per meja.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'qr-meja');

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function muat() {
  const wrap = $('qr-wrap');
  try {
    const r = await Admin.api('GET', '/admin/tables/qr');
    if (r.error) throw new Error(r.error);
    $('base-url').textContent = r.base_url || '-';
    const daftar = r.tables || [];
    if (!daftar.length) {
      wrap.innerHTML = '<div class="card"><p class="muted" style="margin:0">No active tables yet. Add table numbers first via the Settings page, or this page cannot be used yet.</p></div>';
      return;
    }
    const info = await Admin.api('GET', '/admin/settings').catch(() => ({}));
    const namaToko = (info.settings && info.settings.store_name) || 'Nordic by The Founders';
    wrap.innerHTML = '<div class="qr-grid">' + daftar.map((t) =>
      '<div class="qr-card">' +
        '<p class="qr-brand">' + esc(namaToko) + '</p>' +
        '<img src="' + t.qr + '" alt="QR Table ' + esc(t.number) + '">' +
        '<p class="qr-meja">TABLE ' + esc(t.number) + '</p>' +
        '<p class="qr-url">' + esc(t.url) + '</p>' +
        '<p class="qr-brand">Scan to order</p>' +
      '</div>'
    ).join('') + '</div>';
  } catch (e) {
    wrap.innerHTML = '<div class="card"><p style="color:#b91c1c;margin:0">Failed to load QR: ' + esc(e.message || 'error') + '</p></div>';
  }
}

$('btn-cetak').addEventListener('click', () => window.print());

muat();
