const sidebar = document.getElementById('sidebar');
const sidebarTrigger = document.getElementById('sidebar-trigger');
const siteContent = document.getElementById('main-wrapper');
const skipLink = document.querySelector('.journal-skip-link');
const mask = document.getElementById('mask');
const sidebarOpen = () => document.body.hasAttribute('sidebar-display');
const mobileNavigation = () => sidebarTrigger.getClientRects().length > 0;

sidebar.inert = mobileNavigation();

// Chirpy controls the drawer and backdrop. Keep focus within the visible region.
new MutationObserver(() => {
  const open = sidebarOpen();
  sidebarTrigger.setAttribute('aria-expanded', String(open));
  sidebar.inert = !open && mobileNavigation();
  siteContent.inert = open;
  skipLink.inert = open;
  requestAnimationFrame(() => {
    if (open !== sidebarOpen()) return;
    const destination = open ? sidebar.querySelector('.sidebar-brand') : sidebarTrigger;
    destination.focus({ preventScroll: true });
  });
}).observe(document.body, { attributes: true, attributeFilter: ['sidebar-display'] });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarOpen()) {
    mask.click();
  }
});

window.addEventListener('resize', () => {
  if (sidebarOpen() && !mobileNavigation()) {
    mask.click();
  } else {
    sidebar.inert = !sidebarOpen() && mobileNavigation();
  }
});

const tocPopup = document.getElementById('toc-popup');
if (tocPopup) {
  // At the top of a post, Chirpy may not have marked a TOC entry as active yet.
  for (const trigger of document.querySelectorAll('[data-journal-toc-trigger]')) {
    trigger.addEventListener('click', () => {
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      tocPopup.showModal();
      tocPopup.querySelector('.is-active-li')?.scrollIntoView({ block: 'center' });
    });
  }
}
