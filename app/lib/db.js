// Koneksi SQLite (better-sqlite3) + skema + seed awal.
// Data seed = DATA ASLI Nordic by The Founders (Surabaya).
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const { buatPesanan } = require('./pesanan');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'kopi.db'));

const SKEMA = `
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES categories(id), name TEXT NOT NULL, description TEXT DEFAULT '', price INTEGER NOT NULL, image TEXT DEFAULT '/img/placeholder.svg', active INTEGER DEFAULT 1, is_best_seller INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS option_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'single', required INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS options (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL REFERENCES option_groups(id), name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS item_option_groups (item_id INTEGER NOT NULL REFERENCES menu_items(id), group_id INTEGER NOT NULL REFERENCES option_groups(id), sort_order INTEGER DEFAULT 0, PRIMARY KEY (item_id, group_id));
CREATE TABLE IF NOT EXISTS tables (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'kasir', active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_phone TEXT DEFAULT '', order_type TEXT NOT NULL, table_id INTEGER REFERENCES tables(id), address TEXT DEFAULT '', note TEXT DEFAULT '', subtotal INTEGER NOT NULL, discount INTEGER DEFAULT 0, tax INTEGER DEFAULT 0, service INTEGER DEFAULT 0, total INTEGER NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'belum_bayar', status TEXT NOT NULL DEFAULT 'baru', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), menu_item_id INTEGER REFERENCES menu_items(id), item_name TEXT NOT NULL, qty INTEGER NOT NULL, base_price INTEGER NOT NULL, note TEXT DEFAULT '', subtotal INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS order_item_options (id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), option_id INTEGER, group_name TEXT NOT NULL, option_name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS promos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', menu_item_id INTEGER REFERENCES menu_items(id), promo_price INTEGER, discount_percent INTEGER DEFAULT 0, starts_at TEXT, ends_at TEXT, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT, judul TEXT NOT NULL, subjudul TEXT DEFAULT '', gambar TEXT DEFAULT '', tombol_teks TEXT DEFAULT '', tautan TEXT DEFAULT '', tema TEXT DEFAULT 'hijau', aktif INTEGER DEFAULT 1, urutan INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

db.exec(SKEMA);

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---------------------------------------------------------------------------
// SEED — hanya dijalankan bila tabel users masih kosong.
// ---------------------------------------------------------------------------
function seed() {
  const jumlahUser = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (jumlahUser > 0) return;

  const IMG = '/img/placeholder.svg'; // gambar default bila foto produk belum dipasang

  const jalankan = db.transaction(() => {
    // -- Pengaturan toko (data asli Nordic by The Founders) --
    const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const pengaturan = [
      ['store_name', 'Nordic by The Founders'],
      ['store_tagline', 'Artisan specialty coffee slow bar & roastery — Surabaya'],
      [
        'store_description',
        'carefully curated single origin coffee, matcha, & kombucha in citraland west surabaya',
      ],
      [
        'store_address',
        'Jl. Puri Widya Kencana No.JT1/28, Lidah Kulon, Kec. Lakarsantri, Surabaya, Jawa Timur 60213',
      ],
      ['store_phone', ''],
      ['store_hours', 'Tutup 19.00 (takeaway 09.00–17.00)'],
      ['tax_percent', '10'],
      ['service_percent', '0'],
      ['currency', 'Rp'],
      ['receipt_header', 'Terima kasih atas kunjungan Anda'],
      ['receipt_footer', 'Nordic by The Founders — Citraland, Surabaya Barat'],
      ['printer_provider', 'browser'],
      ['printer_width', '58'],
      // Alamat publik server untuk QR meja (diisi IP LAN komputer toko, mis. http://192.168.1.10:3000).
      ['public_base_url', 'http://localhost:3000'],
      // Metode pembayaran KONFIGURABEL (JSON). Diubah lewat halaman Pengaturan.
      [
        'payment_methods',
        JSON.stringify([
          { id: 'qris', label: 'QRIS' },
          { id: 'tunai', label: 'Cash' },
          { id: 'transfer', label: 'Bank Transfer' },
        ]),
      ],
      // Tipe pesanan KONFIGURABEL (JSON array). Diubah lewat halaman Pengaturan.
      // Default: Dine-In + Take Away (delivery nonaktif).
      ['order_types', JSON.stringify(['dine-in', 'takeaway'])],
      // Tautan media sosial KONFIGURABEL (JSON object). Diubah lewat halaman Pengaturan.
      ['social_links', JSON.stringify({ instagram: '', tiktok: '', facebook: '', whatsapp: 'https://wa.me/62895385381158' })],
    ];
    for (const [k, v] of pengaturan) set.run(k, v);

    // -- Kategori --
    const insKat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    const daftarKat = [
      'Coffee',
      'Non Coffee',
      'Artisan Tea',
      'Exotic Tea',
      'Omakase',
      'Small & Bites',
      'Retail — Founders Roast Home',
    ];
    daftarKat.forEach((n, i) => insKat.run(n, i + 1));
    const kat = {};
    for (const r of db.prepare('SELECT id, name FROM categories').all()) kat[r.name] = r.id;

    // -- Menu: [kategori, nama, deskripsi, harga, gambar, best_seller] --
    const insMenu = db.prepare(
      `INSERT INTO menu_items
         (category_id, name, description, price, image, is_best_seller, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const daftarMenu = [
      // Coffee
      ['Coffee', 'WHITE/BLACK', 'Signature coffee — tersedia White atau Black', 55000, '/img/latte.jpg', 1],
      ['Coffee', 'COLD FASHION', 'Kopi dingin gaya old fashioned', 65000, '/img/iced-coffee-cream-top.jpg', 0],
      ['Coffee', 'CHERRISH', 'Kopi dengan sentuhan cherry', 65000, IMG, 0],
      ['Coffee', 'ORANGE ENVY', 'Kopi dengan kesegaran jeruk', 55000, '/img/blend-solara.jpg', 0],
      ['Coffee', 'FLIGHT', 'Flight tasting beberapa single origin', 85000, IMG, 0],
      ['Coffee', 'FLIGHT EXOTIC', 'Flight tasting single origin eksotis', 100000, IMG, 0],
      ['Coffee', 'SIGNATURE COLD BREW', 'Cold brew andalan', 65000, '/img/signature-iced.jpg', 0],
      // Non Coffee
      ['Non Coffee', 'MACHA LATTE', 'Matcha latte — pilih sajian panas atau dingin', 40000, IMG, 0],
      ['Non Coffee', 'CHOCOLATE', 'Chocolate — pilih sajian panas atau dingin', 40000, IMG, 0],
      ['Non Coffee', 'CLARIFIED GUAVA', 'Minuman guava jernih yang menyegarkan', 50000, IMG, 0],
      ['Non Coffee', 'TROPICAL SUNRISE', 'Mocktail tropis', 50000, IMG, 0],
      ['Non Coffee', 'COCONUT MACHA', 'Matcha dengan kelapa', 55000, IMG, 0],
      ['Non Coffee', 'WANDA & COSMO', 'Signature mocktail', 65000, '/img/moctail.jpg', 0],
      ['Non Coffee', 'CLEO WATER', 'Air mineral premium', 30000, IMG, 0],
      // Artisan Tea
      ['Artisan Tea', 'ARTISAN BLEND TEA', 'Teh artisan blend — sudah termasuk 1x refill', 40000, IMG, 0],
      // Exotic Tea
      ['Exotic Tea', 'LONGBOARD GEISHA FLOWER TEA', 'Exotic flower tea — pilih karakter medium atau light', 400000, IMG, 0],
      // Omakase
      ['Omakase', 'THE FOUNDERS COURSE', 'Nett — 5 course: Welcome Drink, Split Espresso & Freeze Distilled Milk, Exotic Filter, Mocktail & Sweet Pairing', 325000, IMG, 0],
      // Small & Bites
      ['Small & Bites', 'Croissant Plain', 'Croissant klasik yang renyah', 28000, IMG, 0],
      ['Small & Bites', 'Croissant Crunchy Gianduja', 'Croissant dengan gianduja renyah', 30000, IMG, 0],
      ['Small & Bites', 'Croissant Strawberry', 'Croissant dengan stroberi', 30000, IMG, 0],
      ['Small & Bites', 'Croissant Butter', 'Croissant butter yang gurih', 30000, IMG, 0],
      ['Small & Bites', 'Croissant Almond', 'Croissant dengan taburan almond', 43000, IMG, 0],
      ['Small & Bites', 'Grilled Cheese Original', 'Roti panggang keju klasik', 65000, IMG, 0],
      ['Small & Bites', 'Grilled Cheese Smoked Beef', 'Roti panggang keju dengan smoked beef', 80000, IMG, 0],
      ['Small & Bites', 'Grilled Cheese Kimchi', 'Roti panggang keju dengan kimchi', 90000, IMG, 1],
      ['Small & Bites', 'Monkey Chocolate', 'Pisang dengan coklat', 43000, IMG, 0],
      ['Small & Bites', 'Cheesecake', 'Cheesecake lembut', 55000, IMG, 0],
      ['Small & Bites', 'Caramel Pudding', 'Puding karamel yang manis', 35000, IMG, 0],
      // Retail — Founders Roast Home (per tube)
      ['Retail — Founders Roast Home', 'Semendo 120H HSN', 'Founders Roast Home — kemasan tube', 60000, IMG, 0],
      ['Retail — Founders Roast Home', 'Solok Natural', 'Founders Roast Home — kemasan tube', 65000, IMG, 0],
      ['Retail — Founders Roast Home', 'Blueberry Milk Tea', 'Founders Roast Home — kemasan tube', 65000, IMG, 0],
      ['Retail — Founders Roast Home', 'Ciwidey Best Nano Lot', 'Founders Roast Home — kemasan tube', 75000, IMG, 0],
      ['Retail — Founders Roast Home', 'Costa Rica Mozart Raisin Honey', 'Founders Roast Home — kemasan tube', 100000, IMG, 0],
      ['Retail — Founders Roast Home', 'Mt. Mekarwangi', 'Founders Roast Home — kemasan tube', 85000, IMG, 0],
      ['Retail — Founders Roast Home', 'Yunnan Catimor', 'Founders Roast Home — kemasan tube', 110000, IMG, 0],
      ['Retail — Founders Roast Home', 'Inama Geisha Janson Alpes', 'Founders Roast Home — kemasan tube', 170000, IMG, 0],
      ['Retail — Founders Roast Home', 'Roma Nativo', 'Founders Roast Home — kemasan tube', 125000, IMG, 0],
      ['Retail — Founders Roast Home', 'Paraiso Plum', 'Founders Roast Home — kemasan tube', 130000, IMG, 0],
      ['Retail — Founders Roast Home', 'Raspberry Candy', 'Founders Roast Home — kemasan tube', 95000, IMG, 0],
      ['Retail — Founders Roast Home', 'Additional Eugenioides', 'Founders Roast Home — kemasan tube', 50000, IMG, 0],
    ];
    daftarMenu.forEach(([k, nama, desk, harga, gambar, best], i) => {
      insMenu.run(kat[k], nama, desk, harga, gambar, best, i + 1);
    });
    const menu = {};
    for (const r of db.prepare('SELECT id, name FROM menu_items').all()) menu[r.name] = r.id;

    // -- Promo / flash sale contoh (bertanda SAMPLE, kelola via admin) --
    // Catatan: seed ini HARUS di sini (setelah menu dibuat) agar fresh-install ikut dapat promo contoh.
    // Memakai item menu ASLI (bukan item [SAMPLE]) supaya selalu valid di instalasi baru.
    const insPromo = db.prepare(
      `INSERT INTO promos (title, description, menu_item_id, promo_price, discount_percent, starts_at, ends_at, active, sort_order)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now', '+3 days'), 1, ?)`
    );
    if (menu['WHITE/BLACK']) insPromo.run('Flash Sale: WHITE/BLACK', '[SAMPLE] Promo contoh — atur via admin.', menu['WHITE/BLACK'], 45000, 0, 1);
    if (menu['MACHA LATTE']) insPromo.run('Hemat 15%: Macha Latte', '[SAMPLE] Promo contoh — atur via admin.', menu['MACHA LATTE'], null, 15, 2);

    // -- Grup opsi --
    // Catatan: ada DUA grup bernama "Sajian" karena selisih harga Dingin berbeda
    // (Macha Latte +10000, Chocolate +15000); price_delta tersimpan per opsi.
    const insGrup = db.prepare(
      'INSERT INTO option_groups (name, type, required, sort_order) VALUES (?, ?, ?, ?)'
    );
    const idGrupSajianMacha = insGrup.run('Sajian', 'single', 1, 1).lastInsertRowid;
    const idGrupSajianChoc = insGrup.run('Sajian', 'single', 1, 2).lastInsertRowid;
    const idGrupGula = insGrup.run('Level Gula', 'single', 0, 3).lastInsertRowid;
    const idGrupEs = insGrup.run('Level Es', 'single', 0, 4).lastInsertRowid;
    const idGrupTambahan = insGrup.run('Tambahan', 'multiple', 0, 5).lastInsertRowid;
    const idGrupVarian = insGrup.run('Varian', 'single', 1, 6).lastInsertRowid;
    const idGrupKarakter = insGrup.run('Karakter', 'single', 1, 7).lastInsertRowid;

    const insOpsi = db.prepare(
      'INSERT INTO options (group_id, name, price_delta, sort_order) VALUES (?, ?, ?, ?)'
    );
    const opsiId = {}; // opsiId[groupId][nama] = id
    const tambahOpsi = (idG, daftar) => {
      opsiId[idG] = {};
      daftar.forEach(([nama, delta], i) => {
        opsiId[idG][nama] = insOpsi.run(idG, nama, delta, i + 1).lastInsertRowid;
      });
    };
    tambahOpsi(idGrupSajianMacha, [['Panas', 0], ['Dingin', 10000]]);
    tambahOpsi(idGrupSajianChoc, [['Panas', 0], ['Dingin', 15000]]);
    tambahOpsi(idGrupGula, [['0%', 0], ['30%', 0], ['50%', 0], ['70%', 0], ['100%', 0]]);
    tambahOpsi(idGrupEs, [['Normal', 0], ['Sedikit', 0], ['Tanpa Es', 0]]);
    tambahOpsi(idGrupTambahan, [['Extra Shot', 10000], ['Susu Oat', 10000], ['Susu Almond', 10000]]);
    tambahOpsi(idGrupVarian, [['PINA COLADA', 0], ['MISTY ROSE', 0], ['BLACKFOREST', 0]]);
    tambahOpsi(idGrupKarakter, [['MEDIUM', 0], ['LIGHT', 0]]);

    // -- Hubungkan grup opsi ke item yang relevan --
    const insHub = db.prepare(
      'INSERT INTO item_option_groups (item_id, group_id, sort_order) VALUES (?, ?, ?)'
    );
    const hubungkan = (namaItem, idG, urutan) => insHub.run(menu[namaItem], idG, urutan);
    const kopiItems = [
      'WHITE/BLACK', 'COLD FASHION', 'CHERRISH', 'ORANGE ENVY',
      'FLIGHT', 'FLIGHT EXOTIC', 'SIGNATURE COLD BREW',
    ];
    for (const nama of kopiItems) {
      hubungkan(nama, idGrupGula, 1);
      hubungkan(nama, idGrupEs, 2);
      hubungkan(nama, idGrupTambahan, 3);
    }
    hubungkan('MACHA LATTE', idGrupSajianMacha, 1);
    hubungkan('CHOCOLATE', idGrupSajianChoc, 1);
    hubungkan('ARTISAN BLEND TEA', idGrupVarian, 1);
    hubungkan('LONGBOARD GEISHA FLOWER TEA', idGrupKarakter, 1);

    // -- Meja 1..8 --
    const insMeja = db.prepare('INSERT INTO tables (number) VALUES (?)');
    for (let n = 1; n <= 8; n++) insMeja.run(String(n));
    const meja = {};
    for (const r of db.prepare('SELECT id, number FROM tables').all()) meja[r.number] = r.id;

    // -- Pengguna awal (kredensial contoh — WAJIB diganti, lihat README) --
    const insUser = db.prepare(
      'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)'
    );
    insUser.run('owner', bcrypt.hashSync('admin123', 10), 'Pemilik', 'owner');
    insUser.run('kasir', bcrypt.hashSync('kasir123', 10), 'Kasir', 'kasir');

    // -- Contoh pesanan (data asli) via buatPesanan --
    const o = (idG, nama) => opsiId[idG][nama];

    const p1 = buatPesanan(db, {
      customer_name: 'Budi Santoso',
      customer_phone: '0812-1111-2222',
      order_type: 'dine-in',
      table_id: meja['3'],
      payment_method: 'qris',
      note: 'Diantar ke meja, terima kasih',
      items: [
        {
          menu_item_id: menu['WHITE/BLACK'],
          qty: 1,
          options: [o(idGrupGula, '50%'), o(idGrupTambahan, 'Extra Shot')],
        },
        { menu_item_id: menu['Croissant Butter'], qty: 1, options: [] },
      ],
    });

    const p2 = buatPesanan(db, {
      customer_name: 'Sinta',
      order_type: 'takeaway',
      payment_method: 'tunai',
      items: [
        {
          menu_item_id: menu['MACHA LATTE'],
          qty: 1,
          options: [o(idGrupSajianMacha, 'Dingin')],
        },
        { menu_item_id: menu['Grilled Cheese Smoked Beef'], qty: 1, options: [] },
      ],
    });
    db.prepare("UPDATE orders SET status = 'diproses' WHERE id = ?").run(p2.id);

    const p3 = buatPesanan(db, {
      customer_name: 'Andi',
      customer_phone: '0813-3333-4444',
      order_type: 'delivery',
      address: 'Jl. Puri Widya Kencana No. 10',
      payment_method: 'transfer',
      items: [
        {
          menu_item_id: menu['CHOCOLATE'],
          qty: 1,
          options: [o(idGrupSajianChoc, 'Panas')],
        },
        { menu_item_id: menu['Semendo 120H HSN'], qty: 1, options: [] },
      ],
    });
    db.prepare(
      `UPDATE orders
       SET status = 'selesai', payment_status = 'lunas',
           created_at = datetime('now', '-1 day', 'localtime'),
           updated_at = datetime('now', '-1 day', 'localtime')
       WHERE id = ?`
    ).run(p3.id);

    return { p1: p1.id, p2: p2.id, p3: p3.id };
  });

  const hasil = jalankan();
  console.log('[db] Seed awal selesai (data Nordic by The Founders, 3 pesanan contoh).');
  return hasil;
}

// Export dipasang SEBELUM seed() dipanggil, karena buatPesanan() (dipakai seed)
// me-lazy-require('./db') di dalam buatKodePesanan().
module.exports = { db, getSetting, getAllSettings };

seed();


// ---------------------------------------------------------------------------
// MIGRASI is_new (2026-09-30): badge "Baru" untuk produk baru.
// Idempoten — aman dijalankan setiap start. Mengonversi penanda manual
// "BARU —" di deskripsi menjadi flag resmi + membersihkan deskripsi.
// ---------------------------------------------------------------------------
function migrasiIsNew() {
  const cols = db.prepare('PRAGMA table_info(menu_items)').all().map((c) => c.name);
  if (!cols.includes('is_new')) {
    db.exec('ALTER TABLE menu_items ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0');
  }
  db.prepare("UPDATE menu_items SET is_new = 1 WHERE is_new = 0 AND description LIKE 'BARU%'").run();
  db.prepare("UPDATE menu_items SET description = TRIM(SUBSTR(description, 8)) WHERE description LIKE 'BARU \u2014%'").run();
}

migrasiIsNew();

// Setting baru yang diperkenalkan belakangan: pastikan ada di DB lama (tanpa menimpa pilihan admin).
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('order_types', '["dine-in","takeaway"]')`).run();
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('social_links', '{"instagram":"","tiktok":"","facebook":"","whatsapp":"https://wa.me/62895385381158"}')`).run();
