const bar = document.querySelector('.workspace-tabs');
const home = bar.querySelector('a');
const page = bar.querySelector('[data-open-tab] a');
const current = page && { path: page.pathname, label: page.textContent.trim() };
const storageKey = `workspace-tabs:${home.pathname}`;
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
  if (current) {
    const index = openTabs.findIndex((tab) => tab.path === current.path);
    if (index === -1) openTabs.push(current);
    else openTabs[index] = current;
    saveTabs();
  }
  renderTabs();
}

syncTabs();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncTabs();
});
