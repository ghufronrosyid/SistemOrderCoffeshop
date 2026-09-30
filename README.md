# SistemOrderCoffeshop

Sistem pemesanan online untuk coffee shop — dipakai di **Nordic by The Founders**
(Surabaya). Terdiri dari:

- **Halaman pelanggan** — lihat menu, kustomisasi tiap item (panas/dingin, gula,
  topping, dll), keranjang, checkout (Dine-In / Take Away), bayar via
  QRIS/Tunai/Transfer, dan lacak status pesanan secara live.
- **Dashboard admin/kasir** — kelola pesanan masuk, konfirmasi & cetak struk
  otomatis, kelola menu/kategori/opsi, promo & flash sale, banner iklan,
  laporan penjualan, QR code meja, pengaturan toko, dan kelola akun pengguna.
- **Kitchen Display (KDS)** — layar dapur untuk barista memantau dan
  memajukan status pesanan.

Seluruh teks tampilan memakai US English. Seluruh konfigurasi bisa diubah
lewat halaman admin — tanpa edit kode.

## Struktur Folder

```
SistemOrderCoffeshop/
├── README.md                  # File ini
├── .gitignore
├── app/                       # Aplikasi utama (Node.js + Express + SQLite)
│   ├── server.js              # Entry point
│   ├── config.js              # PORT & SESSION_SECRET (dari environment)
│   ├── package.json
│   ├── .env.example           # Contoh variabel environment
│   ├── README.md              # Panduan untuk orang toko
│   ├── CATATAN_PENGEMBANG.md  # Catatan teknis pengembang
│   ├── lib/                   # DB, logika pesanan, auth, printer
│   ├── routes/                # REST API (/api/*)
│   ├── data/                  # Database SQLite (dibuat otomatis, tidak ikut di-push)
│   └── public/                # Halaman pelanggan + halaman admin
└── demo/                      # Tiruan interaktif untuk preview (data contoh,
                               # tidak tersambung ke database)
    ├── demo-widget.html       # Demo halaman pelanggan
    └── demo-admin.html        # Demo panel admin
```

## Cara Instalasi (komputer toko — Windows)

1. Instal **Node.js LTS** (versi 20+) dari https://nodejs.org
   (pilih "Windows Installer", klik Next sampai selesai).
2. Download repo ini (Code → Download ZIP) lalu ekstrak, mis. ke `C:\SistemOrderCoffeshop`.
   (Atau `git clone https://github.com/ghufronrosyid/SistemOrderCoffeshop.git` bila sudah instal Git.)
3. Buka **Command Prompt**, masuk ke folder `app`:
   ```
   cd C:\SistemOrderCoffeshop\app
   ```
4. Instal dependensi (sekali saja, butuh internet):
   ```
   npm install
   ```
5. Jalankan server:
   ```
   npm start
   ```
6. Tunggu sampai muncul `Server kopi berjalan di http://localhost:3000`.

> Database (`data/kopi.db`) dibuat otomatis saat pertama dijalankan, sudah
> berisi data Nordic by The Founders: 47 menu, kategori, grup opsi, promo,
> banner, dan 2 akun contoh (lihat di bawah).
>
> Agar server otomatis jalan saat komputer dinyalakan, pakai Task Scheduler
> Windows atau NSSM (tahap lanjutan).
>
> 📖 Panduan instalasi versi super-detail untuk orang toko (non-teknis):
> [`PANDUAN_INSTALASI_TOKO.md`](PANDUAN_INSTALASI_TOKO.md).
>
> 🖼️ **Catatan gambar:** file foto di `app/public/img/` (gambar contoh
> sementara) tidak ikut di-push ke repo. Aplikasi otomatis menampilkan
> `img/placeholder.svg` bila gambar tidak ada. Upload foto asli toko ke
> folder tersebut — via GitHub web (drag & drop) atau copy langsung ke
> komputer toko.

## Cara Membuka

| Halaman             | Alamat                            |
|---------------------|-----------------------------------|
| Pemesanan pelanggan | http://localhost:3000             |
| Lacak pesanan       | http://localhost:3000/pesanan     |
| Tentang toko        | http://localhost:3000/tentang     |
| Login admin         | http://localhost:3000/admin/login |
| Dashboard admin     | http://localhost:3000/admin       |
| Layar dapur (KDS)   | http://localhost:3000/admin/kds    |

**Dari HP pelanggan / tablet kasir:** ganti `localhost` dengan **IP komputer toko**
di jaringan WiFi yang sama, mis. `http://192.168.1.10:3000`.
(Cara cek IP: di Command Prompt ketik `ipconfig`, lihat "IPv4 Address".)

> **Penting untuk QR meja:** agar QR code di meja mengarah ke alamat yang benar
> (bukan localhost), isi `public_base_url` di **Admin → Pengaturan** dengan
> alamat IP/domain komputer toko, mis. `http://192.168.1.10:3000`.

## Akun Bawaan (WAJIB diganti setelah instalasi!)

| Username | Password   | Peran                 |
|----------|------------|-----------------------|
| `owner`  | `admin123` | Pemilik (akses penuh) |
| `kasir`  | `kasir123` | Kasir (kelola pesanan)|

Segera ganti password lewat **Admin → Pengguna** setelah login pertama.

## Variabel Environment (opsional)

Salin `app/.env.example` menjadi `app/.env` lalu sesuaikan:

```
PORT=3000
SESSION_SECRET=isi-dengan-string-acak-panjang
```

## Teknologi

Node.js, Express, SQLite (`better-sqlite3`), express-session, bcrypt, qrcode.
Tanpa build step — file `public/` disajikan langsung oleh Express.
