// Build untuk Vercel: index.html + halaman SEO per destinasi + sitemap + robots + (opsional) CSS Tailwind hasil build.
// Env opsional: APPS_SCRIPT_URL, WA_PUSAT, COMPANY_NAME, COMPANY_BANK, PLAUSIBLE_DOMAIN, SITE_URL
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const SITE = (process.env.SITE_URL || 'https://bolehnginep.com').replace(/\/$/, '');
const root = process.cwd();
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

// 1) Suntik konfigurasi dari env (aman untuk Vercel Environment Variables)
function setConst(name, value) {
  if (value === undefined || value === '') return;
  const re = new RegExp("const " + name + " = '[^']*';");
  if (!re.test(html)) { console.warn('! const ' + name + ' tidak ditemukan'); return; }
  html = html.replace(re, "const " + name + " = '" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "';");
}
['APPS_SCRIPT_URL', 'WA_PUSAT', 'WA_DARURAT', 'COMPANY_NAME', 'COMPANY_BANK', 'PLAUSIBLE_DOMAIN'].forEach((k) => setConst(k, process.env[k]));

// Mode produksi (otomatis di Vercel, atau BN_PROD=1): konfigurasi wajib terisi, data contoh dibuang, Tailwind wajib berhasil, CSP dipasang.
// Untuk pratinjau demo di Vercel, set BN_ALLOW_DEMO=1.
const PROD = (!!process.env.VERCEL || process.env.BN_PROD === '1') && process.env.BN_ALLOW_DEMO !== '1';
if (PROD) {
  const need = ['APPS_SCRIPT_URL', 'WA_PUSAT', 'COMPANY_NAME', 'COMPANY_BANK'].filter((k) => !process.env[k] || /isi di sini|^6281234567890$/.test(process.env[k]));
  if (need.length) { console.error('GAGAL: isi Environment Variables berikut di Vercel (Settings > Environment Variables): ' + need.join(', ') + '. Untuk pratinjau demo set BN_ALLOW_DEMO=1.'); process.exit(1); }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(process.env.APPS_SCRIPT_URL)) { console.error('GAGAL: APPS_SCRIPT_URL harus berbentuk https://script.google.com/macros/s/.../exec'); process.exit(1); }
  // Rumah contoh tetap ikut (berlabel 'Contoh', tidak bisa dibooking) supaya katalog terlihat hidup. Matikan: Script Property SHOW_SAMPLES=tidak (tanpa deploy), atau env Vercel SHOW_SAMPLES=false.
  if (process.env.SHOW_SAMPLES === 'false') { html = html.replace('const SHOW_SAMPLES = true;', 'const SHOW_SAMPLES = false;'); html = html.replace(/const SAMPLE = \[[\s\S]*?\n\];/, 'const SAMPLE = [];'); }
  html = html.replace(/<link rel="stylesheet" media="print" onload="this.media='all'" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/, '<link rel="stylesheet" href="$1">');   // handler inline tidak diizinkan CSP
}

// Build produksi: link bagikan memakai /rumah/<id>/ (punya pratinjau WA)
html = html.replace('const BUILT = false;', 'const BUILT = true;');
if (process.env.SHOW_SAMPLES === 'false') html = html.replace('const SHOW_SAMPLES = true;', 'const SHOW_SAMPLES = false;');

// 2) Ambil data rumah: dari Apps Script (jika ada) atau data sampel di index.html
async function loadHomes() {
  const url = process.env.APPS_SCRIPT_URL;
  if (url) {
    try {
      const r = await fetch(url + '?action=homestays'); const j = await r.json();
      if (j.ok && Array.isArray(j.homestays)) return { homes: j.homestays, source: 'apps-script' };
    } catch (e) { console.warn('! Gagal ambil data live, memakai data sampel:', e.message); }
  }
  const a = html.indexOf('const SV = {'), b = html.indexOf('const SEED_BOOKINGS');
  const c = html.indexOf('const DIST = {'), d = html.indexOf('/* ============ I18N');
  const code = html.slice(a, b) + '\nconst MAX_PEAK_PRICE = 130000;\n' + html.slice(c, d) + '\n;SAMPLE';
  return { homes: vm.runInNewContext(code), source: 'sample' };
}
const { homes, source } = await loadHomes();
console.log('Data rumah:', homes.length, '(' + source + ')');

// 3) Kelompokkan per destinasi
const groups = {};
homes.forEach((h) => { (groups[h.destination] = groups[h.destination] || []).push(h); });
const dests = Object.keys(groups).map((name) => {
  const hs = groups[name];
  return { name, slug: slug(name), homes: hs, min: Math.min(...hs.map((h) => h.price)), prov: (hs[0].city.split(',').pop() || '').trim() };
});

// 4) index.html: canonical, OG, JSON-LD, dan navigasi destinasi untuk crawler
const head = `<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="bolehnginep"><meta property="og:url" content="${SITE}/"><meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<meta property="og:title" content="bolehnginep: nginep di rumah warga dekat alam Indonesia"><meta property="og:description" content="Nginep di rumah warga dekat wisata alam Indonesia. Harga per tamu per malam tertera di tiap rumah.">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'bolehnginep', url: SITE + '/' })}</script>
`;
html = html.replace('</head>', head + '</head>');
const nav = '<nav aria-label="Destinasi" class="max-w-6xl mx-auto px-4 sm:px-6 pb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">' + dests.map((d) => `<a class="underline underline-offset-2 hover:text-white" href="/destinasi/${d.slug}/">Homestay ${esc(d.name)}</a>`).join('') + '</nav>';
html = html.replace('</footer>', nav + '</footer>');
fs.writeFileSync(path.join(dist, 'index.html'), html);

// 5) Halaman statis per destinasi
const css = `body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#FBFAF7;color:#1B1F1D}main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
a{color:#1F4D3A}h1,h2{color:#1F4D3A;font-weight:800;letter-spacing:-.02em;line-height:1.2}.cta{display:inline-block;background:#1F4D3A;color:#fff;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;min-height:44px;box-sizing:border-box}
.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:20px;padding:16px;margin:12px 0}.muted{color:rgba(27,31,29,.65);font-size:14px}.price{font-size:22px;color:#1F4D3A;font-weight:800}`;
for (const d of dests) {
  const title = `Homestay live-in di ${d.name} mulai ${rp(d.min)} per malam | bolehnginep`;
  const desc = `${d.homes.length} rumah warga di ${d.name} (${d.prov}) dekat wisata alam. Tiap rumah sesuai standar bolehnginep, harga per tamu per malam dan daftar harga layanan tambahan tertera jelas.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `Homestay di ${d.name}`,
    itemListElement: d.homes.map((h, i) => {
      const item = { '@type': 'LodgingBusiness', name: h.name, address: { '@type': 'PostalAddress', addressLocality: h.area, addressRegion: h.city }, priceRange: rp(h.price) + ' per tamu per malam' };
      if (h.countHome > 0) item.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(h.ratingHome).toFixed(1), reviewCount: h.countHome };
      return { '@type': 'ListItem', position: i + 1, item };
    })
  };
  const cards = d.homes.map((h) => `<article class="card">${/^https:\/\//.test(h.photo || "") ? `<img src="${esc(h.photo)}" alt="${esc(h.name)}" loading="lazy" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:14px;margin-bottom:10px">` : ""}<h2 style="margin:0 0 4px;font-size:20px">${esc(h.name)}</h2><p class="muted" style="margin:0">${esc(h.area)} · ${esc(h.city)}</p>
<p class="price" style="margin:8px 0">${rp(h.price)} <span class="muted" style="font-family:system-ui;font-weight:400">per tamu per malam</span></p>
<p style="margin:0">${esc((h.desc && (h.desc.id || h.desc)) || '')}</p>${h.distance && h.distance.id ? `<p class="muted" style="margin:6px 0 0">${esc(h.distance.id)}</p>` : ''}
${h.countHome > 0 ? `<p class="muted" style="margin:6px 0 0">Rating rumah ${Number(h.ratingHome).toFixed(1)} (${h.countHome} ulasan)</p>` : ''}</article>`).join('\n');
  const page = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}/destinasi/${d.slug}/">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}/destinasi/${d.slug}/"><meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script><style>${css}</style></head>
<body><main><p><a href="/">← bolehnginep</a></p><h1>Homestay live-in di ${esc(d.name)}</h1>
<p>${esc(desc)}</p><p><a class="cta" href="/?d=${d.slug}#catalog">Lihat rumah &amp; cek tanggal</a></p>
${cards}
<p class="muted">Tarif kamar dibayar ke rekening perusahaan lewat WhatsApp Pusat. Layanan tambahan dibayar langsung ke tuan rumah sesuai daftar harga.</p></main></body></html>`;
  const dir = path.join(dist, 'destinasi', d.slug); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page);
}

// 5b) Halaman per rumah: pratinjau WhatsApp/OG lalu langsung ke aplikasi. noindex agar tidak bersaing dengan halaman destinasi.
const urlsHome = [];
for (const h of homes) {
  const hid = String(h.id), hs = slug(hid);
  const photo = /^https:\/\//.test(h.photo || '') ? h.photo : '';
  const t = `${h.name} · ${h.destination} · ${rp(h.price)}/tamu/malam | bolehnginep`;
  const dsc = String((h.desc && (h.desc.id || h.desc)) || `Homestay live-in di ${h.destination}.`).slice(0, 180);
  const pg = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(t)}</title><meta name="description" content="${esc(dsc)}"><link rel="canonical" href="${SITE}/destinasi/${slug(h.destination)}/">
<meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(dsc)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}/rumah/${hs}/"><meta property="og:image" content="${photo ? esc(photo) : SITE + '/og.png'}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=/?home=${encodeURIComponent(hid)}"><script>location.replace('/?home=${encodeURIComponent(hid)}')</script></head>
<body><p><a href="/?home=${encodeURIComponent(hid)}">Buka ${esc(h.name)}</a></p></body></html>`;
  const dir = path.join(dist, 'rumah', hs); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pg); urlsHome.push(hs);
}

// 6) sitemap + robots
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...dests.map((d) => `/destinasi/${d.slug}/`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// 6a) Aset merek (logo, favicon, gambar pratinjau) dari folder brand/ ke akar situs
if (fs.existsSync(path.join(root, 'brand'))) {
  for (const f of fs.readdirSync(path.join(root, 'brand'))) if (!f.endsWith('-src.svg')) fs.copyFileSync(path.join(root, 'brand', f), path.join(dist, f));
}

// 6b) Modul admin + minify JS (jika esbuild ada; kalau tidak, JS dipakai apa adanya)
let esb = null;
try { esb = await import('esbuild'); } catch (e) { console.warn('! esbuild tidak ada, JS tidak diminify'); }
const minJS = (code) => { if (!esb) return code; try { return esb.transformSync(code, { minify: true, target: 'es2019' }).code; } catch (e) { console.warn('! minify gagal:', e.message); return code; } };
const hash = (txt) => crypto.createHash('md5').update(txt).digest('hex').slice(0, 8);
const adminJs = minJS(fs.readFileSync(path.join(root, 'admin.js'), 'utf8'));
fs.writeFileSync(path.join(dist, 'admin.js'), adminJs);
{
  let out = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  out = out.replace('admin.js?v=1', 'admin.js?v=' + hash(adminJs));
  out = out.replace(/<script>\n(\(function[\s\S]*?)<\/script>/, (m, code) => '<script>' + minJS(code) + '</script>');
  fs.writeFileSync(path.join(dist, 'index.html'), out);
}

// 7) Tailwind build (ganti CDN dengan CSS terkompilasi). Jika gagal, CDN tetap dipakai.
try {
  execSync('npx --no-install tailwindcss -c tailwind.config.cjs -i input.css -o dist/tw.css --minify', { stdio: 'inherit' });
  let out = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  out = out.replace('<script src="https://cdn.tailwindcss.com"></script>', '<link rel="stylesheet" href="/tw.css?v=' + hash(fs.readFileSync(path.join(dist, 'tw.css'), 'utf8')) + '">').replace(/<script>\s*tailwind\.config = [\s\S]*?<\/script>\n?/, '');
  fs.writeFileSync(path.join(dist, 'index.html'), out);
  console.log('Tailwind: CSS terkompilasi dipakai (dist/tw.css)');
} catch (e) {
  if (PROD) { console.error('GAGAL: Tailwind CLI tidak berjalan. Pastikan devDependencies terpasang (npm install). Build produksi tidak boleh memakai CDN.'); process.exit(1); }
  console.warn('! Tailwind CLI tidak tersedia/gagal. dist/index.html tetap memakai Tailwind CDN. Jalankan "npm install" lalu build ulang.');
}
// 8) Content-Security-Policy (hanya produksi): skrip inline diizinkan lewat hash, bukan 'unsafe-inline'
if (PROD) {
  let out = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const hashes = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
  const pl = process.env.PLAUSIBLE_DOMAIN ? ' https://plausible.io' : '';
  const csp = ["default-src 'self'", "script-src 'self' " + hashes.join(' ') + pl, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
    "img-src 'self' data: https:", "connect-src 'self' https://script.google.com https://script.googleusercontent.com" + pl, "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; ');
  out = out.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '">');
  fs.writeFileSync(path.join(dist, 'index.html'), out);
  console.log('CSP dipasang (' + hashes.length + ' skrip inline di-hash)');
}
console.log('Selesai:', dests.length, 'halaman destinasi,', urlsHome.length, 'halaman rumah, sitemap.xml, robots.txt');
