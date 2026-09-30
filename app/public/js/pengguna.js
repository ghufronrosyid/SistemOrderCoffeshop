// Halaman Pengguna: CRUD akun owner/kasir/barista.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'pengguna');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);

const ROLE_LABEL = { owner: 'Owner', kasir: 'Cashier', barista: 'Barista' };

function bukaModal(id) { $(id).style.display = 'flex'; }
function tutupForm(form) { form.closest('.modal-backdrop').style.display = 'none'; }
// Tutup saat klik backdrop-nya langsung atau tombol [data-tutup].
document.querySelectorAll('.modal-backdrop').forEach((bd) => {
  bd.addEventListener('click', (e) => {
    if (e.target === bd || e.target.closest('[data-tutup]')) bd.style.display = 'none';
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach((m) => (m.style.display = 'none'));
});

async function muatUser() {
  try {
    const r = await Admin.api('GET', '/admin/users');
    if (r.error) throw new Error(r.error);
    const list = r.users || [];
    $('tbody-user').innerHTML = list.length
      ? list.map((u) => `<tr>
          <td><strong>${esc(u.username)}</strong>${String(u.id) === String(user.id) ? ' <span class="badge">(You)</span>' : ''}</td>
          <td>${esc(u.name)}</td>
          <td><span class="badge">${esc(ROLE_LABEL[u.role] || u.role)}</span></td>
          <td>${u.active ? '<span class="badge badge-lunas">Active</span>' : '<span class="badge">Inactive</span>'}</td>
          <td class="aksi">
            <button class="btn btn-sm" data-edit-user="${u.id}" type="button">Edit</button>
            <button class="btn btn-sm btn-danger" data-hapus-user="${u.id}" type="button">Delete</button>
          </td></tr>`).join('')
      : '<tr><td colspan="5"><div class="empty-note">No users yet.</div></td></tr>';
    $('tbody-user')._cache = list;
  } catch (e) {
    Admin.toast('Failed to load users: ' + (e.message || 'error'), 'error');
  }
}

$('btn-tambah-user').addEventListener('click', () => {
  $('form-user-tambah').reset(); $('tu-aktif').checked = true;
  bukaModal('modal-user-tambah');
});
$('form-user-tambah').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    username: $('tu-username').value.trim(), password: $('tu-password').value,
    name: $('tu-nama').value.trim(), role: $('tu-role').value, active: $('tu-aktif').checked,
  };
  try {
    const r = await Admin.api('POST', '/admin/users', body);
    if (r.error) throw new Error(r.error);
    Admin.toast('User added', 'ok'); tutupForm($('form-user-tambah')); muatUser();
  } catch (err) { Admin.toast('Failed to add: ' + (err.message || 'error'), 'error'); }
});

$('tbody-user').addEventListener('click', (e) => {
  const edit = e.target.dataset.editUser, hapus = e.target.dataset.hapusUser;
  const list = $('tbody-user')._cache || [];
  if (edit) {
    const u = list.find((x) => String(x.id) === String(edit));
    if (!u) return;
    $('eu-id').value = u.id; $('eu-username').value = u.username;
    $('eu-password').value = ''; $('eu-nama').value = u.name;
    $('eu-role').value = u.role; $('eu-aktif').checked = !!u.active;
    bukaModal('modal-user-edit');
  }
  if (hapus && confirm('Delete this user?')) {
    (async () => {
      try {
        const r = await Admin.api('DELETE', '/admin/users/' + hapus);
        if (r.error) throw new Error(r.error);
        Admin.toast('User deleted', 'ok'); muatUser();
      } catch (err) {
        // Backend menolak bila mencoba menghapus akun sendiri.
        Admin.toast('Failed to delete: ' + (err.message || 'error'), 'error');
      }
    })();
  }
});
$('form-user-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('eu-id').value;
  const body = { name: $('eu-nama').value.trim(), role: $('eu-role').value, active: $('eu-aktif').checked };
  const pw = $('eu-password').value;
  if (pw) body.password = pw; // kosong = password tidak diubah
  try {
    const r = await Admin.api('PATCH', '/admin/users/' + id, body);
    if (r.error) throw new Error(r.error);
    Admin.toast('User updated', 'ok'); tutupForm($('form-user-edit')); muatUser();
  } catch (err) { Admin.toast('Failed to save: ' + (err.message || 'error'), 'error'); }
});

await muatUser();
