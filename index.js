// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

// ─── Search ──────────────────────────────────────────────
function filterCards() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#cardGrid .card, #cardGrid .card-placeholder').forEach(card => {
    const text = (card.innerText + ' ' + (card.dataset.tags || '')).toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

document.getElementById('searchInput').addEventListener('input', filterCards);

// Keyboard shortcut ⌘K / Ctrl+K
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

// Footer date
document.getElementById('footerDate').textContent =
  new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Stats ───────────────────────────────────────────────
const cards = document.querySelectorAll('#cardGrid .card');
document.getElementById('statArticles').textContent = cards.length;
document.getElementById('statCategories').textContent =
  document.querySelectorAll('.section-header').length;

