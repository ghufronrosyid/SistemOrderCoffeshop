// Middleware autentikasi & otorisasi untuk panel admin.
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'belum_login' });
  }
  next();
}

// Pemakaian: router.get('/x', requireLogin, requireRole('owner'), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.session && req.session.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'akses_ditolak' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
