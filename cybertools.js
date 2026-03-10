// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

function toggle(header) {
}

// Smooth scroll + aktive Nav-Markierung
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    a.classList.add('active');
  });
});

// Sub-header click listeners
document.querySelectorAll('.sub-header').forEach(h => {
  h.addEventListener('click', () => toggle(h));
});

// Ersten Eintrag jeder Kategorie öffnen
document.querySelectorAll('.subcategory:first-of-type .sub-header').forEach(h => toggle(h));

// ─── Theme ───────────────────────────────────────────────
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeBtn').textContent = next === 'light' ? '☾ Dunkel' : '☀ Hell';
  localStorage.setItem('theme', next);
}

document.getElementById('themeBtn').addEventListener('click', toggleTheme);

// Apply saved theme on load (defer guarantees DOM is ready)
(function () {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'light' ? '☾ Dunkel' : '☀ Hell';
})();
