// Uji beban ringan untuk web app Apps Script. Jalankan di laptop (k6 gratis, https://k6.io):
//   k6 run -e URL="https://script.google.com/macros/s/XXXX/exec" -e HOME_ID=H-001 tests/load/k6-booking.js
// PERHATIAN: jalankan hanya pada salinan Sheets uji (staging), bukan data asli. Setiap booking menahan tanggal 60 menit.
import http from 'k6/http'; import { check, sleep } from 'k6';
export const options = { scenarios: {
  katalog: { executor: 'constant-vus', vus: 30, duration: '1m', exec: 'katalog' },
  booking: { executor: 'constant-vus', vus: 10, duration: '1m', exec: 'booking', startTime: '5s' } },
  thresholds: { http_req_duration: ['p(95)<3000'], http_req_failed: ['rate<0.05'] } };
export function katalog() { const r = http.get(`${__ENV.URL}?action=homestays`); check(r, { 'katalog 200': (x) => x.status === 200 }); sleep(1); }
export function booking() {
  const wa = '62812' + String(Math.floor(10000000 + Math.random() * 89999999));
  const day = 1 + Math.floor(Math.random() * 27), mon = 1 + Math.floor(Math.random() * 11);
  const checkin = `2027-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const body = JSON.stringify({ action: 'createBooking', homestay_id: __ENV.HOME_ID, guest_name: 'Uji Beban', guest_wa: wa, checkin, nights: 1, guests: 1, addons: [], consent: true, hp: '', elapsed_ms: 9000 });
  const r = http.post(__ENV.URL, body, { redirects: 5 });
  check(r, { 'booking dibalas JSON': (x) => { try { JSON.parse(x.body); return true; } catch (e) { return false; } } }); sleep(2);
}
