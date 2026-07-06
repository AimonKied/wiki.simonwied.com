// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

// markTopic — topic chip toggle (web-hacking specific)
function markTopic(chip) {
  chip.classList.toggle('done');
  if (chip.classList.contains('done')) {
    chip.style.background   = 'rgba(0,255,136,0.12)';
    chip.style.borderColor  = 'rgba(0,255,136,0.4)';
    chip.style.color        = '#00ff88';
  } else {
    chip.style.background   = '';
    chip.style.borderColor  = '';
    chip.style.color        = '';
  }
}

// Open all accordion content
document.querySelectorAll('.sub-content, .category-content').forEach(el => el.classList.add('open'));
document.querySelectorAll('.sub-arrow').forEach(el => el.classList.add('open'));

// ─── TOC scroll highlighting ─────────────────────────────
function updateTOC() {
  const tocLinks = document.querySelectorAll('.toc-right a');
  if (!tocLinks.length) return;
  const anchors = Array.from(document.querySelectorAll('[id]')).filter(el =>
    document.querySelector('.toc-right a[href="#' + el.id + '"]')
  );
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

// Smooth scroll
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
  const MIN_W = 180, MAX_W = 480;

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
  handle.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; handle.classList.add('active'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; });
  document.addEventListener('mousemove', e => { if (!dragging) return; sidebar.style.width = Math.min(Math.max(e.clientX, MIN_W), MAX_W) + 'px'; });
  document.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; handle.classList.remove('active'); document.body.style.cursor = ''; document.body.style.userSelect = ''; localStorage.setItem(WIDTH_KEY, parseInt(sidebar.style.width)); });
})();
