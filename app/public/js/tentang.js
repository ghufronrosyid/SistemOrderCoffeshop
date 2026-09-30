// Halaman About: isi dinamis dari /api/info (alamat, rute, sosmed, pembayaran).
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const SOSMED = [
    { k: "instagram", label: "Instagram" },
    { k: "tiktok", label: "TikTok" },
    { k: "facebook", label: "Facebook" },
    { k: "whatsapp", label: "WhatsApp" },
  ];
  const IKON_BAYAR = { qris: "qr", tunai: "tunai", cash: "tunai", transfer: "transfer" };

  async function muat() {
    let info = null;
    try {
      const r = await fetch("/api/info", { cache: "no-store" });
      if (r.ok) info = await r.json();
    } catch (e) { /* biarkan fallback statis */ }
    if (!info) return;
    const IKON = window.IKON || {};

    // Alamat + tombol rute
    const alamat = String(info.store_address || "").trim();
    const elAlamat = document.getElementById("alamat-teks");
    if (elAlamat && alamat) elAlamat.textContent = alamat;
    const rute = document.getElementById("tombol-rute");
    if (rute) {
      const nama = String(info.store_name || "").trim();
      rute.href =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent((nama ? nama + ", " : "") + (alamat || nama));
    }

    // Ikon media sosial (hanya yang diisi di admin)
    const sos = info.social_links || {};
    const baris = document.getElementById("baris-sosmed");
    if (baris) {
      const ada = SOSMED.filter((d) => String(sos[d.k] || "").trim());
      if (ada.length) {
        baris.innerHTML = ada
          .map(
            (d) =>
              '<a class="tombol-sosmed" href="' + esc(String(sos[d.k]).trim()) +
              '" target="_blank" rel="noopener" aria-label="' + esc(d.label) + '">' +
              (IKON[d.k] || "") + "</a>"
          )
          .join("");
      } else {
        const kosong = document.getElementById("sosmed-kosong");
        if (kosong) kosong.hidden = false;
      }
    }

    // Chip pembayaran (ikut data admin)
    const bayar = document.getElementById("baris-bayar");
    const daftar = Array.isArray(info.payment_methods) ? info.payment_methods : [];
    if (bayar && daftar.length) {
      bayar.innerHTML = daftar
        .map((m) => {
          const id = String(m.id || "").toLowerCase();
          const ikon = IKON[IKON_BAYAR[id] || "dompet"] || "";
          return '<span class="chip-bayar">' + ikon + "<span>" + esc(m.label || m.id) + "</span></span>";
        })
        .join("");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", muat);
  } else {
    muat();
  }
})();
