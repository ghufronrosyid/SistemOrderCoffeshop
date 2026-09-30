// Provider cetak default: tampilkan struk di browser untuk dicetak manual.
// Dipakai bila setting printer_provider = 'browser' atau bila provider lain gagal dimuat.
async function cetak(dataStruk) {
  return {
    ok: true,
    mode: 'browser',
    url: '/admin/struk.html?id=' + dataStruk.order.id,
    pesan: 'Buka halaman struk untuk mencetak',
  };
}

module.exports = { nama: 'browser', cetak };
