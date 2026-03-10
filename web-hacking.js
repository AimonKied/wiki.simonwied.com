// ─── Google Analytics ────────────────────────────────────
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-G07DY445N4');

function toggle(header) {
}

function markTopic(chip) {
  chip.classList.toggle('done');
  if (chip.classList.contains('done')) {
    chip.style.background = 'rgba(0,255,136,0.12)';
    chip.style.borderColor = 'rgba(0,255,136,0.4)';
    chip.style.color = '#00ff88';
  } else {
    chip.style.background = '';
    chip.style.borderColor = '';
    chip.style.color = '';
  }
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

// Staggered animations
document.querySelectorAll('.category').forEach((cat, i) => {
  cat.style.animationDelay = (0.1 + i * 0.08) + 's';
});

// Sub-header click listeners
document.querySelectorAll('.sub-header').forEach(h => {
  h.addEventListener('click', () => toggle(h));
});

// Open first subcategory in each category by default
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
