/* bolehnginep: modul Admin + Portal Mitra. Dimuat hanya saat tombolnya dibuka. */
(function () {
'use strict';
const { $, $$, APPS_SCRIPT_URL, COMPANY_BANK, COMPANY_NAME, DEMO_ADMIN_PIN, S, STD, addDays, apiPost, check, copySync, demoBookings, demoUpdate, errMsg, esc, fmtDate, loc2, normPhone, openLayer, rp, star, store, t, toast, todayISO, track, waLink, renderCatalog } = window.__BN;
/* ============ DISPATCH ============ */
function renderDispatch() {
  const A = S.admin; const body = $('#dpcBody');
  if (!A.pin) {
    body.innerHTML = '<div><label for="dpcPin" class="text-sm font-semibold">' + esc(t('dpcPin')) + '</label><input id="dpcPin" type="password" class="field" autocomplete="off"></div><p id="dpcErr" class="text-sm text-terra font-semibold min-h-[1.25rem]" role="alert"></p><button id="dpcGo" type="button" class="btn btn-primary w-full">' + esc(t('dpcOpen')) + '</button>' + (S.demo ? '<p class="text-xs text-ink/60">Demo PIN: ' + esc(DEMO_ADMIN_PIN) + '</p>' : '');
    return;
  }
  const tabsH = '<div class="flex flex-wrap gap-2">' + [['book', 'dpcTabBook'], ['rev', 'dpcTabReview'], ['pay', 'admTabPay'], ['homes', 'admTabHomes'], ['avail', 'admTabAvail']].map((x) => '<button type="button" data-admtab="' + x[0] + '" class="min-h-[44px] px-4 rounded-full text-sm font-semibold border-[1.5px] ' + ((A.tab || 'book') === x[0] ? 'bg-forest text-white border-forest' : 'bg-white text-forest border-forest/25') + '">' + esc(t(x[1])) + '</button>').join('') + '</div>';
  if (A.tab === 'rev') { renderAdminReviews(tabsH); return; }
  if (A.tab === 'pay') { renderAdminPayouts(tabsH); return; }
  if (A.tab === 'homes') { if (A.edit) renderAdminEdit(tabsH); else renderAdminHomes(tabsH); return; }
  if (A.tab === 'avail') { renderAdminAvail(tabsH); return; }
  const list = A.bookings;
  if (!list.length) { body.innerHTML = tabsH + '<p class="text-ink/70">' + esc(t('dpcNone')) + '</p><button id="dpcRefresh" class="btn btn-ghost">' + esc(t('dpcRefresh')) + '</button>'; return; }
  const b = list.filter((x) => x.booking_code === A.sel)[0] || list[0]; A.sel = b.booking_code;
  const opts = list.map((x) => '<option value="' + esc(x.booking_code) + '"' + (x.booking_code === b.booking_code ? ' selected' : '') + '>' + esc(x.booking_code + ' · ' + x.guest_name + ' · ' + x.homestay_name) + '</option>').join('');
  const pm = picMsg(b), hm = hostMsg(b);
  const blk = (id, title, msg, num, fwd, who) => '<div class="rounded-2xl border border-black/10 p-3 space-y-2"><div class="flex items-center justify-between gap-2"><p class="font-bold text-forest text-sm">' + esc(title) + '</p>' + (fwd ? '<span class="text-xs font-semibold text-forest">' + esc(t('dpcMarked')) + '</span>' : '') + '</div><textarea readonly rows="7" class="field !text-sm font-mono" id="' + id + '">' + esc(msg) + '</textarea><div class="grid grid-cols-3 gap-2"><button type="button" class="btn btn-primary !px-2 text-sm" data-copy="' + id + '">' + esc(t('dpcCopy')) + '</button><a class="btn btn-ghost !px-2 text-sm" target="_blank" rel="noopener" href="' + esc(waLink(num, msg)) + '">' + esc(t('dpcWA')) + '</a><button type="button" class="btn btn-ghost !px-2 text-sm" data-mark="' + who + '">' + esc(t('dpcMark')) + '</button></div></div>';
  body.innerHTML = tabsH + '<div class="flex gap-2 items-end"><div class="flex-1 min-w-0"><label for="dpcSel" class="text-sm font-semibold">' + esc(t('dpcPick')) + '</label><select id="dpcSel" class="field">' + opts + '</select></div><button id="dpcRefresh" type="button" class="btn btn-ghost !px-3 text-sm">' + esc(t('dpcRefresh')) + '</button></div>' +
    '<p class="text-xs text-ink/65">' + esc(t('dpcStatus')) + ': <b>' + esc(b.status) + '</b>' + (b.refund_amount ? ' · Refund ' + esc(rp(b.refund_amount)) + ' (' + esc(b.refund_status || '') + ')' : '') + '</p>' + blk('msgPic', t('dpcPIC') + ' — ' + b.pic_name, pm, b.pic_wa, b.forwarded_pic, 'pic') + blk('msgHost', t('dpcHost') + ' — ' + b.host_name, hm, b.host_wa, b.forwarded_host, 'host');
  body.insertAdjacentHTML('beforeend', adminActionsHTML(b));
}
const addonNames = (b) => { const h = S.homes.filter((x) => x.id === b.homestay_id)[0]; if (!h || !b.addons || !b.addons.length) return '-'; return h.services.filter((s) => b.addons.indexOf(s.id) >= 0).map((s) => loc2(s.name)).join(', ') || '-'; };
function picMsg(b) {
  return 'Halo ' + b.pic_name + ', ada booking baru di areamu.\n\nKode: ' + b.booking_code + '\nRumah: ' + b.homestay_name + ' (' + b.destination + ')\nHost: ' + b.host_name + '\nTamu: ' + b.guest_name + ' (wa.me/' + b.guest_wa + ')\nCheck-in: ' + fmtDate(b.checkin, 'id') + ', ' + b.nights + ' malam, ' + b.guests + ' tamu\nKamar: ' + rp(b.room_total) + ' (diurus admin, status: ' + b.status + ')\nLayanan tambahan: ' + addonNames(b) + ' (estimasi ' + rp(b.addon_estimate) + ', bayar langsung ke host)' +
    (b.note ? '\nCatatan tamu: ' + b.note : '') + '\n\nTugas kamu:\n1. Bikin grup bertiga (admin, tamu, host).\n2. Pastikan standar bolehnginep terjaga saat check-in.\n3. Ingetin tamu: rate card tambahan dibayar langsung ke host.\n4. Habis nginep, ajak tamu nulis ulasan di web (komisi cair kalau rating minimal 4.0).';
}
function hostMsg(b) {
  return 'Halo ' + b.host_name + ', ada tamu baru buat rumahmu.\n\nKode: ' + b.booking_code + '\nTamu: ' + b.guest_name + '\nCheck-in: ' + fmtDate(b.checkin, 'id') + ', ' + b.nights + ' malam, ' + b.guests + ' tamu\nPIC: ' + b.pic_name + ' (wa.me/' + b.pic_wa + ') bakal bantu hubungin kamu dengan tamu.\n\nPenting:\n• Tarif kamar udah diurus admin, jangan ditagih ke tamu.\n• Layanan tambahan (' + addonNames(b) + ') ditagih langsung di lokasi sesuai rate card di web.\n• Ganti seprai dan sarung bantal sebelum tamu datang.' + (b.note ? '\n• Catatan tamu: ' + b.note : '');
}
async function adminLoad() {
  const A = S.admin;
  if (!APPS_SCRIPT_URL) {
    if (A.pin !== DEMO_ADMIN_PIN) return { ok: false, error: 'unauthorized' };
    A.bookings = demoBookings().reverse(); return { ok: true };
  }
  const r = await apiPost({ action: 'adminBookings', token: A.pin });
  if (r && r.ok) A.bookings = r.bookings; return r;
}
async function adminMark(who) {
  const A = S.admin; const b = A.bookings.filter((x) => x.booking_code === A.sel)[0]; if (!b) return;
  if (APPS_SCRIPT_URL) { try { const r = await apiPost({ action: 'markForwarded', token: A.pin, booking_code: b.booking_code, target: who }); if (!r || !r.ok) { toast(t('err_generic')); return; } } catch (e) { toast(t('err_generic')); return; } }
  if (who === 'pic') b.forwarded_pic = true; else b.forwarded_host = true;
  renderDispatch(); toast(t('dpcMarked'));
}

$('#dpcBody').addEventListener('click', async (e) => {
  const at = e.target.closest('[data-admtab]'); if (at) { S.admin.tab = at.getAttribute('data-admtab'); S.admin.edit = null; try { if (S.admin.tab === 'rev') await adminLoadReviews(); else if (S.admin.tab === 'pay') await adminLoadPayouts(); else if (S.admin.tab === 'homes') await adminLoadHomes(); else if (S.admin.tab === 'avail') await adminLoadAvail(); } catch (x) {} renderDispatch(); return; }
  if (await adminClick(e)) return;
  const rv = e.target.closest('[data-revvis]'); if (rv) { const id = rv.getAttribute('data-revvis'); const cur = (S.admin.reviews || []).filter((x) => x.review_id === id)[0]; moderate(id, { visible: !(cur && cur.visible) }); return; }
  const rs = e.target.closest('[data-revsave]'); if (rs) { const id = rs.getAttribute('data-revsave'); moderate(id, { host_reply: $('#rp_' + id).value }); return; }
  if (e.target.closest('#dpcGo')) {
    const pin = $('#dpcPin').value; S.admin.pin = pin; const btn = e.target.closest('#dpcGo'); btn.disabled = true;
    try { const r = await adminLoad(); if (!r || !r.ok) { S.admin.pin = ''; renderDispatch(); const er = $('#dpcErr'); if (er) er.textContent = t('err_' + (r && r.error)) !== 'err_' + (r && r.error) ? t('err_' + r.error) : t('err_generic'); } else renderDispatch(); }
    catch (x) { S.admin.pin = ''; renderDispatch(); const er = $('#dpcErr'); if (er) er.textContent = t('err_generic'); }
    return;
  }
  if (e.target.closest('#dpcRefresh')) { try { const r = await adminLoad(); if (!r || !r.ok) { S.admin.pin = ''; } } catch (x) {} renderDispatch(); return; }
  const cp = e.target.closest('[data-copy]'); if (cp) { const ok = copySync($('#' + cp.getAttribute('data-copy')).value); toast(ok ? t('copied') : t('copyFail')); return; }
  const mk = e.target.closest('[data-mark]'); if (mk) adminMark(mk.getAttribute('data-mark'));
});
$('#dpcBody').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'dpcPin') { e.preventDefault(); const g = $('#dpcGo'); if (g) g.click(); } });
$('#dpcBody').addEventListener('change', (e) => { if (e.target.id === 'dpcSel') { S.admin.sel = e.target.value; renderDispatch(); } if (e.target.id === 'admTplSel') { const b = (S.admin.bookings || []).filter((x) => x.booking_code === S.admin.sel)[0]; if (b) $('#admTplTxt').value = waTpl(b, e.target.value); } });

/* ============ ADMIN: MODERASI ULASAN ============ */
async function adminLoadReviews() {
  const A = S.admin;
  if (!APPS_SCRIPT_URL) { A.reviews = store.get('bn_demo_reviews', []).slice().reverse().map((r) => ({ review_id: r.review_id, date: r.date, homestay_name: r.homestay_name, guest: r.who, ratingHome: r.ratingHome, textHome: r.textHome, ratingHost: r.ratingHost, textHost: r.textHost, visible: r.visible !== false, reply: r.reply || '' })); return { ok: true }; }
  const r = await apiPost({ action: 'adminReviews', token: A.pin }); if (r && r.ok) A.reviews = r.reviews; return r;
}
function renderAdminReviews(tabsH) {
  const list = S.admin.reviews || []; const body = $('#dpcBody');
  body.innerHTML = tabsH + (list.length ? list.map((r) => '<div class="rounded-2xl border border-black/10 p-3 space-y-2 text-sm' + (r.visible ? '' : ' opacity-60') + '"><p class="font-bold text-forest">' + esc(r.homestay_name) + ' <span class="font-normal text-ink/55">· ' + esc(r.guest) + ' · ' + esc(r.date) + (r.visible ? '' : ' · ' + esc(t('rvAdmHidden'))) + '</span></p>' +
    '<p>' + esc(t('rHome')) + ': ' + star + ' <b>' + r.ratingHome + '</b> ' + esc(r.textHome) + '</p><p>' + esc(t('rHost')) + ': ' + star + ' <b>' + r.ratingHost + '</b> ' + esc(r.textHost) + '</p>' +
    '<label class="text-xs font-semibold" for="rp_' + esc(r.review_id) + '">' + esc(t('rvAdmReply')) + '</label><textarea id="rp_' + esc(r.review_id) + '" rows="2" maxlength="400" class="field !text-sm">' + esc(r.reply) + '</textarea>' +
    '<div class="grid grid-cols-2 gap-2"><button type="button" class="btn btn-ghost !px-2 text-sm" data-revvis="' + esc(r.review_id) + '">' + esc(t(r.visible ? 'rvAdmHide' : 'rvAdmShow')) + '</button><button type="button" class="btn btn-primary !px-2 text-sm" data-revsave="' + esc(r.review_id) + '">' + esc(t('rvAdmSave')) + '</button></div></div>').join('') : '<p class="text-ink/70">' + esc(t('rvAdmNone')) + '</p>');
}
async function moderate(id, patch) {
  const A = S.admin; const rv = (A.reviews || []).filter((x) => x.review_id === id)[0]; if (!rv) return;
  try {
    if (APPS_SCRIPT_URL) { const r = await apiPost(Object.assign({ action: 'moderateReview', token: A.pin, review_id: id }, patch)); if (!r || !r.ok) { toast(errMsg(r)); return; } }
    else { const l = store.get('bn_demo_reviews', []); const x = l.filter((y) => y.review_id === id)[0]; if (x) { if ('visible' in patch) x.visible = patch.visible; if ('host_reply' in patch) x.reply = patch.host_reply; store.set('bn_demo_reviews', l); } }
    if ('visible' in patch) rv.visible = patch.visible; if ('host_reply' in patch) rv.reply = patch.host_reply;
    renderDispatch(); toast('✓');
  } catch (e) { toast(t('err_generic')); }
}

/* ============ ADMIN: AKSI SEKALI KLIK, TEMPLATE WA, PAYOUT, RUMAH & PIN ============ */
const badge = (txt, cls) => '<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ' + cls + '">' + esc(txt) + '</span>';
const ST_CLS = { MENUNGGU_PEMBAYARAN: 'bg-terra/15 text-terra', LUNAS: 'bg-forest text-white', SELESAI: 'bg-black/10 text-ink', BATAL: 'bg-black/10 text-ink/60' };
const homeOf = (id) => S.homes.filter((x) => x.id === id)[0] || null;

function demoPayouts() {
  const paid = store.get('bn_demo_paid', {}); const out = [];
  demoBookings().forEach((b) => {
    if (b.status === 'BATAL' && b.refund_amount > 0) out.push({ payout_id: 'REF-' + b.booking_code, type: 'REFUND', ref: b.booking_code, payee: b.guest_name, bank: '', account: '', holder: '', amount: b.refund_amount, due: todayISO(), note: 'Minta rekening/e-wallet tamu via WA ' + b.guest_wa });
    if ((b.status === 'LUNAS' || b.status === 'SELESAI') && addDays(b.checkin, 1) <= todayISO()) out.push({ payout_id: 'HOS-' + b.booking_code, type: 'HOST', ref: b.booking_code, payee: b.host_name, bank: '', account: '', holder: '', amount: Math.round(b.room_total * 0.75), due: addDays(b.checkin, 1), note: 'Rekening pemilik belum diisi (demo)' });
  });
  out.forEach((p) => { p.status = paid[p.payout_id] ? 'DIBAYAR' : 'MENUNGGU'; });
  return out.sort((a, b) => (a.status === 'MENUNGGU' ? 0 : 1) - (b.status === 'MENUNGGU' ? 0 : 1));
}
async function admApi(action, extra) {
  const A = S.admin;
  if (APPS_SCRIPT_URL) return apiPost(Object.assign({ action: action, token: A.pin }, extra));
  if (A.pin !== DEMO_ADMIN_PIN) return { ok: false, error: 'unauthorized' };
  const x = extra || {};
  if (action === 'adminSetStatus') {
    const b = demoBookings().filter((y) => y.booking_code === x.booking_code)[0]; if (!b) return { ok: false, error: 'booking_not_found' };
    if (x.status === 'LUNAS' && b.status === 'MENUNGGU_PEMBAYARAN') { demoUpdate(b.booking_code, { status: 'LUNAS' }); return { ok: true }; }
    if (x.status === 'SELESAI' && b.status === 'LUNAS') { demoUpdate(b.booking_code, { status: 'SELESAI' }); return { ok: true }; }
    if (x.status === 'BATAL' && (b.status === 'LUNAS' || b.status === 'MENUNGGU_PEMBAYARAN')) { const pct = b.status === 'LUNAS' ? Math.max(0, Math.min(100, Number(x.refund_percent) || 0)) / 100 : 0; const rf = Math.round(b.room_total * pct); demoUpdate(b.booking_code, { status: 'BATAL', refund_amount: rf, refund_status: rf > 0 ? 'MENUNGGU_REFUND' : 'TIDAK_ADA' }); return { ok: true, refund_amount: rf }; }
    return { ok: false, error: 'invalid_transition' };
  }
  if (action === 'adminPayouts') return { ok: true, payouts: demoPayouts() };
  if (action === 'adminMarkPaid') { const m = store.get('bn_demo_paid', {}); m[x.payout_id] = true; store.set('bn_demo_paid', m); return { ok: true }; }
  if (action === 'adminHomes') {
    const ver = store.get('bn_demo_ver', {}), act = store.get('bn_demo_active', {});
    const homes = S.homes.map((h) => { const st = (ver[h.id] && ver[h.id].std) || h.standards; return { id: h.id, name: h.name, destination: h.destination, host: h.host, host_wa: '', pic: h.pic, active: act[h.id] !== false, standards: st, passed: st.every(Boolean), verified: h.verified || '', has_pin: h.id === DEMO_HOST.id }; })
      .concat(store.get('bn_demo_regs', []).map((r, i) => { const id = 'REG-' + (i + 1), st = (ver[id] && ver[id].std) || [false, false, false, false, false, false]; return { id: id, name: r.name, destination: r.destination, host: r.host_name, host_wa: '', pic: r.referred_by || '', active: !!act[id], standards: st, passed: st.every(Boolean), verified: '', has_pin: false }; }));
    return { ok: true, homes: homes, pics: [{ name: 'Dewi (PIC Bromo)', wa: DEMO_PIC.wa, area: 'Bromo', has_pin: true }] };
  }
  if (action === 'adminSetHome') { const act = store.get('bn_demo_active', {}); act[x.homestay_id] = x.active === true; store.set('bn_demo_active', act); return { ok: true }; }
  if (action === 'adminAvail') {
    const op = store.get('bn_demo_open', {}), act = store.get('bn_demo_active', {});
    return { ok: true, homes: S.homes.filter((h) => !h.sample).map((h) => ({ id: h.id, name: h.name, destination: h.destination, pic: h.pic, active: act[h.id] !== false, open: op[h.id] !== false, blocks: (S.blocks[h.id] || []).map((b) => ({ from: b[0], to: b[1], reason: b[2] || '' })) })) };
  }
  if (action === 'adminHomeGet') { const h = S.homes.filter((y) => y.id === x.homestay_id)[0]; if (!h) return { ok: false, error: 'not_found' }; return { ok: true, home: { id: h.id, active: true, name: h.name, destination: h.destination, city: h.city, area: h.area, price_per_guest_night: h.price, peak_price: h.peakPrice || '', capacity: h.capacity, host_name: h.host, host_wa: '', host_bank_name: '', host_bank_account: '', host_bank_holder: '', pic_wa: '', moods: (h.moods || []).join(','), desc_id: loc2(h.desc), services_json: JSON.stringify(h.services || []), photo_url: '', photo_urls: '', map_url: h.mapUrl || '', distance_id: loc2(h.distance), checkin_time: h.checkinTime || '14:00', checkout_time: h.checkoutTime || '11:00', house_rules_id: ((h.rules && h.rules.id) || []).join('|'), featured: !!h.featured } }; }
  if (action === 'adminHomeSave' || action === 'adminPicSave') return { ok: true, demo: true };
  if (action === 'adminSetPin') return /^\d{6}$/.test(String(x.pin || '')) ? { ok: true } : { ok: false, error: 'invalid_pin' };
  return { ok: false, error: 'unknown_action' };
}
async function adminLoadPayouts() { const r = await admApi('adminPayouts'); if (r && r.ok) S.admin.payouts = r.payouts; return r; }
async function adminLoadAvail() { const r = await admApi('adminAvail'); if (r && r.ok) S.admin.avail = r.homes; return r; }
async function adminLoadHomes() { const r = await admApi('adminHomes'); if (r && r.ok) { S.admin.homesList = r.homes; S.admin.pics = r.pics; } return r; }

function waTpl(b, key) {
  const h = homeOf(b.homestay_id) || {}; const when = fmtDate(b.checkin, 'id') + ', ' + b.nights + ' malam, ' + b.guests + ' tamu';
  const head = 'Halo ' + b.guest_name + '!\n\n';
  const rules = (h.rules && h.rules.id || []).map((x) => '• ' + x).join('\n');
  const link = location.origin + location.pathname;
  const T2 = {
    confirm: head + 'Terima kasih sudah booking di bolehnginep.\n\nKode booking: ' + b.booking_code + '\nRumah: ' + b.homestay_name + ' (' + b.destination + ')\nCheck-in: ' + when + '\nTarif kamar: ' + rp(b.room_total) + '\n\nKamarnya kosong. Silakan transfer tepat ' + rp(b.jumlah_dibayar || b.room_total) + ' (sudah termasuk kode unik ' + (b.kode_unik || '-') + ') ke rekening perusahaan:\n' + COMPANY_BANK + '\na.n. ' + COMPANY_NAME + '\n\nCara bayar:\n1. Transfer tepat sesuai nominal di atas (termasuk kode unik) ke rekening perusahaan.\n2. Kirim bukti transfer ke chat ini.\n3. Kami cek, lalu kabari kalau booking sudah lunas.\n\nNominal berlaku 60 menit sejak pesan ini dikirim. Lewat dari itu tanggal kami buka lagi untuk tamu lain.',
    paid: head + 'Pembayaran booking ' + b.booking_code + ' sudah kami terima. Terima kasih!\n\nRumah: ' + b.homestay_name + '\nCheck-in: ' + when + '\n\nPendamping lokal, ' + b.pic_name + ' (wa.me/' + b.pic_wa + '), akan membuat grup bersama kamu dan tuan rumah. Kalau jadwal berubah, kabari kami.',
    h1: head + 'Pengingat: check-in kamu besok.\n\nRumah: ' + b.homestay_name + '\nJam check-in: ' + (h.checkinTime || '14:00') + '\nKode booking: ' + b.booking_code + '\n\nBawa KTP/paspor dan jaket. Kabari pendamping ' + b.pic_name + ' kalau kamu akan tiba lewat tengah malam.',
    checkin: head + 'Info check-in untuk ' + b.homestay_name + ':\n\n• Check-in ' + (h.checkinTime || '14:00') + ', check-out ' + (h.checkoutTime || '11:00') + '\n• Bawa KTP/paspor, tuan rumah atau pendamping akan mencatat identitas\n' + (rules ? rules + '\n' : '') + '• Layanan tambahan dibayar langsung ke tuan rumah sesuai daftar harga\n• Ada kendala? Hubungi pendamping ' + b.pic_name + ' (wa.me/' + b.pic_wa + ')',
    review: head + 'Terima kasih sudah menginap di ' + b.homestay_name + '.\n\nBantu tamu lain dengan menulis ulasan jujur di ' + link + ' (menu Tulis ulasan). Siapkan kode booking ' + b.booking_code + ' dan 4 digit terakhir nomor WA kamu.\n\nKalau ada yang kurang pas, balas chat ini atau kirim Lapor masalah di situs, nanti kami tindak lanjuti.'
  };
  return T2[key] || '';
}
function adminActionsHTML(b) {
  let btns = '';
  if (b.status === 'MENUNGGU_PEMBAYARAN') btns = '<p class="w-full text-sm">Nominal transfer: <b>' + esc(rp(b.jumlah_dibayar || b.room_total)) + '</b> (kode unik ' + esc(b.kode_unik || '-') + '). Berlaku 60 menit sejak ' + esc(b.created_at || 'booking dibuat') + '.</p><input id="admPaidAmt" class="field !text-sm" inputmode="numeric" placeholder="Nominal yang masuk (kosongkan kalau sudah dicek pas)"><button type="button" data-admact="LUNAS" class="btn btn-primary text-sm">Tandai LUNAS</button><button type="button" data-admact="BATAL" data-pct="0" class="btn btn-ghost text-sm">Batalkan (belum bayar)</button><button type="button" data-admact="BATAL" data-pct="100" data-received="1" class="btn btn-ghost text-sm">Batalkan, uang sudah masuk (refund 100%)</button>';
  else if (b.status === 'LUNAS') btns = '<button type="button" data-admact="SELESAI" class="btn btn-primary text-sm">Tandai SELESAI</button><div class="flex gap-2 items-center"><select id="admPct" class="field !w-auto !min-h-[44px] text-sm"><option value="100">Refund 100%</option><option value="50">Refund 50%</option><option value="0">Tanpa refund</option></select><button type="button" data-admact="BATAL" data-pctsel="1" class="btn btn-ghost text-sm">Batalkan</button></div>';
  const keys = [['confirm', 'Konfirmasi + cara bayar'], ['paid', 'Pembayaran diterima'], ['h1', 'Pengingat H-1'], ['checkin', 'Instruksi check-in'], ['review', 'Minta ulasan']];
  const def = b.status === 'MENUNGGU_PEMBAYARAN' ? 'confirm' : b.status === 'LUNAS' ? 'checkin' : 'review';
  return '<div class="rounded-2xl border border-black/10 p-3 space-y-2"><p class="font-bold text-forest text-sm">Status booking</p><div class="flex flex-wrap gap-2 items-center">' + (btns || '<span class="text-sm text-ink/60">Tidak ada aksi untuk status ' + esc(b.status) + '.</span>') + '</div></div>' +
    '<div class="rounded-2xl border border-black/10 p-3 space-y-2"><p class="font-bold text-forest text-sm">Pesan WA ke tamu</p><select id="admTplSel" class="field">' + keys.map((k) => '<option value="' + k[0] + '"' + (k[0] === def ? ' selected' : '') + '>' + esc(k[1]) + '</option>').join('') + '</select>' +
    '<textarea id="admTplTxt" rows="8" class="field !text-sm" readonly>' + esc(waTpl(b, def)) + '</textarea><div class="grid grid-cols-2 gap-2"><button type="button" data-copy="admTplTxt" class="btn btn-ghost text-sm">' + esc(t('dpcCopy') !== 'dpcCopy' ? t('dpcCopy') : 'Salin') + '</button><button type="button" data-admwa class="btn btn-primary text-sm">Kirim lewat WA</button></div></div>';
}
function renderAdminPayouts(tabsH) {
  const L = S.admin.payouts || []; const tl = { HOST: 'Pemilik', PIC_COMMISSION: 'Komisi PIC', PIC_BONUS: 'Bonus PIC', REFUND: 'Refund tamu' };
  $('#dpcBody').innerHTML = tabsH + '<p class="text-xs text-ink/60">Transfer manual, lalu tandai dibayar. Daftar dibuat otomatis dari booking.</p>' + (L.length ? L.map((p) => '<div class="rounded-2xl border border-black/10 p-3 space-y-1 text-sm' + (p.status === 'DIBAYAR' ? ' opacity-60' : '') + '"><div class="flex justify-between gap-2"><b class="text-forest">' + esc(tl[p.type] || p.type) + ' · ' + esc(p.payee) + '</b>' + badge(p.status, p.status === 'DIBAYAR' ? 'bg-black/10 text-ink' : 'bg-terra/15 text-terra') + '</div>' +
    '<p class="font-display text-xl text-forest">' + rp(p.amount) + '</p><p class="text-xs text-ink/65">Ref ' + esc(p.ref) + ' · jatuh tempo ' + esc(p.due) + '</p>' + (p.account ? '<p class="text-xs">' + esc(p.bank) + ' ' + esc(p.account) + ' a.n. ' + esc(p.holder) + '</p>' : '') + (p.note ? '<p class="text-xs text-terra">' + esc(p.note) + '</p>' : '') +
    (p.status === 'DIBAYAR' ? '' : '<button type="button" data-paid="' + esc(p.payout_id) + '" class="btn btn-primary w-full text-sm mt-1">Tandai dibayar</button>') + '</div>').join('') : '<p class="text-ink/70">Belum ada payout.</p>') + '<button type="button" id="admPayRefresh" class="btn btn-ghost">Muat ulang</button>';
}
function renderAdminHomes(tabsH) {
  const L = S.admin.homesList || [], P = S.admin.pics || [];
  $('#dpcBody').innerHTML = tabsH + '<p class="text-xs text-ink/60">Pendamping merekomendasikan lolos standar bolehnginep, <b>admin yang mengaktifkan</b>. PIN host dan PIC (6 digit) dibuat di sini lalu dikirim ke mereka lewat WA.</p><button type="button" data-hedit="new" class="btn btn-primary w-full text-sm">+ Tambah rumah</button>' +
    (L.length ? L.map((h) => '<div class="rounded-2xl border border-black/10 p-3 space-y-2 text-sm"><div class="flex justify-between gap-2"><b class="text-forest">' + esc(h.name) + '</b>' + badge(h.active ? 'Aktif' : 'Nonaktif', h.active ? 'bg-forest text-white' : 'bg-black/10 text-ink') + '</div>' +
      '<p class="text-xs text-ink/65">' + esc(h.id) + ' · ' + esc(h.destination) + ' · host ' + esc(h.host) + (h.pic ? ' · PIC ' + esc(h.pic) : ' · belum ada PIC') + '</p>' +
      '<p class="text-xs">6 standar: ' + h.standards.map((v) => v ? '✓' : '✗').join(' ') + (h.passed ? ' <b class="text-forest">lolos</b>' : ' <b class="text-terra">belum lolos</b>') + ' · PIN host: ' + (h.has_pin ? 'sudah' : 'belum') + '</p>' +
      '<div class="flex flex-wrap gap-2 items-center"><button type="button" data-homeact="' + esc(h.id) + '" data-to="' + (h.active ? '0' : '1') + '" class="btn ' + (h.active ? 'btn-ghost' : 'btn-primary') + ' text-sm"' + (!h.active && !h.passed ? ' disabled' : '') + '>' + (h.active ? 'Nonaktifkan' : 'Aktifkan') + '</button><button type="button" data-hedit="' + esc(h.id) + '" class="btn btn-ghost text-sm">Edit data</button>' +
      '<input id="pin_' + esc(h.id) + '" inputmode="numeric" maxlength="6" placeholder="PIN host 6 digit" class="field !w-44 !min-h-[44px] text-sm"><button type="button" data-setpin="' + esc(h.id) + '" class="btn btn-ghost text-sm">Set PIN</button></div></div>').join('') : '<p class="text-ink/70">Belum ada rumah.</p>') +
    '<div class="rounded-2xl border border-black/10 p-3 space-y-2 text-sm"><p class="font-bold text-forest">PIC</p>' + (P.length ? '<ul class="text-xs text-ink/70 divide-y divide-black/5">' + P.map((x) => '<li class="flex items-center justify-between gap-2 py-1"><span class="min-w-0">' + esc(x.name) + ' · ' + esc(x.wa) + ' · ' + esc(x.area) + ' · PIN ' + (x.has_pin ? 'sudah' : 'belum') + (x.status === 'NONAKTIF' ? ' · <b class="text-terra">nonaktif</b>' : '') + '</span><button type="button" data-pedit="' + esc(x.wa) + '" class="btn btn-ghost !min-h-[36px] !px-3 text-xs shrink-0">Edit</button></li>').join('') + '</ul>' : '') +
    '<input id="picNm" class="field !text-sm" placeholder="Nama PIC"><input id="picWa" class="field !text-sm" inputmode="tel" placeholder="WA PIC (08… / 62…)"><input id="picAr" class="field !text-sm" placeholder="Area (mis. Bromo)"><input id="picPin" class="field !text-sm" inputmode="numeric" maxlength="6" placeholder="PIN PIC 6 digit"><button type="button" id="picSave" class="btn btn-primary w-full text-sm">Simpan PIC & PIN</button></div>';
}
const UNIT_LBL = { perGuestPerNight: 'tamu/malam', perNight: 'malam', perGuest: 'tamu', flat: 'sekali' };
const FIELD_LBL = { name: 'Nama', destination: 'Destinasi', price_per_guest_night: 'Tarif (maks Rp100.000)', peak_price: 'Tarif musim ramai (maks Rp130.000)', capacity: 'Kapasitas (1 sampai 20)', group_from: 'Diskon rombongan mulai tamu ke- (2 sampai 10)', group_pct: 'Diskon rombongan (0 sampai 30%)', host_name: 'Nama host', host_wa: 'WA host (62…)', pic_wa: 'PIC', services_json: 'Layanan tambahan', checkin_time: 'Jam check-in', checkout_time: 'Jam check-out', wa: 'WA PIC (62…)', status: 'Status' };
function efIn(id, label, val, attrs) { return '<div><label class="text-xs font-semibold" for="ef_' + id + '">' + esc(label) + '</label><input id="ef_' + id + '" class="field !text-sm" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '></div>'; }
function efTa(id, label, val, rows, hint) { return '<div><label class="text-xs font-semibold" for="ef_' + id + '">' + esc(label) + '</label><textarea id="ef_' + id + '" rows="' + (rows || 3) + '" class="field !text-sm">' + esc(val == null ? '' : val) + '</textarea>' + (hint ? '<p class="text-[11px] text-ink/55">' + esc(hint) + '</p>' : '') + '</div>'; }
function renderAdminEdit(tabsH) {
  const E = S.admin.edit, d = E.data || {};
  if (E.kind === 'pic') {
    $('#dpcBody').innerHTML = tabsH + '<p class="font-bold text-forest">' + (E.key ? 'Edit PIC' : 'Tambah PIC') + '</p><div class="space-y-3">' +
      efIn('p_name', 'Nama PIC', d.name) + efIn('p_wa', 'WA PIC (62…)', d.wa, 'inputmode="tel"') + '<p class="text-[11px] text-terra">Mengganti nomor WA menghapus PIN PIC (PIN terikat ke nomor). Buat PIN baru setelahnya. Nama dan WA di semua rumah PIC ini ikut diperbarui otomatis.</p>' +
      efIn('p_area', 'Area', d.area) + efIn('p_bank_name', 'Bank', d.bank_name) + efIn('p_bank_account', 'No. rekening', d.bank_account, 'inputmode="numeric"') + efIn('p_bank_holder', 'Atas nama', d.bank_holder) +
      '<div><label class="text-xs font-semibold" for="ef_p_status">Status</label><select id="ef_p_status" class="field !text-sm"><option value="AKTIF"' + (d.status !== 'NONAKTIF' ? ' selected' : '') + '>Aktif</option><option value="NONAKTIF"' + (d.status === 'NONAKTIF' ? ' selected' : '') + '>Nonaktif (tidak bisa login)</option></select></div>' +
      '<div class="grid grid-cols-2 gap-2"><button type="button" id="efCancel" class="btn btn-ghost text-sm">Batal</button><button type="button" id="efSave" class="btn btn-primary text-sm">Simpan</button></div></div>';
    return;
  }
  const P = S.admin.pics || [];
  const svc = (() => { try { return JSON.parse(d.services_json || '[]'); } catch (e) { return []; } })().map((x) => ((x.name && (x.name.id || x.name)) || '') + ' | ' + x.price + ' | ' + (UNIT_LBL[x.unit] || 'sekali')).join('\n');
  $('#dpcBody').innerHTML = tabsH + '<p class="font-bold text-forest">' + (E.id ? 'Edit rumah ' + esc(E.id) : 'Tambah rumah') + '</p>' + (E.id ? '' : '<p class="text-xs text-ink/60">Rumah baru nonaktif dulu. Aktifkan setelah pendamping memverifikasi standar bolehnginep.</p>') + '<div class="space-y-3">' +
    '<p class="text-sm font-bold text-forest pt-1">Rumah</p>' + efIn('name', 'Nama rumah', d.name, 'maxlength="80"') + '<div class="grid grid-cols-2 gap-2">' + efIn('destination', 'Destinasi', d.destination) + efIn('area', 'Area / desa', d.area) + '</div>' + efIn('city', 'Kota, provinsi', d.city) +
    '<div class="grid grid-cols-3 gap-2">' + efIn('price_per_guest_night', 'Tarif/tamu/malam', d.price_per_guest_night, 'inputmode="numeric"') + efIn('peak_price', 'Tarif musim ramai', d.peak_price, 'inputmode="numeric"') + efIn('capacity', 'Kapasitas', d.capacity, 'inputmode="numeric"') + '</div>' +
    efIn('moods', 'Suasana (pisah koma: gunung, pesisir, air, kopi, solo)', d.moods) + efTa('desc_id', 'Deskripsi', d.desc_id, 3) + efTa('services', 'Layanan tambahan', svc, 3, 'Satu baris satu layanan: Nama | harga | satuan (tamu/malam, malam, tamu, atau sekali)') +
    efIn('distance_id', 'Jarak (mis. 10 menit ke titik sunrise)', d.distance_id) + '<div class="grid grid-cols-2 gap-2">' + efIn('checkin_time', 'Check-in', d.checkin_time || '14:00', 'type="time"') + efIn('checkout_time', 'Check-out', d.checkout_time || '11:00', 'type="time"') + '</div>' +
    efTa('lingkungan_sekitar', 'Lingkungan sekitar (kebun, ternak, dan lainnya, tulis apa adanya)', d.lingkungan_sekitar, 2) + efTa('akses_kenyamanan', 'Akses & kenyamanan (tangga, jarak parkir, dan lainnya)', d.akses_kenyamanan, 2) +
    '<div class="grid grid-cols-2 gap-2">' + efIn('group_from', 'Diskon rombongan mulai tamu ke-', d.group_from || 3, 'inputmode="numeric"') + efIn('group_pct', 'Diskon rombongan % (0 sampai 30)', d.group_pct || 0, 'inputmode="numeric"') + '</div>' +
    '<label class="flex items-center gap-2 text-sm min-h-[44px]"><input id="ef_terima_bayi" type="checkbox" class="w-5 h-5 accent-[#1F4D3A]"' + (d.terima_bayi === 'ya' ? ' checked' : '') + '> Menerima bayi (di bawah 2 tahun, maks 2, tidak menambah tarif)</label>' +
    efTa('house_rules_id', 'Aturan rumah', (d.house_rules_id || '').split('|').join('\n'), 3, 'Satu baris satu aturan') +
    efIn('photo_url', 'Foto utama (link https)', d.photo_url) + efTa('photo_urls', 'Foto galeri (link https, satu baris satu)', (d.photo_urls || '').split('|').join('\n'), 3) + efIn('map_url', 'Link peta', d.map_url) +
    '<label class="flex items-center gap-2 text-sm min-h-[44px]"><input id="ef_featured" type="checkbox" class="w-5 h-5 accent-[#1F4D3A]"' + (d.featured ? ' checked' : '') + '> Rumah unggulan</label>' +
    '<p class="text-sm font-bold text-forest pt-1">Host</p>' + efIn('host_name', 'Nama host', d.host_name) + efIn('host_wa', 'WA host (62…)', d.host_wa, 'inputmode="tel"') +
    '<div class="grid grid-cols-2 gap-2">' + efIn('host_bank_name', 'Bank', d.host_bank_name) + efIn('host_bank_holder', 'Atas nama', d.host_bank_holder) + '</div>' + efIn('host_bank_account', 'No. rekening', d.host_bank_account, 'inputmode="numeric"') +
    '<p class="text-sm font-bold text-forest pt-1">PIC</p><div><label class="text-xs font-semibold" for="ef_pic_wa">PIC pemegang rumah</label><select id="ef_pic_wa" class="field !text-sm"><option value="">(belum ada PIC)</option>' + P.map((x) => '<option value="' + esc(x.wa) + '"' + (x.wa === d.pic_wa ? ' selected' : '') + '>' + esc(x.name) + ' · ' + esc(x.wa) + '</option>').join('') + '</select></div>' +
    '<div class="grid grid-cols-2 gap-2 sticky bottom-0 bg-white py-2"><button type="button" id="efCancel" class="btn btn-ghost text-sm">Batal</button><button type="button" id="efSave" class="btn btn-primary text-sm">Simpan</button></div></div>';
}
function efVal(id) { const el = $('#ef_' + id); return el ? el.value.trim() : ''; }
function efCollect(E) {
  if (E.kind === 'pic') return { name: efVal('p_name'), wa: efVal('p_wa'), area: efVal('p_area'), bank_name: efVal('p_bank_name'), bank_account: efVal('p_bank_account'), bank_holder: efVal('p_bank_holder'), status: efVal('p_status') };
  const rev = {}; Object.keys(UNIT_LBL).forEach((k) => { rev[UNIT_LBL[k]] = k; });
  const lines = efVal('services').split('\n').map((x) => x.trim()).filter(Boolean), svc = [];
  for (const ln of lines) { const a = ln.split('|').map((x) => x.trim()); const un = rev[(a[2] || '').toLowerCase()]; if (a.length < 3 || !a[0] || !(Number(a[1]) >= 0) || !un) return { _err: 'Baris layanan salah: "' + ln + '". Format: Nama | harga | satuan.' }; svc.push({ name: { id: a[0] }, price: Number(a[1]), unit: un }); }
  const f = { featured: !!($('#ef_featured') || {}).checked, terima_bayi: !!($('#ef_terima_bayi') || {}).checked, services_json: JSON.stringify(svc), house_rules_id: efVal('house_rules_id').split('\n').map((x) => x.trim()).filter(Boolean).join('|'), photo_urls: efVal('photo_urls').split('\n').map((x) => x.trim()).filter(Boolean).join('|') };
  ['name', 'destination', 'area', 'city', 'price_per_guest_night', 'peak_price', 'capacity', 'moods', 'lingkungan_sekitar', 'akses_kenyamanan', 'group_from', 'group_pct', 'desc_id', 'distance_id', 'checkin_time', 'checkout_time', 'photo_url', 'map_url', 'host_name', 'host_wa', 'host_bank_name', 'host_bank_holder', 'host_bank_account', 'pic_wa'].forEach((k) => { f[k] = efVal(k); });
  return f;
}
function renderAdminAvail(tabsH) {
  const L = S.admin.avail || [];
  $('#dpcBody').innerHTML = tabsH + '<p class="text-xs text-ink/60">Tuan rumah ngatur sendiri buka/tutup dan tanggal rumahnya, kayak online/offline ojol. Di sini kamu cuma lihat. Kalau ada masalah serius, tutup paksa lewat tab Rumah &amp; PIN (Nonaktifkan).</p>' +
    (L.length ? L.map((h) => '<div class="rounded-2xl border border-black/10 p-3 space-y-1 text-sm"><div class="flex justify-between gap-2"><b class="text-forest">' + esc(h.name) + '</b>' + badge(!h.active ? 'Dinonaktifkan admin' : h.open ? 'Buka' : 'Tutup sementara', !h.active ? 'bg-terra text-white' : h.open ? 'bg-forest text-white' : 'bg-black/10 text-ink') + '</div>' +
      '<p class="text-xs text-ink/65">' + esc(h.id) + ' · ' + esc(h.destination) + (h.pic ? ' · PIC ' + esc(h.pic) : '') + '</p>' +
      (h.blocks.length ? h.blocks.map((b) => '<p class="text-xs">' + esc(b.from) + (b.to !== b.from ? ' → ' + esc(b.to) : '') + ' · ' + esc(b.reason) + '</p>').join('') : '<p class="text-xs text-ink/60">Nggak ada tanggal diblok.</p>') + '</div>').join('') : '<p class="text-ink/70">Belum ada rumah.</p>');
}
async function adminClick(e) {
  const A = S.admin; const sel = () => (A.bookings || []).filter((x) => x.booking_code === A.sel)[0];
  const act = e.target.closest('[data-admact]');
  if (act) {
    const b = sel(); if (!b) return true; const to = act.getAttribute('data-admact'); let pct = Number(act.getAttribute('data-pct')) || 0; if (act.hasAttribute('data-pctsel')) pct = Number($('#admPct').value);
    if (to === 'BATAL' && !window.confirm('Batalkan booking ' + b.booking_code + (b.status === 'LUNAS' || act.hasAttribute('data-received') ? ' dengan refund ' + pct + '%' : '') + '?')) return true;
    try { const body = { booking_code: b.booking_code, status: to, refund_percent: pct }; if (to === 'LUNAS') { const pa = (($('#admPaidAmt') || {}).value || '').replace(/\D/g, ''); if (pa) body.paid_amount = pa; } if (act.hasAttribute('data-received')) body.received = true; const r = await admApi('adminSetStatus', body); if (!r || !r.ok) { toast(errMsg(r)); return true; } await adminLoad(); renderDispatch(); toast('✓ ' + to); } catch (x) { toast(t('err_generic')); }
    return true;
  }
  if (e.target.closest('[data-admwa]')) { const b = sel(); if (b) window.open('https://wa.me/' + b.guest_wa + '?text=' + encodeURIComponent($('#admTplTxt').value), '_blank', 'noopener'); return true; }
  const pd = e.target.closest('[data-paid]'); if (pd) { try { const r = await admApi('adminMarkPaid', { payout_id: pd.getAttribute('data-paid') }); if (!r || !r.ok) { toast(errMsg(r)); return true; } await adminLoadPayouts(); renderDispatch(); toast('✓'); } catch (x) { toast(t('err_generic')); } return true; }
  if (e.target.closest('#admPayRefresh')) { try { await adminLoadPayouts(); } catch (x) {} renderDispatch(); return true; }
  const ha = e.target.closest('[data-homeact]'); if (ha) { try { const r = await admApi('adminSetHome', { homestay_id: ha.getAttribute('data-homeact'), active: ha.getAttribute('data-to') === '1' }); if (!r || !r.ok) { toast(errMsg(r)); return true; } await adminLoadHomes(); renderDispatch(); toast(S.demo ? 'Mode demo: tidak mengubah katalog' : '✓'); } catch (x) { toast(t('err_generic')); } return true; }
  const he = e.target.closest('[data-hedit]'); if (he) { const id = he.getAttribute('data-hedit'); try { if (id === 'new') A.edit = { kind: 'home', id: '', data: { checkin_time: '14:00', checkout_time: '11:00', capacity: 2 } }; else { const r = await admApi('adminHomeGet', { homestay_id: id }); if (!r || !r.ok) { toast(errMsg(r)); return true; } A.edit = { kind: 'home', id: id, data: r.home }; } renderDispatch(); } catch (x) { toast(t('err_generic')); } return true; }
  const pe = e.target.closest('[data-pedit]'); if (pe) { const wa = pe.getAttribute('data-pedit'), p = (A.pics || []).filter((y) => y.wa === wa)[0] || {}; A.edit = { kind: 'pic', key: wa, data: { name: p.name, wa: p.wa, area: p.area, bank_name: p.bank_name, bank_account: p.bank_account, bank_holder: p.bank_holder, status: p.status || 'AKTIF' } }; renderDispatch(); return true; }
  if (e.target.closest('#efCancel')) { A.edit = null; renderDispatch(); return true; }
  if (e.target.closest('#efSave')) {
    const E = A.edit; if (!E) return true; const f = efCollect(E); if (f._err) { toast(f._err); return true; }
    try {
      const r = E.kind === 'pic' ? await admApi('adminPicSave', { wa: E.key || '', fields: f }) : await admApi('adminHomeSave', { homestay_id: E.id || '', fields: f });
      if (!r || !r.ok) { toast(r && r.error === 'invalid_field' ? 'Cek isian: ' + (FIELD_LBL[r.field] || r.field) : r && r.error === 'duplicate' ? 'Data ini sudah ada.' : errMsg(r)); return true; }
      A.edit = null; await adminLoadHomes(); renderDispatch();
      toast(r.demo ? 'Mode demo: tidak disimpan ke server.' : r.pin_reset ? 'Tersimpan. WA diganti, buat PIN baru untuk PIC ini.' : r.changed === 0 ? 'Nggak ada perubahan.' : '✓ Tersimpan');
    } catch (x) { toast(t('err_generic')); }
    return true;
  }
  const sp = e.target.closest('[data-setpin]'); if (sp) { const id = sp.getAttribute('data-setpin'); try { const r = await admApi('adminSetPin', { role: 'host', id: id, pin: $('#pin_' + id).value.trim() }); if (!r || !r.ok) { toast(errMsg(r)); return true; } await adminLoadHomes(); renderDispatch(); toast('✓ PIN'); } catch (x) { toast(t('err_generic')); } return true; }
  if (e.target.closest('#picSave')) { try { const r = await admApi('adminSetPin', { role: 'pic', id: $('#picWa').value.trim(), pin: $('#picPin').value.trim(), name: $('#picNm').value.trim(), area: $('#picAr').value.trim() }); if (!r || !r.ok) { toast(errMsg(r)); return true; } await adminLoadHomes(); renderDispatch(); toast('✓ PIC'); } catch (x) { toast(t('err_generic')); } return true; }
  return false;
}

/* ============ PORTAL MITRA (HOST & PIC) ============ */
const DEMO_HOST = { id: 'H-001', pin: '123456' }, DEMO_PIC = { wa: '6281200000002', pin: '123456' };
const PT = { role: 'host', host: null, pic: null, tab: 'book', verify: null, err: '' };
function demoPartner(action, x) {
  if (action === 'hostLogin' || action.indexOf('host') === 0) {
    if (String(x.homestay_id).toUpperCase() !== DEMO_HOST.id || x.pin !== DEMO_HOST.pin) return { ok: false, error: 'unauthorized' };
    const id = DEMO_HOST.id, h = homeOf(id);
    if (action === 'hostBlock') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(x.date_to) || x.date_to < x.date_from) return { ok: false, error: 'invalid_date' };
      const clash = demoBookings().some((b) => b.homestay_id === id && (b.status === 'LUNAS' || b.status === 'MENUNGGU_PEMBAYARAN') && Array.from({ length: b.nights }, (_, i) => addDays(b.checkin, i)).some((d) => d >= x.date_from && d <= x.date_to));
      if (clash) return { ok: false, error: 'has_booking' };
      (S.blocks[id] = S.blocks[id] || []).push([x.date_from, x.date_to, x.reason || 'Diblokir pemilik']); const sv = store.get('bn_demo_hblocks', {}); sv[id] = S.blocks[id]; store.set('bn_demo_hblocks', sv); return { ok: true };
    }
    if (action === 'hostUnblock') { const a = S.blocks[id] || []; const i = Number(x.row) - 1; if (!(i >= 0 && i < a.length)) return { ok: false, error: 'not_found' }; a.splice(i, 1); const sv = store.get('bn_demo_hblocks', {}); sv[id] = a; store.set('bn_demo_hblocks', sv); return { ok: true }; }
    if (action === 'hostSetOpen') { const op = store.get('bn_demo_open', {}); op[id] = x.open === true; store.set('bn_demo_open', op); const hh = homeOf(id); if (hh) hh.closed = !x.open; return { ok: true }; }
    if (action === 'hostReply') { const l = store.get('bn_demo_reviews', []); const r = l.filter((y) => y.review_id === x.review_id && y.homestay_id === id)[0]; if (!r) return { ok: false, error: 'review_not_found' }; r.reply = String(x.reply || '').slice(0, 400); store.set('bn_demo_reviews', l); return { ok: true }; }
    return { ok: true, home: { id: id, name: h ? h.name : id, destination: h ? h.destination : '', active: true, open: store.get('bn_demo_open', {})[id] !== false },
      bookings: demoBookings().filter((b) => b.homestay_id === id).reverse().map((b) => ({ code: b.booking_code, guest: b.guest_name, checkin: b.checkin, nights: b.nights, guests: b.guests, status: b.status, note: b.note || '', addons: b.addons || [], host_payout: Math.round(b.room_total * 0.75), host_payout_status: '' })),
      blocks: (S.blocks[id] || []).map((b, i) => ({ row: i + 1, from: b[0], to: b[1], reason: b[2] || '' })),
      reviews: store.get('bn_demo_reviews', []).filter((r) => r.homestay_id === id && r.visible !== false).reverse().map((r) => ({ review_id: r.review_id, date: r.date, guest: r.who, ratingHome: r.ratingHome, textHome: r.textHome, ratingHost: r.ratingHost, textHost: r.textHost, reply: r.reply || '' })) };
  }
  if (action === 'picLogin' || action === 'picVerify') {
    if (normPhone(x.pic_wa) !== DEMO_PIC.wa || x.pin !== DEMO_PIC.pin) return { ok: false, error: 'unauthorized' };
    const ver = store.get('bn_demo_ver', {});
    if (action === 'picVerify') {
      if (!Array.isArray(x.std) || (x.std.length !== 6 && x.std.length !== 13) || String(x.note || '').trim().length < 5) return { ok: false, error: 'invalid_fields' };
      const pass = x.std.every((v) => v === true); if (pass && !/^https:\/\//i.test(x.evidence_url || '')) return { ok: false, error: 'evidence_required' };
      ver[x.homestay_id] = { std: x.std.map((v) => v === true), result: pass ? 'LOLOS' : 'TIDAK_LOLOS' }; store.set('bn_demo_ver', ver); return { ok: true, result: pass ? 'LOLOS' : 'TIDAK_LOLOS' };
    }
    const act = store.get('bn_demo_active', {});
    const homes = S.homes.filter((h) => /bromo/i.test(h.destination)).map((h) => ({ id: h.id, name: h.name, destination: h.destination, area: h.area, host: h.host, host_wa: '', active: act[h.id] !== false, standards: (ver[h.id] && ver[h.id].std) || h.standards, verified: h.verified || '', mine: true }))
      .concat(store.get('bn_demo_regs', []).filter((r) => /bromo/i.test(r.destination)).map((r, i) => { const id = 'REG-' + (i + 1); return { id: id, name: r.name, destination: r.destination, area: r.area, host: r.host_name, host_wa: '', active: !!act[id], standards: (ver[id] && ver[id].std) || [false, false, false, false, false, false], verified: '', mine: false }; }));
    return { ok: true, pic: { name: 'Dewi (PIC Bromo)', area: 'Bromo' }, homes: homes };
  }
  return { ok: false, error: 'unknown_action' };
}
async function ptApi(action, extra) { if (APPS_SCRIPT_URL) return apiPost(Object.assign({ action: action }, extra)); return demoPartner(action, extra); }
function hostCreds() { return { homestay_id: PT.host.id, pin: PT.host.pin }; }
async function ptRefreshHost() { const r = await ptApi('hostLogin', hostCreds()); if (r && r.ok) { PT.host.data = r; const id = r.home.id; S.blocks[id] = r.blocks.map((b) => [b.from, b.to, b.reason]); const hh = homeOf(id); if (hh) hh.closed = r.home.open === false; try { renderCatalog(); } catch (x) {} } return r; }
async function ptRefreshPic() { const r = await ptApi('picLogin', { pic_wa: PT.pic.wa, pin: PT.pic.pin }); if (r && r.ok) PT.pic.data = r; return r; }
function renderPartner() {
  const body = $('#ptBody'); const roleBtns = '<div class="flex gap-2">' + [['host', 'Host'], ['pic', 'PIC']].map((x) => '<button type="button" data-ptrole="' + x[0] + '" class="min-h-[44px] px-4 rounded-full text-sm font-semibold border-[1.5px] ' + (PT.role === x[0] ? 'bg-forest text-white border-forest' : 'bg-white text-forest border-forest/30') + '">' + x[1] + '</button>').join('') + '</div>';
  const logged = PT.role === 'host' ? PT.host : PT.pic;
  if (!logged) {
    body.innerHTML = roleBtns + (PT.role === 'host'
      ? '<div><label for="ptHostId" class="text-sm font-semibold">Kode rumah</label><input id="ptHostId" class="field" autocapitalize="characters" autocomplete="off" placeholder="H-001"></div>'
      : '<div><label for="ptPicWa" class="text-sm font-semibold">Nomor WA PIC</label><input id="ptPicWa" class="field" inputmode="tel" autocomplete="off" placeholder="08…"></div>') +
      '<div><label for="ptPin" class="text-sm font-semibold">PIN (6 digit)</label><input id="ptPin" type="password" inputmode="numeric" maxlength="6" class="field" autocomplete="off"></div><p class="text-sm text-terra font-semibold min-h-[1.25rem]" role="alert">' + esc(PT.err) + '</p><button type="button" id="ptGo" class="btn btn-primary w-full">Masuk</button>' +
      '<p class="text-xs text-ink/60">PIN dikasih admin lewat WhatsApp. Lupa PIN? Chat admin ya.</p>' + (S.demo ? '<p class="text-xs text-ink/60 rounded-xl bg-cream p-3">Mode demo: host H-001 dan PIN 123456. PIC WA 081200000002 dan PIN 123456.</p>' : '');
    return;
  }
  const out = '<button type="button" id="ptLogout" class="btn btn-ghost !min-h-[40px] text-sm">Keluar</button>';
  if (PT.role === 'host') { body.innerHTML = roleBtns + hostView(out); return; }
  body.innerHTML = roleBtns + picView(out);
}
function hostView(out) {
  const d = PT.host.data, tabs = [['book', 'Booking'], ['date', 'Tanggal'], ['rev', 'Ulasan']];
  const tabH = '<div class="flex gap-2">' + tabs.map((x) => '<button type="button" data-pttab="' + x[0] + '" class="min-h-[44px] px-4 rounded-full text-sm font-semibold border-[1.5px] ' + (PT.tab === x[0] ? 'bg-terra text-white border-terra' : 'bg-white text-forest border-forest/30') + '">' + x[1] + '</button>').join('') + '</div>';
  const head = '<div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="font-display text-xl text-forest">' + esc(d.home.name) + '</p><p class="text-xs text-ink/60">' + esc(d.home.destination) + ' · ' + (d.home.active ? 'Aktif tayang' : 'Belum tayang') + '</p></div>' + out + '</div>';
  const h = homeOf(d.home.id); const svcName = (id) => { const s2 = h && h.services.filter((y) => y.id === id)[0]; return s2 ? loc2(s2.name) : id; };
  let content = '';
  if (PT.tab === 'book') content = d.bookings.length ? d.bookings.map((b) => '<div class="rounded-2xl border border-black/10 p-3 text-sm space-y-1' + (b.status === 'BATAL' ? ' opacity-60' : '') + '"><div class="flex justify-between gap-2"><b class="text-forest">' + esc(b.guest) + '</b>' + badge(b.status, ST_CLS[b.status] || 'bg-black/10 text-ink') + '</div><p>' + esc(fmtDate(b.checkin, 'id')) + ' · ' + b.nights + ' malam · ' + b.guests + ' tamu</p>' +
    (b.addons && b.addons.length ? '<p class="text-xs text-ink/70">Layanan: ' + esc(b.addons.map(svcName).join(', ')) + '</p>' : '') + (b.note ? '<p class="text-xs text-ink/70">Catatan tamu: ' + esc(b.note) + '</p>' : '') +
    (b.host_payout > 0 && b.status !== 'MENUNGGU_PEMBAYARAN' ? '<p class="text-xs text-forest">Bagian host: <b>' + rp(b.host_payout) + '</b>' + (b.host_payout_status ? ' · ' + esc(b.host_payout_status) : '') + ' · cair H+1 setelah check-in</p>' : '') + '<p class="text-[11px] text-ink/45">' + esc(b.code) + '</p></div>').join('') : '<p class="text-ink/70 text-sm">Belum ada booking.</p>';
  else if (PT.tab === 'date') content = '<div class="rounded-2xl border border-black/10 p-3 space-y-2"><div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="font-bold text-forest text-sm">' + (d.home.open === false ? 'Rumah lagi tutup' : 'Rumah lagi buka') + '</p><p class="text-xs text-ink/60">' + (d.home.open === false ? 'Tamu nggak bisa booking sampai kamu buka lagi.' : 'Tamu bisa booking di tanggal yang nggak kamu blok.') + '</p></div><button type="button" data-ptopen="' + (d.home.open === false ? '1' : '0') + '" class="btn ' + (d.home.open === false ? 'btn-primary' : 'btn-ghost') + ' text-sm shrink-0">' + (d.home.open === false ? 'Buka sekarang' : 'Tutup sementara') + '</button></div></div><div class="rounded-2xl border border-black/10 p-3 space-y-2"><p class="font-bold text-forest text-sm">Blokir tanggal (rumah penuh atau ada acara)</p><div class="grid grid-cols-2 gap-2"><div><label for="ptFrom" class="text-xs font-semibold">Dari</label><input id="ptFrom" type="date" class="field" min="' + todayISO() + '"></div><div><label for="ptTo" class="text-xs font-semibold">Sampai</label><input id="ptTo" type="date" class="field" min="' + todayISO() + '"></div></div><input id="ptWhy" class="field !text-sm" maxlength="80" placeholder="Alasan (opsional)"><button type="button" id="ptBlockAdd" class="btn btn-primary w-full text-sm">Blokir tanggal</button></div>' +
    (d.blocks.length ? d.blocks.map((b) => '<div class="rounded-2xl border border-black/10 p-3 text-sm flex items-center justify-between gap-2"><div class="min-w-0"><p class="font-semibold text-forest">' + esc(b.from) + (b.to !== b.from ? ' → ' + esc(b.to) : '') + '</p><p class="text-xs text-ink/60 truncate">' + esc(b.reason) + '</p></div><button type="button" data-ptunblock="' + b.row + '" class="btn btn-ghost !min-h-[40px] text-sm shrink-0">Buka</button></div>').join('') : '<p class="text-ink/70 text-sm">Belum ada tanggal diblokir.</p>');
  else content = d.reviews.length ? d.reviews.map((r) => '<div class="rounded-2xl border border-black/10 p-3 text-sm space-y-2"><p class="font-bold text-forest">' + esc(r.guest) + ' <span class="font-normal text-ink/55">· ' + esc(r.date) + '</span></p><p>' + esc(t('rHome')) + ': ' + star + ' <b>' + r.ratingHome + '</b> ' + esc(r.textHome) + '</p><p>' + esc(t('rHost')) + ': ' + star + ' <b>' + r.ratingHost + '</b> ' + esc(r.textHost) + '</p>' +
    '<label class="text-xs font-semibold" for="pr_' + esc(r.review_id) + '">Balasan kamu (tampil publik)</label><textarea id="pr_' + esc(r.review_id) + '" rows="2" maxlength="400" class="field !text-sm">' + esc(r.reply) + '</textarea><button type="button" data-ptreply="' + esc(r.review_id) + '" class="btn btn-primary w-full text-sm">Simpan balasan</button></div>').join('') : '<p class="text-ink/70 text-sm">Belum ada ulasan.</p>';
  return head + tabH + '<div class="space-y-3">' + content + '</div>';
}
function picView(out) {
  const d = PT.pic.data; const head = '<div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="font-display text-xl text-forest">' + esc(d.pic.name) + '</p><p class="text-xs text-ink/60">Area ' + esc(d.pic.area) + '</p></div>' + out + '</div>';
  if (PT.verify) {
    const h = d.homes.filter((x) => x.id === PT.verify)[0]; if (h) {
      return head + '<div class="rounded-2xl border border-black/10 p-3 space-y-3"><p class="font-bold text-forest">Verifikasi: ' + esc(h.name) + '</p><p class="text-xs text-terra font-semibold">Dilarang memverifikasi rumah milik sendiri atau keluarga sendiri. Centang hanya yang sudah kamu periksa langsung.</p>' +
        STD.id.map((x, i) => '<label class="flex gap-3 items-start rounded-xl bg-cream p-3 min-h-[44px]"><input type="checkbox" data-vstd="' + i + '" class="mt-1 w-5 h-5 accent-[#1F4D3A]"' + (h.standards[i] ? ' checked' : '') + '><span class="text-sm"><b class="text-forest">' + esc(x.t) + '</b><br><span class="text-xs text-ink/65">' + esc(x.v) + '</span></span></label>').join('') +
        '<div><label for="vNote" class="text-sm font-semibold">Catatan hasil survei</label><textarea id="vNote" rows="3" maxlength="300" class="field !text-sm"></textarea></div><div><label for="vEv" class="text-sm font-semibold">Link foto bukti (https)</label><input id="vEv" type="url" class="field" placeholder="https://drive.google.com/…"></div>' +
        '<p id="vErr" class="text-sm text-terra font-semibold min-h-[1.25rem]" role="alert"></p><div class="grid grid-cols-2 gap-2"><button type="button" id="ptVerCancel" class="btn btn-ghost text-sm">Kembali</button><button type="button" id="ptVerSend" class="btn btn-primary text-sm" data-home="' + esc(h.id) + '">Kirim hasil</button></div></div>';
    }
  }
  return head + '<p class="text-xs text-ink/60">PIC yang merekomendasikan, admin yang mengaktifkan rumah di katalog.</p>' + (d.homes.length ? d.homes.map((h) => { const n = h.standards.filter(Boolean).length; return '<div class="rounded-2xl border border-black/10 p-3 text-sm space-y-1"><div class="flex justify-between gap-2"><b class="text-forest">' + esc(h.name) + '</b>' + badge(h.active ? 'Tayang' : n === 6 ? 'Lolos, tunggu admin' : 'Belum tayang', h.active ? 'bg-forest text-white' : 'bg-terra/15 text-terra') + '</div><p class="text-xs text-ink/65">' + esc(h.id) + ' · ' + esc(h.area) + ' · host ' + esc(h.host) + (h.mine ? '' : ' · belum ada PIC') + '</p><p class="text-xs">6 standar: ' + h.standards.map((v) => v ? '✓' : '✗').join(' ') + ' (' + n + '/6)' + (h.verified ? ' · diverifikasi ' + esc(h.verified) : '') + '</p><button type="button" data-ptverify="' + esc(h.id) + '" class="btn btn-ghost w-full text-sm">Verifikasi 6 standar</button></div>'; }).join('') : '<p class="text-ink/70 text-sm">Belum ada rumah di areamu.</p>');
}
async function ptLogin() {
  const pin = ($('#ptPin').value || '').trim(); PT.err = '';
  try {
    if (PT.role === 'host') { const id = ($('#ptHostId').value || '').trim().toUpperCase(); const r = await ptApi('hostLogin', { homestay_id: id, pin: pin }); if (!r || !r.ok) PT.err = errMsg(r); else { PT.host = { id: id, pin: pin, data: r }; PT.tab = 'book'; } }
    else { const wa = normPhone($('#ptPicWa').value); const r = await ptApi('picLogin', { pic_wa: wa, pin: pin }); if (!r || !r.ok) PT.err = errMsg(r); else { PT.pic = { wa: wa, pin: pin, data: r }; PT.verify = null; } }
  } catch (e) { PT.err = t('err_generic'); }
  renderPartner();
}
async function ptClick(e) {
  const rb = e.target.closest('[data-ptrole]'); if (rb) { PT.role = rb.getAttribute('data-ptrole'); PT.err = ''; renderPartner(); return; }
  if (e.target.closest('#ptGo')) { const b = e.target.closest('#ptGo'); b.disabled = true; await ptLogin(); return; }
  if (e.target.closest('#ptLogout')) { if (PT.role === 'host') PT.host = null; else { PT.pic = null; PT.verify = null; } PT.err = ''; renderPartner(); return; }
  const tb = e.target.closest('[data-pttab]'); if (tb) { PT.tab = tb.getAttribute('data-pttab'); renderPartner(); return; }
  try {
    const po = e.target.closest('[data-ptopen]'); if (po) { const r = await ptApi('hostSetOpen', Object.assign(hostCreds(), { open: po.getAttribute('data-ptopen') === '1' })); if (!r || !r.ok) { toast(errMsg(r)); return; } await ptRefreshHost(); renderPartner(); toast('✓'); return; }
    if (e.target.closest('#ptBlockAdd')) { const f = $('#ptFrom').value, to = $('#ptTo').value || f; const r = await ptApi('hostBlock', Object.assign(hostCreds(), { date_from: f, date_to: to, reason: $('#ptWhy').value })); if (!r || !r.ok) { toast(errMsg(r)); return; } await ptRefreshHost(); renderPartner(); toast('✓'); return; }
    const ub = e.target.closest('[data-ptunblock]'); if (ub) { const r = await ptApi('hostUnblock', Object.assign(hostCreds(), { row: Number(ub.getAttribute('data-ptunblock')) })); if (!r || !r.ok) { toast(errMsg(r)); return; } await ptRefreshHost(); renderPartner(); toast('✓'); return; }
    const rp2 = e.target.closest('[data-ptreply]'); if (rp2) { const id = rp2.getAttribute('data-ptreply'); const r = await ptApi('hostReply', Object.assign(hostCreds(), { review_id: id, reply: $('#pr_' + id).value })); if (!r || !r.ok) { toast(errMsg(r)); return; } await ptRefreshHost(); renderPartner(); toast('✓'); return; }
    const vb = e.target.closest('[data-ptverify]'); if (vb) { PT.verify = vb.getAttribute('data-ptverify'); renderPartner(); return; }
    if (e.target.closest('#ptVerCancel')) { PT.verify = null; renderPartner(); return; }
    const vs = e.target.closest('#ptVerSend'); if (vs) {
      const std = $$('[data-vstd]').map((c) => c.checked); const r = await ptApi('picVerify', { pic_wa: PT.pic.wa, pin: PT.pic.pin, homestay_id: vs.getAttribute('data-home'), std: std, note: $('#vNote').value, evidence_url: $('#vEv').value.trim() });
      if (!r || !r.ok) { $('#vErr').textContent = errMsg(r); return; }
      PT.verify = null; await ptRefreshPic(); renderPartner(); toast(r.result === 'LOLOS' ? 'Lolos. Menunggu persetujuan admin.' : 'Dicatat: belum lolos.'); track('pic_verify', {}); return;
    }
  } catch (x) { toast(t('err_generic')); }
}
$('#ptBody').addEventListener('click', ptClick);
$('#ptBody').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'ptPin') { e.preventDefault(); const g = $('#ptGo'); if (g) g.click(); } });


const openDispatch = () => { renderDispatch(); openLayer('dispatchModal'); };
const openPartner = () => { PT.err = ''; renderPartner(); openLayer('partnerModal'); };
window.__BN.admin = true; window.__BN.openDispatch = openDispatch; window.__BN.openPartner = openPartner; window.__BN.renderDispatch = renderDispatch;

})();
