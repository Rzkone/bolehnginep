# Tes bolehnginep

- `node tests/server.test.cjs` — logika server (Code.gs) tanpa Google: harga, diskon rombongan, bayi, kode unik, hold 60 menit, refund, standar v2.
- `node tests/admin-fields.test.cjs` — penyimpanan rumah dan pendamping oleh admin.
- `tests/browser/` — tes di browser headless (Chrome). `runtests.sh` membuat `_test.html` dari index.html + admin.js, lalu menjalankannya.
  File `/tmp/admin_body.js` dibuat dari `admin.js` (hapus 4 baris pembuka dan baris `window.__BN.admin = ...` ke bawah).
- Rumus harga di `calc()` (index.html) dan `createBooking_` (Code.gs) harus identik. Angka uji yang sama ada di kedua tes (720.000 / 680.000 / 800.000).
