// Provider ESC/POS: cetak struk LANGSUNG ke printer thermal (USB/LAN),
// tanpa dialog browser. Dipakai bila setting printer_provider = 'escpos'.
//
// Syarat (sekali saja, di komputer toko):
//   npm install escpos escpos-usb        <- untuk printer USB
//   npm install escpos escpos-network    <- untuk printer LAN/WiFi
//
// Setting terkait (halaman Pengaturan admin):
//   printer_provider = 'escpos'
//   printer_width    = '58' atau '80'      (lebar kertas, default 58)
//   printer_host     = '' atau IP printer (mis. 192.168.1.100; kosong = pakai USB)
//   printer_port     = '9100'              (port printer LAN, default 9100)
//
// Paket escpos di-require secara malas (lazy) supaya aplikasi tetap jalan
// normal walau paket belum diinstal — cetak() mengembalikan ok:false dengan
// pesan yang jelas, bukan error yang menggagalkan konfirmasi pesanan.
const { getSetting } = require('../db');

const LEBAR_KOLOM = { 58: 32, 80: 48 };

function rupiah(n) {
  const v = Number(n) || 0;
  return 'Rp' + v.toLocaleString('id-ID');
}

function buatFormat(lebarKertas) {
  const C = LEBAR_KOLOM[lebarKertas] || 32;
  const garis = '-'.repeat(C);
  const tengah = (t) => {
    const s = String(t || '');
    if (s.length >= C) return s.slice(0, C);
    const pad = Math.floor((C - s.length) / 2);
    return ' '.repeat(pad) + s;
  };
  // "Nama item ......... Rp63.000"
  const kiriKanan = (kiri, kanan) => {
    const k = String(kiri || '');
    const r = String(kanan || '');
    if (k.length + r.length + 1 > C) {
      return k.slice(0, Math.max(0, C - r.length - 4)) + '... ' + r;
    }
    return k + ' '.repeat(C - k.length - r.length) + r;
  };
  return { C, garis, tengah, kiriKanan };
}

function formatTanggal(iso) {
  // '2026-09-30 17:35:12' -> '30/09/2026 17:35'
  const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return String(iso || '');
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

const LABEL_TIPE = { dine_in: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery' };
const LABEL_BAYAR = { qris: 'QRIS', tunai: 'Tunai', transfer: 'Transfer' };

function susunBarisStruk(d, F) {
  const L = [];
  const o = d.order;
  const t = d.totals;

  L.push(F.tengah(d.store.name));
  if (d.store.address) L.push(F.tengah(d.store.address));
  if (d.store.phone) L.push(F.tengah('WA: ' + d.store.phone));
  if (d.header) L.push(F.tengah(d.header));
  L.push(F.garis);

  L.push(F.kiriKanan('No: ' + o.code, formatTanggal(o.created_at)));
  L.push(
    F.kiriKanan(
      LABEL_TIPE[o.order_type] || o.order_type,
      (o.table_number ? 'Meja ' + o.table_number + '  ' : '') +
        (LABEL_BAYAR[o.payment_method] || o.payment_method || '')
    )
  );
  if (o.customer_name) L.push('Pelanggan: ' + o.customer_name);
  L.push(F.garis);

  (o.items || []).forEach((it) => {
    L.push(`${it.qty}x ${it.item_name}`);
    (it.options || []).forEach((op) => {
      const delta = Number(op.price_delta) || 0;
      L.push('  - ' + op.option_name + (delta > 0 ? ' (+' + rupiah(delta) + ')' : ''));
    });
    if (it.note) L.push('  Catatan: ' + it.note);
    L.push(F.kiriKanan('', rupiah(it.subtotal)));
  });
  L.push(F.garis);

  L.push(F.kiriKanan('Subtotal', rupiah(t.subtotal)));
  if (Number(t.discount) > 0) L.push(F.kiriKanan('Diskon', '-' + rupiah(t.discount)));
  if (Number(t.tax) > 0) L.push(F.kiriKanan('Pajak', rupiah(t.tax)));
  if (Number(t.service) > 0) L.push(F.kiriKanan('Service', rupiah(t.service)));
  L.push(F.kiriKanan('TOTAL', rupiah(t.total)));
  L.push(F.garis);

  if (d.footer) L.push(F.tengah(d.footer));
  L.push(F.tengah('Terima kasih atas kunjungan Anda'));
  L.push('');
  L.push('');
  return L;
}

async function cetak(dataStruk) {
  const lebar = parseInt(dataStruk.width, 10) || 58;
  const host = getSetting('printer_host', '').trim();
  const port = parseInt(getSetting('printer_port', '9100'), 10) || 9100;

  let escpos;
  try {
    escpos = require('escpos');
  } catch (e) {
    return {
      ok: false,
      mode: 'escpos',
      pesan:
        'Paket escpos belum diinstal di komputer toko. Jalankan: npm install escpos escpos-usb (printer USB) atau npm install escpos escpos-network (printer LAN).',
    };
  }

  let device;
  try {
    if (host) {
      try {
        escpos.Network = require('escpos-network');
      } catch (e) {
        return {
          ok: false,
          mode: 'escpos',
          pesan: 'Untuk printer LAN, instal dulu: npm install escpos-network',
        };
      }
      device = new escpos.Network(host, port);
    } else {
      try {
        escpos.USB = require('escpos-usb');
      } catch (e) {
        return {
          ok: false,
          mode: 'escpos',
          pesan: 'Untuk printer USB, instal dulu: npm install escpos-usb',
        };
      }
      device = new escpos.USB();
    }
  } catch (e) {
    return { ok: false, mode: 'escpos', pesan: 'Gagal menyiapkan printer: ' + e.message };
  }

  const F = buatFormat(lebar);
  const baris = susunBarisStruk(dataStruk, F);

  try {
    await new Promise((resolve, reject) => {
      device.open((err) => (err ? reject(err) : resolve()));
    });
    const printer = new escpos.Printer(device);
    printer.font('a').align('lt').size(1, 1);
    // Nama toko & TOTAL dicetak tebal agar menonjol di struk.
    baris.forEach((b, i) => {
      if (i === 0 || b.startsWith('TOTAL')) printer.style('bu');
      else printer.style('normal');
      printer.text(b);
    });
    printer.style('normal').cut();
    await new Promise((resolve) => {
      try {
        device.close(() => resolve());
      } catch (e) {
        resolve();
      }
      setTimeout(resolve, 1500); // pengaman bila close() tidak memanggil callback
    });
    return { ok: true, mode: 'escpos', pesan: 'Struk terkirim ke printer' };
  } catch (e) {
    return {
      ok: false,
      mode: 'escpos',
      pesan:
        'Printer tidak merespons (' + e.message + '). ' +
        (host
          ? 'Periksa IP ' + host + ' terjangkau di jaringan.'
          : 'Periksa kabel USB & driver printer terinstal di komputer toko.'),
    };
  }
}

module.exports = { nama: 'escpos', cetak, _susunBarisStruk: susunBarisStruk, _buatFormat: buatFormat };
