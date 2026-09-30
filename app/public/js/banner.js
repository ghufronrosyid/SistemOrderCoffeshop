// Halaman admin Banner Iklan: CRUD korsel promo untuk Beranda pelanggan.
const user = await Admin.guard();
Admin.renderSidebar(document.getElementById('sidebar'), 'banner');

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NAMA_TEMA = { hijau: 'Green marble', emas: 'Gold', kopi: 'Coffee' };

function pratinjau(b) {
  const tema = NAMA_TEMA[b.tema] ? b.tema : 'hijau';
  const latar = b.gambar
    ? ' style="background-image:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.55)),url(\'' + esc(b.gambar) + '\');background-size:cover;background-position:center"'
    : '';
  return '<div class="banner-pratinjau tema-' + tema + '"' + latar + '>' +
    '<p class="t-judul">' + esc(b.judul) + '</p>' +
    (b.subjudul ? '<p class="t-sub">' + esc(b.subjudul) + '</p>' : '') +
    (b.tombol_teks ? '<span class="t-cta">' + esc(b.tombol_teks) + '</span>' : '') +
    '</div>';
}

async function muat() {
  const wrap = $('daftar');
  try {
    const r = await Admin.api('GET', '/admin/banners');
    const daftar = r.banners || [];
    if (!daftar.length) {
      wrap.innerHTML = '<div class="card"><p class="muted" style="margin:0">No banners yet. Click “Add Banner” to create your first ad banner.</p></div>';
      return;
    }
    wrap.innerHTML = '<div class="banner-grid">' + daftar.map((b) => {
      const aktif = Number(b.aktif) === 1;
      return '<div class="banner-card' + (aktif ? '' : ' nonaktif') + '">' +
        '<h3>' + esc(b.judul) + '</h3>' +
        pratinjau(b) +
        '<div class="banner-meta">Theme: ' + esc(NAMA_TEMA[b.tema] || b.tema) +
        (b.tautan ? ' • Link: ' + esc(b.tautan) : '') +
        ' • Order: ' + (b.urutan || 0) +
        ' • <span class="' + (aktif ? 'badge-aktif' : 'badge-mati') + '">' + (aktif ? 'Active' : 'Inactive') + '</span></div>' +
        '<div class="banner-aksi">' +
        '<button class="btn" data-edit="' + b.id + '">' + (window.IKON ? IKON.pensil : '✏️') + ' Edit</button>' +
        '<button class="btn" data-hapus="' + b.id + '">' + (window.IKON ? IKON.hapus : '🗑') + ' Delete</button>' +
        '</div></div>';
    }).join('') + '</div>';

    wrap.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => isiForm(daftar.find((x) => x.id === Number(btn.dataset.edit))));
    });
    wrap.querySelectorAll('[data-hapus]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const b = daftar.find((x) => x.id === Number(btn.dataset.hapus));
        if (!confirm('Delete banner "' + (b ? b.judul : '') + '"?')) return;
        await Admin.api('DELETE', '/admin/banners/' + btn.dataset.hapus);
        muat();
      });
    });
  } catch (e) {
    wrap.innerHTML = '<div class="card"><p class="pesan-error">' + esc(e.message || 'Failed to load banners.') + '</p></div>';
  }
}

function isiForm(b) {
  $('form-judul').textContent = b ? 'Edit Banner' : 'Add Banner';
  $('f-id').value = b ? b.id : '';
  $('f-judul').value = b ? b.judul : '';
  $('f-sub').value = b ? b.subjudul || '' : '';
  $('f-gambar').value = b ? b.gambar || '' : '';
  $('f-cta').value = b ? b.tombol_teks || '' : '';
  $('f-tautan').value = b ? b.tautan || '' : '';
  $('f-tema').value = b && NAMA_TEMA[b.tema] ? b.tema : 'hijau';
  $('f-urut').value = b ? b.urutan || 0 : 0;
  $('f-aktif').value = b ? String(Number(b.aktif)) : '1';
  $('form-err').textContent = '';
  $('form-wrap').classList.remove('sembunyi');
  $('f-judul').focus();
}

$('btn-tambah').addEventListener('click', () => isiForm(null));
$('btn-batal').addEventListener('click', () => $('form-wrap').classList.add('sembunyi'));

$('form-banner').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = $('f-id').value;
  const payload = {
    judul: $('f-judul').value.trim(),
    subjudul: $('f-sub').value.trim(),
    gambar: $('f-gambar').value.trim(),
    tombol_teks: $('f-cta').value.trim(),
    tautan: $('f-tautan').value.trim(),
    tema: $('f-tema').value,
    urutan: Number($('f-urut').value) || 0,
    aktif: $('f-aktif').value === '1',
  };
  try {
    if (id) await Admin.api('PATCH', '/admin/banners/' + id, payload);
    else await Admin.api('POST', '/admin/banners', payload);
    $('form-wrap').classList.add('sembunyi');
    muat();
  } catch (e) {
    $('form-err').textContent = e.message || 'Failed to save banner.';
  }
});

muat();
