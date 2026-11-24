import './spotlight.js';
import './workspace-tabs.js';

const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-trigger');
const mask = document.getElementById('mask');
const main = document.getElementById('main-wrapper');
const toolbar = document.querySelector('.workspace-toolbar');
const skip = document.querySelector('.workspace-skip');
const spotlight = document.getElementById('workspace-spotlight');
const isOpen = () => document.body.hasAttribute('sidebar-display');
const isMobile = () => toggle.getClientRects().length > 0;

sidebar.inert = isMobile();

new MutationObserver(() => {
  const open = isOpen();
  toggle.setAttribute('aria-expanded', String(open));
  sidebar.inert = !open && isMobile();
  main.inert = open;
  toolbar.inert = open;
  skip.inert = open;
  requestAnimationFrame(() => {
    if (open !== isOpen() || spotlight.open) return;
    const focus = open ? sidebar.querySelector('a') : toggle;
    focus.focus({ preventScroll: true });
  });
}).observe(document.body, { attributes: true, attributeFilter: ['sidebar-display'] });

window.addEventListener('resize', () => {
  if (isOpen() && !isMobile()) mask.click();
  sidebar.inert = !isOpen() && isMobile();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented && isOpen() && !spotlight.open) mask.click();
});

// Chirpy renders and closes the mobile TOC. Its opener assumes an active entry.
const toc = document.getElementById('toc-popup');
if (toc) {
  for (const button of document.querySelectorAll('[data-workspace-toc-trigger]')) {
    button.addEventListener('click', () => {
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      toc.showModal();
      toc.querySelector('.is-active-li')?.scrollIntoView({ block: 'center' });
    });
  }
}
