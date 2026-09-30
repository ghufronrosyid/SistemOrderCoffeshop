// Klien cetak untuk halaman pesanan.
// Dipanggil setelah backend mengonfirmasi pesanan dan mengembalikan info cetak,
// mis. window.cetakOtomatis({ mode: 'browser', url: '/admin/struk.html?id=12' }).
//
// - mode 'browser' + url: buka halaman struk di tab baru; halaman struk
//   otomatis memanggil window.print() setelah selesai dirender.
// - mode lain (mis. 'escpos'): provider 'escpos' (server-side) tidak butuh
//   aksi browser — struk sudah tercetak di server, cukup beri notifikasi.
window.cetakOtomatis = function (print) {
  if (!print) return;
  if (print.mode === 'browser' && print.url) {
    window.open(print.url, '_blank', 'width=360,height=700');
  } else {
    if (window.Admin) Admin.toast(print.pesan || 'Print command sent', 'ok');
  }
};
