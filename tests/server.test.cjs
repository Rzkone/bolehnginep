// Tes server (Code.gs) di Node tanpa Google. Jalankan: node tests/server.test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, Utilities: { formatDate: (d, tz, f) => '2026-11-22 18:00:00'.slice(0, f.length > 10 ? 19 : 10), getUuid: () => 'abcdef12-0000' }, CacheService: { getScriptCache: () => ({ remove() {}, get() { return null; }, put() {} }) }, SpreadsheetApp: {}, LockService: {}, PropertiesService: {} };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8') + '\n;this.STD_EXTRA_KEYS = STD_EXTRA_KEYS; this.CFG = CFG;', ctx);
const home = (o) => Object.assign({ _row: 2, id: 'H-001', name: 'Omah', host_wa: '6281200000001', host_name: 'Pak', pic_wa: '6281200000002', pic_name: 'Dewi', price_per_guest_night: 100000, capacity: 5, active: true, std1_kunci: true, std2_kamar_mandi: true, std3_kasur_linen: true, std4_listrik_cahaya: true, std5_privasi: true, std6_ratecard: true, std_extra_json: JSON.stringify(Object.fromEntries(ctx.STD_EXTRA_KEYS.map((k) => [k, true]))), services_json: '[]', host_open: '' }, o || {});
const db = { HOMESTAYS: [home()], BOOKINGS: [], SEASONS: [], AVAILABILITY: [], VERIFICATIONS: [], LEDGER: [], LOG: [], PICS: [] };
ctx.readAll_ = (n) => db[n].map((x) => Object.assign({}, x));
ctx.appendObj_ = (n, o) => { db[n].push(Object.assign({ _row: db[n].length + 2 }, o)); };
ctx.updateObj_ = (n, row, p) => { Object.assign(db[n].find((x) => x._row === row), p); };
ctx.adminGuard_ = () => null; ctx.spam_ = () => false;
ctx.createdMs_ = (v) => (v === 'OLD' ? Date.now() - 61 * 60000 : Date.now());
let ok = 0, bad = 0; const T = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const bk = (o) => Object.assign({ homestay_id: 'H-001', guest_name: 'Raka', guest_wa: '081200001111', checkin: '2026-12-10', nights: 2, guests: 1, addons: [], consent: true, consent: true }, o || {});
let n = 0; const wa = () => '08120000' + String(1000 + (++n));

let r = ctx.createBooking_(bk({ guest_wa: wa() }));
T('1 tamu 2 malam', r.ok && r.room_total === 200000 && r.kode_unik >= 1 && r.kode_unik <= 999 && r.jumlah_dibayar === 200000 + r.kode_unik && r.hold_minutes === 60);
db.BOOKINGS.length = 0;
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 4 })); T('4 tamu tanpa diskon = 800.000', r.ok && r.room_total === 800000 && r.diskon === 0); db.BOOKINGS.length = 0;
db.HOMESTAYS[0].group_pct = 20; db.HOMESTAYS[0].group_from = 3;
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 4 })); T('diskon 20% dari tamu ke-3 = 720.000', r.ok && r.room_total === 720000 && r.diskon === 80000); db.BOOKINGS.length = 0;
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 2 })); T('2 tamu belum kena diskon', r.ok && r.room_total === 400000); db.BOOKINGS.length = 0;
db.HOMESTAYS[0].group_pct = 30;
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 4 })); T('diskon 30% = 680.000', r.ok && r.room_total === 680000); db.BOOKINGS.length = 0;
db.HOMESTAYS[0].group_pct = 80;
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 4 })); T('diskon dibatasi maks 30%', r.ok && r.room_total === 680000); db.BOOKINGS.length = 0;
db.HOMESTAYS[0].group_pct = 0;
r = ctx.createBooking_(bk({ guest_wa: wa(), bayi: 1 })); T('bayi ditolak bila rumah tidak menerima', !r.ok && r.error === 'invalid_guests');
db.HOMESTAYS[0].terima_bayi = 'ya';
r = ctx.createBooking_(bk({ guest_wa: wa(), bayi: 2, guests: 5 })); T('bayi tidak menambah harga/kapasitas', r.ok && r.room_total === 1000000 && db.BOOKINGS[0].bayi === 2); db.BOOKINGS.length = 0;
r = ctx.createBooking_(bk({ guest_wa: wa(), bayi: 3 })); T('bayi maks 2', !r.ok);
r = ctx.createBooking_(bk({ guest_wa: wa(), guests: 6 })); T('melebihi kapasitas ditolak', !r.ok && r.error === 'invalid_guests');
// kode unik tidak bentrok antar booking yang menunggu
const capOld = ctx.CFG.MAX_PENDING_PER_HOME; ctx.CFG.MAX_PENDING_PER_HOME = 100; const codes = new Set(); for (let i = 0; i < 40; i++) { const x = ctx.createBooking_(bk({ guest_wa: wa(), checkin: ctx.dateAddDays_('2027-01-01', i * 3) })); if (x.ok) codes.add(x.kode_unik); }
T('40 kode unik berbeda', codes.size === 40); ctx.CFG.MAX_PENDING_PER_HOME = capOld; db.BOOKINGS.length = 0;
// hold 60 menit
ctx.createBooking_(bk({ guest_wa: wa() })); db.BOOKINGS[0].created_at = 'OLD';
r = ctx.createBooking_(bk({ guest_wa: wa() })); T('hold lewat 60 menit membuka tanggal', r.ok); db.BOOKINGS.length = 0;
r = ctx.createBooking_(bk({ guest_wa: wa() })); r = ctx.createBooking_(bk({ guest_wa: wa() })); T('hold aktif memblokir tanggal', !r.ok && r.error === 'dates_unavailable'); db.BOOKINGS.length = 0;
// refund pembulatan ke atas dan dasar jumlah_dibayar
T('refund 50% dibulatkan ke atas', ctx.computeRefund_({ status: 'LUNAS', jumlah_dibayar: 400347, room_total: 400000, checkin: '2026-11-24' }).refund === 200174);
T('refund 100% penuh', ctx.computeRefund_({ status: 'LUNAS', jumlah_dibayar: 400347, checkin: '2026-11-30' }).refund === 400347);
T('check-in hari ini 0', ctx.computeRefund_({ status: 'LUNAS', jumlah_dibayar: 400347, checkin: '2026-11-22' }).refund === 0);
// LUNAS harus pas
r = ctx.createBooking_(bk({ guest_wa: wa() })); const code = r.booking_code, jum = r.jumlah_dibayar;
T('nominal tidak pas ditolak', ctx.adminSetStatus_({ booking_code: code, status: 'LUNAS', paid_amount: jum - 1 }).error === 'amount_mismatch');
T('nominal pas diterima', ctx.adminSetStatus_({ booking_code: code, status: 'LUNAS', paid_amount: jum }).ok);
const b0 = db.BOOKINGS[0]; T('status LUNAS tersimpan', b0.status === 'LUNAS');
// batal 50% memakai jumlah_dibayar: host 75% platform 25% dari yang ditahan
b0.checkin = '2026-11-24'; const c2 = ctx.adminSetStatus_({ booking_code: code, status: 'BATAL', refund_percent: 50 });
T('batal 50%: refund+tahan = jumlah', c2.ok && c2.refund_amount === Math.ceil(jum * 0.5) && b0.take_amount + b0.host_payout === jum - c2.refund_amount);
// uang masuk terlambat, tanggal sudah diambil -> refund 100%
db.BOOKINGS.length = 0; r = ctx.createBooking_(bk({ guest_wa: wa() })); const lateCode = r.booking_code; db.BOOKINGS[0].created_at = 'OLD';
ctx.createBooking_(bk({ guest_wa: wa() })); // tamu lain mengambil tanggal
T('lunas terlambat tapi tanggal terambil ditolak', ctx.adminSetStatus_({ booking_code: lateCode, status: 'LUNAS' }).error === 'dates_taken');
const lr = ctx.adminSetStatus_({ booking_code: lateCode, status: 'BATAL', refund_percent: 100, received: true });
T('uang masuk terlambat: refund 100%', lr.ok && lr.refund_amount === db.BOOKINGS[0].jumlah_dibayar);
// standar v2 dan masa tenggang
const base6 = home({ std_extra_json: '' });
T('masa tenggang: recheck', ctx.stdState_(base6) === 'recheck' && ctx.homeOk_(base6));
T('lolos v2: ok', ctx.stdState_(home()) === 'ok');
T('standar dasar tidak lolos: fail', ctx.stdState_(home({ std2_kamar_mandi: false })) === 'fail');
const t0 = ctx.today_; ctx.today_ = () => '2027-01-05'; T('lewat masa tenggang: fail', ctx.stdState_(base6) === 'fail'); ctx.today_ = t0;
db.HOMESTAYS[0] = home({ std_extra_json: '' }); db.HOMESTAYS[0].active = true;
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
const pp = ctx.publicPayload_(); T('publik: rumah recheck tampil dengan 13 standar', pp.homestays[0].recheck === true && pp.homestays[0].standards.length === 13);
T('publik: contoh tampil secara default', pp.samples === true);
// verifikasi pendamping 13 poin
ctx.picAuth_ = () => ({ pic: { pic_name: 'Dewi' }, wa: '6281200000002' }); ctx.picHomes_ = () => db.HOMESTAYS;
const v = ctx.picVerify_({ homestay_id: 'H-001', std: Array(13).fill(true), note: 'sudah dicek', evidence_url: 'https://x.y/f.jpg' });
T('verifikasi 13 poin lolos v2', v.ok && v.result === 'LOLOS' && ctx.stdState_(db.HOMESTAYS[0]) === 'ok');
T('verifikasi 5 poin ditolak', ctx.picVerify_({ homestay_id: 'H-001', std: [true, true], note: 'x yz ok', evidence_url: '' }).error === 'invalid_fields');
// field rumah baru
const cf = ctx.cleanHomeFields_({ name: 'Rumah', destination: 'Bromo', city: 'a', area: 'b', price_per_guest_night: 90000, capacity: 3, host_name: 'Pak', host_wa: '081200000009', lingkungan_sekitar: 'Ada kebun sayur di belakang', terima_bayi: true, akses_kenyamanan: 'Tangga 5 anak tangga', group_from: 3, group_pct: 20 }, []);
T('field baru tersimpan', cf.ok && cf.v.terima_bayi === 'ya' && cf.v.group_pct === 20 && cf.v.lingkungan_sekitar.includes('kebun'));
T('diskon >30 ditolak', ctx.cleanHomeFields_({ name: 'Rumah', destination: 'Bromo', price_per_guest_night: 90000, capacity: 3, host_name: 'Pak', host_wa: '081200000009', group_pct: 40 }, []).field === 'group_pct');
// ---- hardening
db.BOOKINGS.length = 0; db.HOMESTAYS[0] = home({ terima_bayi: 'ya' });
const w1 = wa(); r = ctx.createBooking_(bk({ guest_wa: w1, checkin: '2027-02-01' })); T('booking pertama ok', r.ok);
r = ctx.createBooking_(bk({ guest_wa: w1, checkin: '2027-03-01' })); T('satu booking menunggu per WA', !r.ok && r.error === 'pending_exists');
db.BOOKINGS.length = 0;
for (let i = 0; i < 3; i++) ctx.createBooking_(bk({ guest_wa: wa(), checkin: ctx.dateAddDays_('2027-04-01', i * 3) }));
r = ctx.createBooking_(bk({ guest_wa: wa(), checkin: '2027-06-01' })); T('maks 3 booking menunggu per rumah', !r.ok && r.error === 'too_many_pending'); db.BOOKINGS.length = 0;
r = ctx.createBooking_(bk({ guest_wa: wa(), booking_code: 'BN-261122-AAAA' })); T('kode dari klien diabaikan', r.ok && r.booking_code !== 'BN-261122-AAAA'); db.BOOKINGS.length = 0;
db.LEDGER.length = 0; r = ctx.createBooking_(bk({ guest_wa: wa() })); const lc = r.booking_code;
ctx.adminSetStatus_({ booking_code: lc, status: 'LUNAS' });
T('LUNAS tercatat di LEDGER', db.LEDGER.length === 1 && db.LEDGER[0].type === 'MASUK' && db.LEDGER[0].amount === db.BOOKINGS[0].jumlah_dibayar);
db.BOOKINGS[0].checkin = '2026-11-24'; ctx.adminSetStatus_({ booking_code: lc, status: 'BATAL', refund_percent: 50 });
T('refund tercatat di LEDGER', db.LEDGER.some((l) => l.type === 'REFUND' && l.amount === Math.ceil(db.BOOKINGS[0].jumlah_dibayar * 0.5)));
ctx.MailApp = { sendEmail() {} }; ctx.Session = { getEffectiveUser: () => ({ getEmail: () => 'a@b.c' }) };
T('pemeriksa: tanpa masalah', ctx.dailyCheck().length === 0);
db.BOOKINGS.push({ _row: 99, booking_code: 'BN-X', status: 'LUNAS', room_total: 100, kode_unik: 5, jumlah_dibayar: 999 });
T('pemeriksa: temukan nominal salah dan LUNAS tanpa LEDGER', ctx.dailyCheck().length === 2);
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => ({ ADMIN_TOKEN: 'abc' }[k]) }) };
T('token admin pendek ditolak', ctx.isAdmin_('abc') === false);
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => ({ ADMIN_TOKEN: 'token-admin-panjang-123' }[k]) }) };
T('token admin panjang diterima', ctx.isAdmin_('token-admin-panjang-123') === true);
let thrown = false; try { ctx.pinHash_('host', 'H-001', '123456'); } catch (e) { thrown = true; } T('PIN_SALT kosong: gagal aman', thrown);
console.log('server:', ok, 'ok', bad, 'bad'); process.exit(bad ? 1 : 0);
