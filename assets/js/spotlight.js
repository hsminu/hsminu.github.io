const panel = document.getElementById('workspace-spotlight');
const query = document.getElementById('workspace-query');
const results = document.getElementById('workspace-results');
const status = panel.querySelector('[role="status"]');
const kinds = { post: '게시글', category: '카테고리', page: '페이지' };
const resultIcons = { post: 'file', category: 'folder', page: 'info' };
const iconTemplate = panel.querySelector('.spotlight-query > .workspace-icon');
const isApple = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform);
let indexPromise;
let choices = [];
let selected = -1;
let source;

for (const hint of document.querySelectorAll('[data-search-shortcut]')) hint.textContent = isApple ? '⌘ K' : 'Ctrl K';

const normalize = (value = '') => value.normalize('NFKC').toLocaleLowerCase().trim();

function loadIndex() {
  indexPromise ??= fetch(panel.dataset.index)
    .then((response) => {
      if (!response.ok) throw new Error('Search index unavailable');
      return response.json();
    })
    .then((items) => items.map((item) => ({
      ...item,
      normalizedTitle: normalize(item.title),
      metadata: normalize([item.categories, item.tags, item.date].filter(Boolean).join(' ')),
      body: normalize(item.content),
    })))
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    });
  return indexPromise;
}

function rank(items, value) {
  const phrase = normalize(value);
  if (!phrase) {
    return [...items.filter((item) => item.type === 'post').slice(0, 3), ...items.filter((item) => item.type !== 'post').slice(0, 4)];
  }
  const words = phrase.split(/\s+/);
  return items.flatMap((item) => {
    const scores = words.map((word) => {
      if (item.normalizedTitle.includes(word)) return 8;
      if (item.metadata.includes(word)) return 3;
      return item.body.includes(word) ? 1 : 0;
    });
    if (scores.includes(0)) return [];
    const titleBonus = item.normalizedTitle === phrase ? 30 : item.normalizedTitle.startsWith(phrase) ? 15 : 0;
    return [{ item, score: scores.reduce((sum, score) => sum + score, titleBonus) }];
  }).sort((left, right) => right.score - left.score).slice(0, 10).map(({ item }) => item);
}

function select(position, scroll = false) {
  results.children[selected]?.setAttribute('aria-selected', 'false');
  selected = position;
  const option = results.children[selected];
  if (!option) {
    query.removeAttribute('aria-activedescendant');
    return;
  }
  option.setAttribute('aria-selected', 'true');
  query.setAttribute('aria-activedescendant', option.id);
  if (scroll) option.scrollIntoView({ block: 'nearest' });
}

function render(items) {
  choices = rank(items, query.value);
  const options = choices.map((item, index) => {
    const row = document.createElement('li');
    row.id = `workspace-result-${index}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    const link = document.createElement('a');
    link.href = item.url;
    link.tabIndex = -1;
    const label = document.createElement('span');
    label.className = 'spotlight-result-title';
    label.textContent = item.title;
    const detail = document.createElement('span');
    detail.className = 'spotlight-result-detail';
    detail.textContent = [item.categories || kinds[item.type], item.date].filter(Boolean).join(' · ');
    const icon = iconTemplate.cloneNode(true);
    icon.classList.add('spotlight-result-icon');
    icon.querySelector('use').setAttribute('href', '#workspace-icon-' + (resultIcons[item.type] || 'file'));
    const text = document.createElement('span');
    text.className = 'spotlight-result-text';
    text.append(label, detail);
    link.append(icon, text);
    row.append(link);
    return row;
  });
  results.replaceChildren(...options);
  results.scrollTop = 0;
  query.setAttribute('aria-expanded', String(choices.length > 0));
  status.textContent = choices.length ? (query.value.trim() ? `${choices.length}개 결과` : '빠른 탐색') : '일치하는 결과가 없어요.';
  select(choices.length ? 0 : -1);
}

async function update() {
  try {
    const items = await loadIndex();
    if (panel.open) render(items);
  } catch {
    if (panel.open) status.textContent = '검색 목록을 불러오지 못했습니다. 다시 검색해 주세요.';
  }
}

function open(trigger) {
  if (panel.open) return;
  source = trigger;
  query.value = '';
  status.textContent = '검색 목록을 불러오는 중…';
  panel.showModal();
  query.focus();
  update();
}

for (const trigger of document.querySelectorAll('[data-workspace-search]')) {
  trigger.addEventListener('click', () => open(trigger));
}
panel.querySelector('[data-close-search]').addEventListener('click', () => panel.close());
panel.addEventListener('click', (event) => {
  if (event.target === panel) panel.close();
});
panel.addEventListener('close', () => {
  results.replaceChildren();
  choices = [];
  query.setAttribute('aria-expanded', 'false');
  select(-1);
  source?.focus({ preventScroll: true });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel.open) {
    event.preventDefault();
    panel.close();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (panel.open) query.focus();
    else open(document.activeElement);
  }
});

query.addEventListener('input', update);
query.addEventListener('keydown', (event) => {
  if (!choices.length || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    select((selected + step + choices.length) % choices.length, true);
  }
  if (event.key === 'Enter' && selected >= 0) {
    event.preventDefault();
    window.location.assign(choices[selected].url);
  }
});
