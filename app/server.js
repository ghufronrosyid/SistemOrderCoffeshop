// Entry point aplikasi: konfigurasi express, session, route halaman & API.
const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const apiRouter = require('./routes/api');

const app = express();

app.use(express.json());
app.use(
  session({
    name: 'kopi.sid',
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 jam
      secure: false, // set true bila sudah di balik HTTPS
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api', apiRouter);

// Halaman
const halaman = (p) => (req, res) =>
  res.sendFile(path.join(__dirname, 'public', p));

app.get('/', halaman('index.html'));
app.get('/lacak', halaman('lacak.html'));
app.get('/tentang', halaman('tentang.html'));
app.get('/admin/login', halaman('admin/login.html'));
app.get(['/admin', '/admin/'], halaman('admin/index.html'));
app.get('/admin/pesanan', halaman('admin/pesanan.html'));
app.get('/admin/menu', halaman('admin/menu.html'));
app.get('/admin/laporan', halaman('admin/laporan.html'));
app.get('/admin/pengaturan', halaman('admin/pengaturan.html'));
app.get('/admin/pengguna', halaman('admin/pengguna.html'));
app.get('/admin/dapur', halaman('admin/kds.html'));

// API yang tidak dikenal -> 404 JSON (bukan halaman HTML).
app.use('/api', (req, res) => res.status(404).json({ error: 'tidak_ditemukan' }));

// Error handler global.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'kesalahan_server' });
});

app.listen(config.PORT, () => {
  console.log(`Server kopi berjalan di http://localhost:${config.PORT} (env: ${config.NODE_ENV})`);
});
