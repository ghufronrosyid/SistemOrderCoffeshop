/* pesanan.js — daftar pesanan, filter, aksi status, modal detail, auto-refresh. */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.guard();
  Admin.renderSidebar(document.getElementById('sidebar'), 'pesanan');

  const tbody = document.querySelector('#orders-table tbody');
  const emptyNote = document.getElementById('orders-empty');
  const searchInput = document.getElementById('q');
  const seg = document.getElementById('status-filter');
  const modal = document.getElementById('order-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');

  let status = '';
  let q = new URLSearchParams(window.location.search).get('q') || '';
  searchInput.value = q;
  let modalOpen = false;
  let memuat = false;

  /* ---------- util lokal ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtWaktu(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- filter ---------- */
  seg.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-status]');
    if (!btn) return;
    status = btn.dataset.status;
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    muat();
  });

  let tunda;
  searchInput.addEventListener('input', () => {
    clearTimeout(tunda);
    tunda = setTimeout(() => { q = searchInput.value.trim(); muat(); }, 400);
  });

  document.getElementById('btn-refresh').addEventListener('click', muat);

  /* ---------- daftar pesanan ---------- */
  async function muat() {
    if (memuat) return;
    memuat = true;
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      const data = await Admin.api('GET', '/admin/orders?' + params.toString());
      render(data.orders || []);
    } catch (e) {
      Admin.toast('Failed to load orders: ' + e.message, 'error');
    } finally {
      memuat = false;
    }
  }

  function render(orders) {
    emptyNote.hidden = orders.length > 0;
    tbody.innerHTML = orders.map(barisHtml).join('');
  }

  function barisHtml(o) {
    const sub = o.order_type === 'dine-in' && o.table_number
      ? '<div class="sub">Table ' + esc(o.table_number) + '</div>' : '';
    return '<tr>' +
      '<td><button type="button" class="link" data-detail="' + o.id + '">' + esc(o.code) + '</button></td>' +
      '<td class="nowrap">' + esc(fmtWaktu(o.created_at)) + '</td>' +
      '<td>' + esc(o.customer_name || '-') + sub + '</td>' +
      '<td>' + esc(Admin.orderTypeLabel(o.order_type)) + '</td>' +
      '<td class="num">' + esc(Admin.rupiah(o.total)) + '</td>' +
      '<td>' + lencanaBayar(o) + '</td>' +
      '<td><span class="badge badge-' + esc(o.status) + '">' + esc(Admin.statusLabel(o.status)) + '</span></td>' +
      '<td class="aksi">' + aksiHtml(o) + '</td>' +
    '</tr>';
  }

  function lencanaBayar(o) {
    const lunas = o.payment_status === 'lunas';
    return '<span class="badge badge-' + (lunas ? 'lunas' : 'belum') + '">' +
        esc(lunas ? 'Paid' : 'Unpaid') + '</span>' +
      '<div class="sub">' + esc(Admin.paymentLabel(o.payment_method)) + '</div>';
  }

  function aksiHtml(o) {
    const tombol = (act, label, cls) =>
      '<button type="button" class="btn btn-sm ' + cls + '" data-act="' + act +
      '" data-id="' + o.id + '">' + label + '</button>';
    const daftar = [];
    if (o.status === 'baru') {
      daftar.push(tombol('konfirmasi', 'Confirm & Print', 'btn-primary'));
      daftar.push(tombol('batal', 'Cancel', 'btn-danger-ghost'));
    } else if (o.status === 'dikonfirmasi') {
      daftar.push(tombol('proses', 'Start Processing', 'btn-primary'));
      daftar.push(tombol('batal', 'Cancel', 'btn-danger-ghost'));
    } else if (o.status === 'diproses') {
      daftar.push(tombol('siap', 'Mark Ready', 'btn-success'));
    } else if (o.status === 'siap') {
      daftar.push(tombol('selesai', 'Complete', 'btn-success'));
    }
    if (o.payment_status === 'belum_bayar' && o.status !== 'dibatalkan' && o.status !== 'selesai') {
      daftar.push(tombol('lunas', 'Paid', 'btn-warn'));
    }
    return daftar.length ? daftar.join('') : '<span class="muted">—</span>';
  }

  /* ---------- aksi per baris ---------- */
  tbody.addEventListener('click', (ev) => {
    const detailBtn = ev.target.closest('[data-detail]');
    if (detailBtn) { bukaDetail(Number(detailBtn.dataset.detail)); return; }
    const actBtn = ev.target.closest('[data-act]');
    if (!actBtn || actBtn.disabled) return;
    jalankanAksi(Number(actBtn.dataset.id), actBtn.dataset.act, actBtn);
  });

  async function jalankanAksi(id, act, btn) {
    if (act === 'batal' && !confirm('Are you sure you want to cancel this order?')) return;
    if (act === 'selesai' && !confirm('Mark this order as completed?')) return;

    btn.disabled = true;
    try {
      if (act === 'konfirmasi') {
        const res = await Admin.api('PATCH', '/admin/orders/' + id, { status: 'dikonfirmasi' });
        if (res.print && typeof window.cetakOtomatis === 'function') window.cetakOtomatis(res.print);
        Admin.toast('Order confirmed.', 'ok');
      } else if (act === 'lunas') {
        await Admin.api('PATCH', '/admin/orders/' + id, { payment_status: 'lunas' });
        Admin.toast('Payment marked as paid.', 'ok');
      } else {
        const peta = { batal: 'dibatalkan', proses: 'diproses', siap: 'siap', selesai: 'selesai' };
        await Admin.api('PATCH', '/admin/orders/' + id, { status: peta[act] });
        Admin.toast('Order status updated.', 'ok');
      }
      muat();
    } catch (e) {
      Admin.toast('Failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- modal detail ---------- */
  async function bukaDetail(id) {
    modalOpen = true;
    modal.hidden = false;
    modalTitle.textContent = 'Order Details';
    modalBody.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const data = await Admin.api('GET', '/admin/orders/' + id);
      const o = data.order;
      modalTitle.textContent = 'Order Details ' + (o.code || '');
      modalBody.innerHTML = detailHtml(o);
    } catch (e) {
      modalBody.innerHTML = '<p class="form-error">Failed to load details: ' + esc(e.message) + '</p>';
    }
  }

  function tutupModal() {
    modal.hidden = true;
    modalOpen = false;
  }
  document.getElementById('modal-close').addEventListener('click', tutupModal);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) tutupModal(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modalOpen) tutupModal(); });

  function detailHtml(o) {
    const tipeExtra = o.order_type === 'dine-in'
      ? ' · Table ' + (o.table_number || '-')
      : (o.order_type === 'delivery' && o.address ? ' · ' + o.address : '');
    const lunas = o.payment_status === 'lunas';

    const info = [
      ['Code', o.code],
      ['Time', fmtWaktu(o.created_at)],
      ['Customer', o.customer_name || '-'],
      ['Phone', o.customer_phone || '-'],
      ['Type', Admin.orderTypeLabel(o.order_type) + tipeExtra],
      ['Payment', Admin.paymentLabel(o.payment_method) + ' · ' + (lunas ? 'Paid' : 'Unpaid')],
      ['Status', null], // badge di bawah
      ['Notes', o.note || '-']
    ];
    const infoHtml = '<dl class="detail-grid">' + info.map(([label, val]) =>
      '<div><dt>' + esc(label) + '</dt><dd>' +
        (label === 'Status'
          ? '<span class="badge badge-' + esc(o.status) + '">' + esc(Admin.statusLabel(o.status)) + '</span>'
          : esc(val)) +
      '</dd></div>'
    ).join('') + '</dl>';

    const itemsHtml = '<h3>Items</h3><ul class="order-items">' + (o.items || []).map((it) => {
      const opts = (it.options || []).map((op) =>
        '<div class="item-opt">+ ' + esc(op.option_name) +
        (op.group_name ? ' <span class="sub">(' + esc(op.group_name) + ')</span>' : '') +
        (Number(op.price_delta) > 0 ? ' · ' + esc(Admin.rupiah(op.price_delta)) : '') + '</div>'
      ).join('');
      return '<li>' +
        '<div class="item-line"><span>' + esc(it.qty) + '× ' + esc(it.item_name) + '</span>' +
        '<span>' + esc(Admin.rupiah(it.subtotal)) + '</span></div>' +
        opts +
        (it.note ? '<div class="item-note">Note: ' + esc(it.note) + '</div>' : '') +
      '</li>';
    }).join('') + '</ul>';

    const baris = (label, val) =>
      '<div class="row"><span>' + label + '</span><span>' + esc(val) + '</span></div>';
    let totals = baris('Subtotal', Admin.rupiah(o.subtotal));
    if (Number(o.discount) > 0) totals += baris('Discount', '−' + Admin.rupiah(o.discount));
    if (Number(o.tax) > 0) totals += baris('Tax', Admin.rupiah(o.tax));
    if (Number(o.service) > 0) totals += baris('Service', Admin.rupiah(o.service));
    totals += '<div class="row grand"><span>Total</span><span>' + esc(Admin.rupiah(o.total)) + '</span></div>';

    return infoHtml + itemsHtml + '<div class="totals">' + totals + '</div>';
  }

  /* ---------- auto-refresh tiap 20 detik (hanya filter Semua / Baru) ---------- */
  setInterval(() => {
    if (modalOpen || document.hidden) return;
    if (status === '' || status === 'baru') muat();
  }, 20000);

  muat();
});
