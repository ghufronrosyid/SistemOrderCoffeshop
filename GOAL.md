# Sistem pemesanan online coffee shop

Goal ID: goal_1336e3d12828
Goal slug: sistem-pemesanan-online-coffee-shop

## Description
Membangun sistem pemesanan online untuk coffee shop tempat saudara user bekerja: web pemesanan pelanggan (menu + kustomisasi per item + keranjang + lacak pesanan) dan dashboard admin (manajemen pesanan, cetak struk otomatis, kelola menu, laporan penjualan, Kitchen Display).

## Status (2026-09-30)
- Brief awal diterima: coffee shop besar, belum ada sistem pemesanan. Minta dashboard admin + "sekompleks dan sesmooth mungkin".
- Fitur yang user sebut: cetak struk pesanan otomatis, opsi kustomisasi di setiap menu.
- KEPUTUSAN: server lokal di komputer toko (dipilih user 2026-09-30) — cocok untuk cetak struk otomatis via printer thermal USB/LAN.
## Build v1 selesai & teruji (2026-09-30 ~17:40 WIB)
- Aplikasi jadi di `app/` (Node.js + Express + SQLite, tanpa CDN — jalan offline di LAN toko). 40 item menu + 7 kategori + 7 option group ter-seed dari data asli.
- Halaman: `/` pemesanan pelanggan (kustomisasi, keranjang, dine-in/takeaway/delivery), `/lacak`, `/tentang`, `/admin` (dashboard, pesanan, kitchen display, kelola menu, laporan, pengaturan, pengguna).
- Cetak struk: provider `browser` (print-CSS 58/80mm, auto-print saat konfirmasi) + struktur siap untuk ESC/POS.
- Uji API lolos: buat pesanan (2x WHITE/BLACK + opsi gula, pajak 10% → Rp121.000) + lacak by kode. Data tes dibersihkan.
- Metode pembayaran sementara: QRIS/Tunai/Transfer (konfigurabel, menunggu info asli).
- INFO FINAL dari user (2026-09-30): pembayaran QRIS/Tunai/Transfer ✓ (sudah sesuai default); printer struk BELUM ADA → direkomendasikan Xprinter XP-58IIZ (USB+Bluetooth, ESC/POS, ~Rp280–320rb); no WA toko +62895385381158 ✓ (tersimpan di settings); semua harga fleksibel/diubah via dashboard admin ✓.
- MASIH DITANYAKAN: konfirmasi mapping foto→menu (apakah tebakan sudah benar).
- UPDATE (2026-09-30): 7 item sample ditambahkan via API admin (terbukti bisa dikelola): MAGIC 55K, FILTER COFFEE 55K, MANUAL BREW 65K, ICED COFFEE CREAM TOP 65K, ICED ESPRESSO 45K, MOCTAIL 65K, BLEND COFFEE DRINK 65K — masing-masing berfoto + 7 grup opsi, deskripsi bertanda "[SAMPLE]". Total 47 item. Uji edit harga via admin panel lolos (MAGIC 55K→60K→55K).
- UPDATE (2026-09-30): audit responsivitas — viewport OK di 12 halaman; customer mobile-first (breakpoint 700/1000px); admin breakpoint 900px (sidebar→top bar) + 520px (padding/target sentuh/KDS 1 kolom); tambah breakpoint 380px untuk header HP kecil. Semua halaman & CSS lolos serve (200).
- UPDATE (2026-09-30): fitur QR MEJA selesai & teruji — halaman admin /admin/qr-meja.html (cetak QR per meja, 8 meja ter-seed), endpoint /api/admin/tables/qr (QR SVG), setting public_base_url (editable di Pengaturan, default http://localhost:3000), halaman pelanggan dukung ?meja=NOMOR (otomatis pilih dine-in + meja). npm: +qrcode.
- SISA (butuh user/saudara): konfirmasi mapping foto→menu, harga asli 7 item sample, beli printer thermal, instalasi di komputer toko (README tersedia).

## Data asli diterima (2026-09-30)
- Nama: **Nordic by The Founders** — artisan specialty coffee slow bar & roastery, Surabaya.
- Alamat: Jl. Puri Widya Kencana No.JT1/28, Lidah Kulon, Kec. Lakarsantri, Surabaya 60213. Tutup 19.00.
- 21 foto diterima: papan menu lengkap + foto produk + interior/barista/biji kopi.
- Menu: 7 kopi, 7 non-kopi, Artisan Blend Tea 40K, Exotic Tea Longboard Geisha 400K, The Founders Course omakase 325K nett, Small & Bites (croissant, grilled cheese, dessert), retail beans "Founders Roast Home" 12 varian (60K–170K/tube).
- Branding visual: krem/beige + hijau tua marmer + aksen emas → dipakai sebagai tema aplikasi.

## Rencana fitur (draf, menunggu konfirmasi)
Pelanggan: katalog menu + foto, kustomisasi per item (ukuran, panas/dingin, level gula & es, jenis susu, extra shot, topping), keranjang, tipe pesanan (dine-in/takeaway/delivery), data pelanggan, pembayaran, kode pesanan + lacak status real-time.
Admin: dashboard omzet, manajemen pesanan + Kitchen Display, cetak struk otomatis (ESC/POS), kelola menu/kategori/opsi, promo & pajak, laporan + export, roles (owner/kasir/barista).

## Update (2026-09-30, sore)
- RALAT USER: opsi **Delivery dihapus** — toko hanya melayani **Dine-In** dan **Take Away**. Label "Ambil Sendiri" diganti "Take Away".
  - `routes/api.js`: ORDER_TYPES = ['dine-in','takeaway']; validasi alamat delivery dihapus; checkout delivery → 400.
  - `public/js/app.js`: LABEL_TIPE, fallback, validasi & body checkout dibersihkan dari delivery; kolom alamat selalu disembunyikan.
  - `public/index.html`: segmen home tinggal 2 tombol (Take Away, Dine-In).
  - Label histori (KDS/admin/struk/lacak) tetap mendukung tampilan order delivery lama.
  - Demo widget disesuaikan: segmen home, radio checkout, map TIPE.
- Seed promo diperbaiki: dipindah ke SETELAH seed menu + menunjuk item menu ASLI (WHITE/BLACK 45K, MACHA LATTE -15%) agar fresh-install ikut dapat promo contoh.
- Demo widget v2 (home + flash sale + lacak otomatis + pesan lagi) selesai & lolos 10 uji fungsional; MENUNGGU izin user sebelum ditampilkan.

## Update (2026-09-30, malam)
- TIPE PESANAN BISA DIATUR DARI ADMIN (atas permintaan user "semua bisa di-manage via admin panel"):
  - Setting baru `order_types` (JSON array), default ["dine-in","takeaway"]. Seed fresh-install + INSERT OR IGNORE untuk DB lama.
  - `routes/api.js`: getOrderTypes() baca setting (fallback default); /api/info & validasi checkout dinamis; alamat wajib hanya bila delivery aktif.
  - PATCH /admin/settings validasi order_types (min 1, filter tipe tak dikenal). KNOWN_SETTINGS += order_types.
  - Admin Pengaturan: kartu "Tipe Pesanan" (checkbox Dine-In/Take Away/Delivery), simpan via pengaturan.js.
  - Home: segmen tipe di-render dinamis dari /api/info (bukan hardcode).
  - Menu/checkout (app.js): label + kolom alamat delivery dikembalikan tapi hanya muncul bila admin mengaktifkan delivery.
  - Uji: toggle via admin → /api/info berubah; kosong → 400; tipe ngaco difilter; delivery ditolak setelah dikembalikan ke 2 tipe. DB bersih (0 order uji).
- OPSI ITEM JADI DROPDOWN (atas permintaan user agar tidak scroll panjang):
  - Grup opsi "single" (Sajian panas/dingin, ukuran, level gula, dll) di modal menu dirender sebagai <select> dropdown dengan placeholder "— Pilih ... —" (wajib) / "Tidak pilih" (opsional); delta harga (+RpX) tampil di teks opsi.
  - pilihanTerpilih() + validasi wajib + listener harga live disesuaikan ke select. Grup "multiple" (topping) tetap checkbox.
- UX (atas feedback user): tombol "Beli" di kartu flash sale demo diganti "🛒 + Keranjang" (lebih jelas: masuk keranjang, bukan beli langsung). Ikon tipe pesanan diselaraskan jadi pasangan cup: ☕ Dine-In / 🥤 Take Away (sebelumnya 🍽️/🥡 dinilai kurang sinkron) — diterapkan di home, checkout, admin Pengaturan, dan demo widget.
- BUG DATA (dilaporkan user "sajiannya double"): 7 item sample (id 41-47) di DB punya DUA grup "Sajian" (#1 Dingin +10rb, #2 Dingin +15rb) — bawaan saat item sample dibuat via API. Diperbaiki: tautan group #2 dihapus dari 7 item (grup #2 tetap dipakai CHOCOLATE). Data demo widget juga dibersihkan (7 duplikat). Terverifikasi: tidak ada lagi nama grup ganda per item.
- UX CHECKOUT 2 LANGKAH (permintaan user 2026-09-30): drawer menu.html kini 2 langkah — (1) Keranjang: daftar item + subtotal + tombol "Checkout →"; (2) Data Pesanan: tombol "← Kembali ke Keranjang" + form tipe pesanan/meja/alamat, data pemesan, pembayaran, ringkasan + tombol "Buat Pesanan". Judul drawer berubah mengikuti langkah. Demo widget diselaraskan (coStep cart→data, tombol Checkout → / ← Kembali). 12 tes stub lolos.
- IKONIFIKASI TOMBOL (permintaan user 2026-09-30): tombol yang tak perlu teks jadi ikon saja. Demo: Tutup drawer/sheet "Tutup"→✕, Hapus item→🗑️, FAB "Keranjang"→ikon bulat saja, tombol kembali→←, tombol sheet "Tambah ke Keranjang"→"🛒 + Keranjang" (selaras preferensi +keranjang). App: btnKembali→←, btnTambah→"🛒 + Keranjang". CTA utama (Checkout, Buat Pesanan) tetap berteks. Semua tes lolos.
- NAV IKON SAJA (permintaan user 2026-09-30): navigasi Beranda/Menu/Pesanan/Tentang jadi ikon saja. App: nav.js tidak lagi render .nav-label (aria-label tetap di link), CSS .nav-item rata tengah ikon. Demo: .tabs pindah ke bawah (absolute bottom, z-30, di bawah drawer), tombol jadi 🏠/📋/🧾/ℹ️ dengan aria-label, view padding-bottom 86px, FAB naik ke bottom:80px. Tes lolos.
- IKON SVG + ANIMASI TAP (permintaan user 2026-09-30): semua emoji di aplikasi & demo diganti ikon garis gaya Lucide/line-icon (35 ikon, inline SVG via window.IKON di app/public/js/ikon.js dan ic() di demo). Setiap tombol/link yang diklik memantul kecil (keyframes ketuk .32s, delegated listener di nav.js, admin-core.js, dan demo). Mencakup: nav bawah, tipe pesanan, FAB, tutup, kembali, hapus, stepper, badge promo/best-seller, judul seksi, langkah status, empty state, tombol admin (login, pengaturan tipe pesanan, pesanan, qr-meja, promo, kds). Fallback emoji bila ikon.js gagal dimuat. Semua syntax & tes lolos.
- BADGE "BARU" PRODUK BARU (permintaan user 2026-09-30): kolom is_new di menu_items + migrasi otomatis (mengonversi penanda manual "BARU —" di deskripsi menjadi flag resmi). Dikelola via Admin → Menu → checkbox "Baru" (tambah/ubah), tampil sebagai lencana hijau "✨ Baru" di kartu menu aplikasi & demo, ikon kilau di rel "Untuk Kamu" beranda. Produk awal yang ditandai: Grilled Cheese Kimchi. API publik & admin sudah mendukung is_new (diuji POST/PATCH/DELETE).
- SEKSI BERANDA "PRODUK BARU" (permintaan user 2026-09-30): seksi "Untuk Kamu" di beranda aplikasi & demo diganti menjadi "Produk Baru" — menampilkan produk bertanda is_new (maks 8, fallback 8 menu pertama bila belum ada yang ditandai).
- TOMBOL BULAT "+ KERANJANG" (permintaan user 2026-09-30): tombol "Tambah ke Keranjang" di modal item disederhanakan menjadi tombol bulat berisi ikon keranjang + lencana plus, mengambang sticky di kanan bawah modal (aplikasi & demo). Harga live tetap terlihat di samping stepper jumlah.
- RALAT TOMBOL FLASH SALE (2026-09-30): permintaan awal salah sasaran — tombol bulat di modal item DIURUNGKAN penuh (kembali ke tombol teks "Tambah ke Keranjang"). Yang benar: tombol di kartu FLASH SALE menjadi tombol bulat berisi ikon keranjang + lencana plus emas, posisi absolute pojok kanan bawah kartu (aplikasi: .btn-bulat di .kartu-promo; demo: .padd di .pcard). Berlaku di aplikasi & demo.
- KERANJANG JADI MODAL TENGAH (permintaan user 2026-09-30): drawer keranjang yang tadinya meluncur dari kanan diubah menjadi modal di tengah layar (aplikasi & demo). Seluruh alur — Keranjang → Checkout/Data Pesanan → Buat Pesanan — tetap di dalam modal yang sama.
- 3 MODAL TERPISAH (permintaan user 2026-09-30): alur checkout dipecah dari 1 drawer 2-langkah menjadi 3 modal tengah terpisah — (1) Keranjang → (2) Data Pesanan (tanpa metode pembayaran, lebih ringkas) → (3) Pembayaran (metode + ringkasan + Buat Pesanan). Tiap modal punya tombol kembali & tombol tutup sendiri. Berlaku di aplikasi (menu.html/app.js) & demo. Harness diperbarui ke 20 tes: lolos semua.
- MODE TOGGLE DINE-IN / TAKE AWAY DI BERANDA (permintaan user 2026-09-30, koreksi: bukan di modal Data Pesanan): tombol yang tak dipilih menganimasikan menyusut kecil (hanya ikon), yang dipilih melebar. Ketuk tombol kecil untuk bertukar. Berlaku di aplikasi & demo. (Percobaan animasi collapse di modal Data Pesanan sudah diurungkan.)
- IKON TAKE AWAY (permintaan user 2026-09-30): diganti dari gelas takeaway menjadi tas belanja (Lucide shopping-bag) agar serasi dengan ikon keranjang (shopping-basket). Berlaku di aplikasi & demo.
- SINKRON TIPE PESANAN (permintaan user 2026-09-30): modal Data Pesanan hanya menampilkan tipe yang sudah dipilih di beranda (yg tak dipilih disembunyikan); QR meja memaksa dine-in tersimpan & render ulang.
- MODE AWAL NETRAL (permintaan user 2026-09-30): saat pertama buka home, Dine-In/Take Away tidak ada yang terpilih (kedua tombol ukuran semula selaras); animasi menyusut/melebar hanya aktif setelah pengguna memilih. Data Pesanan menampilkan dua pilihan bila belum ada pilihan tersimpan, dan pilihan di form ikut tersinkron ke home.
- PENANDA MODE (ide asisten, disetujui user 2026-09-30): pil mode mengambang (ikon + label + titik warna) selalu terlihat & bisa diketuk untuk ganti mode; strip tipis warna mode di atas layar (Dine-In = hijau tua, Take Away = emas); tombol utama checkout mengikuti warna mode. Berlaku di aplikasi & demo.
- PENANDA MODE V2 PREMIUM (revisi 2026-09-30, user menilai versi pil mengambang "jelek"): pil/strip/warna tombol dihapus; diganti caption editorial di bawah nama toko — huruf kapital ber-spasi lebar + garis rambut, emas untuk Take Away & hijau tua untuk Dine-In, bisa diketuk untuk ganti mode; plus caption kecil di kepala keranjang.
- PENANDA MODE V3 CHIP INLINE (revisi 2026-09-30, caption dinilai "tidak premium & memakan header"): tanpa elemen mengambang/baris baru — chip mungil gold hairline inline di dalam judul (header home, header menu, judul keranjang), teks DINE-IN / TAKE AWAY, ketuk untuk ganti mode.
- HERO "SELAMAT MALAM" DIHAPUS (permintaan user 2026-09-30): header home (sapaan waktu + nama toko + tagline + background hijau gradien) dihapus total dari aplikasi & demo; beranda kini langsung mulai dari tombol mode Dine-In/Take Away.
- HEADER MARMER (2026-09-30): header menu, kepala keranjang & hdr demo tidak lagi flat — tekstur urat marmer emas (SVG feTurbulence) + sheen cahaya dari atas + garis rambut emas di bawah. Verifikasi visual via screenshot belum bisa di VPS (chromium headless gagal), SVG & CSS divalidasi sintaks; cek visual final di komputer toko.
- CHIP MODE TENGAH BARIS SENDIRI (2026-09-30): chip DINE-IN/TAKE AWAY kini di baris tersendiri yang rata tengah (bukan nempel kanan nama toko) — di hdr demo, header menu app, & kepala keranjang app.

## Update (2026-09-30, malam): Banner Iklan
- Permintaan Ghufron via anotasi screenshot: tambah **banner iklan terpisah**, Flash Sale tetap kartu.
- Tabel baru `banners` (judul, subjudul, gambar, tombol_teks, tautan, tema[hijau/emas/kopi], aktif, urutan); migrasi otomatis via CREATE TABLE IF NOT EXISTS.
- API: `GET /api/banners` (publik, aktif saja) + CRUD `/api/admin/banners` (ownerOnly, validasi judul wajib, tema fallback hijau).
- Admin: halaman baru `/admin/banner.html` + `public/js/banner.js`, nav "Banner Iklan" setelah Promo; kartu pratinjau mini per banner.
- Pelanggan: korsel banner di Beranda antara tombol tipe pesanan & Flash Sale — geser horizontal snap, titik indikator, auto-geser 5 detik (jeda saat disentuh), ketuk banner buka tautan.
- Demo-widget mirror dengan 2 contoh; harness stub diperbaiki (window.addEventListener) — SEMUA TES LOLOS.
- Seed: 2 banner aktif (Omakase hijau, Flash Sale emas).
- Belum: verifikasi visual browser nyata (VPS headless macet); izin presentasi demo ke Ghufron belum diminta.
- Header demo diperpanjang ke bawah hingga garis bawahnya memotong tepat di tengah tombol Take Away/Dine-In (padding-bottom 46px, seg ditarik naik -44px); tombol tampil seperti kartu mengambang di atas marmer (2026-09-30 malam, revisi sebelum demo ditampilkan).
- Revisi header demo (diperpanjang ke tengah tombol) DIURUNGKAN atas permintaan Ghufron 2026-09-30 malam; kembali ke semula.
- 2026-09-30 malam: demo-widget.html RUSAK BERAT — regex `\.ndemo \.hdr\{.*?\}(?=\.ndemo)` (re.S) memakan ~2/3 blok CSS karena lookahead tidak memperhitungkan newline antar rule (`}` tidak langsung diikuti `.ndemo`). CSS tersisa 3776 char: nav bawah jadi pil vertikal kiri, banner menumpuk vertikal, FAB & drawer tanpa style. DIPERBAIKI: CSS dibangun ulang dari demo-fragment.html (113 rule utuh) + rule tambahan widget + header baru + banner + sechead/hscroll/mode-chip; verifikasi: 1 blok style, semua class ada rule, tanpa duplikat, harness lolos. PELAJARAN: jangan pakai regex lintas-rule dengan lookahead; untuk ganti satu rule CSS pakai pola `sel\{[^}]*\}` atau split aman.
- Banner iklan diubah menjadi MURNI GAMBAR (2026-09-30 malam, atas contoh Kopi Kenangan dari Ghufron): teks judul/subjudul/CTA tidak lagi ditampilkan di atas banner; kartu banner hanya menampilkan gambar (aspect 16:9, object-fit cover). Data teks tetap tersimpan (judul dipakai untuk alt & identifikasi admin). Dibuat 2 contoh gambar (AI, tema Nordic): app/public/img/banner-omakase.jpg & banner-flashsale.jpg; seed DB banner 1-2 diupdate path gambarnya. Demo memakai gambar yang sama (inline base64, 182KB). Fallback: banner tanpa gambar tetap tampil sebagai kartu gradien + teks. Berlaku di app (home.js + style.css) dan demo.
- Perbaikan tombol Flash Sale di demo (2026-09-30 malam): CSS kartu promo (.pcard/.pimg/.pb/.ph/.coret/.merah/.padd/.pplus) hilang saat rekonstruksi sehingga tombol tampil rusak; rule ditulis ulang mengikuti desain app (tombol bulat 46px hijau tua + ikon keranjang + badge + emas, harga ditumpuk vertikal). Verifikasi: semua class & id HTML kini punya rule CSS.
- Perbaikan demo 2026-09-30 malam (atas laporan Ghufron "button-buttonnya rusak"): (1) Tombol Take Away/Dine-In (#seg-tipe) tidak punya CSS sama sekali — ditulis ulang mengikuti app: awal netral sama besar, setelah dipilih yang aktif melebar (flex 2.8) & yang nonaktif menyusut jadi ikon. (2) Navbar (.tabs) dikembalikan ke bawah sebagai pil mengambang hijau tua, ikon tanpa teks, aktif kapsul krem; .view diberi padding-bottom 96px; FAB keranjang naik ke bottom:92px agar tidak tertumpuk. (3) Kartu Produk Baru (.ucard/.uimg/.ub/.up) + badge Baru (.bdg-new) & badge promo (.bdg2) + teks fallback banner (.bi/.bcta) juga hilang — ditulis ulang. Pelajaran: cek class harus mencakup pola class=\"...\" di template JS, bukan cuma HTML statis.
- Header demo dihapus (2026-09-30 malam, atas permintaan Ghufron "Hapus text head nordic the founders itu"): seluruh blok .hdr (h1 + mode-chip + divider + tagline) dibuang dari demo-widget.html; beranda kini langsung mulai dari tombol Take Away/Dine-In seperti app asli. CSS .hdr dibiarkan (tidak dipakai). renderModeChip sudah punya guard null.
- Koreksi 2026-09-30 malam: Ghufron hanya minta teks "Nordic by The Founders" yang dihapus, bukan seluruh header. Header demo dikembalikan lengkap (mode-chip + divider + tagline "Artisan specialty coffee • Surabaya"), hanya elemen <h1> yang dibuang.
- Kategori "New" ditambahkan (2026-09-30 malam, atas permintaan Ghufron): INSERT ke app/data/kopi.db (id 8, sort_order 8, aktif) + append ke DATA.categories di demo-widget.html (id 8, items kosong). Bisa dikelola/dihapus lewat Admin → Menu → Kategori.
- Halaman info/About dipercantik (2026-09-30 malam, atas permintaan Ghufron "Terakhir dipage info percantik lagi"): (1) Alamat kini tampil dengan mini map bergaya (SVG offline: jalan, taman, blok, pin hijau-emas animasi pulsa + label "Nordic by The Founders") + tombol "Get Directions" (Google Maps). (2) Media sosial tampil sebagai ikon saja (Instagram, TikTok, Facebook, WhatsApp — gaya garis serasi) di kartu "Follow Us"; hanya ikon yang link-nya diisi. (3) Pembayaran tampil sebagai chip ikon (QRIS/Cash/Bank Transfer) mengikuti data admin. Link sosmed dikelola via Admin → Settings → kartu "Social Media" (setting baru `social_links`, JSON; diekspos di GET /api/info; default WhatsApp = wa.me/62895385381158). Ikon baru di ikon.js + demo IC_RAW: transfer, instagram, tiktok, facebook, whatsapp. Berlaku di app (tentang.html + js/tentang.js baru) dan demo-widget.html. Seed payment_methods diselaraskan ke label English (Cash/Bank Transfer). Validasi: node --check semua file, server live test /api/info + PATCH /admin/settings (login owner) lolos, nilai uji dikembalikan.
