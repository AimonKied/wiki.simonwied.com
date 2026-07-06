// ─── Collapsible sidebar navigation ──────────────────────
// Category sections collapse/expand on click.
// Active category stays open; others start closed.
// If no active category (home page), all stay open.
(function () {
  const sections = document.querySelectorAll('.nav-section');

  // Check if any category section (2nd+) has an active item
  let activeSection = null;
  sections.forEach((section, i) => {
    if (i === 0) return;
    if (section.querySelector('.nav-item.active')) activeSection = section;
  });

  sections.forEach((section, i) => {
    if (i === 0) return; // "Wiki" / "Navigation" section — never collapsible

    const title = section.querySelector('.nav-section-title');
    if (!title) return;

    // Inject arrow indicator
    const arrow = document.createElement('span');
    arrow.className = 'nav-cat-arrow';
    arrow.textContent = '▾';
    title.appendChild(arrow);

    const isActive = section === activeSection;

    // Collapse non-active sections when there is an active one
    if (activeSection && !isActive) {
      section.classList.add('nav-cat-collapsed');
    }

    // Toggle on click
    title.addEventListener('click', () => {
      const collapsed = section.classList.toggle('nav-cat-collapsed');

      // If expanding this section, collapse siblings (accordion behaviour)
      if (!collapsed) {
        sections.forEach((s, j) => {
          if (j === 0 || s === section) return;
          s.classList.add('nav-cat-collapsed');
        });
      }
    });
  });
})();
