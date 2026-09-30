# Catatan Pengembang

Dokumen internal untuk pengembangan tahap berikutnya. Bahasa: Indonesia.

## Struktur Folder

```
app/
├── server.js                 # Entry point: Express, session, static, rute halaman
├── config.js                 # PORT & SESSION_SECRET (dari env)
├── package.json              # Dependensi: express, express-session, bcrypt, better-sqlite3
├── .env.example              # Contoh variabel environment
├── README.md                 # Panduan instalasi untuk orang toko (non-teknis)
├── CATATAN_PENGEMBANG.md     # File ini
├── data/
│   └── kopi.db               # Database SQLite (dibuat otomatis saat pertama jalan)
├── lib/
│   ├── db.js                 # Buka DB + skema + seed DATA ASLI Nordic by The Founders
│   ├── pesanan.js            # Logika bisnis: validasi, hitung total, simpan pesanan
│   ├── auth.js               # Middleware requireLogin & requireRole
│   ├── printer.js            # ABSTRAKSI cetak struk (baca di bawah)
│   └── printer-providers/
│       ├── browser.js        # Provider default: kembalikan URL halaman struk
│       └── escpos.js         # Provider ESC/POS thermal USB/LAN (terimplementasi 2026-09-30)
├── routes/
│   └── api.js                # Seluruh REST API di bawah /api/*
└── public/
    ├── index.html            # Halaman pemesanan pelanggan (/)
    ├── tentang.html          # Profil toko: deskripsi, alamat, jam, galeri (/tentang)
    ├── lacak.html            # Lacak pesanan (/lacak)
    ├── css/style.css         # Gaya halaman pelanggan (tema Nordic: krem + hijau tua + emas)
    ├── img/                  # Foto interior/produk (lihat "Pemetaan Foto Produk" di bawah)
    ├── img/placeholder.svg   # Gambar menu default (sudah di-retheme ke palet Nordic)
    ├── js/
    │   ├── app.js            # Logika pemesanan pelanggan
    │   ├── lacak.js          # Logika lacak pesanan
    │   ├── admin-core.js     # Helper bersama admin (api, guard, sidebar, toast)
    │   └── printer-client.js # window.cetakOtomatis() di sisi browser
    └── admin/
        ├── login.html        # /admin/login
        ├── index.html        # Dashboard (/admin)
        ├── pesanan.html      # Kelola pesanan (/admin/pesanan)
        ├── kds.html          # Kitchen Display (/admin/dapur)
        ├── menu.html         # Kelola kategori/menu/opsi (/admin/menu)
        ├── laporan.html      # Laporan (/admin/laporan)
        ├── pengaturan.html  # Pengaturan toko & printer (/admin/pengaturan)
        ├── pengguna.html     # Kelola user (/admin/pengguna)
        ├── struk.html        # Halaman cetak struk (dibuka otomatis)
        ├── js/*.js           # Satu file JS per halaman admin
        └── (css dipakai bersama dari /css/)
```

## Skema Database (ringkas)

`categories` → `menu_items` → `item_option_groups` → `option_groups` → `options`;
`orders` → `order_items` → `order_item_options`;
`tables`, `users` (role: owner/kasir/barista, password bcrypt),
`settings` (key-value: store_name, tax_percent, printer_provider, ...).

Status pesanan: `baru` → `dikonfirmasi` → `diproses` → `siap` → `selesai`
(`dibatalkan` = terminal). Lihat peta transisi di `routes/api.js`.

## Data Seed: Nordic by The Founders (data asli)

`lib/db.js` me-seed **data asli toko** saat tabel `users` kosong:

- **Pengaturan**: nama "Nordic by The Founders", tagline, alamat lengkap
  (Jl. Puri Widya Kencana No.JT1/28, Lidah Kulon, Lakarsantri, Surabaya 60213),
  jam operasional "Tutup 19.00 (takeaway 09.00–17.00)", pajak 10%, printer
  browser 58mm, `payment_methods` default QRIS/Tunai/Transfer.
- **7 kategori, 40 item** (Coffee 7, Non Coffee 7, Artisan Tea 1, Exotic Tea 1,
  Omakase 1, Small & Bites 11, Retail — Founders Roast Home 12) — lihat daftar
  lengkap di `lib/db.js`.
- **7 grup opsi, 20 opsi**:
  - "Sajian" ×2 grup (wajib, single): karena selisih harga Dingin berbeda —
    Macha Latte +10rb vs Chocolate +15rb. Price delta disimpan per opsi, jadi
    dua grup bernama sama tapi id berbeda.
  - "Level Gula" (0/30/50/70/100%), "Level Es" (Normal/Sedikit/Tanpa Es),
    "Tambahan" (multiple: Extra Shot/Susu Oat/Susu Almond +10rb) — terhubung
    ke 7 item kopi.
  - "Varian" (wajib: PINA COLADA/MISTY ROSE/BLACKFOREST) → ARTISAN BLEND TEA.
  - "Karakter" (wajib: MEDIUM/LIGHT) → LONGBOARD GEISHA FLOWER TEA.
- **Meja 1–8**, 2 user contoh (owner/admin123, kasir/kasir123 — WAJIB diganti),
  3 pesanan contoh (baru/diproses/selesai kemarin).

## Metode Pembayaran Konfigurabel

- Disimpan sebagai JSON di `settings.payment_methods`: `[{id, label}, ...]`.
- `GET /api/info` mengembalikannya sebagai array objek; `POST /api/orders`
  memvalidasi `payment_method` terhadap daftar ini (bukan hardcode).
- Halaman **Pengaturan → Metode Pembayaran**: textarea satu baris per metode
  format `id | Label`. Perubahan berlaku **tanpa restart server**.
- Fallback: bila kosong/rusak → QRIS/Tunai/Transfer.

## Pemetaan Foto Produk (public/img/)

Foto asli dari toko sudah disalin; yang belum ada foto produk spesifik memakai
`placeholder.svg`. Tabel ini tebakan dari nama file (manifest di `incoming-photos/manifest.json`);
**perlu konfirmasi pemilik toko** sebelum dianggap final.

| Foto | Dipasang ke menu | Status |
|------|------------------|--------|
| `latte.jpg` | WHITE/BLACK | tebakan |
| `blend-solara.jpg` | ORANGE ENVY | tebakan |
| `iced-coffee-cream-top.jpg` | COLD FASHION | tebakan |
| `signature-iced.jpg` | SIGNATURE COLD BREW | tebakan |
| `moctail.jpg` | WANDA & COSMO | tebakan |
| `hero-interior.jpg`, `interior-marble.jpg`, dll. | Halaman Tentang (galeri) | terpasang |

⚠️ **Diskrepansi harga perlu konfirmasi**: manifest foto menyebut
"Raspberry Candy 25K", tetapi data menu eksplisit dari pemilik menyebut
Rp95.000. Seed memakai **Rp95.000** (mengikuti data menu eksplisit).

## Mengganti Data (pasca-seed)

| Data | Cara ganti |
|------|-----------|
| Nama toko, alamat, telepon, tagline, jam | Dashboard → **Pengaturan** (atau langsung tabel `settings`) |
| Metode pembayaran | Dashboard → **Pengaturan** → Metode Pembayaran |
| Menu, harga, foto, kategori | Dashboard → **Menu**. Foto: copy file ke `public/img/`, isi kolom gambar dengan `/img/namafile.jpg` |
| Opsi per menu (ukuran, gula, susu, dsb.) | Dashboard → **Menu** → seksi Grup Opsi; centang grup yang berlaku per menu |
| Nomor meja | Tabel `tables` (atau endpoint `/api/admin/tables`; UI CRUD meja opsional) |
| Pajak & layanan | **Pengaturan** → Pajak % / Layanan % |
| Teks header/footer struk | **Pengaturan** |
| Akun kasir/barista | Dashboard → **Pengguna** (role owner). Ganti password contoh SEGERA. |
| Logo | Simpan sebagai `public/img/logo.png`, lalu sesuaikan `<img>` di header (tahap lanjutan: field setting `logo_url`) |

Data contoh di-seed otomatis oleh `lib/db.js` **hanya bila tabel `users` kosong**.
Untuk reset total: hentikan server, hapus `data/kopi.db`, jalankan lagi.

## Subsistem Printer (abstraksi)

Alur cetak saat ini:
1. Kasir menekan **"Konfirmasi & Cetak"** → `PATCH /api/admin/orders/:id {status:'dikonfirmasi'}`.
2. Route memanggil `cetakStruk(orderId)` dari `lib/printer.js`.
3. `printer.js` membaca `settings.printer_provider` (default `browser`),
   me-load `lib/printer-providers/<nama>.js`, memanggil `provider.cetak(dataStruk)`.
4. Provider `browser` mengembalikan `{ mode:'browser', url:'/admin/struk.html?id=..' }`;
   `public/js/printer-client.js` → `window.cetakOtomatis(print)` membuka URL itu
   di tab baru; `struk.html` me-render struk lalu otomatis `window.print()`.

**Menambah provider baru (mis. ESC/POS thermal printer USB/LAN) TANPA mengubah
kode pemanggil:**
1. Provider `lib/printer-providers/escpos.js` SUDAH terimplementasi (2026-09-30):
   cetak langsung ke printer thermal via USB (`npm install escpos escpos-usb`) atau
   LAN (`npm install escpos escpos-network` + setting `printer_host`/`printer_port`),
   format otomatis 58/80mm mengikuti setting `printer_width`, dan mengembalikan
   `ok:false` + pesan jelas (bukan crash) bila paket/driver printer belum siap.
2. Ubah `settings.printer_provider` menjadi `escpos` lewat halaman Pengaturan.
3. Selesai — `printer.js`, route, dan frontend tidak perlu disentuh, karena
   `cetakOtomatis()` di browser mengabaikan mode non-browser (sudah tercetak di server).

Struktur `dataStruk`: `{ store:{name,address,phone}, order:{...}, items:[...], totals:{subtotal,discount,tax,service,total}, header, footer, width }`.

## TODO Tahap Berikutnya

- [ ] Promo/diskon: tabel `promos` (kode voucher, %, nominal, masa berlaku) + input kode di checkout.
- [ ] QRIS dinamis per transaksi (integrasi payment gateway: Xendit/Midtrans) + webhook lunas otomatis.
- [ ] Notifikasi WhatsApp ke pelanggan saat status berubah (mis. via gateway WA).
- [ ] Mode kasir POS (kasir membuat pesanan langsung, bukan hanya dari pelanggan).
- [ ] Cetak otomatis ganda: struk pelanggan + tiket dapur (KDS print).
- [ ] Stok bahan & peringatan stok menipis.
- [ ] Multi-cabang (kolom `branch_id`).
- [ ] Backup otomatis `data/kopi.db` terjadwal.
- [ ] Session store persisten (saat ini MemoryStore — cukup untuk 1 komputer, tapi session hilang saat restart).
- [ ] Halaman struk pelanggan (nota digital setelah checkout) + unduh PDF.
- [ ] Logo upload via Pengaturan (saat ini manual copy file).
- [ ] Audit log (siapa mengubah apa di admin).
- [ ] Rate limiting di `/api/orders` anti-spam.

## Catatan Teknis

- Uang disimpan sebagai **integer rupiah** (tanpa desimal). Format tampilan via `Admin.rupiah()` / fungsi serupa di sisi pelanggan.
- Waktu DB: `datetime('now','localtime')` — mengikuti jam komputer toko.
- Semua aset lokal (tanpa CDN) agar jalan offline di LAN toko.
- Jangan commit `data/kopi.db` dan `node_modules/` (sudah di `.gitignore`).
- Dependensi: `better-sqlite3@^12` (butuh prebuild untuk Node 20+; di Node 18 gunakan v11).
