// Halaman admin Promo: CRUD flash sale untuk Beranda pelanggan.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'promo');

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function hargaAkhir(p) {
  if (p.promo_price != null) return p.promo_price;
  return Math.round((p.item_price * (1 - (p.discount_percent || 0) / 100)) / 1000) * 1000;
}

function fmtWaktu(iso) {
  if (!iso) return '—';
  try { return new Date(String(iso).replace(' ', 'T')).toLocaleString('en-US'); }
  catch (e) { return iso; }
}

async function muatMenu() {
  const r = await Admin.api('GET', '/admin/menu');
  const items = (r.categories || []).flatMap((k) => k.items || []);
  $('f-item').innerHTML = '<option value="">— Select menu —</option>' +
    items.map((it) => '<option value="' + it.id + '">' + esc(it.name) + ' — ' + rupiah(it.price) + '</option>').join('');
}

async function muat() {
  const wrap = $('daftar');
  try {
    const r = await Admin.api('GET', '/admin/promos');
    const daftar = r.promos || [];
    if (!daftar.length) {
      wrap.innerHTML = '<div class="card"><p class="muted" style="margin:0">No promos yet. Click “Add Promo” to create your first flash sale.</p></div>';
      return;
    }
    wrap.innerHTML = '<div class="promo-grid">' + daftar.map((p) => {
      const aktif = Number(p.active) === 1;
      return '<div class="promo-card' + (aktif ? '' : ' nonaktif') + '">' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p class="promo-item">'+(window.IKON?IKON.paket:'📦')+' ' + esc(p.item_name || ('Menu #' + p.menu_item_id)) +
        (p.item_price != null ? ' — ' + rupiah(p.item_price) : '') + '</p>' +
        (p.description ? '<p class="promo-item">' + esc(p.description) + '</p>' : '') +
        '<div class="promo-harga"><s>' + rupiah(p.item_price || 0) + '</s> → <b>' + rupiah(hargaAkhir(p)) + '</b>' +
        (p.discount_percent ? ' <span class="badge-aktif">-' + p.discount_percent + '%</span>' : '') + '</div>' +
        '<div class="promo-meta">⏳ ' + fmtWaktu(p.starts_at) + ' → ' + fmtWaktu(p.ends_at) +
        ' • <span class="' + (aktif ? 'badge-aktif' : 'badge-mati') + '">' + (aktif ? 'Active' : 'Inactive') + '</span></div>' +
        '<div class="promo-aksi">' +
        '<button class="btn" data-edit="' + p.id + '">'+(window.IKON?IKON.pensil:'✏️')+' Edit</button>' +
        '<button class="btn" data-hapus="' + p.id + '">'+(window.IKON?IKON.hapus:'🗑')+' Delete</button>' +
        '</div></div>';
    }).join('') + '</div>';

    wrap.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => isiForm(daftar.find((x) => String(x.id) === b.getAttribute('data-edit')))));
    wrap.querySelectorAll('[data-hapus]').forEach((b) =>
      b.addEventListener('click', () => hapus(b.getAttribute('data-hapus'))));
  } catch (e) {
    wrap.innerHTML = '<div class="card"><p class="pesan-error">Failed to load promos.</p></div>';
  }
}

function dtLocal(iso) {
  if (!iso) return '';
  try {
    const d = new Date(String(iso).replace(' ', 'T'));
    const p2 = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  } catch (e) { return ''; }
}

function isiForm(p) {
  $('form-judul').textContent = p ? 'Edit Promo' : 'Add Promo';
  $('f-id').value = p ? p.id : '';
  $('f-title').value = p ? p.title : '';
  $('f-desc').value = p ? (p.description || '') : '';
  $('f-item').value = p ? p.menu_item_id : '';
  $('f-harga').value = p && p.promo_price != null ? p.promo_price : '';
  $('f-diskon').value = p ? (p.discount_percent || '') : '';
  $('f-mulai').value = p ? dtLocal(p.starts_at) : '';
  $('f-selesai').value = p ? dtLocal(p.ends_at) : '';
  $('f-urut').value = p ? (p.sort_order || 0) : 0;
  $('f-aktif').value = p ? String(p.active) : '1';
  $('form-err').textContent = '';
  $('form-wrap').classList.remove('sembunyi');
  $('form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function hapus(id) {
  if (!confirm('Delete this promo?')) return;
  await Admin.api('DELETE', '/admin/promos/' + id);
  muat();
}

function sqlDariLocal(v) {
  if (!v) return null;
  return v.replace('T', ' ') + ':00';
}

$('btn-tambah').addEventListener('click', () => isiForm(null));
$('btn-batal').addEventListener('click', () => $('form-wrap').classList.add('sembunyi'));

$('form-promo').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('form-err').textContent = '';
  const id = $('f-id').value;
  const harga = $('f-harga').value.trim();
  const body = {
    title: $('f-title').value.trim(),
    description: $('f-desc').value.trim(),
    menu_item_id: Number($('f-item').value),
    promo_price: harga === '' ? null : Number(harga),
    discount_percent: Number($('f-diskon').value) || 0,
    starts_at: sqlDariLocal($('f-mulai').value),
    ends_at: sqlDariLocal($('f-selesai').value),
    sort_order: Number($('f-urut').value) || 0,
    active: $('f-aktif').value === '1' ? 1 : 0,
  };
  if (!body.title || !body.menu_item_id) {
    $('form-err').textContent = 'Title and menu are required.';
    return;
  }
  try {
    if (id) await Admin.api('PATCH', '/admin/promos/' + id, body);
    else await Admin.api('POST', '/admin/promos', body);
  } catch (e) {
    $('form-err').textContent = e.message || 'Failed to save promo.';
    return;
  }
  $('form-wrap').classList.add('sembunyi');
  muat();
});

await muatMenu();
await muat();
