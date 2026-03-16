// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

function toggle(header) {
  const content = header.nextElementSibling;
  const arrow = header.querySelector('.sub-arrow');
  if (content) content.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}

// Smooth scroll + active nav highlight
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

// Open the first entry of each category by default
document.querySelectorAll('.subcategory:first-of-type .sub-header').forEach(h => toggle(h));

// ─── Sidebar Toggle & Resize ─────────────────────────────
(function () {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const handle = document.getElementById('sidebarResize');
  if (!sidebar || !toggle) return;

  const STORAGE_KEY = 'sidebar-collapsed';
  const WIDTH_KEY = 'sidebar-width';
  const DEFAULT_W = 276;
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
