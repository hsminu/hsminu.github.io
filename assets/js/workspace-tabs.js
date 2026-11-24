const bar = document.querySelector('.workspace-tabs');
const home = bar.querySelector('a');
const page = bar.querySelector('[data-open-tab] a');
const current = page && { path: page.pathname, label: page.textContent.trim() };
const storageKey = `workspace-tabs:${home.pathname}`;
const navigationKey = `${storageKey}:navigation`;
let openTabs = [];

function restoreTabs() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey));
    if (!Array.isArray(stored)) return [];
    return stored.filter(({ path, label }) =>
      typeof label === 'string' &&
      typeof path === 'string' &&
      path.startsWith(home.pathname) &&
      path !== home.pathname &&
      new URL(path, location.origin).origin === location.origin
    );
  } catch {
    return [];
  }
}

function saveTabs() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(openTabs));
  } catch {
    // The current page still works when the browser blocks session storage.
  }
}

function takeNavigation() {
  try {
    const navigation = JSON.parse(sessionStorage.getItem(navigationKey));
    sessionStorage.removeItem(navigationKey);
    return navigation?.path === current?.path ? navigation?.tabId : undefined;
  } catch {
    return undefined;
  }
}

function closeTab(path) {
  const index = openTabs.findIndex((tab) => tab.path === path);
  openTabs.splice(index, 1);
  saveTabs();

  if (path === current?.path) {
    const neighbor = openTabs[index - 1] || openTabs[index];
    location.replace(neighbor?.path || home.href);
  } else {
    renderTabs().focus({ preventScroll: true });
  }
}

function renderTabs() {
  bar.querySelectorAll('[data-open-tab]').forEach((node) => node.remove());
  let active = home;

  for (const { path, label } of openTabs) {
    const item = document.createElement('div');
    item.className = 'workspace-tab';
    item.setAttribute('data-open-tab', '');
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

    item.append(link, close);
    bar.append(item);
  }

  const viewport = bar.getBoundingClientRect();
  const tab = active.parentElement.getBoundingClientRect();
  if (tab.left < viewport.left) bar.scrollLeft += tab.left - viewport.left;
  if (tab.right > viewport.right) bar.scrollLeft += tab.right - viewport.right;
  return active;
}

function syncTabs() {
  openTabs = restoreTabs();
  const previousTabId = takeNavigation() || history.state?.workspaceTabId;
  if (current) {
    const previousTab = previousTabId && openTabs.find((tab) => tab.id === previousTabId);
    const existingTab = openTabs.find((tab) => tab.path === current.path);
    const id = previousTab?.id || existingTab?.id || crypto.getRandomValues(new Uint32Array(4)).join('-');
    if (previousTab) {
      // Keep the current slot even if the destination was already open elsewhere.
      openTabs = openTabs.filter((tab) => tab.path !== current.path || tab === previousTab);
    }
    const index = openTabs.indexOf(previousTab || existingTab);
    const updatedTab = { ...current, id };
    if (index === -1) openTabs.push(updatedTab);
    else openTabs[index] = updatedTab;
    saveTabs();
    if (history.state?.workspaceTabId !== id) {
      history.replaceState({ ...history.state, workspaceTabId: id }, '');
    }
  }
  renderTabs();
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[data-open-in-current-tab]');
  const activeTab = current && openTabs.find((tab) => tab.path === current.path);
  if (!link || !activeTab?.id) return;

  try {
    sessionStorage.setItem(navigationKey, JSON.stringify({ path: link.pathname, tabId: activeTab.id }));
  } catch {
    // Leave the link's ordinary navigation available.
  }
});

syncTabs();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncTabs();
});
