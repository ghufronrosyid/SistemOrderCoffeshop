# Panduan Instalasi — Aplikasi Pemesanan Nordic by The Founders

Panduan langkah-per-langkah untuk komputer di toko. Tidak perlu bisa coding —
cukup ikuti urutannya. Estimasi waktu: ±30 menit (termasuk download).

---

## Yang dibutuhkan

- Komputer/laptop di toko (Windows) yang **tetap menyala** selama jam operasional
- Koneksi internet (hanya saat instalasi awal)
- HP pelanggan & komputer toko terhubung ke **WiFi yang sama**

---

## Langkah 1 — Install Node.js

1. Buka https://nodejs.org di browser komputer toko
2. Download tombol **LTS** versi Windows ("Windows Installer")
3. Jalankan file installer, klik **Next** terus sampai selesai

## Langkah 2 — Copy aplikasi ke komputer toko

1. Minta file aplikasi (folder `app`) — copy ke komputer toko, mis. `C:\nordic-app`
   (bisa via flashdisk, Google Drive, atau file ZIP)
2. Pastikan di dalamnya ada file `server.js` dan folder `public`

## Langkah 3 — Install sekali (butuh internet)

1. Buka **Command Prompt**: tekan `Win + R`, ketik `cmd`, Enter
2. Ketik perintah ini (satu per satu, Enter tiap baris):
   ```
   cd C:\nordic-app
   npm install
   ```
3. Tunggu sampai selesai (muncul lagi tulisan `C:\nordic-app>`)

## Langkah 4 — Jalankan server

1. Di Command Prompt yang sama, ketik:
   ```
   npm start
   ```
2. Tunggu sampai muncul: `Server kopi berjalan di http://localhost:3000`
3. **Jangan tutup** jendela Command Prompt ini selama toko buka

## Langkah 5 — Cek dari HP (WiFi yang sama)

1. Di komputer toko, di Command Prompt **baru**, ketik `ipconfig`, catat **IPv4 Address**
   (contoh: `192.168.1.10`)
2. Di HP yang connect WiFi toko, buka browser: `http://192.168.1.10:3000`
   (ganti `192.168.1.10` dengan IP yang tadi)
3. Kalau halaman menu Nordic muncul → **berhasil** ✅
4. Kalau Windows Firewall bertanya, pilih **Allow / Izinkan**

## Langkah 6 — Pengaturan awal (di dashboard admin)

1. Buka di komputer toko: `http://localhost:3000/admin/login`
2. Login pertama: username `owner`, password `admin123`
3. ⚠️ **Wajib:** buka menu **Pengguna** → ganti password `owner` (dan `kasir`/`kasir123` bila dipakai)
4. Buka menu **Pengaturan** → isi **Alamat server publik** dengan IP komputer toko
   (contoh: `http://192.168.1.10:3000`) — ini dipakai agar QR meja berfungsi
5. Cek kartu **Tipe Pesanan**: pastikan **Dine-In** dan **Take Away** aktif
6. Cek kartu **Promo / Flash Sale** bila ingin menjalankan promo

## Langkah 7 — Printer struk

- Saat kasir menekan **"Konfirmasi & Cetak"**, halaman struk otomatis terbuka untuk dicetak.
- Set printer thermal sebagai **printer default** di Windows (Settings → Bluetooth & devices → Printers).
- Rekomendasi: **Xprinter XP-58IIZ** (USB + Bluetooth, ±Rp280–320rb) — colok USB, install driver, jadi printer default.

## Langkah 8 — QR meja

1. Di admin, buka menu **QR Meja**
2. Cetak QR tiap meja, tempel di meja
3. Pelanggan yang scan → halaman pesan terbuka dengan nomor meja **otomatis terisi**

---

## Pemakaian harian

| Kebutuhan | Buka di |
|---|---|
| Pelanggan memesan | `http://<IP-toko>:3000` (atau scan QR meja) |
| Kasir kelola pesanan | `http://localhost:3000/admin` |
| Layar dapur (barista) | `http://localhost:3000/admin/dapur` |
| Pelanggan lacak pesanan | Tab **Pesanan** di HP (otomatis, tanpa ketik kode) |

## Kalau komputer dimatikan/dinyalakan ulang

- Buka Command Prompt → `cd C:\nordic-app` → `npm start` lagi
- (Opsi lanjutan: atur auto-start via Task Scheduler Windows agar jalan sendiri)

## ⚠️ Penting: jangan hapus file database

Semua pesanan, menu, dan pengaturan tersimpan di **satu file**: `data\kopi.db`.
Kalau suatu saat aplikasi di-update (copy ulang folder), **backup dulu file ini**
lalu kembalikan setelah update — kalau hilang, data ikut hilang.

## Masih menunggu (info dari pemilik)

- Konfirmasi pasangan foto ↔ menu & harga asli 7 item bertanda **[SAMPLE]**
  (sementara bisa jalan dulu dengan harga sample; ubah kapan saja via admin → Kelola Menu)
