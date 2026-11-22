/**
 * bolehnginep.com — Backend Google Apps Script (v2)
 * Tab wajib: HOMESTAYS, BOOKINGS, REVIEWS, AVAILABILITY, SEASONS, COMPLAINTS, PICS, PAYOUTS
 * Jalankan setupSheets() sekali, lalu setupDailyTrigger() sekali.
 *
 * DEPLOY: Deploy > New deployment > Web app | Execute as: Me | Who has access: Anyone
 * ADMIN : Script Properties (Project Settings) key ADMIN_TOKEN = PIN panel Admin.
 *         Tanpa ADMIN_TOKEN semua endpoint admin ditolak.
 */

const CFG = {
  MIN_RATING: 4.0,
  MAX_PRICE_PER_GUEST_NIGHT: 100000,      // plafon tarif hari biasa (Rp per tamu per malam)
  MAX_PEAK_PRICE_PER_GUEST_NIGHT: 130000, // plafon tarif musim ramai (tab SEASONS)
  TAKE_RATE: 0.25,                        // potongan dari tarif kamar (Pusat + komisi PIC). Pemilik terima 75%
  PIC_COMMISSION_PERCENT: 0.05,           // bagian PIC dari tarif kamar (sudah termasuk di TAKE_RATE)
  ACQUISITION_BONUS: 50000,               // placeholder, ubah sesuai kebijakan
  MIN_REVIEWS_FOR_ACQ_BONUS: 2,           // ulasan >= MIN_RATING dari tamu BERBEDA
  INCENTIVE_RATING_BASIS: 'AVG',          // 'AVG' | 'HOST_PIC'
  MAX_NIGHTS: 5,
  MIN_ADMIN_TOKEN: 8,                     // ADMIN_TOKEN di Script Properties minimal sekian karakter (disarankan 12+)
  MAX_PENDING_PER_HOME: 3,                // batas booking menunggu pembayaran per rumah (mencegah penahanan tanggal massal)
  HOLD_MINUTES: 60,                       // nominal transfer berlaku selama ini sejak diterbitkan (saat booking dikirim), lalu tanggal terbuka lagi
  STD_GRACE_UNTIL: '2026-12-31',          // rumah lama (belum lolos standar v2) tetap tayang berlabel 'perlu cek ulang' sampai tanggal ini
  GROUP_MAX_PCT: 30, MAX_BAYI: 2, UNIQUE_CODE_MAX: 999,
  KAS_RATE: 0.10, KAS_CAP: 5000000,       // kas jaminan: 10% komisi platform per booking selesai, batas awal Rp5.000.000 (pencatatan di sheet, belum otomatis)
  TZ: 'Asia/Jakarta',
  CACHE_SECONDS: 120,
  REVIEW_ALLOWED_STATUS: ['LUNAS', 'SELESAI'],
  REFUND_FULL_DAYS: 3,                    // batal >= 3 hari sebelum check-in: refund 100%
  REFUND_HALF_DAYS: 1,                    // batal 1 sampai <3 hari: refund 50%; kurang dari itu: 0%
  REFUND_HALF_PERCENT: 0.5,
  MIN_FILL_MS: 2500,                      // form yang terkirim lebih cepat dari ini dianggap bot
  RL: {
    BOOKING_PER_WA_PER_HOUR: 3, BOOKING_GLOBAL_PER_10MIN: 60,
    LOOKUP_FAILS_PER_HOUR: 5,             // salah kode booking/4 digit WA per kode
    PARTNER_FAILS_PER_HOUR: 5,            // PIN host/PIC salah per akun
    ADMIN_FAILS: 5, ADMIN_LOCK_SEC: 900,  // PIN admin salah berulang -> kunci 15 menit
    REGISTER_PER_WA_PER_DAY: 2, COMPLAINT_PER_CODE_PER_DAY: 3
  },
  COMPLAINT_CATEGORIES: ['kebersihan', 'keamanan', 'tagihan_di_luar_rate_card', 'perilaku_pemilik_pic', 'lainnya']
};

const STD_KEYS = ['std1_kunci', 'std2_kamar_mandi', 'std3_kasur_linen', 'std4_listrik_cahaya', 'std5_privasi', 'std6_ratecard'];
// Standar v2: 7 poin tambahan disimpan sebagai JSON (std_extra_json) supaya daftar standar bisa bertambah tanpa menambah kolom.
const STD_EXTRA_KEYS = ['x7_bau_lingkungan', 'x8_kandang_menempel', 'x9_kebersihan_umum', 'x10_kebersihan_tuan_rumah', 'x11_sikap_tuan_rumah', 'x12_kapasitas_kasur', 'x13_keselamatan'];
function stdExtra_(h) { const o = parseJson_(h.std_extra_json, {}); return STD_EXTRA_KEYS.map(function (k) { return o[k] === true; }); }
function stdBaseOk_(h) { return STD_KEYS.every(function (k) { return isTrue_(h[k]); }); }
// 'ok' = lolos v2; 'recheck' = lolos standar lama, masih masa tenggang; 'fail' = tidak tayang
function stdState_(h) {
  if (!stdBaseOk_(h)) return 'fail';
  if (stdExtra_(h).every(function (v) { return v; })) return 'ok';
  return today_() <= CFG.STD_GRACE_UNTIL ? 'recheck' : 'fail';
}
function homeOk_(h) { return stdState_(h) !== 'fail'; }
function paid_(bk) { return Number(bk.jumlah_dibayar) || Number(bk.room_total) || 0; }

const HEADERS = {
  HOMESTAYS: ['id', 'active', 'name', 'destination', 'city', 'area', 'price_per_guest_night', 'capacity',
    'host_name', 'host_wa', 'pic_name', 'pic_wa', 'moods'].concat(STD_KEYS).concat(['std_verified_at',
    'desc_id', 'desc_en', 'services_json', 'photo_url', 'featured',
    'rating_home_avg', 'rating_home_count', 'rating_host_pic_avg', 'rating_host_pic_count',
    'first_guest_done', 'first_guest_rating', 'acq_bonus_status', 'acq_bonus_amount', 'created_at',
    'peak_price', 'photo_urls', 'map_url', 'distance_id', 'distance_en', 'checkin_time', 'checkout_time',
    'house_rules_id', 'house_rules_en', 'host_bank_name', 'host_bank_account', 'host_bank_holder', 'host_pin_hash', 'host_open',
    'std_extra_json', 'lingkungan_sekitar', 'terima_bayi', 'akses_kenyamanan', 'group_from', 'group_pct']),
  BOOKINGS: ['booking_code', 'created_at', 'homestay_id', 'homestay_name', 'destination', 'guest_name', 'guest_wa',
    'checkin', 'nights', 'guests', 'room_total', 'addons_json', 'addon_estimate', 'note', 'status',
    'pic_name', 'host_name', 'forwarded_pic', 'forwarded_host', 'review_done', 'rating_home', 'rating_host_pic',
    'rating_basis', 'commission_amount', 'commission_status',
    'take_amount', 'host_payout', 'host_payout_status', 'refund_amount',
    'cancelled_at', 'refund_status', 'consent_at',
    'bayi', 'kode_unik', 'jumlah_dibayar', 'diskon'],
  REVIEWS: ['review_id', 'created_at', 'booking_code', 'homestay_id', 'guest_name',
    'rating_home', 'review_home', 'rating_host_pic', 'review_host_pic', 'visible', 'host_reply', 'host_reply_at'],
  AVAILABILITY: ['homestay_id', 'date_from', 'date_to', 'reason'],
  SEASONS: ['date_from', 'date_to', 'label'],
  COMPLAINTS: ['complaint_id', 'created_at', 'booking_code', 'homestay_id', 'category', 'description', 'status', 'handled_by', 'resolution'],
  PICS: ['pic_name', 'pic_wa', 'area', 'bank_name', 'bank_account', 'bank_holder', 'status', 'joined_at', 'pin_hash'],
  VERIFICATIONS: ['verification_id', 'created_at', 'homestay_id', 'pic_wa', 'std1_kunci', 'std2_kamar_mandi', 'std3_kasur_linen', 'std4_listrik_cahaya', 'std5_privasi', 'std6_ratecard', 'result', 'note', 'evidence_url', 'extra_json'],
  LOG: ['at', 'actor', 'action', 'target', 'before', 'after'],
  LEDGER: ['at', 'booking_code', 'type', 'amount', 'actor', 'note'],   // hanya bertambah, jangan diedit atau dihapus
  PAYOUTS: ['payout_id', 'created_at', 'type', 'ref', 'payee_name', 'bank_name', 'bank_account', 'bank_holder', 'amount', 'due_date', 'status', 'paid_at', 'note']
};

/* ============ ENTRY POINTS ============ */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'homestays';
    if (action === 'homestays') return json_(Object.assign({ ok: true }, publicPayload_()));
    if (action === 'reviews') return json_({ ok: true, reviews: publicReviews_(String(p.id || '')) });
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let body;
  try {
    lock.waitLock(20000);
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action) {
      case 'createBooking': return json_(createBooking_(body));
      case 'submitReview': return json_(submitReview_(body));
      case 'bookingStatus': return json_(bookingStatus_(body));
      case 'cancelBooking': return json_(cancelBooking_(body));
      case 'submitComplaint': return json_(submitComplaint_(body));
      case 'registerHome': return json_(registerHome_(body));
      case 'adminBookings': return json_(adminBookings_(body));
      case 'markForwarded': return json_(markForwarded_(body));
      case 'adminReviews': return json_(adminReviews_(body));
      case 'moderateReview': return json_(moderateReview_(body));
      case 'hostLogin': return json_(hostLogin_(body));
      case 'hostBlock': return json_(hostBlock_(body));
      case 'hostUnblock': return json_(hostUnblock_(body));
      case 'hostSetOpen': return json_(hostSetOpen_(body));
      case 'adminAvail': return json_(adminAvail_(body));
      case 'hostReply': return json_(hostReply_(body));
      case 'picLogin': return json_(picLogin_(body));
      case 'picVerify': return json_(picVerify_(body));
      case 'adminSetStatus': return json_(adminSetStatus_(body));
      case 'adminPayouts': return json_(adminPayouts_(body));
      case 'adminMarkPaid': return json_(adminMarkPaid_(body));
      case 'adminHomes': return json_(adminHomes_(body));
      case 'adminSetHome': return json_(adminSetHome_(body));
      case 'adminSetPin': return json_(adminSetPin_(body));
      case 'adminHomeGet': return json_(adminHomeGet_(body));
      case 'adminHomeSave': return json_(adminHomeSave_(body));
      case 'adminPicSave': return json_(adminPicSave_(body));
      case 'clientError': return json_(clientError_(body));
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    const eid = 'E' + Math.floor(Math.random() * 1e6);
    logChange_('SERVER_ERROR', eid, {}, { msg: String(err && err.message || err).slice(0, 200), action: String((typeof body !== 'undefined' && body && body.action) || '') }, 'system');
    return json_({ ok: false, error: 'server', error_id: eid });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ============ PUBLIC: HOMESTAYS + MUSIM + KETERSEDIAAN ============ */

function publicPayload_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public_v2');
  if (hit) return JSON.parse(hit);
  const homes = readAll_('HOMESTAYS')
    .filter(function (h) {
      return h.id && isTrue_(h.active) && homeOk_(h) &&
        Number(h.price_per_guest_night) <= CFG.MAX_PRICE_PER_GUEST_NIGHT;
    })
    .map(function (h) {
      const peak = Number(h.peak_price) || 0;
      return {
        id: String(h.id), name: str_(h.name), destination: str_(h.destination), city: str_(h.city), area: str_(h.area),
        price: Number(h.price_per_guest_night) || 0,
        peakPrice: (peak > 0 && peak <= CFG.MAX_PEAK_PRICE_PER_GUEST_NIGHT) ? peak : 0,
        capacity: Number(h.capacity) || 1,
        host: str_(h.host_name), pic: str_(h.pic_name),
        moods: splitList_(h.moods, ','),
        standards: STD_KEYS.map(function (k) { return isTrue_(h[k]); }).concat(stdExtra_(h)),
        recheck: stdState_(h) === 'recheck',
        lingkungan: str_(h.lingkungan_sekitar), akses: str_(h.akses_kenyamanan), terimaBayi: str_(h.terima_bayi) === 'ya',
        groupFrom: Math.max(2, Math.floor(Number(h.group_from)) || 3), groupPct: Math.max(0, Math.min(CFG.GROUP_MAX_PCT, Math.floor(Number(h.group_pct)) || 0)),
        verified: fmtDate_(h.std_verified_at),
        desc: { id: str_(h.desc_id), en: str_(h.desc_en) },
        services: parseJson_(h.services_json, []),
        photo: httpsOnly_(h.photo_url),
        photos: splitList_(h.photo_urls, '|').map(httpsOnly_).filter(Boolean),
        mapUrl: httpsOnly_(h.map_url),
        distance: { id: str_(h.distance_id), en: str_(h.distance_en) },
        checkinTime: time_(h.checkin_time, '14:00'), checkoutTime: time_(h.checkout_time, '11:00'),
        rules: { id: splitList_(h.house_rules_id, '|'), en: splitList_(h.house_rules_en, '|') },
        featured: isTrue_(h.featured), open: h.host_open === '' || h.host_open === undefined || isTrue_(h.host_open),
        ratingHome: Number(h.rating_home_avg) || 0, countHome: Number(h.rating_home_count) || 0,
        ratingHost: Number(h.rating_host_pic_avg) || 0, countHost: Number(h.rating_host_pic_count) || 0
      };
    });
  const seasons = seasons_().map(function (x) { return { from: x.from, to: x.to, label: x.label }; });
  const blocks = {};
  readAll_('AVAILABILITY').forEach(function (r) {
    const f = fmtDate_(r.date_from), t = fmtDate_(r.date_to) || f;
    if (!r.homestay_id || !f) return;
    (blocks[String(r.homestay_id)] = blocks[String(r.homestay_id)] || []).push([f, t]);
  });
  const allBookings = readAll_('BOOKINGS');   // satu kali baca untuk semua rumah (sebelumnya sekali per rumah)
  homes.forEach(function (h) { takenRanges_(h.id, '', allBookings).forEach(function (r) { (blocks[h.id] = blocks[h.id] || []).push(r); }); });
  const payload = { homestays: homes, seasons: seasons, blocks: blocks, samples: String(PropertiesService.getScriptProperties().getProperty('SHOW_SAMPLES') || '').toLowerCase() !== 'tidak' };
  try { cache.put('public_v2', JSON.stringify(payload), CFG.CACHE_SECONDS); } catch (e) {}
  return payload;
}

function publicReviews_(homeId) {
  if (!homeId) return [];
  return readAll_('REVIEWS')
    .filter(function (r) { return String(r.homestay_id) === homeId && isTrue_(r.visible); })
    .slice(-20).reverse()
    .map(function (r) {
      return {
        who: String(r.guest_name || '').split(' ')[0], date: str_(r.created_at).slice(0, 10),
        ratingHome: Number(r.rating_home) || 0, textHome: str_(r.review_home),
        ratingHost: Number(r.rating_host_pic) || 0, textHost: str_(r.review_host_pic),
        reply: str_(r.host_reply)
      };
    });
}

/* ============ PUBLIC: CREATE BOOKING ============ */

function createBooking_(b) {
  if (spam_(b)) return { ok: false, error: 'spam' };
  if (b.consent !== true) return { ok: false, error: 'consent_required' };
  const home = readAll_('HOMESTAYS').filter(function (h) {
    return String(h.id) === String(b.homestay_id) && isTrue_(h.active) && homeOk_(h);
  })[0];
  if (!home) return { ok: false, error: 'homestay_not_active' };

  const name = clean_(b.guest_name, 80);
  const wa = normPhone_(b.guest_wa);
  const nights = Math.floor(Number(b.nights));
  const guests = Math.floor(Number(b.guests));
  const checkin = String(b.checkin || '');
  if (name.length < 2) return { ok: false, error: 'invalid_name' };
  if (!/^62\d{8,13}$/.test(wa)) return { ok: false, error: 'invalid_wa' };
  if (!(nights >= 1 && nights <= CFG.MAX_NIGHTS)) return { ok: false, error: 'invalid_nights' };
  const bayi = Math.floor(Number(b.bayi) || 0);
  if (!(guests >= 1 && guests <= Number(home.capacity))) return { ok: false, error: 'invalid_guests' };
  if (!(bayi >= 0 && bayi <= CFG.MAX_BAYI) || (bayi > 0 && str_(home.terima_bayi) !== 'ya')) return { ok: false, error: 'invalid_guests' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || checkin < today_()) return { ok: false, error: 'invalid_checkin' };

  if (!hit_('bk_wa_' + wa, CFG.RL.BOOKING_PER_WA_PER_HOUR, 3600) || !hit_('bk_all', CFG.RL.BOOKING_GLOBAL_PER_10MIN, 600)) return { ok: false, error: 'rate_limited' };

  // Harga SELALU dihitung ulang di server (tarif musiman per malam). Nilai klien tidak dipercaya.
  const base = Number(home.price_per_guest_night) || 0;
  if (base > CFG.MAX_PRICE_PER_GUEST_NIGHT) return { ok: false, error: 'homestay_not_active' };
  const peak = Math.min(Number(home.peak_price) || 0, CFG.MAX_PEAK_PRICE_PER_GUEST_NIGHT);
  const seasons = seasons_();
  const nightsList = nightsList_(checkin, nights);
  if (!(home.host_open === '' || home.host_open === undefined || isTrue_(home.host_open))) return { ok: false, error: 'home_closed' };
  // Kirim ulang permintaan yang sama (klik dobel, koneksi putus lalu diulang) mengembalikan booking yang sama, bukan menolaknya.
  const allB = readAll_('BOOKINGS');   // satu kali baca untuk seluruh proses booking
  const dup = allB.filter(function (x) {
    return String(x.homestay_id) === String(home.id) && normPhone_(x.guest_wa) === wa && fmtDate_(x.checkin) === checkin && Number(x.nights) === nights &&
      String(x.status) === 'MENUNGGU_PEMBAYARAN' && createdMs_(x.created_at) && Date.now() - createdMs_(x.created_at) <= CFG.HOLD_MINUTES * 60000;
  })[0];
  if (dup) return { ok: true, booking_code: String(dup.booking_code), room_total: Number(dup.room_total) || 0, addon_estimate: Number(dup.addon_estimate) || 0, kode_unik: Number(dup.kode_unik) || 0, jumlah_dibayar: paid_(dup), diskon: Number(dup.diskon) || 0, hold_minutes: CFG.HOLD_MINUTES };
  // Satu booking menunggu pembayaran per nomor WA, dan batas booking menunggu per rumah: mencegah penahanan tanggal massal.
  const live = function (x) { return String(x.status) === 'MENUNGGU_PEMBAYARAN' && createdMs_(x.created_at) && Date.now() - createdMs_(x.created_at) <= CFG.HOLD_MINUTES * 60000; };
  if (allB.some(function (x) { return live(x) && normPhone_(x.guest_wa) === wa; })) return { ok: false, error: 'pending_exists' };
  if (allB.filter(function (x) { return live(x) && String(x.homestay_id) === String(home.id); }).length >= CFG.MAX_PENDING_PER_HOME) return { ok: false, error: 'too_many_pending' };
  const blocked = blocksFor_(home.id);
  const taken = takenRanges_(home.id, '', allB);
  for (let i = 0; i < nightsList.length; i++) if (inRanges_(nightsList[i], taken)) return { ok: false, error: 'dates_unavailable' };
  for (let i = 0; i < nightsList.length; i++) if (inRanges_(nightsList[i], blocked)) return { ok: false, error: 'dates_unavailable' };
  // Diskon rombongan: mulai tamu ke-group_from tarif per tamu turun group_pct% (ditanggung tuan rumah). Rumus ini harus identik dengan calc() di browser.
  const gFrom = Math.max(2, Math.floor(Number(home.group_from)) || 3);
  const gPct = Math.max(0, Math.min(CFG.GROUP_MAX_PCT, Math.floor(Number(home.group_pct)) || 0));
  const gExtra = gPct > 0 ? Math.max(0, guests - gFrom + 1) : 0;
  let perGuest = 0, diskon = 0;
  nightsList.forEach(function (d) {
    const r = (peak > 0 && inRanges_(d, seasons.map(function (s) { return [s.from, s.to]; }))) ? peak : base;
    perGuest += r; diskon += Math.round(r * gPct / 100) * gExtra;
  });
  const roomTotal = perGuest * guests - diskon;
  // Nominal transfer unik: tarif kamar + kode 001..999 yang tidak dipakai booking lain yang masih menunggu pembayaran.
  const usedCodes = {};
  allB.forEach(function (x) { if (String(x.status) === 'MENUNGGU_PEMBAYARAN' && createdMs_(x.created_at) && Date.now() - createdMs_(x.created_at) <= CFG.HOLD_MINUTES * 60000) usedCodes[Number(x.kode_unik)] = 1; });
  let kode = 0;
  for (let i = 0; i < 60 && !kode; i++) { const c = 1 + Math.floor(Math.random() * CFG.UNIQUE_CODE_MAX); if (!usedCodes[c]) kode = c; }
  if (!kode) return { ok: false, error: 'rate_limited' };
  const jumlah = roomTotal + kode;
  const takeAmount = Math.round(jumlah * CFG.TAKE_RATE);

  const services = parseJson_(home.services_json, []);
  const picked = (Array.isArray(b.addons) ? b.addons : []).map(String);
  let addonTotal = 0;
  const addonNames = [];
  services.forEach(function (s) {
    if (picked.indexOf(String(s.id)) < 0) return;
    addonTotal += (Number(s.price) || 0) * qty_(s.unit, nights, guests);
    addonNames.push(String(s.id));
  });

  let code = newCode_();   // kode selalu diterbitkan server
  const existing = allB.map(function (r) { return String(r.booking_code); });
  while (existing.indexOf(code) >= 0) code = newCode_();

  appendObj_('BOOKINGS', {
    booking_code: code, created_at: now_(), homestay_id: home.id, homestay_name: home.name, destination: home.destination,
    guest_name: name, guest_wa: wa, checkin: checkin, nights: nights, guests: guests,
    room_total: roomTotal, addons_json: JSON.stringify(addonNames), addon_estimate: addonTotal,
    note: clean_(b.note, 300), status: 'MENUNGGU_PEMBAYARAN',
    pic_name: home.pic_name, host_name: home.host_name, forwarded_pic: false, forwarded_host: false,
    review_done: false, commission_status: 'TERTAHAN',
    take_amount: takeAmount, host_payout: jumlah - takeAmount, host_payout_status: 'MENUNGGU', refund_amount: 0,
    refund_status: 'TIDAK_ADA', consent_at: now_(), bayi: bayi, kode_unik: kode, jumlah_dibayar: jumlah, diskon: diskon
  });
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true, booking_code: code, room_total: roomTotal, addon_estimate: addonTotal, kode_unik: kode, jumlah_dibayar: jumlah, diskon: diskon, hold_minutes: CFG.HOLD_MINUTES };
}

/* ============ PUBLIC: CEK STATUS & BATAL ============ */

function verifyBooking_(code, last4) {
  code = String(code || '').trim().toUpperCase(); last4 = String(last4 || '').replace(/\D/g, '');
  if (!code || last4.length !== 4) return { error: 'booking_not_found' };
  const key = 'vf_' + code;
  if (Number(CacheService.getScriptCache().get(key) || 0) >= CFG.RL.LOOKUP_FAILS_PER_HOUR) return { error: 'too_many_attempts' };
  const bk = readAll_('BOOKINGS').filter(function (x) { return String(x.booking_code).toUpperCase() === code; })[0];
  if (!bk || normPhone_(bk.guest_wa).slice(-4) !== last4) {
    hit_(key, 999, 3600);
    return { error: 'booking_not_found' };
  }
  return { bk: bk };
}

function computeRefund_(bk) {
  const total = paid_(bk);
  const st = String(bk.status);
  if (st === 'MENUNGGU_PEMBAYARAN') return { paid: false, pct: 0, refund: 0, retained: 0 };
  if (st !== 'LUNAS') return { paid: true, pct: 0, refund: 0, retained: total, blocked: true };
  const left = daysBetween_(today_(), fmtDate_(bk.checkin));
  const pct = left >= CFG.REFUND_FULL_DAYS ? 1 : (left >= CFG.REFUND_HALF_DAYS ? CFG.REFUND_HALF_PERCENT : 0);
  const refund = Math.min(total, Math.ceil(total * pct - 1e-6));   // dibulatkan ke atas ke rupiah penuh
  return { paid: true, pct: pct, refund: refund, retained: total - refund, daysLeft: left };
}

function bookingStatus_(r) {
  const v = verifyBooking_(r.booking_code, r.wa_last4);
  if (v.error) return { ok: false, error: v.error };
  const bk = v.bk, rf = computeRefund_(bk);
  const cancellable = ['MENUNGGU_PEMBAYARAN', 'LUNAS'].indexOf(String(bk.status)) >= 0;
  return {
    ok: true,
    booking: {
      code: str_(bk.booking_code), homestay_name: str_(bk.homestay_name), destination: str_(bk.destination),
      checkin: fmtDate_(bk.checkin), nights: Number(bk.nights) || 0, guests: Number(bk.guests) || 0,
      room_total: Number(bk.room_total) || 0, addon_estimate: Number(bk.addon_estimate) || 0,
      kode_unik: Number(bk.kode_unik) || 0, jumlah_dibayar: paid_(bk), bayi: Number(bk.bayi) || 0,
      hold_left_min: String(bk.status) === 'MENUNGGU_PEMBAYARAN' && createdMs_(bk.created_at) ? Math.max(0, Math.ceil((createdMs_(bk.created_at) + CFG.HOLD_MINUTES * 60000 - Date.now()) / 60000)) : 0,
      status: str_(bk.status), review_done: isTrue_(bk.review_done),
      refund_amount: Number(bk.refund_amount) || 0, refund_status: str_(bk.refund_status),
      cancellable: cancellable, refund_preview: cancellable ? { paid: rf.paid, pct: rf.pct, refund: rf.refund } : null
    }
  };
}

function cancelBooking_(r) {
  CacheService.getScriptCache().remove('public_v2');
  const v = verifyBooking_(r.booking_code, r.wa_last4);
  if (v.error) return { ok: false, error: v.error };
  const bk = v.bk;
  if (['MENUNGGU_PEMBAYARAN', 'LUNAS'].indexOf(String(bk.status)) < 0) return { ok: false, error: 'not_cancellable' };
  const rf = computeRefund_(bk);
  const hostPayout = Math.round(rf.retained * (1 - CFG.TAKE_RATE));
  updateObj_('BOOKINGS', bk._row, {
    status: 'BATAL', cancelled_at: now_(), refund_amount: rf.refund,
    refund_status: rf.refund > 0 ? 'MENUNGGU_REFUND' : 'TIDAK_ADA',
    take_amount: rf.retained - hostPayout, host_payout: hostPayout, host_payout_status: hostPayout > 0 ? 'MENUNGGU' : 'TIDAK_ADA',
    commission_amount: 0, commission_status: 'TIDAK_CAIR'
  });
  return { ok: true, refund_amount: rf.refund, paid: rf.paid, pct: rf.pct };
}

/* ============ PUBLIC: KOMPLAIN ============ */

function submitComplaint_(r) {
  if (spam_(r)) return { ok: false, error: 'spam' };
  const v = verifyBooking_(r.booking_code, r.wa_last4);
  if (v.error) return { ok: false, error: v.error };
  const cat = String(r.category || '');
  const desc = clean_(r.description, 800);
  if (CFG.COMPLAINT_CATEGORIES.indexOf(cat) < 0) return { ok: false, error: 'invalid_category' };
  if (desc.length < 10) return { ok: false, error: 'invalid_description' };
  if (!hit_('cp_' + v.bk.booking_code, CFG.RL.COMPLAINT_PER_CODE_PER_DAY, 86400)) return { ok: false, error: 'rate_limited' };
  const id = 'CP-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  appendObj_('COMPLAINTS', { complaint_id: id, created_at: now_(), booking_code: v.bk.booking_code, homestay_id: v.bk.homestay_id, category: cat, description: desc, status: 'OPEN' });
  return { ok: true, complaint_id: id };
}

/* ============ PUBLIC: SUBMIT REVIEW (Dual-Rating) + INSENTIF PIC ============ */

function submitReview_(r) {
  const rh = Math.floor(Number(r.rating_home));
  const rp = Math.floor(Number(r.rating_host_pic));
  if (!(rh >= 1 && rh <= 5 && rp >= 1 && rp <= 5)) return { ok: false, error: 'invalid_rating' };
  const v = verifyBooking_(r.booking_code, r.wa_last4);
  if (v.error) return { ok: false, error: v.error };
  const bk = v.bk;
  if (isTrue_(bk.review_done)) return { ok: false, error: 'already_reviewed' };
  if (CFG.REVIEW_ALLOWED_STATUS.indexOf(String(bk.status)) < 0) return { ok: false, error: 'booking_not_confirmed' };
  const home = readAll_('HOMESTAYS').filter(function (h) { return String(h.id) === String(bk.homestay_id); })[0];
  if (!home) return { ok: false, error: 'homestay_missing' };

  appendObj_('REVIEWS', {
    review_id: 'RV-' + Utilities.getUuid().slice(0, 8).toUpperCase(), created_at: now_(), booking_code: bk.booking_code,
    homestay_id: bk.homestay_id, guest_name: bk.guest_name,
    rating_home: rh, review_home: clean_(r.review_home, 500),
    rating_host_pic: rp, review_host_pic: clean_(r.review_host_pic, 500), visible: true
  });
  const agg = recalcHome_(home.id);

  const basis = ratingBasis_(rh, rp);
  const good = basis >= CFG.MIN_RATING;
  const patchHome = { first_guest_done: true };
  const st = String(home.acq_bonus_status);
  if (st !== 'LAYAK_CAIR' && st !== 'DIJADWALKAN' && st !== 'DIBAYAR') {
    const stdOk = STD_KEYS.every(function (k) { return isTrue_(home[k]); });
    const byCode = {};
    readAll_('BOOKINGS').forEach(function (x) { byCode[String(x.booking_code)] = x; });
    const guestsOk = {};
    readAll_('REVIEWS').forEach(function (rv) {
      if (String(rv.homestay_id) !== String(home.id)) return;
      const bb = byCode[String(rv.booking_code)];
      if (bb && ratingBasis_(Number(rv.rating_home), Number(rv.rating_host_pic)) >= CFG.MIN_RATING) guestsOk[normPhone_(bb.guest_wa)] = true;
    });
    const ok = stdOk && Object.keys(guestsOk).length >= CFG.MIN_REVIEWS_FOR_ACQ_BONUS;
    patchHome.acq_bonus_status = ok ? 'LAYAK_CAIR' : 'TERTAHAN';
    patchHome.acq_bonus_amount = ok ? CFG.ACQUISITION_BONUS : 0;
  }
  updateObj_('HOMESTAYS', home._row, patchHome);
  updateObj_('BOOKINGS', bk._row, {
    review_done: true, rating_home: rh, rating_host_pic: rp, rating_basis: round1_(basis),
    commission_amount: good ? Math.round(paid_(bk) * CFG.PIC_COMMISSION_PERCENT) : 0,
    commission_status: good ? 'LAYAK_CAIR' : 'TIDAK_CAIR'
  });
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true, homestay: { id: String(home.id), ratingHome: agg.avgH, countHome: agg.n, ratingHost: agg.avgP, countHost: agg.n } };
}

// Hitung ulang rating dari ulasan yang visible (dipakai juga setelah moderasi)
function recalcHome_(homeId) {
  const rows = readAll_('REVIEWS').filter(function (r) { return String(r.homestay_id) === String(homeId) && isTrue_(r.visible); });
  const n = rows.length;
  let sh = 0, sp = 0;
  rows.forEach(function (r) { sh += Number(r.rating_home) || 0; sp += Number(r.rating_host_pic) || 0; });
  const avgH = n ? round1_(sh / n) : 0, avgP = n ? round1_(sp / n) : 0;
  const home = readAll_('HOMESTAYS').filter(function (h) { return String(h.id) === String(homeId); })[0];
  if (home) updateObj_('HOMESTAYS', home._row, { rating_home_avg: avgH, rating_home_count: n, rating_host_pic_avg: avgP, rating_host_pic_count: n });
  return { n: n, avgH: avgH, avgP: avgP };
}

/* ============ PUBLIC: DAFTAR RUMAH (pemilik) ============ */

function registerHome_(r) {
  if (spam_(r)) return { ok: false, error: 'spam' };
  const host = clean_(r.host_name, 80), wa = normPhone_(r.host_wa), name = clean_(r.name, 80);
  const dest = clean_(r.destination, 60), city = clean_(r.city, 80), area = clean_(r.area, 60);
  const price = Math.floor(Number(r.price)), cap = Math.floor(Number(r.capacity));
  const peak = r.peak_price ? Math.floor(Number(r.peak_price)) : 0;
  if (host.length < 2 || name.length < 2 || dest.length < 2 || city.length < 2 || area.length < 2) return { ok: false, error: 'invalid_fields' };
  if (!/^62\d{8,13}$/.test(wa)) return { ok: false, error: 'invalid_wa' };
  if (!(price >= 20000 && price <= CFG.MAX_PRICE_PER_GUEST_NIGHT)) return { ok: false, error: 'invalid_price' };
  if (peak && !(peak >= price && peak <= CFG.MAX_PEAK_PRICE_PER_GUEST_NIGHT)) return { ok: false, error: 'invalid_price' };
  if (!(cap >= 1 && cap <= 10)) return { ok: false, error: 'invalid_capacity' };
  if (!hit_('rg_' + wa, CFG.RL.REGISTER_PER_WA_PER_DAY, 86400)) return { ok: false, error: 'rate_limited' };
  const rows = readAll_('HOMESTAYS');
  const dup = rows.filter(function (h) { return normPhone_(h.host_wa) === wa && String(h.name).toLowerCase() === name.toLowerCase(); })[0];
  if (dup) return { ok: false, error: 'duplicate' };
  let max = 0;
  rows.forEach(function (h) { const n = parseInt(String(h.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
  const id = 'H-' + ('000' + (max + 1)).slice(-3);
  appendObj_('HOMESTAYS', {
    id: id, active: false, name: name, destination: dest, city: city, area: area, price_per_guest_night: price, peak_price: peak || '', capacity: cap,
    host_name: host, host_wa: wa, pic_name: clean_(r.referred_by, 80), pic_wa: '', moods: '',
    std1_kunci: false, std2_kamar_mandi: false, std3_kasur_linen: false, std4_listrik_cahaya: false, std5_privasi: false, std6_ratecard: false,
    desc_id: clean_(r.desc, 400), desc_en: '', services_json: '[]', photo_url: '', featured: false, lingkungan_sekitar: clean_(r.lingkungan, 200), terima_bayi: '', group_from: 3, group_pct: 0,
    rating_home_avg: 0, rating_home_count: 0, rating_host_pic_avg: 0, rating_host_pic_count: 0,
    first_guest_done: false, acq_bonus_status: 'MENUNGGU_VERIFIKASI', acq_bonus_amount: 0, created_at: now_()
  });
  return { ok: true, id: id };
}

/* ============ ADMIN (wajib ADMIN_TOKEN, terkunci setelah salah berulang) ============ */

function adminGuard_(token) {
  const c = CacheService.getScriptCache();
  if (Number(c.get('admin_fail') || 0) >= CFG.RL.ADMIN_FAILS) return { ok: false, error: 'locked' };
  if (isAdmin_(token)) { c.remove('admin_fail'); return null; }
  const nf = Number(c.get('admin_fail') || 0) + 1;
  c.put('admin_fail', String(nf), CFG.RL.ADMIN_LOCK_SEC);
  if (nf === CFG.RL.ADMIN_FAILS) { try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'bolehnginep: admin terkunci', 'Ada ' + nf + ' percobaan PIN admin yang salah. Admin terkunci 15 menit. Kalau ini kamu, tunggu atau jalankan unlockAdmin() dari editor Apps Script.'); } catch (e) {} }
  return { ok: false, error: 'unauthorized' };
}

function unlockAdmin() { CacheService.getScriptCache().remove('admin_fail'); }   // jalankan manual dari editor bila terkunci

function isAdmin_(token) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!real || !token || String(real).length < CFG.MIN_ADMIN_TOKEN) return false;   // token terlalu pendek = admin tertutup (gagal aman)
  const a = String(real), t = String(token);
  if (a.length !== t.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ t.charCodeAt(i);
  return diff === 0;
}

function adminBookings_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const homes = {};
  readAll_('HOMESTAYS').forEach(function (h) { homes[String(h.id)] = h; });
  const rows = readAll_('BOOKINGS').reverse().slice(0, 100).map(function (x) {
    const h = homes[String(x.homestay_id)] || {};
    return {
      booking_code: str_(x.booking_code), homestay_id: str_(x.homestay_id), homestay_name: str_(x.homestay_name), destination: str_(x.destination),
      guest_name: str_(x.guest_name), guest_wa: normPhone_(x.guest_wa), checkin: fmtDate_(x.checkin),
      nights: Number(x.nights) || 0, guests: Number(x.guests) || 0, bayi: Number(x.bayi) || 0,
      room_total: Number(x.room_total) || 0, addon_estimate: Number(x.addon_estimate) || 0,
      kode_unik: Number(x.kode_unik) || 0, jumlah_dibayar: paid_(x), created_at: str_(x.created_at),
      addons: parseJson_(x.addons_json, []), note: str_(x.note), status: str_(x.status),
      refund_amount: Number(x.refund_amount) || 0, refund_status: str_(x.refund_status),
      pic_name: str_(x.pic_name), pic_wa: normPhone_(h.pic_wa), host_name: str_(x.host_name), host_wa: normPhone_(h.host_wa),
      forwarded_pic: isTrue_(x.forwarded_pic), forwarded_host: isTrue_(x.forwarded_host)
    };
  });
  return { ok: true, bookings: rows };
}

function markForwarded_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const bk = readAll_('BOOKINGS').filter(function (x) { return String(x.booking_code) === String(b.booking_code); })[0];
  if (!bk) return { ok: false, error: 'booking_not_found' };
  const patch = {};
  if (b.target === 'pic') patch.forwarded_pic = true;
  else if (b.target === 'host') patch.forwarded_host = true;
  else return { ok: false, error: 'invalid_target' };
  updateObj_('BOOKINGS', bk._row, patch);
  return { ok: true };
}

function adminReviews_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const homes = {};
  readAll_('HOMESTAYS').forEach(function (h) { homes[String(h.id)] = h.name; });
  const rows = readAll_('REVIEWS').reverse().slice(0, 60).map(function (r) {
    return {
      review_id: str_(r.review_id), date: str_(r.created_at).slice(0, 10), homestay_id: str_(r.homestay_id), homestay_name: str_(homes[String(r.homestay_id)]),
      guest: str_(r.guest_name), ratingHome: Number(r.rating_home) || 0, textHome: str_(r.review_home),
      ratingHost: Number(r.rating_host_pic) || 0, textHost: str_(r.review_host_pic),
      visible: isTrue_(r.visible), reply: str_(r.host_reply)
    };
  });
  return { ok: true, reviews: rows };
}

function moderateReview_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const rv = readAll_('REVIEWS').filter(function (x) { return String(x.review_id) === String(b.review_id); })[0];
  if (!rv) return { ok: false, error: 'review_not_found' };
  const patch = {};
  if (typeof b.visible === 'boolean') patch.visible = b.visible;
  if (typeof b.host_reply === 'string') { patch.host_reply = clean_(b.host_reply, 400); patch.host_reply_at = now_(); }
  updateObj_('REVIEWS', rv._row, patch);
  recalcHome_(rv.homestay_id);
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true };
}


/* ============ PIN MITRA (host & PIC): hash SHA-256 + kunci percobaan ============ */

function pinHash_(scope, id, pin) {
  const salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT');
  if (!salt || salt.length < 16) throw new Error('PIN_SALT belum diisi (minimal 16 karakter) di Script Properties');
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, scope + ':' + id + ':' + pin + ':' + salt);
  return raw.map(function (b) { return ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2); }).join('');
}
function eqConst_(a, b) {
  a = String(a); b = String(b); if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
function validPin_(pin) { return /^\d{6}$/.test(String(pin || '')); }
function partnerFail_(key) {
  const c = CacheService.getScriptCache(); c.put(key, String(Number(c.get(key) || 0) + 1), 3600);
}
function partnerLocked_(key) { return Number(CacheService.getScriptCache().get(key) || 0) >= CFG.RL.PARTNER_FAILS_PER_HOUR; }

function hostAuth_(r) {
  const id = clean_(r.homestay_id, 20).toUpperCase(), key = 'hf_' + id;
  if (partnerLocked_(key)) return { error: 'too_many_attempts' };
  const h = readAll_('HOMESTAYS').filter(function (x) { return String(x.id).toUpperCase() === id; })[0];
  const stored = h ? str_(h.host_pin_hash) : '';
  if (!h || !stored || !validPin_(r.pin) || !eqConst_(stored, pinHash_('host', String(h.id), String(r.pin)))) { partnerFail_(key); return { error: 'unauthorized' }; }
  CacheService.getScriptCache().remove(key);
  return { home: h };
}

function picAuth_(r) {
  const wa = normPhone_(r.pic_wa), key = 'pf_' + wa;
  if (partnerLocked_(key)) return { error: 'too_many_attempts' };
  const p = readAll_('PICS').filter(function (x) { return normPhone_(x.pic_wa) === wa && String(x.status || 'AKTIF').toUpperCase() !== 'NONAKTIF'; })[0];
  const stored = p ? str_(p.pin_hash) : '';
  if (!p || !stored || !validPin_(r.pin) || !eqConst_(stored, pinHash_('pic', wa, String(r.pin)))) { partnerFail_(key); return { error: 'unauthorized' }; }
  CacheService.getScriptCache().remove(key);
  return { pic: p, wa: wa };
}

/* ============ PORTAL HOST ============ */

function hostLogin_(r) {
  const a = hostAuth_(r); if (a.error) return { ok: false, error: a.error };
  const h = a.home, id = String(h.id);
  const bookings = readAll_('BOOKINGS').filter(function (x) { return String(x.homestay_id) === id; }).reverse().slice(0, 40).map(function (x) {
    return { code: str_(x.booking_code), guest: str_(x.guest_name), checkin: fmtDate_(x.checkin), nights: Number(x.nights) || 0, guests: Number(x.guests) || 0,
      status: str_(x.status), note: str_(x.note), addons: parseJson_(x.addons_json, []), host_payout: Number(x.host_payout) || 0, host_payout_status: str_(x.host_payout_status) };
  });
  const blocks = readAll_('AVAILABILITY').filter(function (x) { return String(x.homestay_id) === id; }).map(function (x) {
    return { row: x._row, from: fmtDate_(x.date_from), to: fmtDate_(x.date_to), reason: str_(x.reason) };
  });
  const reviews = readAll_('REVIEWS').filter(function (x) { return String(x.homestay_id) === id && isTrue_(x.visible); }).reverse().slice(0, 20).map(function (x) {
    return { review_id: str_(x.review_id), date: str_(x.created_at).slice(0, 10), guest: str_(x.guest_name), ratingHome: Number(x.rating_home) || 0, textHome: str_(x.review_home),
      ratingHost: Number(x.rating_host_pic) || 0, textHost: str_(x.review_host_pic), reply: str_(x.host_reply) };
  });
  return { ok: true, home: { id: id, name: str_(h.name), destination: str_(h.destination), active: isTrue_(h.active), open: (h.host_open === '' || h.host_open === undefined || isTrue_(h.host_open)) }, bookings: bookings, blocks: blocks, reviews: reviews };
}

function hostBlock_(r) {
  const a = hostAuth_(r); if (a.error) return { ok: false, error: a.error };
  const id = String(a.home.id), from = str_(r.date_from), to = str_(r.date_to || r.date_from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { ok: false, error: 'invalid_date' };
  if (daysBetween_(from, to) > 120) return { ok: false, error: 'invalid_date' };
  const clash = readAll_('BOOKINGS').filter(function (x) {
    if (String(x.homestay_id) !== id || ['MENUNGGU_PEMBAYARAN', 'LUNAS'].indexOf(String(x.status)) < 0) return false;
    const ci = fmtDate_(x.checkin), n = Number(x.nights) || 0;
    return nightsList_(ci, n).some(function (d) { return d >= from && d <= to; });
  })[0];
  if (clash) return { ok: false, error: 'has_booking' };
  appendObj_('AVAILABILITY', { homestay_id: id, date_from: from, date_to: to, reason: clean_(r.reason, 80) || 'Diblokir pemilik' });
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true };
}

function hostUnblock_(r) {
  const a = hostAuth_(r); if (a.error) return { ok: false, error: a.error };
  const row = readAll_('AVAILABILITY').filter(function (x) { return x._row === Number(r.row) && String(x.homestay_id) === String(a.home.id); })[0];
  if (!row) return { ok: false, error: 'not_found' };
  sheet_('AVAILABILITY').deleteRow(row._row);
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true };
}

function hostSetOpen_(r) {   // seperti online/offline ojol: host sendiri yang buka/tutup rumahnya
  const a = hostAuth_(r); if (a.error) return { ok: false, error: a.error };
  updateObj_('HOMESTAYS', a.home._row, { host_open: r.open === true });
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true };
}
function adminAvail_(b) {   // admin hanya melihat. Menutup paksa lewat adminSetHome (Nonaktifkan)
  const g = adminGuard_(b.token); if (g) return g;
  const idx = {}, homes = readAll_('HOMESTAYS').filter(function (h) { return h.id; }).map(function (h) {
    const o = { id: str_(h.id), name: str_(h.name), destination: str_(h.destination), pic: str_(h.pic_name), active: isTrue_(h.active), open: (h.host_open === '' || h.host_open === undefined || isTrue_(h.host_open)), blocks: [] };
    idx[o.id] = o; return o;
  });
  readAll_('AVAILABILITY').forEach(function (x) {
    const o = idx[String(x.homestay_id)]; if (!o) return;
    o.blocks.push({ from: fmtDate_(x.date_from), to: fmtDate_(x.date_to) || fmtDate_(x.date_from), reason: str_(x.reason) });
  });
  return { ok: true, homes: homes };
}

function hostReply_(r) {
  const a = hostAuth_(r); if (a.error) return { ok: false, error: a.error };
  const rv = readAll_('REVIEWS').filter(function (x) { return String(x.review_id) === String(r.review_id) && String(x.homestay_id) === String(a.home.id); })[0];
  if (!rv) return { ok: false, error: 'review_not_found' };
  updateObj_('REVIEWS', rv._row, { host_reply: clean_(r.reply, 400), host_reply_at: now_() });
  return { ok: true };
}

/* ============ PORTAL PIC: verifikasi 6 standar ============ */

function picHomes_(p) {
  const name = String(p.pic_name).toLowerCase(), wa = normPhone_(p.pic_wa), area = String(p.area || '').toLowerCase();
  return readAll_('HOMESTAYS').filter(function (h) {
    if (String(h.pic_name).toLowerCase() === name && name) return true;
    if (normPhone_(h.pic_wa) === wa && wa) return true;
    return !str_(h.pic_name) && area && (String(h.destination).toLowerCase().indexOf(area) >= 0 || String(h.area).toLowerCase().indexOf(area) >= 0);
  });
}

function picLogin_(r) {
  const a = picAuth_(r); if (a.error) return { ok: false, error: a.error };
  const homes = picHomes_(a.pic).map(function (h) {
    return { id: str_(h.id), name: str_(h.name), destination: str_(h.destination), area: str_(h.area), host: str_(h.host_name), host_wa: normPhone_(h.host_wa),
      active: isTrue_(h.active), standards: STD_KEYS.map(function (k) { return isTrue_(h[k]); }).concat(stdExtra_(h)), verified: fmtDate_(h.std_verified_at), mine: String(h.pic_name).toLowerCase() === String(a.pic.pic_name).toLowerCase() };
  });
  return { ok: true, pic: { name: str_(a.pic.pic_name), area: str_(a.pic.area) }, homes: homes };
}

function picVerify_(r) {
  const a = picAuth_(r); if (a.error) return { ok: false, error: a.error };
  const h = picHomes_(a.pic).filter(function (x) { return String(x.id) === String(r.homestay_id); })[0];
  if (!h) return { ok: false, error: 'not_found' };
  const std = Array.isArray(r.std) ? r.std : [];
  if (std.length !== 6 && std.length !== 13) return { ok: false, error: 'invalid_fields' };
  const all = std.map(function (v) { return v === true; });
  const flags = all.slice(0, 6), ex = all.slice(6);
  const pass = all.every(function (v) { return v; });
  const note = clean_(r.note, 300), ev = httpsOnly_(r.evidence_url);
  if (note.length < 5) return { ok: false, error: 'invalid_fields' };
  if (pass && !ev) return { ok: false, error: 'evidence_required' };
  const rec = { verification_id: 'V-' + Utilities.getUuid().slice(0, 8).toUpperCase(), created_at: now_(), homestay_id: String(h.id), pic_wa: a.wa, result: pass ? 'LOLOS' : 'TIDAK_LOLOS', note: note, evidence_url: ev };
  STD_KEYS.forEach(function (k, i) { rec[k] = flags[i]; });
  const exObj = {}; if (ex.length === 7) STD_EXTRA_KEYS.forEach(function (k, i) { exObj[k] = ex[i]; });
  rec.extra_json = ex.length === 7 ? JSON.stringify(exObj) : '';
  appendObj_('VERIFICATIONS', rec);
  const patch = { pic_name: a.pic.pic_name, pic_wa: a.wa, std_verified_at: pass ? today_() : '' };
  STD_KEYS.forEach(function (k, i) { patch[k] = flags[i]; });
  if (ex.length === 7) patch.std_extra_json = JSON.stringify(exObj);
  if (pass) patch.acq_bonus_status = 'TERTAHAN'; // rumah tetap nonaktif sampai admin menyetujui
  updateObj_('HOMESTAYS', h._row, patch);
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true, result: rec.result };
}

/* ============ ADMIN: aksi sekali klik ============ */

function adminSetStatus_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const bk = readAll_('BOOKINGS').filter(function (x) { return String(x.booking_code) === String(b.booking_code); })[0];
  if (!bk) return { ok: false, error: 'booking_not_found' };
  const cur = String(bk.status), to = String(b.status);
  CacheService.getScriptCache().remove('public_v2');
  if (to === 'LUNAS' && cur === 'MENUNGGU_PEMBAYARAN') {
    const ci = fmtDate_(bk.checkin), n = Number(bk.nights) || 0, other = takenRanges_(bk.homestay_id, bk.booking_code);
    if (nightsList_(ci, n).some(function (d) { return inRanges_(d, other); })) return { ok: false, error: 'dates_taken' };
    // Nominal harus persis jumlah_dibayar; transfer yang tidak pas tidak pernah otomatis LUNAS (admin cek manual, lalu kirim paid_amount yang benar).
    if (b.paid_amount !== undefined && b.paid_amount !== null && b.paid_amount !== '' && Math.round(Number(b.paid_amount)) !== paid_(bk)) return { ok: false, error: 'amount_mismatch' };
    updateObj_('BOOKINGS', bk._row, { status: 'LUNAS' }); ledger_(String(bk.booking_code), 'MASUK', paid_(bk), 'admin', b.paid_amount ? 'nominal dicek' : 'ditandai tanpa nominal'); return { ok: true, status: 'LUNAS' }; }
  if (to === 'SELESAI' && cur === 'LUNAS') { updateObj_('BOOKINGS', bk._row, { status: 'SELESAI' }); return { ok: true, status: 'SELESAI' }; }
  if (to === 'BATAL' && (cur === 'MENUNGGU_PEMBAYARAN' || cur === 'LUNAS')) {
    // received=true: uang sudah masuk setelah batas waktu, tanggal sudah diambil orang lain -> batal dengan refund (biaya transfer ditanggung platform)
    const total = paid_(bk), paid = cur === 'LUNAS' || (cur === 'MENUNGGU_PEMBAYARAN' && b.received === true);
    const pct = paid ? Math.max(0, Math.min(1, Number(b.refund_percent) / 100 || 0)) : 0;
    const refund = Math.min(total, Math.ceil(total * pct - 1e-6)), retained = total - refund;
    const hostPayout = paid ? Math.round(retained * (1 - CFG.TAKE_RATE)) : 0;
    updateObj_('BOOKINGS', bk._row, {
      status: 'BATAL', cancelled_at: now_(), refund_amount: refund, refund_status: refund > 0 ? 'MENUNGGU_REFUND' : 'TIDAK_ADA',
      take_amount: paid ? retained - hostPayout : 0, host_payout: hostPayout, host_payout_status: hostPayout > 0 ? 'MENUNGGU' : 'TIDAK_ADA',
      commission_amount: 0, commission_status: 'TIDAK_CAIR'
    });
    if (paid) { ledger_(String(bk.booking_code), 'REFUND', refund, 'admin', cur === 'LUNAS' ? 'batal setelah lunas' : 'uang masuk terlambat'); if (b.received === true && cur === 'MENUNGGU_PEMBAYARAN') ledger_(String(bk.booking_code), 'MASUK', total, 'admin', 'transfer terlambat'); }
    return { ok: true, status: 'BATAL', refund_amount: refund };
  }
  return { ok: false, error: 'invalid_transition' };
}

function adminPayouts_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  generatePayoutsCore_();
  const rows = readAll_('PAYOUTS').reverse().slice(0, 120).map(function (p) {
    return { payout_id: str_(p.payout_id), type: str_(p.type), ref: str_(p.ref), payee: str_(p.payee_name), bank: str_(p.bank_name), account: str_(p.bank_account), holder: str_(p.bank_holder),
      amount: Number(p.amount) || 0, due: fmtDate_(p.due_date), status: str_(p.status), paid_at: str_(p.paid_at), note: str_(p.note) };
  });
  rows.sort(function (a, c) { return (a.status === 'MENUNGGU' ? 0 : 1) - (c.status === 'MENUNGGU' ? 0 : 1); });
  return { ok: true, payouts: rows };
}

function adminMarkPaid_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const p = readAll_('PAYOUTS').filter(function (x) { return String(x.payout_id) === String(b.payout_id); })[0];
  if (!p) return { ok: false, error: 'not_found' };
  if (String(p.status) === 'DIBAYAR') return { ok: true };
  updateObj_('PAYOUTS', p._row, { status: 'DIBAYAR', paid_at: now_() });
  const ref = String(p.ref), type = String(p.type);
  if (type === 'PIC_BONUS') {
    const h = readAll_('HOMESTAYS').filter(function (x) { return String(x.id) === ref; })[0];
    if (h) updateObj_('HOMESTAYS', h._row, { acq_bonus_status: 'DIBAYAR' });
  } else {
    const bk = readAll_('BOOKINGS').filter(function (x) { return String(x.booking_code) === ref; })[0];
    if (bk) {
      if (type === 'HOST') updateObj_('BOOKINGS', bk._row, { host_payout_status: 'DIBAYAR' });
      else if (type === 'PIC_COMMISSION') updateObj_('BOOKINGS', bk._row, { commission_status: 'DIBAYAR' });
      else if (type === 'REFUND') updateObj_('BOOKINGS', bk._row, { refund_status: 'DIBAYAR' });
    }
  }
  return { ok: true };
}

function adminHomes_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const rows = readAll_('HOMESTAYS').map(function (h) {
    const std = STD_KEYS.map(function (k) { return isTrue_(h[k]); }).concat(stdExtra_(h));
    return { id: str_(h.id), name: str_(h.name), destination: str_(h.destination), host: str_(h.host_name), host_wa: normPhone_(h.host_wa), pic: str_(h.pic_name),
      active: isTrue_(h.active), standards: std, passed: homeOk_(h), recheck: stdState_(h) === 'recheck', verified: fmtDate_(h.std_verified_at), has_pin: !!str_(h.host_pin_hash) };
  });
  const pics = readAll_('PICS').map(function (p) { return { name: str_(p.pic_name), wa: normPhone_(p.pic_wa), area: str_(p.area), has_pin: !!str_(p.pin_hash), status: String(p.status || 'AKTIF').toUpperCase(), bank_name: str_(p.bank_name), bank_account: str_(p.bank_account), bank_holder: str_(p.bank_holder) }; });
  return { ok: true, homes: rows, pics: pics };
}

function adminSetHome_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const h = readAll_('HOMESTAYS').filter(function (x) { return String(x.id) === String(b.homestay_id); })[0];
  if (!h) return { ok: false, error: 'not_found' };
  if (b.active === true && !homeOk_(h)) return { ok: false, error: 'standards_not_passed' };
  updateObj_('HOMESTAYS', h._row, { active: b.active === true });
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true };
}

function adminSetPin_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  if (!validPin_(b.pin)) return { ok: false, error: 'invalid_pin' };
  if (b.role === 'host') {
    const h = readAll_('HOMESTAYS').filter(function (x) { return String(x.id) === String(b.id); })[0];
    if (!h) return { ok: false, error: 'not_found' };
    updateObj_('HOMESTAYS', h._row, { host_pin_hash: pinHash_('host', String(h.id), String(b.pin)) });
    return { ok: true };
  }
  if (b.role === 'pic') {
    const wa = normPhone_(b.id);
    if (!/^62\d{8,13}$/.test(wa)) return { ok: false, error: 'invalid_wa' };
    let p = readAll_('PICS').filter(function (x) { return normPhone_(x.pic_wa) === wa; })[0];
    if (!p) { appendObj_('PICS', { pic_name: clean_(b.name, 80) || ('PIC ' + wa), pic_wa: wa, area: clean_(b.area, 60), status: 'AKTIF', joined_at: today_() }); p = readAll_('PICS').filter(function (x) { return normPhone_(x.pic_wa) === wa; })[0]; }
    updateObj_('PICS', p._row, { pin_hash: pinHash_('pic', wa, String(b.pin)) });
    return { ok: true };
  }
  return { ok: false, error: 'invalid_fields' };
}

/* ============ ADMIN: EDIT RUMAH, HOST, PIC (+ catatan LOG) ============ */

const HOME_FIELDS_ = ['name', 'destination', 'city', 'area', 'price_per_guest_night', 'peak_price', 'capacity', 'host_name', 'host_wa', 'host_bank_name', 'host_bank_account', 'host_bank_holder',
  'pic_name', 'pic_wa', 'moods', 'desc_id', 'services_json', 'photo_url', 'photo_urls', 'map_url', 'distance_id', 'checkin_time', 'checkout_time', 'house_rules_id', 'featured', 'lingkungan_sekitar', 'terima_bayi', 'akses_kenyamanan', 'group_from', 'group_pct'];
const SVC_UNITS_ = ['perGuestPerNight', 'perNight', 'perGuest', 'flat'];

// Buku besar uang: catatan yang hanya bertambah. type: MASUK | REFUND | TAHAN
function ledger_(code, type, amount, actor, note) {
  try { appendObj_('LEDGER', { at: now_(), booking_code: code, type: type, amount: Math.round(Number(amount) || 0), actor: actor || 'admin', note: note || '' }); } catch (e) {}
}
function logChange_(action, target, before, after, actor) {
  const mask = function (o) { const c = {}; Object.keys(o).forEach(function (k) { const v = String(o[k]); c[k] = (k === 'host_bank_account' || k === 'bank_account') ? (v ? '***' + v.slice(-4) : '') : v.slice(0, 200); }); return c; };
  try { appendObj_('LOG', { at: now_(), actor: actor || 'admin', action: action, target: target, before: JSON.stringify(mask(before)), after: JSON.stringify(mask(after)) }); } catch (e) {}
}
function adminHomeGet_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const h = readAll_('HOMESTAYS').filter(function (x) { return String(x.id) === String(b.homestay_id); })[0];
  if (!h) return { ok: false, error: 'not_found' };
  const o = { id: str_(h.id), active: isTrue_(h.active) };
  HOME_FIELDS_.forEach(function (k) { o[k] = (k === 'checkin_time' || k === 'checkout_time') ? time_(h[k], k === 'checkin_time' ? '14:00' : '11:00') : (k === 'featured' ? isTrue_(h[k]) : (k === 'host_wa' || k === 'pic_wa') ? normPhone_(h[k]) : (typeof h[k] === 'number' ? h[k] : str_(h[k]))); });
  return { ok: true, home: o };
}
function cleanHomeFields_(f, pics) {
  const out = {}, bad = function (x) { return { error: 'invalid_field', field: x }; };
  out.name = clean_(f.name, 80); if (out.name.length < 2) return bad('name');
  out.destination = clean_(f.destination, 60); if (out.destination.length < 2) return bad('destination');
  out.city = clean_(f.city, 80); out.area = clean_(f.area, 60);
  const price = Math.floor(Number(f.price_per_guest_night)); if (!(price >= 0 && price <= CFG.MAX_PRICE_PER_GUEST_NIGHT)) return bad('price_per_guest_night'); out.price_per_guest_night = price;
  const peak = f.peak_price === '' || f.peak_price == null ? 0 : Math.floor(Number(f.peak_price)); if (!(peak >= 0 && peak <= CFG.MAX_PEAK_PRICE_PER_GUEST_NIGHT)) return bad('peak_price'); out.peak_price = peak || '';
  const cap = Math.floor(Number(f.capacity)); if (!(cap >= 1 && cap <= 20)) return bad('capacity'); out.capacity = cap;
  out.host_name = clean_(f.host_name, 80); if (out.host_name.length < 2) return bad('host_name');
  const wa = normPhone_(f.host_wa); if (!/^62\d{8,13}$/.test(wa)) return bad('host_wa'); out.host_wa = wa;
  out.host_bank_name = clean_(f.host_bank_name, 40); out.host_bank_account = clean_(f.host_bank_account, 30).replace(/[^0-9]/g, ''); out.host_bank_holder = clean_(f.host_bank_holder, 80);
  if (f.pic_wa) {
    const pw = normPhone_(f.pic_wa), p = pics.filter(function (x) { return normPhone_(x.pic_wa) === pw; })[0];
    if (!p) return bad('pic_wa'); out.pic_wa = pw; out.pic_name = str_(p.pic_name);
  } else { out.pic_wa = ''; out.pic_name = ''; }
  out.moods = splitList_(clean_(f.moods, 120), ',').slice(0, 6).join(',');
  out.desc_id = clean_(f.desc_id, 400); out.desc_en = out.desc_id;
  let svcs; try { svcs = JSON.parse(f.services_json || '[]'); } catch (e) { return bad('services_json'); }
  if (!Array.isArray(svcs) || svcs.length > 10) return bad('services_json');
  const seen = {}; const norm = [];
  for (let i = 0; i < svcs.length; i++) {
    const nm = clean_(svcs[i] && svcs[i].name && (svcs[i].name.id || svcs[i].name), 60), pr = Math.floor(Number(svcs[i] && svcs[i].price)), un = svcs[i] && svcs[i].unit;
    if (!nm || !(pr >= 0 && pr <= 2000000) || SVC_UNITS_.indexOf(un) < 0) return bad('services_json');
    let id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('svc' + i); while (seen[id]) id += '-' + i; seen[id] = 1;
    norm.push({ id: id, name: { id: nm, en: nm }, price: pr, unit: un });
  }
  out.services_json = JSON.stringify(norm);
  out.photo_url = httpsOnly_(f.photo_url);
  out.photo_urls = splitList_(f.photo_urls, '|').map(httpsOnly_).filter(Boolean).slice(0, 8).join('|');
  out.map_url = httpsOnly_(f.map_url);
  out.distance_id = clean_(f.distance_id, 120); out.distance_en = out.distance_id;
  const ci = String(f.checkin_time || '14:00'), co = String(f.checkout_time || '11:00');
  if (!/^\d{2}:\d{2}$/.test(ci)) return bad('checkin_time'); if (!/^\d{2}:\d{2}$/.test(co)) return bad('checkout_time'); out.checkin_time = ci; out.checkout_time = co;
  out.house_rules_id = splitList_(f.house_rules_id, '|').map(function (x) { return clean_(x, 120); }).filter(Boolean).slice(0, 10).join('|'); out.house_rules_en = out.house_rules_id;
  out.featured = f.featured === true;
  out.lingkungan_sekitar = clean_(f.lingkungan_sekitar, 200); out.akses_kenyamanan = clean_(f.akses_kenyamanan, 300);
  out.terima_bayi = (f.terima_bayi === true || f.terima_bayi === 'ya') ? 'ya' : '';
  const gf = f.group_from === '' || f.group_from == null ? 3 : Math.floor(Number(f.group_from)); if (!(gf >= 2 && gf <= 10)) return bad('group_from'); out.group_from = gf;
  const gp = f.group_pct === '' || f.group_pct == null ? 0 : Math.floor(Number(f.group_pct)); if (!(gp >= 0 && gp <= CFG.GROUP_MAX_PCT)) return bad('group_pct'); out.group_pct = gp;
  return { ok: true, v: out };
}
function adminHomeSave_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const c = cleanHomeFields_(b.fields || {}, readAll_('PICS')); if (!c.ok) return { ok: false, error: c.error, field: c.field };
  const rows = readAll_('HOMESTAYS');
  if (!b.homestay_id) {
    const dup = rows.filter(function (h) { return normPhone_(h.host_wa) === c.v.host_wa && String(h.name).toLowerCase() === c.v.name.toLowerCase(); })[0];
    if (dup) return { ok: false, error: 'duplicate' };
    let max = 0; rows.forEach(function (h) { const n = parseInt(String(h.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
    const id = 'H-' + ('000' + (max + 1)).slice(-3);
    const row = Object.assign({ id: id, active: false, std1_kunci: false, std2_kamar_mandi: false, std3_kasur_linen: false, std4_listrik_cahaya: false, std5_privasi: false, std6_ratecard: false,
      rating_home_avg: 0, rating_home_count: 0, rating_host_pic_avg: 0, rating_host_pic_count: 0, first_guest_done: false, acq_bonus_status: 'MENUNGGU_VERIFIKASI', acq_bonus_amount: 0, created_at: now_() }, c.v);
    appendObj_('HOMESTAYS', row); logChange_('TAMBAH_RUMAH', id, {}, c.v);
    CacheService.getScriptCache().remove('public_v2'); return { ok: true, id: id };
  }
  const h = rows.filter(function (x) { return String(x.id) === String(b.homestay_id); })[0];
  if (!h) return { ok: false, error: 'not_found' };
  const before = {}, after = {};
  HOME_FIELDS_.concat(['desc_en', 'distance_en', 'house_rules_en']).forEach(function (k) {
    if (c.v[k] === undefined) return;
    const old = (k === 'checkin_time' || k === 'checkout_time') ? time_(h[k], '') : (k === 'featured' ? isTrue_(h[k]) : (k === 'host_wa' || k === 'pic_wa') ? normPhone_(h[k]) : str_(h[k]));
    if (String(old) !== String(c.v[k])) { before[k] = old; after[k] = c.v[k]; }
  });
  if (!Object.keys(after).length) return { ok: true, changed: 0 };
  updateObj_('HOMESTAYS', h._row, after);
  logChange_('EDIT_RUMAH', String(h.id), before, after);
  CacheService.getScriptCache().remove('public_v2');
  return { ok: true, changed: Object.keys(after).length };
}
function adminPicSave_(b) {
  const g = adminGuard_(b.token); if (g) return g;
  const f = b.fields || {}, name = clean_(f.name, 80), area = clean_(f.area, 60), nw = normPhone_(f.wa), status = String(f.status || 'AKTIF').toUpperCase();
  if (name.length < 2) return { ok: false, error: 'invalid_field', field: 'name' };
  if (!/^62\d{8,13}$/.test(nw)) return { ok: false, error: 'invalid_field', field: 'wa' };
  if (['AKTIF', 'NONAKTIF'].indexOf(status) < 0) return { ok: false, error: 'invalid_field', field: 'status' };
  const patch = { pic_name: name, pic_wa: nw, area: area, status: status, bank_name: clean_(f.bank_name, 40), bank_account: clean_(f.bank_account, 30).replace(/[^0-9]/g, ''), bank_holder: clean_(f.bank_holder, 80) };
  const pics = readAll_('PICS'), oldWa = normPhone_(b.wa);
  const cur = oldWa ? pics.filter(function (p) { return normPhone_(p.pic_wa) === oldWa; })[0] : null;
  if (pics.some(function (p) { return normPhone_(p.pic_wa) === nw && (!cur || p._row !== cur._row); })) return { ok: false, error: 'duplicate' };
  if (!cur) { appendObj_('PICS', Object.assign({ joined_at: today_() }, patch)); logChange_('TAMBAH_PIC', nw, {}, patch); return { ok: true, pin_reset: false }; }
  const before = {}, after = {};
  Object.keys(patch).forEach(function (k) { const old = (k === 'pic_wa') ? normPhone_(cur[k]) : (k === 'status' ? String(cur.status || 'AKTIF').toUpperCase() : str_(cur[k])); if (String(old) !== String(patch[k])) { before[k] = old; after[k] = patch[k]; } });
  let pinReset = false;
  if (Object.keys(after).length) {
    if (after.pic_wa) { after.pin_hash = ''; pinReset = true; }   // PIN terikat nomor WA, jadi harus dibuat ulang
    updateObj_('PICS', cur._row, after);
    if (after.pic_wa || after.pic_name) {
      readAll_('HOMESTAYS').forEach(function (h) { if (normPhone_(h.pic_wa) === oldWa) updateObj_('HOMESTAYS', h._row, { pic_name: name, pic_wa: nw }); });
      CacheService.getScriptCache().remove('public_v2');
    }
    const a2 = Object.assign({}, after); delete a2.pin_hash; logChange_('EDIT_PIC', oldWa, before, a2);
  }
  return { ok: true, pin_reset: pinReset };
}

/* ============ PAYOUT LEDGER (jalankan harian lewat trigger) ============ */

function generatePayouts() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return generatePayoutsCore_(); } finally { lock.releaseLock(); }
}

function generatePayoutsCore_() {
  {
    const today = today_();
    const homes = {}; readAll_('HOMESTAYS').forEach(function (h) { homes[String(h.id)] = h; });
    const pics = {}; readAll_('PICS').forEach(function (p) { pics[String(p.pic_name).toLowerCase()] = p; });
    const done = {}; readAll_('PAYOUTS').forEach(function (p) { done[p.type + '|' + p.ref] = true; });
    let created = 0;
    function add(type, ref, payee, bank, amount, note) {
      if (done[type + '|' + ref] || !(amount > 0)) return false;
      appendObj_('PAYOUTS', {
        payout_id: 'PO-' + Utilities.getUuid().slice(0, 8).toUpperCase(), created_at: now_(), type: type, ref: ref, payee_name: payee,
        bank_name: bank.name || '', bank_account: bank.account || '', bank_holder: bank.holder || '', amount: amount, due_date: today, status: 'MENUNGGU', note: note || ''
      });
      done[type + '|' + ref] = true; created++; return true;
    }
    readAll_('BOOKINGS').forEach(function (bk) {
      const code = String(bk.booking_code), h = homes[String(bk.homestay_id)] || {};
      // 1) Pembayaran pemilik rumah: H+1 setelah check-in (juga untuk booking batal yang dananya ditahan sebagian)
      if (String(bk.host_payout_status) === 'MENUNGGU' && Number(bk.host_payout) > 0 && ['LUNAS', 'SELESAI', 'BATAL'].indexOf(String(bk.status)) >= 0 &&
          today >= dateAddDays_(fmtDate_(bk.checkin), 1)) {
        const bank = { name: h.host_bank_name, account: h.host_bank_account, holder: h.host_bank_holder };
        if (add('HOST', code, h.host_name || bk.host_name, bank, Number(bk.host_payout), bank.account ? '' : 'Rekening pemilik belum diisi di HOMESTAYS')) updateObj_('BOOKINGS', bk._row, { host_payout_status: 'DIJADWALKAN' });
      }
      // 2) Komisi PIC
      if (String(bk.commission_status) === 'LAYAK_CAIR' && Number(bk.commission_amount) > 0) {
        const p = pics[String(bk.pic_name).toLowerCase()] || {};
        const bank = { name: p.bank_name, account: p.bank_account, holder: p.bank_holder };
        if (add('PIC_COMMISSION', code, bk.pic_name, bank, Number(bk.commission_amount), bank.account ? '' : 'Rekening PIC belum ada di tab PICS')) updateObj_('BOOKINGS', bk._row, { commission_status: 'DIJADWALKAN' });
      }
      // 3) Refund tamu
      if (String(bk.refund_status) === 'MENUNGGU_REFUND' && Number(bk.refund_amount) > 0) {
        if (add('REFUND', code, bk.guest_name, {}, Number(bk.refund_amount), 'Minta rekening/e-wallet tamu via WA ' + normPhone_(bk.guest_wa))) updateObj_('BOOKINGS', bk._row, { refund_status: 'DIJADWALKAN' });
      }
    });
    // 4) Bonus akuisisi PIC
    Object.keys(homes).forEach(function (id) {
      const h = homes[id];
      if (String(h.acq_bonus_status) === 'LAYAK_CAIR' && Number(h.acq_bonus_amount) > 0) {
        const p = pics[String(h.pic_name).toLowerCase()] || {};
        const bank = { name: p.bank_name, account: p.bank_account, holder: p.bank_holder };
        if (add('PIC_BONUS', id, h.pic_name, bank, Number(h.acq_bonus_amount), bank.account ? '' : 'Rekening PIC belum ada di tab PICS')) updateObj_('HOMESTAYS', h._row, { acq_bonus_status: 'DIJADWALKAN' });
      }
    });
    CacheService.getScriptCache().remove('public_v2');
    return created;
  }
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'generatePayouts') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('generatePayouts').timeBased().everyDays(1).atHour(8).create();
}

/* ============ LOG ERROR KLIEN (ringan, dibatasi) ============ */
function clientError_(b) {
  if (!hit_('cerr_all', 5, 600)) return { ok: false, error: 'rate_limited' };
  logChange_('CLIENT_ERROR', clean_(b.where, 60), {}, { msg: clean_(b.msg, 160), ua: clean_(b.ua, 80) }, 'client');
  return { ok: true };
}

/* ============ BACKUP HARIAN + PEMERIKSA HARIAN ============ */
// Jalankan setupBackup() sekali dari editor. Salinan Sheets masuk Drive pemilik skrip tiap hari 03.00, salinan lebih dari 14 hari dihapus.
function dailyBackup() {
  DriveApp.getFileById(ss_().getId()).makeCopy('bolehnginep-backup-' + today_());
  const old = DriveApp.searchFiles("title contains 'bolehnginep-backup-' and trashed = false");
  const cut = Date.now() - 14 * 86400000;
  while (old.hasNext()) { const x = old.next(); if (x.getDateCreated().getTime() < cut) x.setTrashed(true); }
}
// Pemeriksa integritas: kode booking unik, status sah, nominal = tarif + kode unik, setiap LUNAS punya catatan MASUK. Kirim email ringkasan harian.
function dailyCheck() {
  const issues = [], bk = readAll_('BOOKINGS'), led = readAll_('LEDGER'), seen = {};
  const ok = ['MENUNGGU_PEMBAYARAN', 'LUNAS', 'SELESAI', 'BATAL'];
  bk.forEach(function (x) {
    const c = String(x.booking_code); if (!c) return;
    if (seen[c]) issues.push('Kode ganda: ' + c); seen[c] = 1;
    if (ok.indexOf(String(x.status)) < 0) issues.push(c + ': status tidak sah (' + x.status + ')');
    if (Number(x.kode_unik) && Number(x.jumlah_dibayar) !== (Number(x.room_total) || 0) + Number(x.kode_unik)) issues.push(c + ': jumlah_dibayar tidak sama dengan tarif + kode unik');
    if ((String(x.status) === 'LUNAS' || String(x.status) === 'SELESAI') && !led.some(function (l) { return String(l.booking_code) === c && String(l.type) === 'MASUK'; })) issues.push(c + ': status ' + x.status + ' tanpa catatan MASUK di LEDGER');
  });
  const cnt = {}; bk.forEach(function (x) { const st = String(x.status); cnt[st] = (cnt[st] || 0) + 1; });
  const body = 'Booking: ' + JSON.stringify(cnt) + '\n' + (issues.length ? 'MASALAH (' + issues.length + '):\n' + issues.slice(0, 40).join('\n') : 'Tidak ada masalah integritas.');
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'bolehnginep: ringkasan harian' + (issues.length ? ' (ADA MASALAH)' : ''), body); } catch (e) {}
  return issues;
}
function setupBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['weeklyBackup', 'dailyBackup', 'dailyCheck'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(7).create();
}

/* ============ SETUP (jalankan sekali dari editor) ============ */

function setupSheets() {
  const ss = ss_();
  Object.keys(HEADERS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const h = HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1F4D3A').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  function textCols(sheet, keys, rows) {
    keys.forEach(function (k) { ss.getSheetByName(sheet).getRange(2, HEADERS[sheet].indexOf(k) + 1, rows, 1).setNumberFormat('@'); });
  }
  textCols('BOOKINGS', ['guest_wa', 'checkin'], 2000);
  textCols('HOMESTAYS', ['host_wa', 'pic_wa', 'std_verified_at', 'host_bank_account', 'checkin_time', 'checkout_time'], 500);
  textCols('AVAILABILITY', ['date_from', 'date_to'], 1000);
  textCols('SEASONS', ['date_from', 'date_to'], 100);
  textCols('PICS', ['pic_wa', 'bank_account'], 200);
  textCols('VERIFICATIONS', ['pic_wa'], 500);
  textCols('PAYOUTS', ['bank_account', 'due_date'], 3000);
  const bs = ss.getSheetByName('BOOKINGS');
  bs.getRange(2, HEADERS.BOOKINGS.indexOf('status') + 1, 2000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['MENUNGGU_PEMBAYARAN', 'LUNAS', 'SELESAI', 'BATAL'], true).build());
  ss.getSheetByName('COMPLAINTS').getRange(2, HEADERS.COMPLAINTS.indexOf('status') + 1, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['OPEN', 'IN_PROGRESS', 'CLOSED'], true).build());
  ss.getSheetByName('PAYOUTS').getRange(2, HEADERS.PAYOUTS.indexOf('status') + 1, 3000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['MENUNGGU', 'DIBAYAR', 'GAGAL'], true).build());

  const hs = ss.getSheetByName('HOMESTAYS');
  if (hs.getLastRow() < 2) {
    appendObj_('HOMESTAYS', {
      id: 'H-001', active: true, name: 'Omah Pak Slamet (contoh)', destination: 'Gunung Bromo', city: 'Probolinggo, Jawa Timur', area: 'Ngadisari',
      price_per_guest_night: 100000, peak_price: 130000, capacity: 3, host_name: 'Pak Slamet & Bu Wati', host_wa: '6281200000001',
      pic_name: 'Dewi (PIC Bromo)', pic_wa: '6281200000002', moods: 'gunung,kopi',
      std1_kunci: true, std2_kamar_mandi: true, std3_kasur_linen: true, std4_listrik_cahaya: true, std5_privasi: true, std6_ratecard: true,
      std_verified_at: '2026-10-12', desc_id: 'Kamar di rumah keluarga, 10 menit dari titik sunrise.', desc_en: 'Room in a family home, 10 minutes from the sunrise point.',
      services_json: JSON.stringify([
        { id: 'sarapan', name: { id: 'Sarapan', en: 'Breakfast' }, price: 15000, unit: 'perGuestPerNight' },
        { id: 'motor', name: { id: 'Sewa motor', en: 'Motorbike rental' }, price: 90000, unit: 'perNight' }
      ]),
      photo_url: '', photo_urls: '', map_url: '', distance_id: '10 menit berkendara ke titik sunrise', distance_en: '10 minutes by bike to the sunrise point',
      checkin_time: '14:00', checkout_time: '11:00',
      house_rules_id: 'Jam tenang 22.00–05.00|Lepas alas kaki di dalam rumah|Lapor ke pemilik jika pulang lewat tengah malam',
      house_rules_en: 'Quiet hours 22:00–05:00|Remove shoes indoors|Tell the host if returning after midnight',
      featured: true, rating_home_avg: 0, rating_home_count: 0, rating_host_pic_avg: 0, rating_host_pic_count: 0,
      first_guest_done: false, acq_bonus_status: 'TERTAHAN', acq_bonus_amount: 0, created_at: now_()
    });
  }
  const ses = ss.getSheetByName('SEASONS');
  if (ses.getLastRow() < 2) appendObj_('SEASONS', { date_from: '2026-12-24', date_to: '2027-01-03', label: 'Libur Natal & Tahun Baru' });
}

/* ============ HELPERS ============ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(n) {
  const s = ss_().getSheetByName(n);
  if (!s) throw new Error('Tab ' + n + ' belum ada. Jalankan setupSheets().');
  return s;
}
function readAll_(name) {
  const v = sheet_(name).getDataRange().getValues();
  const h = v.shift();
  return v.map(function (r, i) { const o = { _row: i + 2 }; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}
function appendObj_(name, obj) {
  sheet_(name).appendRow(HEADERS[name].map(function (k) { return obj[k] === undefined ? '' : safe_(obj[k]); }));
}
function updateObj_(name, row, patch) {
  const sh = sheet_(name);
  Object.keys(patch).forEach(function (k) {
    const c = HEADERS[name].indexOf(k);
    if (c >= 0) sh.getRange(row, c + 1).setValue(safe_(patch[k]));
  });
}
function safe_(v) { // cegah formula injection di Sheets
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}
function spam_(b) {
  if (b.hp) return true;                                   // honeypot terisi
  if (Number(b.elapsed_ms) < CFG.MIN_FILL_MS) return true; // terlalu cepat untuk manusia
  return false;
}
function hit_(key, max, sec) { // rate limit sederhana berbasis CacheService (dipanggil di dalam script lock)
  const c = CacheService.getScriptCache();
  const v = Number(c.get(key) || 0);
  if (v >= max) return false;
  c.put(key, String(v + 1), Math.min(sec, 21600));
  return true;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function str_(v) { return v == null ? '' : String(v); }
// Jam dari Sheets bisa berupa Date (1899-12-30 HH:mm). Selalu kembalikan 'HH:mm'.
function time_(v, def) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'HH:mm');
  const m = String(v == null ? '' : v).match(/(\d{1,2})[:.](\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : def;
}
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max); }
function parseJson_(v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function splitList_(v, sep) { return str_(v).split(sep).map(function (s) { return s.trim(); }).filter(Boolean); }
function httpsOnly_(u) { u = str_(u).trim(); return /^https:\/\//i.test(u) ? u : ''; }
function ratingBasis_(rh, rp) { return CFG.INCENTIVE_RATING_BASIS === 'HOST_PIC' ? rp : (rh + rp) / 2; }
function round1_(n) { return Math.round(n * 10) / 10; }
function now_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  return str_(v);
}
function dateAddDays_(iso, n) {
  const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function daysBetween_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function nightsList_(checkin, n) { const out = []; for (let i = 0; i < n; i++) out.push(dateAddDays_(checkin, i)); return out; }
function inRanges_(iso, ranges) { for (let i = 0; i < ranges.length; i++) if (iso >= ranges[i][0] && iso <= ranges[i][1]) return true; return false; }
function seasons_() {
  return readAll_('SEASONS').map(function (r) { return { from: fmtDate_(r.date_from), to: fmtDate_(r.date_to) || fmtDate_(r.date_from), label: str_(r.label) }; })
    .filter(function (s) { return s.from; });
}
function createdMs_(v) {
  if (v instanceof Date) return v.getTime();
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  return m ? new Date(m[1] + 'T' + (m[2].length === 5 ? m[2] + ':00' : m[2]) + '+07:00').getTime() : 0;
}
// Tanggal yang sudah diambil booking lain: LUNAS selalu, belum bayar hanya selama HOLD_MINUTES
function takenRanges_(homeId, exceptCode, rows) {
  const out = [], now = Date.now();
  (rows || readAll_('BOOKINGS')).forEach(function (x) {
    if (String(x.homestay_id) !== String(homeId) || (exceptCode && String(x.booking_code) === String(exceptCode))) return;
    const st = String(x.status);
    if (st === 'MENUNGGU_PEMBAYARAN') { const t0 = createdMs_(x.created_at); if (t0 && now - t0 > CFG.HOLD_MINUTES * 60000) return; }
    else if (st !== 'LUNAS') return;
    const ci = fmtDate_(x.checkin), n = Number(x.nights) || 0;
    if (ci && n > 0) out.push([ci, dateAddDays_(ci, n - 1)]);
  });
  return out;
}
function blocksFor_(homeId) {
  return readAll_('AVAILABILITY').filter(function (r) { return String(r.homestay_id) === String(homeId); })
    .map(function (r) { const f = fmtDate_(r.date_from); return [f, fmtDate_(r.date_to) || f]; });
}
function normPhone_(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1);
  return d;
}
function qty_(unit, nights, guests) {
  switch (unit) {
    case 'perGuestPerNight': return nights * guests;
    case 'perNight': return nights;
    case 'perGuest': return guests;
    default: return 1;
  }
}
function newCode_() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return 'BN-' + Utilities.formatDate(new Date(), CFG.TZ, 'yyMMdd') + '-' + s;
}
