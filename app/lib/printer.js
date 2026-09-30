// Abstraksi cetak struk.
//
// Untuk menambah provider baru (mis. escpos), cukup buat file
// lib/printer-providers/namabaru.js dengan fungsi async cetak(dataStruk) —
// TIDAK perlu mengubah file ini.
//
// Provider dipilih dari setting `printer_provider` (default: 'browser').
// Bila file provider gagal dimuat, otomatis fallback ke provider 'browser'.
const { db, getSetting } = require('./db');

function namaProviderAman(nama) {
  return String(nama || 'browser').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'browser';
}

function muatProvider(nama) {
  const aman = namaProviderAman(nama);
  try {
    const p = require(`./printer-providers/${aman}.js`);
    if (p && typeof p.cetak === 'function') return p;
    throw new Error('fungsi cetak() tidak ditemukan');
  } catch (e) {
    if (aman !== 'browser') {
      console.warn(
        `[printer] Provider "${aman}" gagal dimuat (${e.message}); fallback ke browser.`
      );
    }
    return require('./printer-providers/browser.js');
  }
}

async function cetakStruk(orderId) {
  const providerName = getSetting('printer_provider', 'browser');
  const provider = muatProvider(providerName);

  const order = db
    .prepare(
      `SELECT o.*, t.number AS table_number
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.id = ?`
    )
    .get(orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan');

  const idItem = db
    .prepare('SELECT id FROM order_items WHERE order_id = ? ORDER BY id')
    .all(orderId)
    .map((r) => r.id);
  const items = db
    .prepare(
      `SELECT menu_item_id, item_name, qty, base_price, note, subtotal
       FROM order_items WHERE order_id = ? ORDER BY id`
    )
    .all(orderId);
  const optStmt = db.prepare(
    `SELECT group_name, option_name, price_delta
     FROM order_item_options WHERE order_item_id = ? ORDER BY id`
  );
  items.forEach((it, i) => {
    it.options = optStmt.all(idItem[i]);
  });

  const dataStruk = {
    store: {
      name: getSetting('store_name', ''),
      address: getSetting('store_address', ''),
      phone: getSetting('store_phone', ''),
    },
    order: { ...order, items },
    totals: {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      service: order.service,
      total: order.total,
    },
    currency: getSetting('currency', 'Rp'),
    header: getSetting('receipt_header', ''),
    footer: getSetting('receipt_footer', ''),
    width: parseInt(getSetting('printer_width', '58'), 10) || 58,
  };

  return provider.cetak(dataStruk);
}

module.exports = { cetakStruk };
