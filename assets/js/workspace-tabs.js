const bar = document.querySelector('.workspace-tabs');
const home = bar.querySelector('a');
const page = bar.querySelector('[data-open-tab] a');
const current = page && {
  path: page.pathname,
  label: page.textContent.trim(),
};
const storageKey = `workspace-tabs:${home.pathname}`;
let retainedTabs = [];
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
    const oldPins = Array.isArray(stored?.pinned) ? stored.pinned : [];
    const retained = Array.isArray(stored?.retained)
      ? stored.retained.filter(isWorkspaceTab)
      : oldPins.filter(isWorkspaceTab).map(tab => ({ ...tab, pinned: true }));
    return {
      retained,
      preview: isWorkspaceTab(stored?.preview) && !retained.some(tab => tab.path === stored.preview.path) ? stored.preview : null,
    };
  } catch {
    return { retained: [], preview: null };
  }
}

function saveTabs() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ retained: retainedTabs, preview }));
  } catch {
    // The current page still works when the browser blocks session storage.
  }
}

function visibleTabs() {
  return preview ? [...retainedTabs, preview] : retainedTabs;
}

function closeTab(path) {
  const previous = visibleTabs();
  const index = previous.findIndex((tab) => tab.path === path);
  retainedTabs = retainedTabs.filter((tab) => tab.path !== path);
  if (preview?.path === path) preview = null;
  saveTabs();

  if (path === current?.path) {
    const neighbor = previous[index - 1] || previous[index + 1];
    location.replace(neighbor?.path || home.href);
  } else {
    renderTabs().focus({ preventScroll: true });
  }
}

function togglePin(tab) {
  if (tab === preview) {
    retainedTabs.push({ ...tab, pinned: true });
    preview = null;
  } else {
    tab.pinned = !tab.pinned;
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
  pin.title = pinned ? 'Unpin tab' : 'Pin tab';
  pin.setAttribute('aria-label', `Pin ${tab.label}`);
  pin.setAttribute('aria-pressed', String(pinned));
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-thumbtack';
  icon.setAttribute('aria-hidden', 'true');
  pin.append(icon);
  pin.addEventListener('click', () => togglePin(tab));
  return pin;
}

function renderTabs() {
  bar.querySelectorAll('[data-open-tab]').forEach((node) => node.remove());
  let active = home;

  for (const tab of visibleTabs()) {
    const { path, label } = tab;
    const pinned = tab !== preview && tab.pinned === true;
    const item = document.createElement('div');
    item.className = 'workspace-tab';
    item.setAttribute('data-open-tab', '');
    item.toggleAttribute('data-preview', tab === preview);
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
    close.innerHTML = '<svg class="workspace-icon" aria-hidden="true"><use href="#workspace-icon-close"></use></svg>';
    close.setAttribute('aria-label', `Close ${label}`);
    close.addEventListener('click', () => closeTab(path));

    if (path === current?.path) {
      link.setAttribute('aria-current', 'page');
      active = link;
    }

    item.append(link, createPinButton(tab, pinned), close);
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
  retainedTabs = stored.retained;
  preview = stored.preview;
  if (current && !retainedTabs.some((tab) => tab.path === current.path)) preview = current;
  saveTabs();
  renderTabs();
}

syncTabs();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncTabs();
});
