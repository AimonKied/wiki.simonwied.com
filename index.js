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

// ─── Sidebar Toggle & Resize ─────────────────────────────
(function () {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const handle = document.getElementById('sidebarResize');
  if (!sidebar || !toggle) return;

  const STORAGE_KEY = 'sidebar-collapsed';
  const WIDTH_KEY = 'sidebar-width';
  const DEFAULT_W = 260;
  const MIN_W = 180;
  const MAX_W = 480;

  // Restore saved width
  const savedW = parseInt(localStorage.getItem(WIDTH_KEY));
  if (savedW >= MIN_W && savedW <= MAX_W) sidebar.style.width = savedW + 'px';

  // Restore collapsed state
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    sidebar.classList.add('collapsed');
    toggle.textContent = '»';
  }

  toggle.addEventListener('click', function () {
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '»' : '«';
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  });

  // Resize drag
  if (!handle) return;
  let dragging = false;
  handle.addEventListener('mousedown', function (e) {
    e.preventDefault();
    dragging = true;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    let w = e.clientX;
    if (w < MIN_W) w = MIN_W;
    if (w > MAX_W) w = MAX_W;
    sidebar.style.width = w + 'px';
  });
  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(WIDTH_KEY, parseInt(sidebar.style.width));
  });
})();

