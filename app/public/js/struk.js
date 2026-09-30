// Halaman cetak struk (mandiri, tanpa sidebar).
// Dibuka dari halaman pesanan dengan ?id=<order_id>; otomatis memanggil window.print().
const user = await Admin.guard();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);
const garis = '<div class="garis"></div>';

function fmtTanggal(s) {
  try {
    return new Date(s).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return s || ''; }
}

function renderStruk(rc) {
  const o = rc.order, t = rc.store;
  const lebar = rc.width === 58 ? 'struk-58' : 'struk-80';
  const el = $('struk');
  el.className = 'struk ' + lebar;

  let h = '';
  // Kepala toko
  h += `<div class="tengah"><div class="nama-toko">${esc(t.name)}</div>`;
  if (t.address) h += `<div>${esc(t.address)}</div>`;
  if (t.phone) h += `<div>${esc(t.phone)}</div>`;
  if (rc.header) h += `<div class="header-teks">${esc(rc.header)}</div>`;
  h += '</div>' + garis;

  // Info pesanan
  h += `<div class="baris"><span>No: ${esc(o.code)}</span></div>`;
  h += `<div class="baris"><span>${esc(fmtTanggal(o.created_at))}</span></div>`;
  if (o.customer_name) h += `<div class="baris"><span>Customer: ${esc(o.customer_name)}</span></div>`;
  if (o.customer_phone) h += `<div class="baris"><span>Phone: ${esc(o.customer_phone)}</span></div>`;
  h += `<div class="baris"><span>Type: ${esc(Admin.orderTypeLabel(o.order_type))}</span></div>`;
  if (o.table_number) h += `<div class="baris"><span>Table: ${esc(o.table_number)}</span></div>`;
  if (o.address) h += `<div class="baris"><span>Address: ${esc(o.address)}</span></div>`;
  h += garis;

  // Item
  for (const it of o.items || []) {
    h += `<div class="item">`;
    h += `<div class="baris"><span>${it.qty} x ${esc(it.item_name)}</span><span>${Admin.rupiah(it.subtotal)}</span></div>`;
    h += `<div class="baris kecil"><span>@${Admin.rupiah(it.base_price)}</span></div>`;
    for (const op of it.options || []) {
      const delta = op.price_delta ? ' ' + Admin.rupiah(op.price_delta) : '';
      h += `<div class="baris kecil"><span>&nbsp;&nbsp;+ ${esc(op.option_name)}${esc(delta)}</span></div>`;
    }
    if (it.note) h += `<div class="baris kecil"><span>&nbsp;&nbsp;* ${esc(it.note)}</span></div>`;
    h += `</div>`;
  }
  h += garis;

  // Ringkasan
  h += `<div class="baris"><span>Subtotal</span><span>${Admin.rupiah(o.subtotal)}</span></div>`;
  if (o.discount) h += `<div class="baris"><span>Discount</span><span>-${Admin.rupiah(o.discount)}</span></div>`;
  if (o.tax) h += `<div class="baris"><span>Tax</span><span>${Admin.rupiah(o.tax)}</span></div>`;
  if (o.service) h += `<div class="baris"><span>Service</span><span>${Admin.rupiah(o.service)}</span></div>`;
  h += `<div class="baris total"><span>TOTAL</span><span>${Admin.rupiah(o.total)}</span></div>`;
  h += garis;

  // Pembayaran & status
  const lunas = String(o.payment_status).toLowerCase() === 'paid' || String(o.payment_status).toLowerCase() === 'lunas';
  h += `<div class="baris"><span>${esc(Admin.paymentLabel(o.payment_method))}</span><span>${lunas ? 'PAID' : esc(Admin.statusLabel(o.status))}</span></div>`;
  h += garis;

  // Kaki
  if (rc.footer) h += `<div class="tengah footer-teks">${esc(rc.footer)}</div>`;
  h += `<div class="tengah">Thank you for your visit</div>`;

  el.innerHTML = h;
}

// Fungsi kompatibilitas: dipanggil sebagai cetakOtomatis() untuk mencetak ulang struk ini.
window.cetakOtomatis = function () { window.print(); };

$('btn-cetak-ulang').addEventListener('click', () => window.print());
$('btn-tutup').addEventListener('click', () => window.close());

(async () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { $('struk').innerHTML = '<p class="tengah">Order ID not found (?id=).</p>'; return; }
  try {
    const r = await Admin.api('GET', '/admin/receipt/' + encodeURIComponent(id));
    if (r.error) throw new Error(r.error);
    if (!r.receipt) throw new Error('Receipt data is empty.');
    renderStruk(r.receipt);
    // Otomatis buka dialog cetak setelah struk selesai dirender.
    setTimeout(() => window.print(), 600);
  } catch (e) {
    $('struk').innerHTML = '<p class="tengah">Failed to load receipt: ' + esc(e.message || 'error') + '</p>';
  }
})();
