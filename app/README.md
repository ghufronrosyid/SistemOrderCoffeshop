# Sistem Pemesanan Online Coffee Shop

Aplikasi pemesanan online untuk **Nordic by The Founders** (Surabaya):
**halaman pelanggan** (lihat menu, kustomisasi tiap item, keranjang, checkout,
lacak pesanan) + **dashboard admin** (kelola pesanan, Kitchen Display untuk
barista, kelola menu, laporan, pengaturan) + **cetak struk otomatis** saat
pesanan dikonfirmasi.

> Database SQLite dibuat otomatis saat server pertama dijalankan, sudah berisi
> data Nordic: 47 menu, kategori, grup opsi, promo, banner, dan akun contoh.
> Semua teks tampilan memakai US English.

## Syarat

- **Node.js LTS** (versi 20 atau lebih baru) terinstal di komputer toko.
- Komputer toko dan HP pelanggan terhubung ke **jaringan yang sama** (WiFi toko).

## Cara Instalasi (Windows)

1. Download Node.js LTS dari https://nodejs.org (pilih "Windows Installer"),
   instal seperti biasa (klik Next sampai selesai).
2. Copy folder `app` dari repo ini ke komputer toko, mis. `C:\kopi-app`.
   (Struktur di dalam `app`: `server.js`, `package.json`, `lib/`, `routes/`,
   `public/`.)
3. Buka **Command Prompt**, masuk ke folder aplikasi:
   ```
   cd C:\kopi-app
   ```
4. Instal dependensi (sekali saja, butuh internet):
   ```
   npm install
   ```
5. Jalankan server:
   ```
   npm start
   ```
6. Tunggu sampai muncul tulisan `Server kopi berjalan di http://localhost:3000`.

> Tips: agar server otomatis jalan saat komputer dinyalakan, bisa memakai
> Task Scheduler Windows atau aplikasi pembantu seperti NSSM (tahap lanjutan).

## Cara Membuka

| Halaman              | Alamat                            |
|----------------------|-----------------------------------|
| Pemesanan pelanggan  | http://localhost:3000             |
| Tentang toko         | http://localhost:3000/tentang     |
| Lacak pesanan        | http://localhost:3000/lacak       |
| Login admin          | http://localhost:3000/admin/login |
| Dashboard admin      | http://localhost:3000/admin       |
| Kitchen Display      | http://localhost:3000/admin/dapur |

**Dari HP pelanggan / tablet kasir:** ganti `localhost` dengan **IP komputer toko**
di jaringan WiFi, mis. `http://192.168.1.10:3000`.
(Cara cek IP: di Command Prompt ketik `ipconfig`, lihat "IPv4 Address".)

## Akun Contoh (WAJIB diganti!)

| Username | Password   | Peran  |
|----------|------------|--------|
| `owner`  | `admin123` | Pemilik (akses penuh) |
| `kasir`  | `kasir123` | Kasir (kelola pesanan) |

> ⚠️ Ini kredensial **contoh**. Setelah login pertama, segera ganti password
> lewat menu **Pengguna** di dashboard admin, dan hapus/tambah akun sesuai
> kebutuhan toko.

## Cetak Struk

Secara default struk dicetak lewat **browser** (halaman struk ukuran 58mm/80mm
otomatis terbuka untuk dicetak ke printer thermal saat kasir menekan
**"Konfirmasi & Cetak"**). Pengaturan printer ada di menu **Pengaturan**.

## Data

Seluruh data tersimpan dalam satu file SQLite: `data/kopi.db`.
Untuk me-reset ke data awal Nordic, hapus file tersebut lalu jalankan ulang
`npm start` (seed otomatis dibuat ulang).

## Bantuan

Lihat `CATATAN_PENGEMBANG.md` untuk: struktur folder, cara mengganti data contoh
dengan data asli toko, dan daftar pekerjaan tahap berikutnya.
