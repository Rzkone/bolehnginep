# bolehnginep: dari Tahap 0 ke Tahap 1 (pilot)

Semua alat di bawah gratis: Google Sheets + Apps Script, GitHub, Vercel Hobby. Vercel Hobby hanya untuk non-komersial, jadi pilot Tahap 1 harus tanpa uang dari orang asing (lihat bagian 5).

## 1. Definisi Tahap 1 (pilot inti)
- 3 destinasi, 15–20 rumah, tamu dan tuan rumah yang sudah saling dikenal atau dikenalkan pendamping.
- Pembayaran manual: transfer ke rekening perusahaan dengan nominal + kode unik, berlaku 60 menit, admin menandai LUNAS.
- Halaman Syarat berlabel "masa uji coba". Tidak ada promosi massal.

## 2. Pasang (urut, sekitar 1–2 jam)
**A. Apps Script**
1. Buka Apps Script dari Sheets. Tempel `Code.gs` baru (atau pakai `clasp`, lihat bagian 6).
2. Project Settings > Script Properties: isi `ADMIN_TOKEN` (12+ karakter) dan `PIN_SALT` (16+ karakter acak). Tanpa ini admin dan PIN mitra tidak jalan.
3. Jalankan `setupSheets()` lalu `setupBackup()`. Beri izin Drive dan Gmail saat diminta.
4. Deploy > Manage deployments > edit deployment yang ada > Version baru. Jangan "New deployment" karena URL berubah.
5. Isi tab HOMESTAYS, PICS, SEASONS. Rumah baru nonaktif sampai pendamping memverifikasi 13 poin dan admin mengaktifkan.
6. Buat PIN tuan rumah dan pendamping lewat panel admin (wajib setelah `PIN_SALT` diisi).

**B. Vercel (Settings > Environment Variables)**
| Nama | Isi |
|---|---|
| `APPS_SCRIPT_URL` | URL web app berakhiran `/exec` |
| `WA_PUSAT` | nomor WA admin, format `62812...` tanpa plus |
| `WA_DARURAT` | nomor darurat 24 jam (boleh kosong) |
| `COMPANY_NAME` | nama pemilik rekening |
| `COMPANY_BANK` | bank + nomor rekening |
| `SITE_URL` | `https://bolehnginep.com` |

Build produksi (otomatis di Vercel) gagal dengan pesan jelas kalau variabel wajib kosong atau Tailwind tidak berjalan. Untuk pratinjau demo set `BN_ALLOW_DEMO=1`.

**C. Cek setelah deploy**
- Katalog tampil dari Sheets, tidak ada rumah contoh.
- Buka DevTools > Console: tidak ada pesan "Refused to ..." (CSP).
- Booking uji dari HP: nominal + kode unik tampil, tombol Buka WhatsApp bekerja di Safari iOS dan di dalam browser Instagram.
- Admin: tandai LUNAS dengan nominal salah (harus ditolak), lalu benar. Tab LEDGER bertambah satu baris.
- Tunggu 60 menit: tanggal terbuka lagi. Email ringkasan harian tiba esok pagi.
- Jalankan `tests/load/k6-booking.js` pada salinan Sheets uji (bukan data asli) dan catat p95.
- Pulihkan satu backup ke Sheets baru untuk memastikan backup bisa dipakai.

## 2b. Rumah dan foto contoh (supaya katalog terlihat hidup)
- Katalog menampilkan 16 rumah contoh berlabel "Contoh" (tidak bisa dibooking) selama rumah asli kurang dari 8. Foto contoh berasal dari Unsplash.
- Menghapusnya tanpa deploy ulang: Apps Script > Project Settings > Script Properties > tambah `SHOW_SAMPLES` = `tidak`. Efek paling lambat 2 menit (cache).
- Cara lain: otomatis hilang saat rumah asli mencapai 8, atau set `SHOW_SAMPLES=false` di Vercel lalu Redeploy.
- Baris "Omah Pak Slamet (contoh)" di tab HOMESTAYS adalah baris asli dari `setupSheets()`. Hapus barisnya atau nonaktifkan dari panel admin saat rumah asli pertama sudah masuk.
- Rating pada rumah contoh fiktif. Jangan dikutip ke calon mitra sebagai data nyata.

## 3. Gerbang masuk Tahap 1 (semua harus ya)
- [ ] `ADMIN_TOKEN` dan `PIN_SALT` terisi, PIN mitra dibuat ulang
- [ ] 15 rumah minimal terverifikasi 13 poin (atau masih masa tenggang berlabel "sedang dicek ulang")
- [ ] Minimal 5 pendamping aktif di 3 destinasi, honor tetap per rumah disepakati tertulis
- [ ] Pesan WA admin sudah dibaca ulang dan disetujui
- [ ] Nomor WA cadangan disiapkan, dan nomor darurat 24 jam siap bila dipakai
- [ ] Rekening perusahaan siap, dan satu orang bertugas mencocokkan mutasi bank dengan LEDGER tiap hari
- [ ] Uji coba kering 10 booking dari orang yang dikenal lolos tanpa masalah
- [ ] Prosedur darurat (sakit, kecelakaan, ancaman) tertulis dan dipegang pendamping

## 4. Metrik pilot dan gerbang ke Fase 2 (usulan, sesuaikan)
Catat mingguan dari Sheets dan `track()`:
- Corong: lihat rumah → klik booking → LUNAS dalam 60 menit
- Booking selesai, persentase nominal kedaluwarsa, waktu dari booking ke LUNAS
- Refund per 100 booking, komplain per 100 booking, komplain berat (target 0)
- Rumah aktif yang menerima minimal 1 booking per bulan, waktu balasan pendamping
- Tamu yang memesan lagi

Usulan gerbang ke 10 destinasi dan 50 rumah: minimal 30 booking selesai, komplain berat 0, refund di bawah 10%, dan minimal 2 pendamping per destinasi memegang rumah dengan baik. Tentukan angka final sebelum pilot mulai supaya tidak digeser belakangan.

## 5. Pemicu yang menghentikan semua sebelum uang masuk
Sebelum booking berbayar pertama dari orang yang tidak dikenal:
1. Kajian hukum dan pajak usaha (izin usaha, pajak penghasilan platform, pajak daerah akomodasi, penampungan dana tamu).
2. Upgrade Vercel ke Pro (Hobby non-komersial). Biayanya $20 per bulan menurut halaman harga Vercel saat ini.
3. Syarat dan Kebijakan Privasi ditinjau, label "uji coba" dihapus.
4. Pertimbangkan Virtual Account otomatis (payment gateway) untuk menggantikan transfer manual.

## 6. Rilis berversi dan rollback
- Backend: `npm install`, salin `.clasp.json.example` jadi `.clasp.json` (isi scriptId), `npm run gas:login`, `npm run gas:push`, lalu `GAS_DEPLOYMENT_ID=... GAS_DESC="v2" npm run gas:deploy`. Catat ID deployment sebelumnya untuk kembali.
- Frontend: Vercel > Deployments > Promote deployment lama untuk rollback instan.
- Urutan rilis: backend dulu (kolom baru hanya menambah), jalankan `setupSheets()`, baru frontend. Rollback frontend aman karena server hanya menambah.

## 7. Yang belum terbukti
- Tidak ada uji ke Google Sheets sungguhan dan tidak ada uji beban (skrip k6 sudah siap).
- Build Tailwind produksi dan CSP sudah diuji di sandbox dengan Tailwind tiruan. Cek hasil build di Vercel dan Console browser.
- Tampilan di Safari iOS dan browser Instagram belum dicoba di perangkat.
- Pencegahan penyalahgunaan booking tanpa captcha lebih lemah: pantau tab BOOKINGS tiap hari selama pilot.
