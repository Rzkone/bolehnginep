# Tes bolehnginep

- `node tests/server.test.cjs` — logika server (Code.gs) tanpa Google: harga, diskon rombongan, bayi, kode unik, hold 60 menit, refund, standar v2.
- `node tests/admin-fields.test.cjs` — penyimpanan rumah dan pendamping oleh admin.
- `tests/browser/` — tes di browser headless (Chrome). `runtests.sh` membuat `_test.html` dari index.html + admin.js, lalu menjalankannya.
  File `/tmp/admin_body.js` dibuat dari `admin.js` (hapus 4 baris pembuka dan baris `window.__BN.admin = ...` ke bawah).
- Rumus harga di `calc()` (index.html) dan `createBooking_` (Code.gs) harus identik. Angka uji yang sama ada di kedua tes (720.000 / 680.000 / 800.000).

## Pemeriksaan otomatis vs manual

`tests/static.test.cjs` ikut berjalan di setiap build Vercel. Build berhenti kalau salah satu gagal: kunci teks hilang (tampil mentah seperti "polPayout"), atribut event inline (diblokir CSP), baris geser tanpa dukungan seret mouse, batas malam klien tidak sama dengan server, kalimat instruksi admin nyasar ke pesan tamu, badge pendek tanpa `whitespace-nowrap`.

Yang tidak bisa diperiksa otomatis, cek dengan mata sebelum rilis (HP dan desktop 100%, plus layar lebar):
1. Tidak ada area kosong yang janggal di hero, filter, kartu unggulan, dan footer.
2. Semua teks rata dan terpusat pada tempatnya, tidak terpotong, tidak terpecah baris.
3. Tiap klik di panel admin dan mitra memberi tanda (garis atas + putaran tombol) dalam sekitar 0,3 detik.
4. Setiap kalimat pada pesan WA dibaca dari sudut pandang pengirimnya: pesan tamu bicara sebagai tamu, pesan admin bicara sebagai admin.
