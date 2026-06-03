// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

// ─── TOC: highlight current section on scroll ────────────
function updateTOC() {
  const tocLinks = document.querySelectorAll('.toc-right a');
  if (!tocLinks.length) return;

  const anchors = Array.from(
    document.querySelectorAll('.page-section, .cmd-block')
  ).filter(el => el.id);

  const scrollY = window.scrollY + 120;
  let activeId = anchors[0]?.id ?? null;

  for (const el of anchors) {
    if (el.offsetTop <= scrollY) activeId = el.id;
  }

  tocLinks.forEach(a => {
    a.classList.toggle('toc-active', a.getAttribute('href') === '#' + activeId);
  });
}

window.addEventListener('scroll', updateTOC, { passive: true });
updateTOC();

// ─── Smooth scroll on TOC + nav links ────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ─── Sidebar Toggle & Resize ─────────────────────────────
(function () {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebarToggle');
  const handle  = document.getElementById('sidebarResize');
  if (!sidebar || !toggle) return;

  const STORAGE_KEY = 'sidebar-collapsed';
  const WIDTH_KEY   = 'sidebar-width';
  const MIN_W = 180;
  const MAX_W = 480;

  const savedW = parseInt(localStorage.getItem(WIDTH_KEY));
  if (savedW >= MIN_W && savedW <= MAX_W) sidebar.style.width = savedW + 'px';

  if (localStorage.getItem(STORAGE_KEY) === '1') {
    sidebar.classList.add('collapsed');
    toggle.textContent = '»';
  }

  toggle.addEventListener('click', function () {
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '»' : '«';
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  });

  if (!handle) return;
  let dragging = false;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let w = Math.min(Math.max(e.clientX, MIN_W), MAX_W);
    sidebar.style.width = w + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(WIDTH_KEY, parseInt(sidebar.style.width));
  });
})();
