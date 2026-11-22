// Pemeriksaan statis: menangkap kelas masalah yang pernah muncul sebagai revisi. Jalankan: node tests/static.test.cjs
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), adm = fs.readFileSync(path.join(root, 'admin.js'), 'utf8'), gs = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
let ok = 0, bad = 0; const T = (n, c, d) => { if (c) ok++; else { bad++; console.log('FAIL', n, d || ''); } };
const all = idx + '\n' + adm;

// 1) Kunci teks: setiap kunci yang dipakai harus ada di kamus (jangan sampai kunci mentah tampil, mis. "polPayout")
const tI = idx.indexOf('const T = {'); const idBlock = idx.slice(idx.indexOf('id: {', tI), idx.indexOf('\n  en: {', tI));
const keys = new Set([...idBlock.matchAll(/(?:^|[\s,{])([A-Za-z_][A-Za-z0-9_]*):\s*['"`]/g)].map((m) => m[1]));
const used = new Set();
for (const m of all.matchAll(/\bt\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g)) used.add(m[1]);
for (const m of all.matchAll(/data-i18n(?:-ph)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
for (const m of all.matchAll(/\[((?:'[a-z][A-Za-z0-9]+',?\s*){3,})\]/g)) for (const k of m[1].matchAll(/'([a-z][A-Za-z0-9]+)'/g)) if (/^(pol|rg|st|dp|cp|rv|err|flow|how)[A-Z]/.test(k[1])) used.add(k[1]);
const missing = [...used].filter((k) => !keys.has(k) && !/^(id|en|ok)$/.test(k) && !/_$/.test(k));
T('semua kunci teks ada di kamus', missing.length === 0, missing.join(', '));

// 1b) Kode error dari server harus punya teks ramah (err_<kode>), kecuali yang memang ditangani khusus
const codes = new Set([...gs.matchAll(/error:\s*'([a-z_]+)'/g)].map((m) => m[1]));
const em = idx.slice(idx.indexOf('function errMsg'), idx.indexOf('function errMsg') + 600);
const noKey = [...codes].filter((c) => !keys.has('err_' + c));
console.log('info: kode server tanpa teks khusus (memakai teks umum):', noKey.join(', ') || '-');
T('errMsg punya teks umum cadangan', /errGeneric|err_unknown|errDefault|t\('err[A-Za-z_]*'\)/.test(em), em.slice(0, 200));

// 2) CSP: tidak boleh ada atribut event inline (diblokir di produksi)
const inl = [...idx.matchAll(/\son(error|click|load|change|input|submit)="/g)].filter((m) => !/media='all'/.test(idx.slice(m.index, m.index + 60)));
T('tanpa atribut event inline', inl.length === 0, String(inl.length));
T('admin.js tanpa atribut event inline', !/\son(error|click|load|change|input)=\\?"/.test(adm));

// 3) Baris yang bisa overflow horizontal harus bisa digeser mouse (dragScroll) atau membungkus di desktop
const ox = [...idx.matchAll(/id="([a-zA-Z]+)"[^>]*overflow-x-auto[^>]*/g)].map((m) => ({ id: m[1], cls: m[0] }));
for (const o of ox) T('overflow-x #' + o.id + ' bisa digeser/bungkus', new RegExp("dragScroll\\(\\$\\('#" + o.id + "'\\)\\)").test(idx) || /(sm|lg):(overflow-visible|flex-wrap)/.test(o.cls), o.cls.slice(0, 80));

// 4) Batas malam sama di klien dan server
const cn = Number((idx.match(/const MAX_NIGHTS = (\d+)/) || [])[1]), sn = Number((gs.match(/MAX_NIGHTS:\s*(\d+)/) || [])[1]);
T('MAX_NIGHTS klien = server = 5', cn === 5 && sn === 5, cn + '/' + sn);
const fo = (idx.match(/ns\.innerHTML = \[([\d, ]+)\]/) || [])[1];
T('opsi filter malam tidak melebihi batas', fo && Math.max.apply(null, fo.split(',').map(Number)) <= cn, fo);

// 5) Arah kalimat: pesan WA tamu->admin tidak boleh berbunyi seperti admin->tamu
const bm = idx.slice(idx.indexOf('function bookingMessage'), idx.indexOf('const loc2'));
T('pesan tamu tanpa kalimat instruksi admin', !/Mohon transfer|Nominal transfer|kode unik|Berlaku \d+ menit/i.test(bm));
T('tamu tidak melihat nominal/batas waktu di situs', !/payLeft|payCd/.test(idx.slice(idx.indexOf('function showPayBox'), idx.indexOf('function bookedTxt'))));
T('admin: template konfirmasi memuat nominal & rekening', /nominal/i.test(adm) && /rekening/i.test(adm));

// 6) Umpan balik jaringan tersedia (tidak ada klik yang terasa mati)
T('indikator jaringan terpasang', /id="netBar"/.test(idx) && /function netStart/.test(idx) && /netEnd\(\)/.test(idx));
T('semua fetch lewat apiGet/apiPost', (idx.match(/\bfetch\(/g) || []).length <= 3 && !/\bfetch\(/.test(adm));

// 7) Label/badge pendek tidak boleh terpecah baris
for (const m of idx.matchAll(/<span class="([^"]*)">(Segera hadir|Contoh|Terbaik)<\/span>/g)) T('badge "' + m[2] + '" nowrap', /whitespace-nowrap/.test(m[1]), m[1]);

console.log('static: ' + ok + ' ok ' + bad + ' bad'); process.exit(bad ? 1 : 0);
