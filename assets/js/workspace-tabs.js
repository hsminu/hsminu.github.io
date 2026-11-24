const bar = document.querySelector('.workspace-tabs');
const home = bar.querySelector('a');
const page = bar.querySelector('[data-open-tab] a');
const current = page && {
  path: page.pathname,
  label: page.textContent.trim(),
  post: page.hasAttribute('data-post-tab'),
};
const storageKey = `workspace-tabs:${home.pathname}`;
let pinnedTabs = [];
let preview = null;

function isWorkspaceTab(tab) {
  return typeof tab?.label === 'string' &&
    typeof tab.path === 'string' &&
    tab.path.startsWith(home.pathname) &&
    tab.path !== home.pathname &&
    new URL(tab.path, location.origin).origin === location.origin;
}

function restoreTabs() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey));
    return {
      pinned: Array.isArray(stored?.pinned) ? stored.pinned.filter((tab) => isWorkspaceTab(tab) && tab.post) : [],
      preview: isWorkspaceTab(stored?.preview) ? stored.preview : null,
    };
  } catch {
    return { pinned: [], preview: null };
  }
}

function saveTabs() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ pinned: pinnedTabs, preview }));
  } catch {
    // The current page still works when the browser blocks session storage.
  }
}

function visibleTabs() {
  return preview ? [...pinnedTabs, preview] : pinnedTabs;
}

function closeTab(path) {
  const previous = visibleTabs();
  const index = previous.findIndex((tab) => tab.path === path);
  pinnedTabs = pinnedTabs.filter((tab) => tab.path !== path);
  if (preview?.path === path) preview = null;
  saveTabs();

  if (path === current?.path) {
    const neighbor = previous[index - 1] || previous[index + 1];
    location.replace(neighbor?.path || home.href);
  } else {
    renderTabs().focus({ preventScroll: true });
  }
}

function togglePin(tab, pinned) {
  if (pinned) {
    pinnedTabs = pinnedTabs.filter((entry) => entry.path !== tab.path);
    if (tab.path === current?.path) preview = tab;
  } else {
    pinnedTabs.push(tab);
    preview = null;
  }
  saveTabs();
  const active = renderTabs();
  const link = [...bar.querySelectorAll('[data-open-tab] a')].find((entry) => entry.pathname === tab.path);
  const button = link?.parentElement.querySelector('.workspace-tab-pin');
  (button || active).focus({ preventScroll: true });
}

function createPinButton(tab, pinned) {
  const pin = document.createElement('button');
  pin.className = 'workspace-tab-pin';
  pin.type = 'button';
  pin.title = pinned ? '탭 고정 해제' : '탭 고정';
  pin.setAttribute('aria-label', `${tab.label} 탭 고정`);
  pin.setAttribute('aria-pressed', String(pinned));
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-thumbtack';
  icon.setAttribute('aria-hidden', 'true');
  pin.append(icon);
  pin.addEventListener('click', () => togglePin(tab, pinned));
  return pin;
}

function renderTabs() {
  bar.querySelectorAll('[data-open-tab]').forEach((node) => node.remove());
  let active = home;

  for (const tab of visibleTabs()) {
    const { path, label, post } = tab;
    const pinned = tab !== preview;
    const item = document.createElement('div');
    item.className = 'workspace-tab';
    item.setAttribute('data-open-tab', '');
    item.toggleAttribute('data-preview', !pinned);
    const link = document.createElement('a');
    link.className = 'workspace-tab-link';
    link.href = path;
    link.title = label;
    const name = document.createElement('span');
    name.textContent = label;
    link.append(name);
    const close = document.createElement('button');
    close.className = 'workspace-tab-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', `${label} 탭 닫기`);
    close.addEventListener('click', () => closeTab(path));

    if (path === current?.path) {
      link.setAttribute('aria-current', 'page');
      active = link;
    }

    item.append(link);
    if (post) item.append(createPinButton(tab, pinned));
    item.append(close);
    bar.append(item);
  }

  const viewport = bar.getBoundingClientRect();
  const tab = active.parentElement.getBoundingClientRect();
  if (tab.left < viewport.left) bar.scrollLeft += tab.left - viewport.left;
  if (tab.right > viewport.right) bar.scrollLeft += tab.right - viewport.right;
  return active;
}

function syncTabs() {
  const stored = restoreTabs();
  pinnedTabs = stored.pinned;
  preview = stored.preview;
  if (current && !pinnedTabs.some((tab) => tab.path === current.path)) preview = current;
  saveTabs();
  renderTabs();
}

syncTabs();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncTabs();
});
