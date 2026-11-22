/** Konfigurasi build produksi (menggantikan Tailwind CDN). Harus sama dengan blok tailwind.config di index.html. */
module.exports = {
  content: ['./dist/index.html', './dist/admin.js'],
  theme: { extend: {
    colors: { cream: '#F3F1EB', forest: '#17201B', terra: '#B4472A', ink: '#1B1F1D', leaf: '#1F4D3A', mint: '#E8EFEA' },
    fontFamily: { display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'] }
  } }
};
