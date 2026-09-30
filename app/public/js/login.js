/* login.js — halaman masuk admin. */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // Bila sesi masih aktif, langsung ke dashboard.
  try {
    await Admin.api('GET', '/admin/me');
    window.location.href = '/admin/';
    return;
  } catch (e) { /* belum login — tampilkan form */ }

  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errBox.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      await Admin.api('POST', '/admin/login', {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
      });
      window.location.href = '/admin/';
    } catch (e) {
      errBox.textContent = e.message || 'Login failed. Please check your username and password.';
      errBox.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign In';
      document.getElementById('password').value = '';
      document.getElementById('password').focus();
    }
  });
});
