import './spotlight.js';
import './workspace-tabs.js';

const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-trigger');
const mask = document.getElementById('mask');
const main = document.getElementById('main-wrapper');
const toolbar = document.querySelector('.workspace-toolbar');
const frame = document.querySelector('.workspace-window');
const skip = document.querySelector('.workspace-skip');
const spotlight = document.getElementById('workspace-spotlight');
const isOpen = () => document.body.hasAttribute('sidebar-display');
const isMobile = () => toggle.getClientRects().length > 0;

sidebar.inert = isMobile();

function fitSidebar() {
  if (isMobile()) return;
  const top = toolbar.getBoundingClientRect().bottom;
  const bottom = Math.min(window.innerHeight, frame.getBoundingClientRect().bottom - frame.clientTop);
  const height = `${Math.max(0, Math.floor(bottom - top))}px`;
  if (sidebar.style.getPropertyValue('--workspace-sidebar-height') !== height) {
    sidebar.style.setProperty('--workspace-sidebar-height', height);
  }
}

window.addEventListener('scroll', fitSidebar, { passive: true });
new ResizeObserver(fitSidebar).observe(frame);
fitSidebar();

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
  fitSidebar();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented && isOpen() && !spotlight.open) mask.click();
});

// Chirpy renders and closes the mobile TOC. Its opener assumes an active entry.
const toc = document.getElementById('toc-popup');
if (toc) {
  const desktopToc = window.matchMedia('(min-width: 1200px)');
  const heading = document.querySelector('.workspace-document .content :is(h2, h3, h4)[id]');
  const refreshToc = () => {
    if (!heading) return;
    const anchorOffset = parseFloat(getComputedStyle(heading).scrollMarginTop);
    window.tocbot?.refresh({
      tocSelector: desktopToc.matches ? '#toc' : '#toc-popup-content',
      contentSelector: '.workspace-document .content',
      headingSelector: 'h2, h3, h4',
      ignoreSelector: '[data-toc-skip]',
      orderedList: false,
      scrollSmooth: false,
      collapseDepth: desktopToc.matches ? 0 : 4,
      headingsOffset: Math.ceil(anchorOffset) + 2,
    });
  };
  refreshToc();
  desktopToc.addEventListener('change', refreshToc);

  // The regenerated links still use Chirpy's dialog close handler.
  toc.addEventListener('click', (event) => {
    if (event.target.closest('.toc-link') && !toc.hasAttribute('closing')) {
      toc.querySelector('#toc-popup-close').click();
    }
  });

  for (const button of document.querySelectorAll('[data-workspace-toc-trigger]')) {
    button.addEventListener('click', () => {
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      toc.showModal();
      toc.querySelector('.is-active-li')?.scrollIntoView({ block: 'center' });
    });
  }
}
