const index = document.querySelector('[data-tags-index]');
const input = index.querySelector('input');
const clear = index.querySelector('.workspace-tag-search button');
const count = index.querySelector('[data-tag-count]');
const empty = index.querySelector('.workspace-tags-empty');
const list = index.querySelector('tbody');
const sorters = Array.from(index.querySelectorAll('[data-tag-sort]'));

const storageKey = 'workspace-tag-sort';
const defaultSort = 'posts:desc';
const sortModes = new Set(['posts:desc', 'posts:asc', 'name:asc', 'name:desc']);
const normalize = (text) => text.normalize('NFC').toLowerCase();
const rows = Array.from(list.rows, (element) => ({
  element,
  name: normalize(element.querySelector('.workspace-tag-name').textContent),
  nameOrder: Number(element.dataset.nameOrder),
  posts: Number(element.querySelector('.workspace-tag-row-count').textContent),
}));

let sort = defaultSort;
try {
  const saved = localStorage.getItem(storageKey);
  if (sortModes.has(saved)) sort = saved;
} catch {
  // The list is still sortable when storage is unavailable.
}

function applySort() {
  const [column, direction] = sort.split(':');
  const order = direction === 'asc' ? 1 : -1;
  rows.sort((left, right) => {
    const byName = left.nameOrder - right.nameOrder;
    return column === 'name' ? order * byName : order * (left.posts - right.posts) || byName;
  });
  if (rows.some(({ element }, position) => element !== list.rows[position])) {
    list.append(...rows.map(({ element }) => element));
  }

  for (const button of sorters) {
    const header = button.closest('th');
    if (button.dataset.tagSort === column) {
      button.dataset.direction = direction;
      header.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
    } else {
      delete button.dataset.direction;
      header.removeAttribute('aria-sort');
    }
  }
}

function applyFilter() {
  const query = normalize(input.value.trim());
  let matches = 0;
  for (const row of rows) {
    const hidden = !row.name.includes(query);
    if (row.element.hidden !== hidden) row.element.hidden = hidden;
    if (!hidden) matches += 1;
  }
  const total = rows.length;
  const unit = total === 1 ? 'tag' : 'tags';
  const summary = query ? `${matches} of ${total} ${unit}` : `${total} ${unit}`;
  if (count.textContent !== summary) count.textContent = summary;
  clear.hidden = !input.value;
  empty.hidden = matches > 0;
  const emptyMessage = query ? 'No matching tags' : 'No tags yet';
  if (empty.textContent !== emptyMessage) empty.textContent = emptyMessage;
}

if (sort !== defaultSort) applySort();
applyFilter();
input.disabled = false;
input.addEventListener('input', applyFilter);
clear.addEventListener('click', () => {
  input.value = '';
  input.focus();
  applyFilter();
});

for (const button of sorters) {
  button.disabled = false;
  button.addEventListener('click', () => {
    const direction = button.dataset.direction;
    const column = button.dataset.tagSort;
    const nextDirection = direction ? (direction === 'asc' ? 'desc' : 'asc') : (column === 'name' ? 'asc' : 'desc');
    sort = `${column}:${nextDirection}`;
    applySort();
    try {
      localStorage.setItem(storageKey, sort);
    } catch {
      // The current sort still applies for this visit.
    }
  });
}
