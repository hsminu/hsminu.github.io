import './spotlight.js';
import './workspace-tabs.js';
import './section-filter.js';

const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-trigger');
const mask = document.getElementById('mask');
const main = document.getElementById('main-wrapper');
const toolbar = document.querySelector('.workspace-toolbar');
const frame = document.querySelector('.workspace-window');
const skip = document.querySelector('.workspace-skip');
const spotlight = document.getElementById('workspace-spotlight');
const isOpen = () => document.body.hasAttribute('sidebar-display');
const drawerMode = window.matchMedia('(max-width: 849px)');
const isMobile = () => drawerMode.matches;
const isCollapsed = () => frame.hasAttribute('data-sidebar-collapsed');

function syncSidebar() {
  const expanded = isMobile() ? isOpen() : !isCollapsed();
  toggle.setAttribute('aria-expanded', String(expanded));
  sidebar.inert = !expanded;
}

syncSidebar();

toggle.addEventListener('click', (event) => {
  if (isMobile()) return;
  event.stopImmediatePropagation();
  frame.toggleAttribute('data-sidebar-collapsed');
  syncSidebar();
}, { capture: true });

new MutationObserver(() => {
  const open = isOpen();
  syncSidebar();
  main.inert = open;
  toolbar.inert = open;
  skip.inert = open;
  requestAnimationFrame(() => {
    if (open !== isOpen() || spotlight.open) return;
    const focus = open ? sidebar.querySelector('a') : toggle;
    focus.focus({ preventScroll: true });
  });
}).observe(document.body, { attributes: true, attributeFilter: ['sidebar-display'] });

drawerMode.addEventListener('change', () => {
  if (isOpen() && !isMobile()) mask.click();
  syncSidebar();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented && isOpen() && !spotlight.open) mask.click();
}, { capture: true });

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

const readingProgress = document.querySelector('[data-reading-progress]');
const articleBody = document.querySelector('.workspace-document .content');
const notionBlockLinks = new Map(Object.entries(JSON.parse(articleBody?.dataset.notionBlockLinks || '{}')));

for (const block of articleBody?.querySelectorAll('unknown[url]') ?? []) {
  const url = block.getAttribute('url');
  if (!/^https:\/\/(?:app\.notion\.com|(?:www\.)?notion\.so)\//i.test(url)) continue;

  const blockId = new URL(url).hash.slice(1).replaceAll('-', '');
  const destination = notionBlockLinks.get(blockId);
  const link = document.createElement('a');
  link.href = destination?.url || url;
  link.textContent = destination?.label || 'View block in Notion';
  if (destination?.url?.startsWith('https://github.com/')) {
    const provider = document.createElement('small');
    provider.textContent = ['GitHub', destination.language].filter(Boolean).join(' · ');
    const title = document.createElement('strong');
    title.textContent = destination.label;
    link.className = 'notion-preview-link';
    link.rel = 'noopener noreferrer';
    link.replaceChildren(provider, title);
    if (destination.description) {
      const summary = document.createElement('span');
      summary.textContent = destination.description;
      link.append(summary);
    }
  }
  block.replaceWith(link, ...block.childNodes);
}

if (readingProgress && articleBody?.textContent.trim()) {
  const statusBar = readingProgress.closest('.workspace-status');
  const percentage = statusBar.querySelector('[data-reading-percent]');
  const tabs = document.querySelector('.workspace-tabs');
  const updateProgress = () => {
    const article = articleBody.getBoundingClientRect();
    const readingTop = Math.max(toolbar.getBoundingClientRect().bottom, tabs.getBoundingClientRect().bottom);
    const readingBottom = Math.min(window.innerHeight, statusBar.getBoundingClientRect().top);
    const distance = article.height - (readingBottom - readingTop);
    const value = article.bottom <= readingBottom ? 100 : distance <= 0 ? 0
      : Math.round(100 * Math.min(1, Math.max(0, (readingTop - article.top) / distance)));
    if (percentage.textContent === value + '%') return;
    readingProgress.value = value;
    percentage.textContent = value + '%';
    readingProgress.parentElement.hidden = false;
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  new ResizeObserver(updateProgress).observe(articleBody);
  updateProgress();
}
