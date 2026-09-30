/* kds.js — Kitchen Display System: kartu pesanan aktif, auto-refresh 10 detik. */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.guard();
  Admin.renderSidebar(document.getElementById('sidebar'), 'kds');

  const grid = document.getElementById('kds-grid');
  const emptyNote = document.getElementById('kds-empty');
  let memuat = false;

  document.getElementById('btn-refresh').addEventListener('click', muat);

  async function muat() {
    if (memuat) return;
    memuat = true;
    try {
      const data = await Admin.api('GET', '/admin/kds');
      render(data.orders || []);
    } catch (e) {
      Admin.toast('Failed to load KDS: ' + e.message, 'error');
    } finally {
      memuat = false;
    }
  }

  function render(orders) {
    emptyNote.hidden = orders.length > 0;
    grid.innerHTML = orders.map(kartuHtml).join('');
  }

  function kartuHtml(o) {
    const menit = Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000));
    const urg = menit >= 30 ? 'urgent' : (menit >= 15 ? 'warn' : '');

    let tombol = '';
    if (o.status === 'dikonfirmasi') {
      tombol = '<button type="button" class="btn btn-primary btn-lg btn-block" data-act="proses" data-id="' + o.id + '">Start Cooking</button>';
    } else if (o.status === 'diproses') {
      tombol = '<button type="button" class="btn btn-success btn-lg btn-block" data-act="siap" data-id="' + o.id + '">Mark Ready</button>';
    }

    const items = (o.items || []).map(itemHtml).join('');
    const alamat = o.order_type === 'delivery' && o.address
      ? '<div class="kds-addr">' + esc(o.address) + '</div>' : '';

    return '<article class="kds-card">' +
      '<header class="kds-head">' +
        '<div class="kds-code">' + esc(o.code) + '</div>' +
        '<div class="kds-meta">' + esc(Admin.orderTypeLabel(o.order_type)) + ' · ' + esc(subTipe(o)) + '</div>' +
        alamat +
        '<div class="kds-timer ' + urg + '">⏱ ' + menit + ' min</div>' +
      '</header>' +
      '<ul class="kds-items">' + items + '</ul>' +
      (o.note ? '<p class="kds-note">'+(window.IKON?IKON.catatan:'📝')+' ' + esc(o.note) + '</p>' : '') +
      '<footer class="kds-foot">' + tombol + '</footer>' +
    '</article>';
  }

  // "Meja X" untuk dine-in, nama pelanggan untuk takeaway/delivery.
  function subTipe(o) {
    if (o.order_type === 'dine-in') return 'Table ' + (o.table_number || '-');
    return o.customer_name || '-';
  }

  function itemHtml(it) {
    const opts = (it.options || []).map((op) =>
      '<li class="kds-opt">+ ' + esc(op.option_name) +
      (Number(op.price_delta) > 0 ? ' (' + esc(Admin.rupiah(op.price_delta)) + ')' : '') + '</li>'
    ).join('');
    return '<li class="kds-item">' +
      '<span class="kds-qty">' + esc(it.qty) + '×</span>' +
      '<span class="kds-name">' + esc(it.item_name) + '</span>' +
      (opts ? '<ul class="kds-opts">' + opts + '</ul>' : '') +
      (it.note ? '<div class="kds-item-note">“' + esc(it.note) + '”</div>' : '') +
    '</li>';
  }

  /* Aksi tombol kartu (delegasi). */
  grid.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const id = Number(btn.dataset.id);
    const target = btn.dataset.act === 'proses' ? 'diproses' : 'siap';
    btn.disabled = true;
    try {
      await Admin.api('PATCH', '/admin/orders/' + id, { status: target });
      Admin.toast(target === 'diproses' ? 'Order is being prepared.' : 'Order marked ready.', 'ok');
      muat();
    } catch (e) {
      Admin.toast('Failed: ' + e.message, 'error');
      btn.disabled = false;
    }
  });

  /* Auto-refresh tiap 10 detik (jeda saat tab tidak terlihat). */
  setInterval(() => { if (!document.hidden) muat(); }, 10000);

  muat();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
});
