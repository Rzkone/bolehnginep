# Skema Google Sheets — bolehnginep (v3)

Buat 1 Spreadsheet, buka Extensions > Apps Script, tempel `Code.gs`, jalankan `setupSheets()` sekali. Script membuat **8 tab** (HOMESTAYS, BOOKINGS, REVIEWS, AVAILABILITY, SEASONS, COMPLAINTS, PICS, PAYOUTS), header, dropdown, dan baris contoh. Lalu jalankan `setupDailyTrigger()` sekali agar ledger payout dibuat otomatis tiap hari.

## Tab 1 — HOMESTAYS (1 baris = 1 rumah mitra)

| Kolom | Isi |
|---|---|
| id | Unik, mis. `H-001` |
| active | TRUE/FALSE. Rumah tampil di web hanya jika active = TRUE, keenam std = TRUE, **dan** tarif ≤ Rp 100.000. Rumah dari form "Daftarkan Rumahmu" masuk dengan active = FALSE |
| name, destination, city, area | Teks |
| price_per_guest_night | Rp per tamu per malam (angka) |
| capacity | Maks tamu |
| host_name, host_wa | Pemilik rumah (WA format 62…, tidak pernah dikirim ke publik) |
| pic_name, pic_wa | PIC Area (WA tidak dikirim ke publik) |
| moods | Pisahkan koma: `gunung,pesisir,kopi,solo` |
| std1_kunci … std6_ratecard | TRUE/FALSE untuk 6 standar |
| std_verified_at | Tanggal verifikasi PIC `yyyy-mm-dd` |
| desc_id, desc_en | Deskripsi singkat |
| services_json | Rate card, contoh: `[{"id":"sarapan","name":{"id":"Sarapan","en":"Breakfast"},"price":15000,"unit":"perGuestPerNight"}]`. Unit: `perGuestPerNight`, `perNight`, `perGuest`, `flat` |
| photo_url | Opsional (https). Kosong = ilustrasi SVG bawaan |
| peak_price | Tarif musim ramai per tamu per malam, maks Rp 130.000. Kosong/0 = tidak ada tarif musim ramai |
| photo_urls | Beberapa URL https dipisah `|` |
| map_url | Link Google Maps (https) |
| distance_id, distance_en | Teks jarak ke destinasi |
| checkin_time, checkout_time | Mis. `14:00`, `11:00` |
| house_rules_id, house_rules_en | Aturan rumah, dipisah `|` |
| host_bank_name, host_bank_account, host_bank_holder | Rekening payout pemilik. **Tidak pernah dikirim ke publik** |
| featured | TRUE untuk rumah sorotan |
| rating_home_avg/count, rating_host_pic_avg/count | **Otomatis** dari ulasan |
| first_guest_done, first_guest_rating | **Otomatis** (tamu pertama) |
| acq_bonus_status, acq_bonus_amount | **Otomatis**: MENUNGGU_VERIFIKASI (baru daftar) → TERTAHAN → LAYAK_CAIR saat rumah punya 2 ulasan ≥ 4/5 dari **tamu berbeda** (lalu admin ubah manual ke DIBAYAR) |
| created_at | Waktu input |

## Tab 2 — BOOKINGS (diisi otomatis saat tamu booking)

booking_code, created_at, homestay_id, homestay_name, destination, guest_name, guest_wa, checkin, nights, guests, room_total, addons_json, addon_estimate, note, **status**, pic_name, host_name, forwarded_pic, forwarded_host, review_done, rating_home, rating_host_pic, rating_basis, commission_amount, **commission_status**, take_amount, host_payout, **host_payout_status**, refund_amount, cancelled_at, refund_status, consent_at

- `status` (dropdown): MENUNGGU_PEMBAYARAN → **LUNAS** → SELESAI / BATAL. Admin Pusat mengubah manual ke LUNAS setelah tamu membayar kamar. Ulasan hanya bisa dikirim saat LUNAS atau SELESAI.
- `commission_status`: TERTAHAN → LAYAK_CAIR (rating ≥ 4.0) atau TIDAK_CAIR (otomatis saat ulasan masuk).
- `take_amount` = room_total × TAKE_RATE (Pusat + komisi PIC). `host_payout` = sisanya. Payout pemilik jatuh tempo H+1 setelah check-in (lihat tab PAYOUTS). `refund_amount` dan `refund_status` (MENUNGGU_REFUND → DIBAYAR) diisi otomatis saat tamu membatalkan; admin mentransfer lalu mengubah status manual. `consent_at` = waktu tamu menyetujui Syarat & Privasi.
- `room_total` selalu dihitung ulang server dari harga di tab HOMESTAYS.

## Tab 3 — REVIEWS

review_id, created_at, booking_code, homestay_id, guest_name, rating_home, review_home, rating_host_pic, review_host_pic, visible, host_reply, host_reply_at

`visible` FALSE menyembunyikan ulasan dari publik. Moderasi dan balasan host bisa dari panel Dispatch > tab Ulasan.

## Tab 4 — AVAILABILITY (tanggal tidak tersedia)

homestay_id, date_from, date_to (`yyyy-mm-dd`, inklusif), reason. Malam yang masuk rentang ini ditolak server (`dates_unavailable`) dan tampil abu-abu di kalender.

## Tab 5 — SEASONS (musim ramai, berlaku semua rumah)

date_from, date_to, label. Malam dalam rentang memakai `peak_price` rumah (jika terisi). Harga dihitung per malam, jadi menginap yang menyeberang musim memakai campuran tarif.

## Tab 6 — COMPLAINTS

complaint_id, created_at, booking_code, homestay_id, category, description, status, handled_by, resolution. Kategori: kebersihan, keamanan, tagihan_di_luar_rate_card, perilaku_pemilik_pic, lainnya. Tamu mengirim dengan kode booking + 4 digit WA. Admin menangani manual.

## Tab 7 — PICS (data PIC untuk payout)

pic_name, pic_wa, area, bank_name, bank_account, bank_holder, status, joined_at. `pic_name` harus sama persis dengan yang ada di HOMESTAYS/BOOKINGS agar payout komisi dan bonus menemukan rekening.

## Tab 8 — PAYOUTS (ledger, dibuat oleh `generatePayouts()`)

payout_id, created_at, type, ref, payee_name, bank_name, bank_account, bank_holder, amount, due_date, status, paid_at, note.
- `HOST`: per booking, jatuh tempo H+1 setelah check-in (booking LUNAS/SELESAI).
- `PIC_COMMISSION`: per booking dengan ulasan ≥ 4/5.
- `PIC_BONUS`: rumah berstatus LAYAK_CAIR.
- `REFUND`: tamu yang membatalkan dan berhak refund.
Idempoten (kunci type|ref), aman dijalankan berulang. Admin mentransfer manual lalu mengubah `status` ke DIBAYAR dan mengisi `paid_at`.

## Tab 9 — VERIFICATIONS (riwayat survei PIC)

verification_id, created_at, homestay_id, pic_wa, std1..std6, result, note, evidence_url. Satu baris per survei, tidak pernah ditimpa (jejak audit). `result` = LOLOS atau TIDAK_LOLOS. LOLOS wajib `evidence_url` https (foto bukti). Hasil survei juga menulis flag std ke HOMESTAYS, `pic_name`, `pic_wa`, `std_verified_at`.

## Kolom PIN (hash, bukan PIN asli)

- HOMESTAYS: `host_pin_hash`. PICS: `pin_hash`. Jangan isi manual. Dibuat lewat admin (tab "Rumah & PIN" di Admin Pusat) atau aksi `adminSetPin`. Hash = SHA-256 dengan garam `PIN_SALT`.
- **Jangan ganti `PIN_SALT` setelah PIN dibuat**, semua PIN lama jadi tidak valid.
- Salah PIN 5x per jam per akun = terkunci sementara.

## Alur verifikasi & aktivasi rumah

1. Pemilik mendaftar (rumah masuk HOMESTAYS, `active` FALSE).
2. PIC area survei di Portal Mitra, centang 6 standar, isi catatan dan link foto bukti, kirim.
3. Jika LOLOS, rumah tetap **belum tayang**. Admin membuka tab "Rumah & PIN" lalu menekan Aktifkan (ditolak jika 6 standar belum lolos).
4. Admin membuat PIN host (6 digit) dan mengirimnya lewat WA.

## Aksi API (doPost)

- Publik: booking, lookup, review, complaint, register (dengan honeypot, rate limit, kunci per WA).
- Host (`homestay_id` + `pin`): `hostLogin`, `hostBlock` (ditolak jika ada booking aktif), `hostUnblock`, `hostReply`.
- PIC (`pic_wa` + `pin`): `picLogin`, `picVerify`.
- Admin (`token` = ADMIN_TOKEN): `adminSetStatus` (MENUNGGU→LUNAS, LUNAS→SELESAI, MENUNGGU/LUNAS→BATAL + `refund_percent`), `adminPayouts`, `adminMarkPaid`, `adminHomes`, `adminSetHome`, `adminSetPin` (role host/pic).

## Pengaturan keuangan & insentif (objek `CFG` di Code.gs)

- `MAX_PRICE_PER_GUEST_NIGHT` 100000: plafon tarif kamar per tamu per malam.
- `MAX_PEAK_PRICE_PER_GUEST_NIGHT` 130000: plafon tarif musim ramai.
- `TAKE_RATE` 0.25: potongan dari tarif kamar (Pusat + PIC). Pemilik menerima 75%.
- Refund: `REFUND_FULL_DAYS` 3 (≥3 hari sebelum check-in = 100%), `REFUND_HALF_DAYS` 1 dan `REFUND_HALF_PERCENT` 0.5 (1 sampai <3 hari = 50%), kurang dari 1 hari atau no-show = 0. Force majeure ditangani manual. Pembatalan oleh host = 100% (manual).
- Anti-spam: `MIN_FILL_MS` 2500, batas per jam di blok `RL`. Kunci percobaan lookup salah: 5x per jam per kode. Admin salah PIN 5x = terkunci 15 menit (global).
- `PIC_COMMISSION_PERCENT` 0.05 (bagian PIC, sudah termasuk di TAKE_RATE) dan `ACQUISITION_BONUS` 50000: **placeholder, ubah sesuai kebijakan**.
- `MIN_REVIEWS_FOR_ACQ_BONUS` 2 dan `MIN_RATING` 4.0.
- `INCENTIVE_RATING_BASIS`: `AVG` (rata-rata rating rumah & pemilik/PIC) atau `HOST_PIC`.

## Deploy

1. Script Properties > tambah `ADMIN_TOKEN` = PIN panel Admin (tanpa ini semua endpoint admin ditolak) dan `PIN_SALT` = teks acak panjang (dipakai hash PIN host/PIC, jangan diganti lagi). Jalankan `setupSheets()` sekali agar 9 tab dan kolom baru dibuat.
2. Deploy > New deployment > Web app > Execute as **Me**, Access **Anyone**. Salin URL `/exec`.
3. Di `index.html` (atau lewat Environment Variables Vercel) isi `APPS_SCRIPT_URL`, `WA_PUSAT`, `COMPANY_NAME` (nama pemilik rekening), dan `COMPANY_BANK` (bank + nomor rekening, dipakai template pesan WA). Setiap ubah Code.gs, buat **New version** deployment.
4. Deploy ke Vercel dengan build (lihat di bawah), atau upload `index.html` saja (tetap jalan dengan Tailwind CDN).

## Build produksi (Vercel)

`npm install` lalu `npm run build` (menjalankan `node build.mjs` di root repo): membuat `dist/` berisi index.html, `destinasi/<slug>/index.html` (SEO + JSON-LD), `sitemap.xml`, `robots.txt`, dan `tw.css` (menggantikan Tailwind CDN). Set Environment Variables di Vercel: `APPS_SCRIPT_URL`, `WA_PUSAT`, `COMPANY_NAME`, `COMPANY_BANK`, `PLAUSIBLE_DOMAIN` (opsional), `SITE_URL`. Build juga membuat `rumah/<id>/index.html` (pratinjau WA/OG, noindex) dan menyalakan `BUILT=true` agar tombol Bagikan memakai link itu. File yang harus ada di root repo: `index.html`, `admin.js` (modul Admin + Portal Mitra, dimuat hanya saat tombolnya diklik), `build.mjs`, `package.json`, `tailwind.config.cjs`, `input.css`, `vercel.json`. Build memakai esbuild (minify) bila terpasang. Build command `npm run build`, output directory `dist` (sudah ada di `vercel.json`).


## Ketersediaan (v3.1): host yang atur sendiri
- Tab **HOMESTAYS** punya kolom baru **host_open** (paling kanan, setelah host_pin_hash). Kosong = buka. Jalankan `setupSheets()` lagi: hanya baris header yang ditulis ulang, data tidak disentuh.
- Host atur sendiri di Portal Mitra: tombol Buka/Tutup sementara dan blokir tanggal. Langsung tayang.
- Admin hanya melihat (tab Ketersediaan). Tutup paksa lewat Nonaktifkan di tab Rumah & PIN.
- Endpoint baru: hostSetOpen, adminAvail. Booking ke rumah yang tutup ditolak server (home_closed).

## Tab LOG (catatan perubahan data)
Dibuat otomatis oleh `setupSheets()`. Kolom: at, actor, action, target, before, after. Diisi setiap admin menambah/mengedit rumah, host, atau PIC lewat panel Admin → Rumah & PIN. Nomor rekening hanya dicatat 4 digit terakhir.

## Tambahan fondasi (Tahap B–E)

Jalankan ulang `setupSheets()` sekali setelah memasang Code.gs baru. Header baru ditambahkan di ujung kanan, data lama tidak bergeser.
Jalankan juga `setupBackup()` sekali untuk backup mingguan (salinan Sheets tiap Minggu pukul 03.00, salinan lebih dari 8 minggu dihapus).

**HOMESTAYS (baru):** `std_extra_json` (7 poin standar v2 sebagai JSON), `lingkungan_sekitar`, `terima_bayi` (`ya` atau kosong), `akses_kenyamanan`, `group_from` (default 3), `group_pct` (0 sampai 30, default 0).
**BOOKINGS (baru):** `bayi`, `kode_unik` (001 sampai 999), `jumlah_dibayar` (tarif kamar + kode unik; dasar semua hitungan komisi, payout, dan refund), `diskon`.
**VERIFICATIONS (baru):** `extra_json`.

Standar v2: rumah yang baru lolos 6 poin lama tetap tayang berlabel "sedang dicek ulang" sampai `CFG.STD_GRACE_UNTIL` (2026-12-31), lalu disembunyikan sampai pendamping memverifikasi 13 poin.
`CFG.HOLD_MINUTES` = 60 (nominal transfer berlaku 60 menit sejak booking dikirim). `CFG.KAS_RATE` dan `CFG.KAS_CAP` baru berupa konstanta kas jaminan, pencatatannya masih manual.
Batas migrasi dari Apps Script: pertimbangkan pindah bila booking di atas sekitar 300 per bulan atau waktu respons konsisten di atas 3 detik.

## Pengamanan (wajib sebelum dipakai)

Isi di Apps Script > Project Settings > Script Properties:
- `ADMIN_TOKEN` minimal 8 karakter (disarankan 12 atau lebih). Kalau lebih pendek, admin tertutup.
- `PIN_SALT` minimal 16 karakter acak. Tanpa ini PIN tuan rumah dan pendamping tidak bisa dibuat atau diperiksa. Setelah mengisi atau mengganti garam, buat ulang PIN semua mitra.

Jalankan `setupSheets()` (membuat tab `LEDGER`) lalu `setupBackup()` (menggantikan backup mingguan): backup harian 03.00 (disimpan 14 hari) dan pemeriksa integritas harian 07.00 yang mengirim email ringkasan. Kalau admin terkunci, jalankan `unlockAdmin()` dari editor.
Tab `LEDGER` hanya bertambah: jangan edit atau hapus barisnya. Setiap booking LUNAS wajib punya baris `MASUK`, setiap refund punya baris `REFUND`.
