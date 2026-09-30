// Seluruh REST API — dipasang di '/api' oleh server.js.
const express = require('express');
const bcrypt = require('bcrypt');
const { db, getSetting, getAllSettings } = require('../lib/db');
const { buatPesanan } = require('../lib/pesanan');
const { requireLogin, requireRole } = require('../lib/auth');
const { cetakStruk } = require('../lib/printer');

const router = express.Router();
const ownerOnly = requireRole('owner');
const staf = requireRole('owner', 'kasir', 'barista');

const ORDER_TYPES_DEFAULT = ['dine-in', 'takeaway'];
const ORDER_TYPES_KNOWN = ['dine-in', 'takeaway', 'delivery'];
// Tipe pesanan KONFIGURABEL via admin (settings.order_types, JSON array).
// Fallback ke default bila setting belum ada / tidak valid.
function getOrderTypes() {
  try {
    const mentah = getSetting('order_types', '');
    if (mentah) {
      const daftar = JSON.parse(mentah);
      const valid = (Array.isArray(daftar) ? daftar : [])
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => ORDER_TYPES_KNOWN.includes(t));
      if (valid.length) return [...new Set(valid)];
    }
  } catch { /* abaikan, pakai default */ }
  return ORDER_TYPES_DEFAULT.slice();
}
const PAYMENT_STATUSES = ['belum_bayar', 'lunas'];
const ORDER_STATUSES = ['baru', 'dikonfirmasi', 'diproses', 'siap', 'selesai', 'dibatalkan'];
const USER_ROLES = ['owner', 'kasir', 'barista'];

// Metode pembayaran KONFIGURABEL via settings.payment_methods (JSON:
// [{id, label}, ...]). Diubah lewat halaman Pengaturan tanpa restart.
function getSocialLinks() {
  const baku = { instagram: '', tiktok: '', facebook: '', whatsapp: 'https://wa.me/62895385381158' };
  try {
    const mentah = getSetting('social_links', '');
    if (!mentah) return baku;
    const o = JSON.parse(mentah);
    if (!o || typeof o !== 'object') return baku;
    return {
      instagram: String(o.instagram || '').trim(),
      tiktok: String(o.tiktok || '').trim(),
      facebook: String(o.facebook || '').trim(),
      whatsapp: String(o.whatsapp || '').trim(),
    };
  } catch { return baku; }
}

function getPaymentMethods() {
  const baku = [
    { id: 'qris', label: 'QRIS' },
    { id: 'tunai', label: 'Tunai' },
    { id: 'transfer', label: 'Transfer' },
  ];
  try {
    const mentah = getSetting('payment_methods', '');
    if (!mentah) return baku;
    const daftar = JSON.parse(mentah);
    if (!Array.isArray(daftar) || daftar.length === 0) return baku;
    const bersih = daftar
      .filter((m) => m && typeof m.id === 'string' && m.id.trim())
      .map((m) => ({ id: m.id.trim(), label: String(m.label || m.id).trim() }));
    return bersih.length ? bersih : baku;
  } catch {
    return baku;
  }
}

// Transisi status yang diizinkan.
const TRANSISI = {
  baru: ['dikonfirmasi', 'dibatalkan'],
  dikonfirmasi: ['diproses', 'dibatalkan'],
  diproses: ['siap'],
  siap: ['selesai'],
  selesai: [],
  dibatalkan: [],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function getOrderFull(id) {
  const order = db
    .prepare(
      `SELECT o.*, t.number AS table_number
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.id = ?`
    )
    .get(id);
  if (!order) return null;
  const idItem = db
    .prepare('SELECT id FROM order_items WHERE order_id = ? ORDER BY id')
    .all(id)
    .map((r) => r.id);
  const items = db
    .prepare(
      `SELECT menu_item_id, item_name, qty, base_price, note, subtotal
       FROM order_items WHERE order_id = ? ORDER BY id`
    )
    .all(id);
  const optStmt = db.prepare(
    `SELECT option_id, group_name, option_name, price_delta
     FROM order_item_options WHERE order_item_id = ? ORDER BY id`
  );
  items.forEach((it, i) => {
    it.options = optStmt.all(idItem[i]);
  });
  order.items = items;
  return order;
}

function getOrderByCode(code) {
  return db.prepare('SELECT id FROM orders WHERE code = ?').get(code);
}

function validTanggal(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Rentang tanggal untuk laporan: default hari ini.
function rentangTanggal(req, res) {
  const hariIni = new Date().toISOString().slice(0, 10);
  const from = req.query.from || hariIni;
  const to = req.query.to || hariIni;
  if (!validTanggal(from) || !validTanggal(to)) {
    res.status(400).json({ error: 'Format tanggal tidak valid (gunakan YYYY-MM-DD)' });
    return null;
  }
  if (from > to) {
    res.status(400).json({ error: 'Tanggal awal tidak boleh setelah tanggal akhir' });
    return null;
  }
  return { from, to };
}

// ---------------------------------------------------------------------------
// API PUBLIK
// ---------------------------------------------------------------------------
router.get('/info', (req, res) => {
  res.json({
    store_name: getSetting('store_name', ''),
    store_address: getSetting('store_address', ''),
    store_phone: getSetting('store_phone', ''),
    tax_percent: parseInt(getSetting('tax_percent', '0'), 10) || 0,
    service_percent: parseInt(getSetting('service_percent', '0'), 10) || 0,
    currency: getSetting('currency', 'Rp'),
    payment_methods: getPaymentMethods(),
    order_types: getOrderTypes(),
    social_links: getSocialLinks(),
  });
});

router.get('/menu', (req, res) => {
  const categories = db
    .prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY sort_order, id')
    .all();
  const itemStmt = db.prepare(
    `SELECT id, name, description, price, image, is_best_seller, is_new
     FROM menu_items WHERE category_id = ? AND active = 1 ORDER BY sort_order, id`
  );
  const itemBaruStmt = db.prepare(
    `SELECT id, name, description, price, image, is_best_seller, is_new
     FROM menu_items WHERE is_new = 1 AND active = 1 ORDER BY sort_order, id`
  );
  const grupStmt = db.prepare(
    `SELECT og.id, og.name, og.type, og.required
     FROM option_groups og
     JOIN item_option_groups iog ON iog.group_id = og.id
     WHERE iog.item_id = ? AND og.active = 1
     ORDER BY iog.sort_order, og.id`
  );
  const opsiStmt = db.prepare(
    'SELECT id, name, price_delta FROM options WHERE group_id = ? AND active = 1 ORDER BY sort_order, id'
  );

  const hasil = categories.map((kat) => {
    // Kategori bernama "New" bersifat virtual: otomatis berisi semua produk bertanda New,
    // tanpa memindahkan produk dari kategori aslinya. Dikelola via checkbox "New" di Admin -> Menu.
    const koleksiBaru = String(kat.name || '').trim().toLowerCase() === 'new';
    const daftar = koleksiBaru ? itemBaruStmt.all() : itemStmt.all(kat.id);
    return {
      id: kat.id,
      name: kat.name,
      items: daftar.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        price: it.price,
        image: it.image,
        is_best_seller: it.is_best_seller,
        is_new: it.is_new,
        promo: promoUntukItem(it.id, it.price),
        option_groups: grupStmt.all(it.id).map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          required: g.required,
          options: opsiStmt.all(g.id),
        })),
      })),
    };
  });
  res.json({ categories: hasil });
});

// -- Promo / flash sale --
function promoAktif() {
  return db
    .prepare(
      `SELECT p.id, p.title, p.description, p.menu_item_id, p.promo_price, p.discount_percent,
              p.starts_at, p.ends_at, mi.name AS item_name, mi.price AS item_price, mi.image AS item_image
       FROM promos p JOIN menu_items mi ON mi.id = p.menu_item_id
       WHERE p.active = 1 AND mi.active = 1
         AND (p.starts_at IS NULL OR p.starts_at <= datetime('now','localtime'))
         AND (p.ends_at IS NULL OR p.ends_at >= datetime('now','localtime'))
       ORDER BY p.sort_order, p.id`
    )
    .all()
    .map((p) => ({
      ...p,
      final_price:
        p.promo_price != null
          ? p.promo_price
          : Math.round((p.item_price * (1 - (p.discount_percent || 0) / 100)) / 1000) * 1000,
    }));
}

function promoUntukItem(itemId, hargaNormal) {
  const daftar = promoAktif();
  const p = daftar.find((x) => x.menu_item_id === itemId);
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    promo_price: p.promo_price,
    discount_percent: p.discount_percent,
    final_price: p.final_price,
    ends_at: p.ends_at,
  };
}

router.get('/promos', (req, res) => {
  res.json({ promos: promoAktif() });
});

// Banner iklan untuk Beranda pelanggan (hanya yang aktif, terurut).
router.get('/banners', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, judul, subjudul, gambar, tombol_teks, tautan, tema
       FROM banners WHERE aktif = 1 ORDER BY urutan, id`
    )
    .all();
  res.json({ banners: rows });
});

// Ringkasan beberapa pesanan sekaligus (untuk tab "Pesanan Saya" di perangkat pelanggan).
router.get('/orders/by-codes', (req, res) => {
  const codes = String(req.query.codes || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  if (!codes.length) return res.json({ orders: [] });
  const stmt = db.prepare(
    `SELECT o.code, o.status, o.order_type, o.total, o.created_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.code = ?`
  );
  res.json({ orders: codes.map((c) => stmt.get(c)).filter(Boolean) });
});

router.get('/tables', (req, res) => {
  const tables = db
    .prepare('SELECT id, number FROM tables WHERE active = 1 ORDER BY id')
    .all();
  res.json({ tables });
});

router.post('/orders', (req, res) => {
  try {
    const b = req.body || {};
    const customer_name = String(b.customer_name || '').trim();
    if (!customer_name) {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi' });
    }
    const tipeAktif = getOrderTypes();
    if (!tipeAktif.includes(b.order_type)) {
      return res.status(400).json({ error: 'Tipe pesanan tidak valid (' + tipeAktif.join(', ') + ')' });
    }
    const daftarBayar = getPaymentMethods().map((m) => m.id);
    if (!daftarBayar.includes(b.payment_method)) {
      return res.status(400).json({ error: 'Metode pembayaran tidak valid' });
    }

    let table_id = null;
    if (b.order_type === 'dine-in') {
      table_id = Number(b.table_id);
      if (!Number.isInteger(table_id)) {
        return res.status(400).json({ error: 'Nomor meja wajib dipilih untuk dine-in' });
      }
      const meja = db.prepare('SELECT id FROM tables WHERE id = ? AND active = 1').get(table_id);
      if (!meja) {
        return res.status(400).json({ error: 'Meja tidak ditemukan atau tidak aktif' });
      }
    }
    if (b.order_type === 'delivery' && !String(b.address || '').trim()) {
      return res.status(400).json({ error: 'Alamat wajib diisi untuk delivery' });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return res.status(400).json({ error: 'Pesanan harus memiliki minimal satu item' });
    }

    const order = buatPesanan(db, {
      customer_name,
      customer_phone: String(b.customer_phone || '').trim(),
      order_type: b.order_type,
      table_id,
      address: String(b.address || '').trim(),
      note: String(b.note || '').trim(),
      payment_method: b.payment_method,
      items: b.items,
    });

    res.status(201).json({
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        payment_status: order.payment_status,
        total: order.total,
        created_at: order.created_at,
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Data pesanan tidak valid' });
  }
});

router.get('/orders/:code', (req, res) => {
  const row = getOrderByCode(req.params.code);
  if (!row) return res.status(404).json({ error: 'pesanan_tidak_ditemukan' });
  res.json({ order: getOrderFull(row.id) });
});

router.post('/orders/:code/batal', (req, res) => {
  const row = getOrderByCode(req.params.code);
  if (!row) return res.status(404).json({ error: 'pesanan_tidak_ditemukan' });
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(row.id);
  if (order.status !== 'baru') {
    return res.status(400).json({ error: 'Pesanan hanya bisa dibatalkan saat status masih "baru"' });
  }
  db.prepare(
    "UPDATE orders SET status = 'dibatalkan', updated_at = datetime('now','localtime') WHERE id = ?"
  ).run(row.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// AUTH ADMIN
// ---------------------------------------------------------------------------
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (
    !user ||
    user.active !== 1 ||
    !password ||
    !bcrypt.compareSync(String(password), user.password_hash)
  ) {
    return res.status(401).json({ error: 'username_atau_password_salah' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.name = user.name;
  req.session.role = user.role;
  res.json({
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

// Semua endpoint /api/admin/* di bawah ini butuh login.
router.use('/admin', requireLogin);

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/admin/me', (req, res) => {
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      name: req.session.name,
      role: req.session.role,
    },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: PESANAN (owner, kasir, barista)
// ---------------------------------------------------------------------------
router.get('/admin/orders', staf, (req, res) => {
  const { status, q } = req.query;
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const syarat = [];
  const param = [];
  if (status) {
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status pesanan tidak valid' });
    }
    syarat.push('o.status = ?');
    param.push(status);
  }
  if (q) {
    syarat.push('(o.code LIKE ? OR o.customer_name LIKE ?)');
    param.push(`%${q}%`, `%${q}%`);
  }
  if (req.query.from) {
    if (!validTanggal(req.query.from)) {
      return res.status(400).json({ error: 'Format from tidak valid (YYYY-MM-DD)' });
    }
    syarat.push("date(o.created_at) >= date(?)");
    param.push(req.query.from);
  }
  if (req.query.to) {
    if (!validTanggal(req.query.to)) {
      return res.status(400).json({ error: 'Format to tidak valid (YYYY-MM-DD)' });
    }
    syarat.push("date(o.created_at) <= date(?)");
    param.push(req.query.to);
  }

  const where = syarat.length ? 'WHERE ' + syarat.join(' AND ') : '';
  const orders = db
    .prepare(
      `SELECT o.id, o.code, o.customer_name, o.order_type, t.number AS table_number,
              o.status, o.payment_method, o.payment_status, o.total, o.created_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       ${where}
       ORDER BY o.id DESC LIMIT ?`
    )
    .all(...param, limit);
  res.json({ orders });
});

router.get('/admin/orders/:id', staf, (req, res) => {
  const order = getOrderFull(req.params.id);
  if (!order) return res.status(404).json({ error: 'pesanan_tidak_ditemukan' });
  res.json({ order });
});

router.patch('/admin/orders/:id', staf, async (req, res, next) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'pesanan_tidak_ditemukan' });

    const { status, payment_status } = req.body || {};
    if (status === undefined && payment_status === undefined) {
      return res.status(400).json({ error: 'Tidak ada perubahan yang diminta' });
    }

    const kolom = [];
    const nilai = [];
    if (status !== undefined) {
      if (!(TRANSISI[order.status] || []).includes(status)) {
        return res.status(400).json({
          error: `Transisi status dari "${order.status}" ke "${status}" tidak diizinkan`,
        });
      }
      kolom.push('status = ?');
      nilai.push(status);
    }
    if (payment_status !== undefined) {
      if (!PAYMENT_STATUSES.includes(payment_status)) {
        return res.status(400).json({ error: 'Status pembayaran tidak valid (belum_bayar, lunas)' });
      }
      kolom.push('payment_status = ?');
      nilai.push(payment_status);
    }

    db.prepare(
      `UPDATE orders SET ${kolom.join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(...nilai, order.id);

    let print;
    if (status === 'dikonfirmasi') {
      // Cetak struk otomatis saat pesanan dikonfirmasi.
      print = await cetakStruk(order.id);
    }

    const resp = { order: getOrderFull(order.id) };
    if (print !== undefined) resp.print = print;
    res.json(resp);
  } catch (e) {
    next(e);
  }
});

// KDS (Kitchen Display): pesanan yang perlu dikerjakan dapur.
router.get('/admin/kds', staf, (req, res) => {
  const rows = db
    .prepare("SELECT id FROM orders WHERE status IN ('dikonfirmasi','diproses') ORDER BY created_at ASC")
    .all();
  res.json({ orders: rows.map((r) => getOrderFull(r.id)) });
});

router.get('/admin/receipt/:id', staf, (req, res) => {
  const order = getOrderFull(req.params.id);
  if (!order) return res.status(404).json({ error: 'pesanan_tidak_ditemukan' });
  res.json({
    receipt: {
      store: {
        name: getSetting('store_name', ''),
        address: getSetting('store_address', ''),
        phone: getSetting('store_phone', ''),
      },
      order,
      header: getSetting('receipt_header', ''),
      footer: getSetting('receipt_footer', ''),
      width: parseInt(getSetting('printer_width', '58'), 10) || 58,
    },
  });
});

// ---------------------------------------------------------------------------
// ADMIN: LAPORAN (owner, kasir, barista)
// ---------------------------------------------------------------------------
router.get('/admin/reports/ringkasan', staf, (req, res) => {
  const rentang = rentangTanggal(req, res);
  if (!rentang) return;
  const { from, to } = rentang;
  const filter = "status != 'dibatalkan' AND date(created_at) BETWEEN date(?) AND date(?)";

  const agg = db
    .prepare(`SELECT COUNT(*) AS jml, COALESCE(SUM(total), 0) AS omzet FROM orders WHERE ${filter}`)
    .get(from, to);
  const perHari = db
    .prepare(
      `SELECT date(created_at) AS tanggal, COALESCE(SUM(total), 0) AS omzet, COUNT(*) AS pesanan
       FROM orders WHERE ${filter}
       GROUP BY date(created_at) ORDER BY tanggal ASC`
    )
    .all(from, to);
  const perMetode = db
    .prepare(
      `SELECT payment_method, COALESCE(SUM(total), 0) AS omzet, COUNT(*) AS pesanan
       FROM orders WHERE ${filter}
       GROUP BY payment_method ORDER BY omzet DESC`
    )
    .all(from, to);

  res.json({
    ringkasan: {
      total_omzet: agg.omzet,
      jumlah_pesanan: agg.jml,
      rata_rata: agg.jml > 0 ? Math.round(agg.omzet / agg.jml) : 0,
    },
    per_hari: perHari,
    per_metode: perMetode,
  });
});

router.get('/admin/reports/terlaris', staf, (req, res) => {
  const rentang = rentangTanggal(req, res);
  if (!rentang) return;
  const { from, to } = rentang;
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  const items = db
    .prepare(
      `SELECT oi.item_name AS name, SUM(oi.qty) AS qty, SUM(oi.subtotal) AS omzet
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'dibatalkan' AND date(o.created_at) BETWEEN date(?) AND date(?)
       GROUP BY oi.item_name
       ORDER BY qty DESC, omzet DESC
       LIMIT ?`
    )
    .all(from, to, limit);
  res.json({ items });
});

// ---------------------------------------------------------------------------
// ADMIN: CRUD MASTER (khusus owner)
// ---------------------------------------------------------------------------

// -- Kategori --
router.get('/admin/categories', ownerOnly, (req, res) => {
  const rows = db
    .prepare('SELECT id, name, sort_order, active FROM categories ORDER BY sort_order, id')
    .all();
  res.json({ categories: rows });
});

router.post('/admin/categories', ownerOnly, (req, res) => {
  const { name, sort_order, active } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  }
  const info = db
    .prepare('INSERT INTO categories (name, sort_order, active) VALUES (?, ?, ?)')
    .run(String(name).trim(), Number(sort_order) || 0, active === 0 ? 0 : 1);
  res.status(201).json({
    category: db.prepare('SELECT id, name, sort_order, active FROM categories WHERE id = ?').get(info.lastInsertRowid),
  });
});

router.patch('/admin/categories/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'kategori_tidak_ditemukan' });
  const { name, sort_order, active } = req.body || {};
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Nama kategori tidak boleh kosong' });
  }
  db.prepare(
    `UPDATE categories SET
       name = COALESCE(?, name),
       sort_order = COALESCE(?, sort_order),
       active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    name === undefined ? null : String(name).trim(),
    sort_order === undefined ? null : Number(sort_order) || 0,
    active === undefined ? null : active ? 1 : 0,
    req.params.id
  );
  res.json({
    category: db.prepare('SELECT id, name, sort_order, active FROM categories WHERE id = ?').get(req.params.id),
  });
});

router.delete('/admin/categories/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'kategori_tidak_ditemukan' });
  const terpakai = db
    .prepare('SELECT COUNT(*) AS c FROM menu_items WHERE category_id = ?')
    .get(req.params.id).c;
  if (terpakai > 0) {
    return res.status(400).json({ error: 'Kategori masih memiliki menu, tidak bisa dihapus' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// -- Menu item --
const MENU_FIELDS = 'id, category_id, name, description, price, image, active, is_best_seller, is_new, sort_order';

function getMenuItem(id) {
  const row = db.prepare(`SELECT ${MENU_FIELDS} FROM menu_items WHERE id = ?`).get(id);
  if (!row) return null;
  row.option_group_ids = db
    .prepare('SELECT group_id FROM item_option_groups WHERE item_id = ? ORDER BY sort_order')
    .all(id)
    .map((r) => r.group_id);
  return row;
}

function validasiGrupIds(groupIds) {
  if (!Array.isArray(groupIds)) return [];
  const ids = [...new Set(groupIds.map(Number).filter((n) => Number.isInteger(n)))];
  for (const gid of ids) {
    const g = db.prepare('SELECT id FROM option_groups WHERE id = ? AND active = 1').get(gid);
    if (!g) throw new Error(`Grup opsi tidak ditemukan atau tidak aktif (id: ${gid})`);
  }
  return ids;
}

function sinkronGrupItem(itemId, groupIds) {
  const trx = db.transaction((ids) => {
    db.prepare('DELETE FROM item_option_groups WHERE item_id = ?').run(itemId);
    const ins = db.prepare(
      'INSERT INTO item_option_groups (item_id, group_id, sort_order) VALUES (?, ?, ?)'
    );
    ids.forEach((gid, i) => ins.run(itemId, gid, i + 1));
  });
  trx(groupIds);
}

router.get('/admin/menu-items', ownerOnly, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description,
              m.price, m.image, m.active, m.is_best_seller, m.is_new, m.sort_order
       FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
       ORDER BY m.sort_order, m.id`
    )
    .all();
  res.json({ menu_items: rows });
});

router.post('/admin/menu-items', ownerOnly, (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'Nama menu wajib diisi' });
    }
    const price = Number(b.price);
    if (!Number.isInteger(price) || price < 0) {
      return res.status(400).json({ error: 'Harga harus bilangan bulat >= 0 (rupiah)' });
    }
    if (b.category_id != null) {
      const kat = db.prepare('SELECT id FROM categories WHERE id = ?').get(b.category_id);
      if (!kat) return res.status(400).json({ error: 'Kategori tidak ditemukan' });
    }
    const groupIds = validasiGrupIds(b.option_group_ids);
    const info = db
      .prepare(
        `INSERT INTO menu_items
           (category_id, name, description, price, image, active, is_best_seller, is_new, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        b.category_id == null ? null : Number(b.category_id),
        String(b.name).trim(),
        String(b.description || ''),
        price,
        String(b.image || '/img/placeholder.svg'),
        b.active === 0 || b.active === false ? 0 : 1,
        b.is_best_seller ? 1 : 0,
        b.is_new ? 1 : 0,
        Number(b.sort_order) || 0
      );
    sinkronGrupItem(info.lastInsertRowid, groupIds);
    res.status(201).json({ menu_item: getMenuItem(info.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/admin/menu-items/:id', ownerOnly, (req, res) => {
  try {
    if (!getMenuItem(req.params.id)) {
      return res.status(404).json({ error: 'menu_tidak_ditemukan' });
    }
    const b = req.body || {};
    if (b.name !== undefined && !String(b.name).trim()) {
      return res.status(400).json({ error: 'Nama menu tidak boleh kosong' });
    }
    if (b.price !== undefined && (!Number.isInteger(Number(b.price)) || Number(b.price) < 0)) {
      return res.status(400).json({ error: 'Harga harus bilangan bulat >= 0 (rupiah)' });
    }
    if (b.category_id !== undefined && b.category_id !== null) {
      const kat = db.prepare('SELECT id FROM categories WHERE id = ?').get(b.category_id);
      if (!kat) return res.status(400).json({ error: 'Kategori tidak ditemukan' });
    }
    db.prepare(
      `UPDATE menu_items SET
         category_id = COALESCE(?, category_id),
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         price = COALESCE(?, price),
         image = COALESCE(?, image),
         active = COALESCE(?, active),
         is_best_seller = COALESCE(?, is_best_seller),
         is_new = COALESCE(?, is_new),
         sort_order = COALESCE(?, sort_order)
       WHERE id = ?`
    ).run(
      b.category_id === undefined ? null : b.category_id === null ? null : Number(b.category_id),
      b.name === undefined ? null : String(b.name).trim(),
      b.description === undefined ? null : String(b.description),
      b.price === undefined ? null : Number(b.price),
      b.image === undefined ? null : String(b.image),
      b.active === undefined ? null : b.active ? 1 : 0,
      b.is_best_seller === undefined ? null : b.is_best_seller ? 1 : 0,
      b.is_new === undefined ? null : b.is_new ? 1 : 0,
      b.sort_order === undefined ? null : Number(b.sort_order) || 0,
      req.params.id
    );
    if (b.option_group_ids !== undefined) {
      sinkronGrupItem(Number(req.params.id), validasiGrupIds(b.option_group_ids));
    }
    res.json({ menu_item: getMenuItem(req.params.id) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/admin/menu-items/:id', ownerOnly, (req, res) => {
  if (!getMenuItem(req.params.id)) {
    return res.status(404).json({ error: 'menu_tidak_ditemukan' });
  }
  const trx = db.transaction(() => {
    db.prepare('DELETE FROM item_option_groups WHERE item_id = ?').run(req.params.id);
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  });
  trx();
  res.json({ ok: true });
});

// -- Grup opsi --
const GRUP_FIELDS = 'id, name, type, required, sort_order, active';

router.get('/admin/option-groups', ownerOnly, (req, res) => {
  const rows = db
    .prepare(`SELECT ${GRUP_FIELDS} FROM option_groups ORDER BY sort_order, id`)
    .all();
  res.json({ option_groups: rows });
});

router.post('/admin/option-groups', ownerOnly, (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'Nama grup opsi wajib diisi' });
  }
  const type = b.type || 'single';
  if (!['single', 'multiple'].includes(type)) {
    return res.status(400).json({ error: 'Tipe grup tidak valid (single, multiple)' });
  }
  const info = db
    .prepare('INSERT INTO option_groups (name, type, required, sort_order, active) VALUES (?, ?, ?, ?, ?)')
    .run(String(b.name).trim(), type, b.required ? 1 : 0, Number(b.sort_order) || 0, b.active === 0 || b.active === false ? 0 : 1);
  res.status(201).json({
    option_group: db.prepare(`SELECT ${GRUP_FIELDS} FROM option_groups WHERE id = ?`).get(info.lastInsertRowid),
  });
});

router.patch('/admin/option-groups/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM option_groups WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'grup_opsi_tidak_ditemukan' });
  const b = req.body || {};
  if (b.name !== undefined && !String(b.name).trim()) {
    return res.status(400).json({ error: 'Nama grup opsi tidak boleh kosong' });
  }
  if (b.type !== undefined && !['single', 'multiple'].includes(b.type)) {
    return res.status(400).json({ error: 'Tipe grup tidak valid (single, multiple)' });
  }
  db.prepare(
    `UPDATE option_groups SET
       name = COALESCE(?, name), type = COALESCE(?, type),
       required = COALESCE(?, required), sort_order = COALESCE(?, sort_order),
       active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    b.name === undefined ? null : String(b.name).trim(),
    b.type === undefined ? null : b.type,
    b.required === undefined ? null : b.required ? 1 : 0,
    b.sort_order === undefined ? null : Number(b.sort_order) || 0,
    b.active === undefined ? null : b.active ? 1 : 0,
    req.params.id
  );
  res.json({
    option_group: db.prepare(`SELECT ${GRUP_FIELDS} FROM option_groups WHERE id = ?`).get(req.params.id),
  });
});

router.delete('/admin/option-groups/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM option_groups WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'grup_opsi_tidak_ditemukan' });
  const trx = db.transaction(() => {
    db.prepare('DELETE FROM options WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM item_option_groups WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM option_groups WHERE id = ?').run(req.params.id);
  });
  trx();
  res.json({ ok: true });
});

// -- Opsi (nested di bawah grup) --
const OPSI_FIELDS = 'id, group_id, name, price_delta, sort_order, active';

router.get('/admin/option-groups/:id/options', ownerOnly, (req, res) => {
  const grup = db.prepare('SELECT id FROM option_groups WHERE id = ?').get(req.params.id);
  if (!grup) return res.status(404).json({ error: 'grup_opsi_tidak_ditemukan' });
  const rows = db
    .prepare(`SELECT ${OPSI_FIELDS} FROM options WHERE group_id = ? ORDER BY sort_order, id`)
    .all(req.params.id);
  res.json({ options: rows });
});

router.post('/admin/option-groups/:id/options', ownerOnly, (req, res) => {
  const grup = db.prepare('SELECT id FROM option_groups WHERE id = ?').get(req.params.id);
  if (!grup) return res.status(404).json({ error: 'grup_opsi_tidak_ditemukan' });
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'Nama opsi wajib diisi' });
  }
  const delta = Number(b.price_delta);
  if (!Number.isInteger(delta)) {
    return res.status(400).json({ error: 'Selisih harga harus bilangan bulat (rupiah)' });
  }
  const info = db
    .prepare('INSERT INTO options (group_id, name, price_delta, sort_order, active) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, String(b.name).trim(), delta, Number(b.sort_order) || 0, b.active === 0 || b.active === false ? 0 : 1);
  res.status(201).json({
    option: db.prepare(`SELECT ${OPSI_FIELDS} FROM options WHERE id = ?`).get(info.lastInsertRowid),
  });
});

router.patch('/admin/options/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM options WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'opsi_tidak_ditemukan' });
  const b = req.body || {};
  if (b.name !== undefined && !String(b.name).trim()) {
    return res.status(400).json({ error: 'Nama opsi tidak boleh kosong' });
  }
  if (b.price_delta !== undefined && !Number.isInteger(Number(b.price_delta))) {
    return res.status(400).json({ error: 'Selisih harga harus bilangan bulat (rupiah)' });
  }
  db.prepare(
    `UPDATE options SET
       name = COALESCE(?, name), price_delta = COALESCE(?, price_delta),
       sort_order = COALESCE(?, sort_order), active = COALESCE(?, active)
     WHERE id = ?`
  ).run(
    b.name === undefined ? null : String(b.name).trim(),
    b.price_delta === undefined ? null : Number(b.price_delta),
    b.sort_order === undefined ? null : Number(b.sort_order) || 0,
    b.active === undefined ? null : b.active ? 1 : 0,
    req.params.id
  );
  res.json({
    option: db.prepare(`SELECT ${OPSI_FIELDS} FROM options WHERE id = ?`).get(req.params.id),
  });
});

router.delete('/admin/options/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM options WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'opsi_tidak_ditemukan' });
  db.prepare('DELETE FROM options WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// -- Meja --
router.get('/admin/tables', ownerOnly, (req, res) => {
  const rows = db.prepare('SELECT id, number, active FROM tables ORDER BY id').all();
  res.json({ tables: rows });
});

router.post('/admin/tables', ownerOnly, (req, res) => {
  const b = req.body || {};
  const number = String(b.number || '').trim();
  if (!number) return res.status(400).json({ error: 'Nomor meja wajib diisi' });
  try {
    const info = db
      .prepare('INSERT INTO tables (number, active) VALUES (?, ?)')
      .run(number, b.active === 0 || b.active === false ? 0 : 1);
    res.status(201).json({
      table: db.prepare('SELECT id, number, active FROM tables WHERE id = ?').get(info.lastInsertRowid),
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Nomor meja sudah dipakai' });
    }
    throw e;
  }
});

router.patch('/admin/tables/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM tables WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'meja_tidak_ditemukan' });
  const b = req.body || {};
  if (b.number !== undefined && !String(b.number).trim()) {
    return res.status(400).json({ error: 'Nomor meja tidak boleh kosong' });
  }
  try {
    db.prepare(
      `UPDATE tables SET number = COALESCE(?, number), active = COALESCE(?, active) WHERE id = ?`
    ).run(
      b.number === undefined ? null : String(b.number).trim(),
      b.active === undefined ? null : b.active ? 1 : 0,
      req.params.id
    );
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Nomor meja sudah dipakai' });
    }
    throw e;
  }
  res.json({
    table: db.prepare('SELECT id, number, active FROM tables WHERE id = ?').get(req.params.id),
  });
});

router.delete('/admin/tables/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM tables WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'meja_tidak_ditemukan' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// -- CRUD promo / flash sale --
router.get('/admin/promos', ownerOnly, (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, mi.name AS item_name, mi.price AS item_price
       FROM promos p LEFT JOIN menu_items mi ON mi.id = p.menu_item_id
       ORDER BY p.sort_order, p.id`
    )
    .all();
  res.json({ promos: rows });
});

router.post('/admin/promos', ownerOnly, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Judul promo wajib diisi' });
  if (!b.menu_item_id) return res.status(400).json({ error: 'Pilih menu untuk promo' });
  const r = db
    .prepare(
      `INSERT INTO promos (title, description, menu_item_id, promo_price, discount_percent,
                           starts_at, ends_at, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title).trim(),
      String(b.description || ''),
      Number(b.menu_item_id),
      b.promo_price === null || b.promo_price === undefined || b.promo_price === '' ? null : Math.round(Number(b.promo_price)),
      Math.max(0, Math.min(100, Number(b.discount_percent) || 0)),
      b.starts_at || null,
      b.ends_at || null,
      b.active === false || b.active === 0 ? 0 : 1,
      Number(b.sort_order) || 0
    );
  res.json({ promo: db.prepare('SELECT * FROM promos WHERE id = ?').get(r.lastInsertRowid) });
});

router.patch('/admin/promos/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM promos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'promo_tidak_ditemukan' });
  const b = req.body || {};
  db.prepare(
    `UPDATE promos SET title = COALESCE(?, title), description = COALESCE(?, description),
       menu_item_id = COALESCE(?, menu_item_id), promo_price = ?,
       discount_percent = COALESCE(?, discount_percent), starts_at = ?,
       ends_at = ?, active = COALESCE(?, active), sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(
    b.title === undefined ? null : String(b.title).trim(),
    b.description === undefined ? null : String(b.description),
    b.menu_item_id === undefined ? null : Number(b.menu_item_id),
    b.promo_price === undefined
      ? db.prepare('SELECT promo_price FROM promos WHERE id = ?').get(req.params.id).promo_price
      : b.promo_price === null || b.promo_price === ''
        ? null
        : Math.round(Number(b.promo_price)),
    b.discount_percent === undefined ? null : Math.max(0, Math.min(100, Number(b.discount_percent) || 0)),
    b.starts_at === undefined ? db.prepare('SELECT starts_at FROM promos WHERE id = ?').get(req.params.id).starts_at : b.starts_at || null,
    b.ends_at === undefined ? db.prepare('SELECT ends_at FROM promos WHERE id = ?').get(req.params.id).ends_at : b.ends_at || null,
    b.active === undefined ? null : b.active ? 1 : 0,
    b.sort_order === undefined ? null : Number(b.sort_order) || 0,
    req.params.id
  );
  res.json({ promo: db.prepare('SELECT * FROM promos WHERE id = ?').get(req.params.id) });
});

router.delete('/admin/promos/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM promos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'promo_tidak_ditemukan' });
  db.prepare('DELETE FROM promos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Banner iklan (dikelola dari Admin -> Banner Iklan) ----
const TEMA_BANNER = ['hijau', 'emas', 'kopi'];
router.get('/admin/banners', ownerOnly, (req, res) => {
  res.json({ banners: db.prepare('SELECT * FROM banners ORDER BY urutan, id').all() });
});
router.post('/admin/banners', ownerOnly, (req, res) => {
  const b = req.body || {};
  if (!String(b.judul || '').trim()) return res.status(400).json({ error: 'Judul banner wajib diisi' });
  const r = db
    .prepare(
      `INSERT INTO banners (judul, subjudul, gambar, tombol_teks, tautan, tema, aktif, urutan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.judul).trim(),
      String(b.subjudul || ''),
      String(b.gambar || ''),
      String(b.tombol_teks || ''),
      String(b.tautan || ''),
      TEMA_BANNER.includes(b.tema) ? b.tema : 'hijau',
      b.aktif === false || b.aktif === 0 ? 0 : 1,
      Number(b.urutan) || 0
    );
  res.json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(r.lastInsertRowid) });
});
router.patch('/admin/banners/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM banners WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'banner_tidak_ditemukan' });
  const b = req.body || {};
  db.prepare(
    `UPDATE banners SET judul = COALESCE(?, judul), subjudul = COALESCE(?, subjudul),
       gambar = COALESCE(?, gambar), tombol_teks = COALESCE(?, tombol_teks),
       tautan = COALESCE(?, tautan), tema = COALESCE(?, tema),
       aktif = COALESCE(?, aktif), urutan = COALESCE(?, urutan)
     WHERE id = ?`
  ).run(
    b.judul === undefined ? null : String(b.judul).trim(),
    b.subjudul === undefined ? null : String(b.subjudul),
    b.gambar === undefined ? null : String(b.gambar),
    b.tombol_teks === undefined ? null : String(b.tombol_teks),
    b.tautan === undefined ? null : String(b.tautan),
    b.tema === undefined ? null : TEMA_BANNER.includes(b.tema) ? b.tema : 'hijau',
    b.aktif === undefined ? null : b.aktif ? 1 : 0,
    b.urutan === undefined ? null : Number(b.urutan) || 0,
    req.params.id
  );
  res.json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id) });
});
router.delete('/admin/banners/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM banners WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'banner_tidak_ditemukan' });
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// QR code per meja: untuk dicetak & ditempel di meja. Dipindai -> buka halaman
// pesan dengan nomor meja sudah terisi (?meja=NOMOR). Base URL diambil dari
// settings.public_base_url (isi dengan IP LAN komputer toko).
router.get('/admin/tables/qr', ownerOnly, async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const base = String(getSetting('public_base_url', 'http://localhost:3000') || 'http://localhost:3000').replace(/\/+$/, '');
    const rows = db.prepare('SELECT id, number FROM tables WHERE active = 1 ORDER BY id').all();
    const hasil = [];
    for (const t of rows) {
      const url = base + '/?meja=' + encodeURIComponent(t.number);
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 400 });
      hasil.push({
        id: t.id,
        number: t.number,
        url,
        qr: 'data:image/svg+xml,' + encodeURIComponent(svg),
      });
    }
    res.json({ base_url: base, tables: hasil });
  } catch (e) {
    res.status(500).json({ error: 'Gagal membuat QR: ' + (e.message || e) });
  }
});

// -- Pengguna --
const USER_FIELDS = 'id, username, name, role, active';

router.get('/admin/users', ownerOnly, (req, res) => {
  const rows = db.prepare(`SELECT ${USER_FIELDS} FROM users ORDER BY id`).all();
  res.json({ users: rows });
});

router.post('/admin/users', ownerOnly, (req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim();
  const name = String(b.name || '').trim();
  if (!username) return res.status(400).json({ error: 'Username wajib diisi' });
  if (!name) return res.status(400).json({ error: 'Nama wajib diisi' });
  if (!b.password || String(b.password).length < 6) {
    return res.status(400).json({ error: 'Password wajib diisi (minimal 6 karakter)' });
  }
  const role = b.role || 'kasir';
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid (owner, kasir, barista)' });
  }
  try {
    const info = db
      .prepare('INSERT INTO users (username, password_hash, name, role, active) VALUES (?, ?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(String(b.password), 10), name, role, b.active === 0 || b.active === false ? 0 : 1);
    res.status(201).json({
      user: db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(info.lastInsertRowid),
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username sudah dipakai' });
    }
    throw e;
  }
});

router.patch('/admin/users/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'pengguna_tidak_ditemukan' });
  const b = req.body || {};
  if (b.username !== undefined && !String(b.username).trim()) {
    return res.status(400).json({ error: 'Username tidak boleh kosong' });
  }
  if (b.name !== undefined && !String(b.name).trim()) {
    return res.status(400).json({ error: 'Nama tidak boleh kosong' });
  }
  if (b.role !== undefined && !USER_ROLES.includes(b.role)) {
    return res.status(400).json({ error: 'Role tidak valid (owner, kasir, barista)' });
  }
  if (b.password !== undefined && b.password !== '' && String(b.password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  if (Number(req.params.id) === req.session.userId && b.active !== undefined && !b.active) {
    return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri' });
  }
  try {
    db.prepare(
      `UPDATE users SET
         username = COALESCE(?, username), name = COALESCE(?, name),
         role = COALESCE(?, role), active = COALESCE(?, active)
       WHERE id = ?`
    ).run(
      b.username === undefined ? null : String(b.username).trim(),
      b.name === undefined ? null : String(b.name).trim(),
      b.role === undefined ? null : b.role,
      b.active === undefined ? null : b.active ? 1 : 0,
      req.params.id
    );
    if (b.password) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(bcrypt.hashSync(String(b.password), 10), req.params.id);
    }
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username sudah dipakai' });
    }
    throw e;
  }
  res.json({
    user: db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(req.params.id),
  });
});

router.delete('/admin/users/:id', ownerOnly, (req, res) => {
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'pengguna_tidak_ditemukan' });
  if (Number(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// -- Pengaturan --
const KNOWN_SETTINGS = [
  'store_name', 'store_tagline', 'store_description', 'store_address', 'store_phone',
  'store_hours',
  'tax_percent', 'service_percent', 'currency',
  'public_base_url',
  'receipt_header', 'receipt_footer',
  'printer_provider', 'printer_width',
  'payment_methods',
  'order_types',
  'social_links',
];

router.get('/admin/settings', ownerOnly, (req, res) => {
  res.json({ settings: getAllSettings() });
});

router.patch('/admin/settings', ownerOnly, (req, res) => {
  const b = req.body || {};
  const kunci = Object.keys(b);
  if (kunci.length === 0) {
    return res.status(400).json({ error: 'Tidak ada pengaturan yang dikirim' });
  }
  for (const k of kunci) {
    if (!KNOWN_SETTINGS.includes(k)) {
      return res.status(400).json({ error: `Pengaturan tidak dikenal: ${k}` });
    }
  }
  if (b.tax_percent !== undefined) {
    const v = Number(b.tax_percent);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: 'tax_percent harus bilangan bulat 0-100' });
    }
  }
  if (b.service_percent !== undefined) {
    const v = Number(b.service_percent);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: 'service_percent harus bilangan bulat 0-100' });
    }
  }
  if (b.printer_width !== undefined) {
    const v = Number(b.printer_width);
    if (!Number.isInteger(v) || v <= 0) {
      return res.status(400).json({ error: 'printer_width harus bilangan bulat > 0' });
    }
  }
  if (b.payment_methods !== undefined) {
    // Boleh dikirim sebagai array [{id,label}] atau string JSON-nya.
    let daftar = b.payment_methods;
    if (typeof daftar === 'string') {
      try {
        daftar = JSON.parse(daftar);
      } catch {
        return res.status(400).json({ error: 'payment_methods harus JSON valid' });
      }
    }
    if (!Array.isArray(daftar) || daftar.length === 0) {
      return res.status(400).json({ error: 'payment_methods minimal satu metode' });
    }
    for (const m of daftar) {
      if (!m || typeof m.id !== 'string' || !m.id.trim()) {
        return res.status(400).json({ error: 'Setiap metode pembayaran wajib punya id' });
      }
    }
    b.payment_methods = JSON.stringify(
      daftar.map((m) => ({ id: m.id.trim(), label: String(m.label || m.id).trim() }))
    );
  }

  if (b.order_types !== undefined) {
    // Boleh dikirim sebagai array ["dine-in","takeaway"] atau string JSON-nya.
    let daftar = b.order_types;
    if (typeof daftar === 'string') {
      try {
        daftar = JSON.parse(daftar);
      } catch {
        return res.status(400).json({ error: 'order_types harus JSON valid' });
      }
    }
    const valid = (Array.isArray(daftar) ? daftar : [])
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => ORDER_TYPES_KNOWN.includes(t));
    const unik = [...new Set(valid)];
    if (unik.length === 0) {
      return res.status(400).json({ error: 'order_types minimal satu tipe (dine-in, takeaway, delivery)' });
    }
    b.order_types = JSON.stringify(unik);
  }

  if (b.social_links !== undefined) {
    // Boleh dikirim sebagai object {instagram,tiktok,facebook,whatsapp} atau string JSON-nya.
    let tautan = b.social_links;
    if (typeof tautan === 'string') {
      try {
        tautan = JSON.parse(tautan);
      } catch {
        return res.status(400).json({ error: 'social_links harus JSON valid' });
      }
    }
    if (!tautan || typeof tautan !== 'object' || Array.isArray(tautan)) {
      return res.status(400).json({ error: 'social_links harus object' });
    }
    b.social_links = JSON.stringify({
      instagram: String(tautan.instagram || '').trim(),
      tiktok: String(tautan.tiktok || '').trim(),
      facebook: String(tautan.facebook || '').trim(),
      whatsapp: String(tautan.whatsapp || '').trim(),
    });
  }

  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const trx = db.transaction(() => {
    for (const k of kunci) upsert.run(k, String(b[k]));
  });
  trx();
  res.json({ settings: getAllSettings() });
});

module.exports = router;
