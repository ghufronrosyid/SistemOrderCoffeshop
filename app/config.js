// Konfigurasi aplikasi — dibaca dari environment variable.
const crypto = require('crypto');

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[PERINGATAN] SESSION_SECRET tidak diset di environment — memakai secret acak sementara. ' +
    'Ini hanya untuk development; session akan hangus setiap restart. ' +
    'Set SESSION_SECRET di environment untuk produksi.'
  );
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  SESSION_SECRET: sessionSecret,
  NODE_ENV: process.env.NODE_ENV || 'development',
};
