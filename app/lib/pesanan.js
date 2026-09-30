// Logika bisnis pesanan: kode pesanan, validasi, hitung total, simpan ke DB.
// Dipakai oleh route POST /api/orders dan oleh seed di lib/db.js.
const crypto = require('crypto');

// Karakter kode: A-Z tanpa I dan O (mudah tertukar 1/0), plus angka 2-9.
const KODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Lazy require('./db') di dalam fungsi (bukan di atas file) untuk menghindari
// circular dependency: lib/db.js me-require file ini saat seeding.
function buatKodePesanan() {
  const { db } = require('./db');
  const cek = db.prepare('SELECT 1 FROM orders WHERE code = ?');
  let code;
  do {
    let s = 'K';
    for (let i = 0; i < 5; i++) {
      s += KODE_ALPHABET[crypto.randomInt(KODE_ALPHABET.length)];
    }
    code = s;
  } while (cek.get(code));
  return code;
}

function getSettingVal(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

/**
 * Buat pesanan baru.
 * data = { customer_name, customer_phone, order_type, table_id, address, note,
 *          payment_method, items: [{ menu_item_id, qty, note, options: [option_id, ...] }] }
 * Melempar Error (pesan Bahasa Indonesia) bila validasi gagal.
 * Mengembalikan baris order yang baru dibuat.
 */
function buatPesanan(db, data) {
  const d = data || {};
  const customer_name = String(d.customer_name || '').trim();
  const customer_phone = String(d.customer_phone || '').trim();
  const order_type = d.order_type;
  const table_id = d.table_id == null ? null : Number(d.table_id);
  const address = String(d.address || '').trim();
  const note = String(d.note || '').trim();
  const payment_method = d.payment_method;
  const items = d.items;

  if (!customer_name) throw new Error('Nama pelanggan wajib diisi');
  if (!order_type) throw new Error('Tipe pesanan wajib diisi');
  if (!payment_method) throw new Error('Metode pembayaran wajib diisi');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Pesanan harus memiliki minimal satu item');
  }

  const taxPct = parseInt(getSettingVal(db, 'tax_percent', '0'), 10) || 0;
  const servicePct = parseInt(getSettingVal(db, 'service_percent', '0'), 10) || 0;

  const menuStmt = db.prepare('SELECT * FROM menu_items WHERE id = ?');
  const optStmt = db.prepare(
    `SELECT o.id, o.name, o.price_delta, o.group_id,
            og.name AS group_name, og.type AS group_type,
            og.required AS group_required, og.active AS group_active
     FROM options o JOIN option_groups og ON og.id = o.group_id
     WHERE o.id = ? AND o.active = 1`
  );
  const linkStmt = db.prepare(
    'SELECT 1 FROM item_option_groups WHERE item_id = ? AND group_id = ?'
  );
  const grupTerkaitStmt = db.prepare(
    `SELECT og.* FROM option_groups og
     JOIN item_option_groups iog ON iog.group_id = og.id
     WHERE iog.item_id = ? AND og.active = 1`
  );

  const itemValid = [];

  for (const it of items) {
    const menuItem = menuStmt.get(it.menu_item_id);
    if (!menuItem || menuItem.active !== 1) {
      throw new Error(`Menu tidak ditemukan atau tidak aktif (id: ${it.menu_item_id})`);
    }
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error(`Jumlah untuk "${menuItem.name}" harus antara 1 sampai 99`);
    }

    const optionIds = Array.isArray(it.options) ? it.options : [];
    const terlihat = new Set();
    const perGrup = new Map(); // group_id -> { type, required, name, options: [] }

    for (const oid of optionIds) {
      const oidNum = Number(oid);
      if (!Number.isInteger(oidNum)) {
        throw new Error(`ID opsi tidak valid: ${oid}`);
      }
      if (terlihat.has(oidNum)) {
        throw new Error(`Opsi duplikat untuk "${menuItem.name}"`);
      }
      terlihat.add(oidNum);

      const opt = optStmt.get(oidNum);
      if (!opt || opt.group_active !== 1) {
        throw new Error(`Opsi tidak ditemukan atau tidak aktif (id: ${oid})`);
      }
      if (!linkStmt.get(menuItem.id, opt.group_id)) {
        throw new Error(`Opsi "${opt.name}" tidak tersedia untuk menu "${menuItem.name}"`);
      }
      if (!perGrup.has(opt.group_id)) {
        perGrup.set(opt.group_id, {
          type: opt.group_type,
          required: opt.group_required,
          name: opt.group_name,
          options: [],
        });
      }
      perGrup.get(opt.group_id).options.push(opt);
    }

    // Terapkan aturan tiap grup yang terhubung ke item ini.
    for (const g of grupTerkaitStmt.all(menuItem.id)) {
      const pilih = perGrup.get(g.id);
      const jumlah = pilih ? pilih.options.length : 0;
      if (g.type === 'single' && jumlah > 1) {
        throw new Error(`Grup opsi "${g.name}" hanya boleh memilih satu untuk "${menuItem.name}"`);
      }
      if (g.required === 1 && jumlah !== 1) {
        throw new Error(`Grup opsi "${g.name}" wajib dipilih untuk "${menuItem.name}"`);
      }
    }

    const opsiTerpilih = [];
    let delta = 0;
    for (const g of perGrup.values()) {
      for (const opt of g.options) {
        delta += opt.price_delta;
        opsiTerpilih.push({
          option_id: opt.id,
          group_name: g.name,
          option_name: opt.name,
          price_delta: opt.price_delta,
        });
      }
    }

    // Harga promo aktif (bila ada) dipakai sebagai harga dasar saat checkout.
    let hargaDasar = menuItem.price;
    try {
      const pr = db
        .prepare(
          `SELECT promo_price, discount_percent FROM promos
           WHERE menu_item_id = ? AND active = 1
             AND (starts_at IS NULL OR starts_at <= datetime('now','localtime'))
             AND (ends_at IS NULL OR ends_at >= datetime('now','localtime'))
           ORDER BY sort_order, id LIMIT 1`
        )
        .get(menuItem.id);
      if (pr) {
        hargaDasar =
          pr.promo_price != null
            ? pr.promo_price
            : Math.round((menuItem.price * (1 - (pr.discount_percent || 0) / 100)) / 1000) * 1000;
      }
    } catch (e) { /* abaikan, pakai harga normal */ }

    const subtotalItem = qty * (hargaDasar + delta);
    itemValid.push({
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      qty,
      base_price: hargaDasar,
      note: String((it && it.note) || '').trim(),
      subtotal: subtotalItem,
      options: opsiTerpilih,
    });
  }

  const subtotal = itemValid.reduce((a, b) => a + b.subtotal, 0);
  const discount = 0;
  const tax = Math.round((subtotal * taxPct) / 100);
  const service = Math.round((subtotal * servicePct) / 100);
  const total = subtotal - discount + tax + service;
  const code = buatKodePesanan();

  const simpan = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders
           (code, customer_name, customer_phone, order_type, table_id, address, note,
            subtotal, discount, tax, service, total,
            payment_method, payment_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'belum_bayar', 'baru')`
      )
      .run(
        code, customer_name, customer_phone, order_type, table_id, address, note,
        subtotal, discount, tax, service, total, payment_method
      );
    const orderId = info.lastInsertRowid;

    const insItem = db.prepare(
      `INSERT INTO order_items
         (order_id, menu_item_id, item_name, qty, base_price, note, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insOpsi = db.prepare(
      `INSERT INTO order_item_options
         (order_item_id, option_id, group_name, option_name, price_delta)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const iv of itemValid) {
      const ii = insItem.run(
        orderId, iv.menu_item_id, iv.item_name, iv.qty,
        iv.base_price, iv.note, iv.subtotal
      );
      for (const o of iv.options) {
        insOpsi.run(ii.lastInsertRowid, o.option_id || null, o.group_name, o.option_name, o.price_delta);
      }
    }
    return orderId;
  });

  const orderId = simpan();
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

module.exports = { buatKodePesanan, buatPesanan };
