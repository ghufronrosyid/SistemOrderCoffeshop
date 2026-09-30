// Halaman Master Data: kategori, menu, grup opsi + opsi, meja.
// Memakai kontrak window.Admin dari /js/admin-core.js (api, guard, toast, rupiah, renderSidebar).
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'menu');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yaTidak = (v) => v ? '<span class="badge badge-lunas">Yes</span>' : '<span class="badge">No</span>';
const kosong = (teks, colspan) => `<tr><td colspan="${colspan}"><div class="empty-note">${esc(teks)}</div></td></tr>`;
const $ = (id) => document.getElementById(id);

// Panggil API; lempar Error berisi pesan backend {"error":"..."} bila gagal.
async function apiOk(method, path, body) {
  const r = await Admin.api(method, path, body);
  if (r && r.error) throw new Error(r.error);
  return r;
}
function gagal(e, aksi) {
  Admin.toast((aksi ? aksi + ': ' : '') + (e.message || 'Terjadi kesalahan'), 'error');
}

// ---------- Modal generik (struktur .modal-backdrop > .modal-card) ----------
function bukaModal(id) { $(id).style.display = 'flex'; }
// Tutup saat klik backdrop-nya langsung atau tombol [data-tutup].
document.querySelectorAll('.modal-backdrop').forEach((bd) => {
  bd.addEventListener('click', (e) => {
    if (e.target === bd || e.target.closest('[data-tutup]')) bd.style.display = 'none';
  });
});
function tutupForm(form) { form.closest('.modal-backdrop').style.display = 'none'; }
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach((m) => (m.style.display = 'none'));
});

// ---------- Tab (tombol .seg) ----------
document.querySelectorAll('.seg [data-tab]').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.seg [data-tab]').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach((p) => (p.style.display = 'none'));
    $('tab-' + t.dataset.tab).style.display = 'block';
  });
});

// ================= KATEGORI =================
async function muatKategori() {
  try {
    const r = await apiOk('GET', '/admin/categories');
    const list = r.categories || [];
    $('tbody-kategori').innerHTML = list.length
      ? list.map((k) => `<tr>
          <td>${esc(k.name)}</td><td>${esc(k.sort_order)}</td>
          <td>${yaTidak(k.active)}</td>
          <td class="aksi">
            <button class="btn btn-sm" data-edit-kat="${k.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-hapus-kat="${k.id}" type="button">Delete</button>
          </td></tr>`).join('')
      : kosong('No categories yet.', 4);
    // Isi select kategori di modal menu juga
    $('menu-kategori').innerHTML = list.filter((k) => k.active)
      .map((k) => `<option value="${k.id}">${esc(k.name)}</option>`).join('');
  } catch (e) { gagal(e, 'Failed to load categories'); }
}
$('btn-tambah-kategori').addEventListener('click', () => {
  $('form-kategori').reset(); $('kat-id').value = ''; $('kat-aktif').checked = true;
  $('modal-kategori-judul').textContent = 'Add Category';
  bukaModal('modal-kategori');
});
$('tbody-kategori').addEventListener('click', async (e) => {
  const edit = e.target.dataset.editKat, hapus = e.target.dataset.hapusKat;
  if (edit) {
    try {
      const r = await apiOk('GET', '/admin/categories');
      const k = (r.categories || []).find((x) => String(x.id) === String(edit));
      if (!k) return;
      $('kat-id').value = k.id; $('kat-nama').value = k.name;
      $('kat-urutan').value = k.sort_order ?? 0; $('kat-aktif').checked = !!k.active;
      $('modal-kategori-judul').textContent = 'Edit Category';
      bukaModal('modal-kategori');
    } catch (err) { gagal(err, 'Failed to load categories'); }
  }
  if (hapus && confirm('Delete this category? Menus inside it will be affected.')) {
    try { await apiOk('DELETE', '/admin/categories/' + hapus); Admin.toast('Category deleted', 'ok'); muatKategori(); }
    catch (err) { gagal(err, 'Failed to delete'); }
  }
});
$('form-kategori').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('kat-id').value;
  const body = { name: $('kat-nama').value.trim(), sort_order: Number($('kat-urutan').value) || 0, active: $('kat-aktif').checked };
  try {
    await apiOk(id ? 'PATCH' : 'POST', id ? '/admin/categories/' + id : '/admin/categories', body);
    Admin.toast('Category saved', 'ok'); tutupForm($('form-kategori')); muatKategori();
  } catch (err) { gagal(err, 'Failed to save'); }
});

// ================= MENU =================
let grupOpsiCache = [];
let menuPunyaDataGrup = true;
async function muatGrupOpsiCache() {
  try { const r = await apiOk('GET', '/admin/option-groups'); grupOpsiCache = r.groups || []; }
  catch { grupOpsiCache = []; }
}
function renderCekGrupOpsi(terpilih = []) {
  $('menu-grup-opsi').innerHTML = grupOpsiCache.length
    ? grupOpsiCache.map((g) => `<label style="display:block;margin:8px 0"><input type="checkbox" style="width:auto" value="${g.id}" ${terpilih.includes(g.id) ? 'checked' : ''}> ${esc(g.name)} <span class="muted">(${esc(g.type)})</span></label>`).join('')
    : '<span class="muted">No option groups yet. Create one in the Option Groups tab first.</span>';
}
async function muatMenu() {
  try {
    const r = await apiOk('GET', '/admin/menu-items');
    const list = r.items || [];
    $('tbody-menu').innerHTML = list.length
      ? list.map((m) => `<tr>
          <td><strong>${esc(m.name)}</strong>${m.is_best_seller ? ' <span class="badge badge-belum">Best Seller</span>' : ''}${m.is_new ? ' <span class="badge badge-baru">New</span>' : ''}</td>
          <td>${esc(m.category_name || '-')}</td>
          <td>${Admin.rupiah(m.price)}</td>
          <td>${yaTidak(m.active)}</td>
          <td class="aksi">
            <button class="btn btn-sm" data-edit-menu="${m.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-hapus-menu="${m.id}" type="button">Delete</button>
          </td></tr>`).join('')
      : kosong('No menu items yet.', 5);
  } catch (e) { gagal(e, 'Failed to load menu'); }
}
$('btn-tambah-menu').addEventListener('click', () => {
  $('form-menu').reset(); $('menu-id').value = '';
  $('menu-aktif').checked = true;
  $('menu-gambar').value = '/img/placeholder.svg';
  renderCekGrupOpsi();
  menuPunyaDataGrup = true; // mode tambah: selalu kirim option_group_ids
  $('modal-menu-judul').textContent = 'Add Menu';
  bukaModal('modal-menu');
});
$('tbody-menu').addEventListener('click', async (e) => {
  const edit = e.target.dataset.editMenu, hapus = e.target.dataset.hapusMenu;
  if (edit) {
    try {
      const r = await apiOk('GET', '/admin/menu-items');
      const m = (r.items || []).find((x) => String(x.id) === String(edit));
      if (!m) return;
      $('menu-id').value = m.id; $('menu-kategori').value = m.category_id;
      $('menu-nama').value = m.name; $('menu-deskripsi').value = m.description || '';
      $('menu-harga').value = m.price; $('menu-urutan').value = m.sort_order ?? 0;
      $('menu-gambar').value = m.image || '/img/placeholder.svg';
      $('menu-best').checked = !!m.is_best_seller; $('menu-new').checked = !!m.is_new; $('menu-aktif').checked = !!m.active;
      // Hanya kirim option_group_ids saat simpan bila backend menyertakannya di GET
      // (agar edit tidak menghapus relasi yang tidak terlihat).
      menuPunyaDataGrup = Array.isArray(m.option_group_ids);
      renderCekGrupOpsi(m.option_group_ids || []);
      $('modal-menu-judul').textContent = 'Edit Menu';
      bukaModal('modal-menu');
    } catch (err) { gagal(err, 'Failed to load menu'); }
  }
  if (hapus && confirm('Delete this menu item?')) {
    try { await apiOk('DELETE', '/admin/menu-items/' + hapus); Admin.toast('Menu item deleted', 'ok'); muatMenu(); }
    catch (err) { gagal(err, 'Failed to delete'); }
  }
});
$('form-menu').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('menu-id').value;
  const body = {
    category_id: $('menu-kategori').value, name: $('menu-nama').value.trim(),
    description: $('menu-deskripsi').value.trim(), price: Number($('menu-harga').value) || 0,
    image: $('menu-gambar').value.trim() || '/img/placeholder.svg',
    active: $('menu-aktif').checked, is_best_seller: $('menu-best').checked, is_new: $('menu-new').checked,
    sort_order: Number($('menu-urutan').value) || 0,
  };
  if (menuPunyaDataGrup) {
    body.option_group_ids = [...document.querySelectorAll('#menu-grup-opsi input:checked')].map((c) => c.value);
  }
  try {
    await apiOk(id ? 'PATCH' : 'POST', id ? '/admin/menu-items/' + id : '/admin/menu-items', body);
    Admin.toast('Menu item saved', 'ok'); tutupForm($('form-menu')); muatMenu();
  } catch (err) { gagal(err, 'Failed to save'); }
});

// ================= GRUP OPSI =================
let grupAktifId = null;
async function muatGrup() {
  try {
    const r = await apiOk('GET', '/admin/option-groups');
    const list = r.groups || [];
    grupOpsiCache = list;
    $('tbody-grup').innerHTML = list.length
      ? list.map((g) => `<tr>
          <td><strong>${esc(g.name)}</strong></td>
          <td>${g.type === 'multiple' ? 'Multiple' : 'Single'}</td>
          <td>${yaTidak(g.required)}</td><td>${yaTidak(g.active)}</td>
          <td class="aksi">
            <button class="btn btn-sm" data-kelola-grup="${g.id}" data-nama="${esc(g.name)}" type="button">Manage Options</button>
            <button class="btn btn-sm" data-edit-grup="${g.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-hapus-grup="${g.id}" type="button">Delete</button>
          </td></tr>`).join('')
      : kosong('No option groups yet.', 5);
  } catch (e) { gagal(e, 'Failed to load option groups'); }
}
$('btn-tambah-grup').addEventListener('click', () => {
  $('form-grup').reset(); $('grup-id').value = ''; $('grup-aktif').checked = true;
  $('modal-grup-judul').textContent = 'Add Option Group';
  bukaModal('modal-grup');
});
$('tbody-grup').addEventListener('click', async (e) => {
  const kelola = e.target.dataset.kelolaGrup, edit = e.target.dataset.editGrup, hapus = e.target.dataset.hapusGrup;
  if (kelola) { grupAktifId = kelola; $('opsi-nama-grup').textContent = e.target.dataset.nama; $('card-opsi').style.display = 'block'; muatOpsi(); $('card-opsi').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  if (edit) {
    try {
      const g = grupOpsiCache.find((x) => String(x.id) === String(edit));
      if (!g) return;
      $('grup-id').value = g.id; $('grup-nama').value = g.name; $('grup-tipe').value = g.type;
      $('grup-urutan').value = g.sort_order ?? 0; $('grup-required').checked = !!g.required; $('grup-aktif').checked = !!g.active;
      $('modal-grup-judul').textContent = 'Edit Option Group';
      bukaModal('modal-grup');
    } catch (err) { gagal(err, 'Failed to load group'); }
  }
  if (hapus && confirm('Delete this option group and all its options?')) {
    try { await apiOk('DELETE', '/admin/option-groups/' + hapus); Admin.toast('Option group deleted', 'ok'); muatGrup(); }
    catch (err) { gagal(err, 'Failed to delete'); }
  }
});
$('form-grup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('grup-id').value;
  const body = { name: $('grup-nama').value.trim(), type: $('grup-tipe').value, required: $('grup-required').checked, sort_order: Number($('grup-urutan').value) || 0, active: $('grup-aktif').checked };
  try {
    await apiOk(id ? 'PATCH' : 'POST', id ? '/admin/option-groups/' + id : '/admin/option-groups', body);
    Admin.toast('Option group saved', 'ok'); tutupForm($('form-grup')); muatGrup();
  } catch (err) { gagal(err, 'Failed to save'); }
});
async function muatOpsi() {
  if (!grupAktifId) return;
  try {
    const r = await apiOk('GET', '/admin/option-groups/' + grupAktifId + '/options');
    const list = r.options || [];
    $('tbody-opsi').innerHTML = list.length
      ? list.map((o) => `<tr>
          <td>${esc(o.name)}</td>
          <td>+${Admin.rupiah(o.price_delta || 0)}</td>
          <td>${esc(o.sort_order)}</td><td>${yaTidak(o.active)}</td>
          <td class="aksi">
            <button class="btn btn-sm" data-edit-opsi="${o.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-hapus-opsi="${o.id}" type="button">Delete</button>
          </td></tr>`).join('')
      : kosong('No options in this group yet.', 5);
    $('tbody-opsi')._cache = list;
  } catch (e) { gagal(e, 'Failed to load options'); }
}
$('btn-tambah-opsi').addEventListener('click', () => {
  $('form-opsi').reset(); $('opsi-id').value = ''; $('opsi-aktif').checked = true;
  $('modal-opsi-judul').textContent = 'Add Option';
  bukaModal('modal-opsi');
});
$('tbody-opsi').addEventListener('click', (e) => {
  const edit = e.target.dataset.editOpsi, hapus = e.target.dataset.hapusOpsi;
  const list = $('tbody-opsi')._cache || [];
  if (edit) {
    const o = list.find((x) => String(x.id) === String(edit));
    if (!o) return;
    $('opsi-id').value = o.id; $('opsi-nama').value = o.name;
    $('opsi-harga').value = o.price_delta || 0; $('opsi-urutan').value = o.sort_order ?? 0;
    $('opsi-aktif').checked = !!o.active;
    $('modal-opsi-judul').textContent = 'Edit Option';
    bukaModal('modal-opsi');
  }
  if (hapus && confirm('Delete this option?')) {
    (async () => {
      try { await apiOk('DELETE', '/admin/options/' + hapus); Admin.toast('Option deleted', 'ok'); muatOpsi(); }
      catch (err) { gagal(err, 'Failed to delete'); }
    })();
  }
});
$('form-opsi').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('opsi-id').value;
  const body = { name: $('opsi-nama').value.trim(), price_delta: Number($('opsi-harga').value) || 0, sort_order: Number($('opsi-urutan').value) || 0, active: $('opsi-aktif').checked };
  try {
    await apiOk(id ? 'PATCH' : 'POST', id ? '/admin/options/' + id : '/admin/option-groups/' + grupAktifId + '/options', body);
    Admin.toast('Option saved', 'ok'); tutupForm($('form-opsi')); muatOpsi();
  } catch (err) { gagal(err, 'Failed to save'); }
});

// ================= MEJA =================
async function muatMeja() {
  try {
    const r = await apiOk('GET', '/admin/tables');
    const list = r.tables || [];
    $('tbody-meja').innerHTML = list.length
      ? list.map((t) => `<tr>
          <td><strong>${esc(t.number)}</strong></td><td>${yaTidak(t.active)}</td>
          <td class="aksi"><button class="btn btn-sm btn-danger" data-hapus-meja="${t.id}" type="button">Delete</button></td>
        </tr>`).join('')
      : kosong('No tables yet.', 3);
  } catch (e) { gagal(e, 'Failed to load tables'); }
}
$('btn-tambah-meja').addEventListener('click', () => {
  $('form-meja').reset(); $('meja-aktif').checked = true; bukaModal('modal-meja');
});
$('tbody-meja').addEventListener('click', async (e) => {
  const hapus = e.target.dataset.hapusMeja;
  if (hapus && confirm('Delete this table?')) {
    try { await apiOk('DELETE', '/admin/tables/' + hapus); Admin.toast('Table deleted', 'ok'); muatMeja(); }
    catch (err) { gagal(err, 'Failed to delete'); }
  }
});
$('form-meja').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { number: $('meja-nomor').value.trim(), active: $('meja-aktif').checked };
  try {
    await apiOk('POST', '/admin/tables', body);
    Admin.toast('Table added', 'ok'); tutupForm($('form-meja')); muatMeja();
  } catch (err) { gagal(err, 'Failed to save'); }
});

// ================= INIT =================
await muatKategori();
await muatGrupOpsiCache();
await muatMenu();
await muatGrup();
await muatMeja();
