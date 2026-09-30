// Halaman Pengaturan: muat & simpan settings toko.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'pengaturan');

const $ = (id) => document.getElementById(id);
const KEYS = ['store_name', 'store_tagline', 'store_description', 'store_address', 'store_phone', 'store_hours', 'tax_percent', 'service_percent', 'currency', 'receipt_header', 'receipt_footer', 'printer_provider', 'printer_width', 'public_base_url'];

function isiForm(s) {
  for (const k of KEYS) {
    const el = $('set-' + k);
    if (!el) continue;
    const v = s[k];
    el.value = (v === undefined || v === null) ? '' : String(v);
  }
  // Metode pembayaran: JSON [{id,label}] -> textarea "id | Label" per baris.
  const ta = $('set-payment_methods');
  if (ta) {
    try {
      const daftar = JSON.parse(s.payment_methods || '[]');
      ta.value = Array.isArray(daftar)
        ? daftar.map((m) => `${m.id} | ${m.label || m.id}`).join('\n')
        : '';
    } catch { ta.value = ''; }
  }
  // Tautan media sosial: JSON {instagram,tiktok,facebook,whatsapp} -> 4 input URL.
  try {
    const sos = JSON.parse(s.social_links || '{}');
    for (const k of ['instagram', 'tiktok', 'facebook', 'whatsapp']) {
      const el = $('set-social-' + k);
      if (el) el.value = String((sos && sos[k]) || '');
    }
  } catch { /* biarkan kosong */ }

  // Tipe pesanan: checkbox dine-in/takeaway/delivery -> JSON array.
  const TIPE_IDS = ['dine-in', 'takeaway', 'delivery'];
  for (const t of TIPE_IDS) {
    const cb = $('set-order_types-' + t);
    if (cb) {
      try {
        const aktif = JSON.parse(s.order_types || '["dine-in","takeaway"]');
        cb.checked = Array.isArray(aktif) && aktif.includes(t);
      } catch { cb.checked = (t !== 'delivery'); }
    }
  }
}

function bacaOrderTypes() {
  return ['dine-in', 'takeaway', 'delivery'].filter((t) => {
    const cb = $('set-order_types-' + t);
    return cb && cb.checked;
  });
}

// Textarea "id | Label" -> JSON string [{id,label}].
function bacaPaymentMethods() {
  const ta = $('set-payment_methods');
  const daftar = [];
  for (const baris of (ta ? ta.value : '').split('\n')) {
    const b = baris.trim();
    if (!b) continue;
    const pisah = b.indexOf('|');
    const id = (pisah >= 0 ? b.slice(0, pisah) : b).trim().toLowerCase().replace(/\s+/g, '_');
    const label = (pisah >= 0 ? b.slice(pisah + 1) : b).trim() || id;
    if (id) daftar.push({ id, label });
  }
  return JSON.stringify(daftar);
}

async function muat() {
  try {
    const r = await Admin.api('GET', '/admin/settings');
    if (r.error) throw new Error(r.error);
    isiForm(r.settings || {});
  } catch (e) {
    Admin.toast('Failed to load settings: ' + (e.message || 'error'), 'error');
  }
}

$('form-pengaturan').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {};
  for (const k of KEYS) {
    const el = $('set-' + k);
    if (!el) continue;
    body[k] = (k === 'tax_percent' || k === 'service_percent') ? (Number(el.value) || 0) : el.value;
  }
  body.social_links = JSON.stringify({
    instagram: ($('set-social-instagram') || {}).value || '',
    tiktok: ($('set-social-tiktok') || {}).value || '',
    facebook: ($('set-social-facebook') || {}).value || '',
    whatsapp: ($('set-social-whatsapp') || {}).value || '',
  });
  body.payment_methods = bacaPaymentMethods(); // divalidasi di server (min. 1 metode)
  body.order_types = bacaOrderTypes(); // divalidasi di server (min. 1 tipe)
  try {
    const r = await Admin.api('PATCH', '/admin/settings', body);
    if (r.error) throw new Error(r.error);
    isiForm(r.settings || body);
    Admin.toast('Settings saved', 'ok');
  } catch (err) {
    Admin.toast('Failed to save: ' + (err.message || 'error'), 'error');
  }
});

await muat();
