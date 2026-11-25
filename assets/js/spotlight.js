const panel = document.getElementById('workspace-spotlight');
const query = document.getElementById('workspace-query');
const results = document.getElementById('workspace-results');
const scroll = panel.querySelector('.spotlight-scroll');
const count = panel.querySelector('.spotlight-count');
const message = panel.querySelector('[data-search-message]');
const messageTitle = message.querySelector('strong');
const messageDetail = message.querySelector('p');
const retry = message.querySelector('[data-search-retry]');
const iconTemplate = panel.querySelector('.spotlight-query > .workspace-icon');
const groups = { post: 'Posts', category: 'Categories', tag: 'Tags', page: 'Pages' };
const icons = { post: 'file', category: 'folder', tag: 'tag', page: 'info' };
const resultLimit = 12;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
const fold = (value) => value.normalize('NFKC').toLowerCase();
const normalize = (value) => fold(value).trim().replace(/\s+/gu, ' ');
const sidebar = new Map(Array.from(document.querySelectorAll('[data-spotlight-nav]'), (link) => [
  link.pathname,
  {
    title: link.dataset.spotlightTitle || link.textContent.trim(),
    url: link.pathname,
    navIcon: link.querySelector('.workspace-icon'),
    order: Number(link.dataset.spotlightNav),
  },
]));

let indexPromise;
let items;
let options = [];
let selected = -1;
let source;
let composing = false;
let renderTimer;
let renderedQuery;

function loadIndex() {
  indexPromise ??= fetch(panel.dataset.index, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('Search index unavailable');
      return response.json();
    })
    .then((entries) => {
      if (!Array.isArray(entries)) throw new Error('Invalid search index');
      const indexed = new Map();
      for (const entry of entries) {
        if (!Object.hasOwn(groups, entry.type) || typeof entry.title !== 'string' || typeof entry.url !== 'string' ||
          (entry.type === 'post' && (!Number.isFinite(entry.timestamp) || !/^\d{4}\.\d{2}\.\d{2}$/.test(entry.date)))) {
          throw new Error('Invalid search entry');
        }
        const url = new URL(entry.url, location.href);
        if (url.origin !== location.origin || indexed.has(url.pathname)) continue;
        const content = (entry.content || '').normalize('NFKC');
        indexed.set(url.pathname, {
          ...entry,
          url: url.pathname,
          navIcon: sidebar.get(url.pathname)?.navIcon,
          symbol: '#workspace-icon-' + (entry.icon || icons[entry.type]),
          titleMatch: normalize(entry.title),
          tagsMatch: normalize((entry.tags || []).join(' ')),
          categoriesMatch: normalize((entry.categories || []).join(' ')),
          keywordMatch: normalize(entry.keywords || ''),
          content,
          bodyMatch: fold(content),
        });
      }
      return [...indexed.values()];
    })
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    });
  return indexPromise;
}

function rank(entry, phrase, words) {
  let weakest = 2;
  let strength = 0;
  let bodyTerm;
  let matchedTag;
  for (const word of words) {
    let tier;
    if (entry.titleMatch.includes(word)) tier = 2;
    else if (entry.tagsMatch.includes(word)) {
      tier = 3;
      matchedTag ??= entry.tags.find(tag => normalize(tag).includes(word));
    }
    else if (entry.categoriesMatch.includes(word) || entry.keywordMatch.includes(word)) tier = 4;
    else if (entry.bodyMatch.includes(word)) {
      tier = 5;
      bodyTerm ??= word;
    } else return null;
    weakest = Math.max(weakest, tier);
    strength += tier;
  }
  const priority = entry.titleMatch === phrase ? 0 : entry.titleMatch.startsWith(phrase) ? 1 : weakest;
  return { entry, priority, strength, bodyTerm, matchedTag };
}

function highlight(parent, text, pattern) {
  if (!pattern || !fold(text).match(pattern)) {
    parent.textContent = text;
    return;
  }

  // Preserve the original spelling when a normalized match changes the length of a character.
  const source = segmenter ? text : text.normalize('NFKC');
  const parts = segmenter ? segmenter.segment(source) : [...source].map(segment => ({ segment }));
  const offsets = [];
  let normalized = '';
  let offset = 0;
  for (const { segment } of parts) {
    const next = fold(segment);
    for (let char = 0; char < next.length; char++) offsets.push([offset, offset + segment.length]);
    offset += segment.length;
    normalized += next;
  }

  let end = 0;
  for (const match of normalized.matchAll(pattern)) {
    const [start] = offsets[match.index];
    const [, stop] = offsets[match.index + match[0].length - 1];
    if (start < end) continue;
    const mark = document.createElement('mark');
    mark.textContent = source.slice(start, stop);
    parent.append(document.createTextNode(source.slice(end, start)), mark);
    end = stop;
  }
  parent.append(document.createTextNode(source.slice(end)));
}

function snippet(entry, word) {
  const position = entry.bodyMatch.indexOf(word);
  const start = Math.max(0, position - 38);
  const end = Math.min(entry.content.length, Math.max(start + 125, position + word.length + 26));
  return (start ? '…' : '') + entry.content.slice(start, end).trim() + (end < entry.content.length ? '…' : '');
}

function createOption(entry, pattern, bodyTerm, matchedTag) {
  const link = document.createElement('a');
  link.id = `workspace-result-${options.length}`;
  link.className = 'spotlight-option';
  link.dataset.resultType = entry.type;
  link.href = entry.url;
  link.tabIndex = -1;
  link.setAttribute('role', 'option');
  link.setAttribute('aria-selected', 'false');

  const icon = (entry.navIcon || iconTemplate).cloneNode(true);
  icon.classList.add('spotlight-result-icon');
  if (!entry.navIcon) icon.querySelector('use').setAttribute('href', entry.symbol);
  const text = document.createElement('span');
  text.className = 'spotlight-result-text';
  const title = document.createElement('span');
  title.className = 'spotlight-result-title';
  highlight(title, entry.title, pattern);
  text.append(title);

  const detail = entry.type === 'post'
    ? [entry.categories?.join(', '), entry.date, matchedTag && '#' + matchedTag].filter(Boolean).join(' · ')
    : entry.type === 'tag' ? `${entry.count} post${entry.count === 1 ? '' : 's'}` : '';
  if (detail) {
    const metadata = document.createElement('span');
    metadata.className = 'spotlight-result-detail';
    highlight(metadata, detail, pattern);
    text.append(metadata);
  }
  if (entry.type === 'post' && bodyTerm) {
    const excerpt = document.createElement('span');
    excerpt.className = 'spotlight-result-snippet';
    highlight(excerpt, snippet(entry, bodyTerm), pattern);
    text.append(excerpt);
  }

  link.append(icon, text);
  options.push(link);
  return link;
}

function select(position, reveal = false) {
  options[selected]?.setAttribute('aria-selected', 'false');
  selected = position;
  const option = options[selected];
  if (option) {
    option.setAttribute('aria-selected', 'true');
    query.setAttribute('aria-activedescendant', option.id);
    if (reveal) option.scrollIntoView({ block: 'nearest' });
  } else {
    query.removeAttribute('aria-activedescendant');
  }
}

function createGroup(label, matches, pattern) {
  const heading = document.createElement('div');
  heading.className = 'spotlight-group-title';
  heading.id = `workspace-search-group-${options.length}`;
  heading.textContent = label;
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', heading.id);
  group.append(heading, ...matches.map(({ entry, bodyTerm, matchedTag }) => createOption(entry, pattern, bodyTerm, matchedTag)));
  return group;
}

function resetResults() {
  select(-1);
  options = [];
  results.replaceChildren();
  results.hidden = true;
  query.setAttribute('aria-expanded', 'false');
  count.textContent = '';
  scroll.scrollTop = 0;
}

function showMessage(title, body = '', canRetry = false) {
  messageTitle.textContent = title;
  messageDetail.textContent = body;
  messageDetail.hidden = !body;
  retry.hidden = !canRetry;
  message.hidden = false;
}

function renderInitial() {
  const recent = items.filter(({ type }) => type === 'post').slice(0, 3);
  const links = [...sidebar.values()].filter(({ order }) => order > 0).map(link => ({ ...link, type: 'page' }));
  for (const entry of items) {
    if (entry.quickOrder !== undefined && !sidebar.has(entry.url)) {
      links.push({ ...entry, title: entry.quickTitle, order: entry.quickOrder });
    }
  }
  links.sort((left, right) => left.order - right.order);
  if (recent.length) results.append(createGroup('Recent Posts', recent.map(entry => ({ entry }))));
  if (links.length) {
    const quickNavigation = createGroup('Quick Navigation', links.map(entry => ({ entry })));
    quickNavigation.classList.add('spotlight-quick-navigation');
    results.append(quickNavigation);
  }
}

function renderMatches(phrase) {
  const words = [...new Set(phrase.split(' '))];
  const matches = items.map(entry => rank(entry, phrase, words)).filter(Boolean);
  if (!matches.length) {
    showMessage('No results found', 'Try a different search term.');
    return;
  }

  const pattern = new RegExp(words.sort((a, b) => b.length - a.length)
    .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
  const sorted = matches.sort((left, right) =>
    left.priority - right.priority || left.strength - right.strength ||
    (right.entry.timestamp || 0) - (left.entry.timestamp || 0));
  for (const [type, label] of Object.entries(groups)) {
    const visible = sorted.filter(({ entry }) => entry.type === type).slice(0, resultLimit);
    if (visible.length) results.append(createGroup(label, visible, pattern));
  }
  count.textContent = options.length < matches.length
    ? `${options.length} of ${matches.length} results`
    : `${matches.length} result${matches.length === 1 ? '' : 's'}`;
}

function render() {
  if (!panel.open || !items || composing) return;
  const phrase = normalize(query.value);
  if (renderedQuery === phrase) return;
  renderedQuery = phrase;
  resetResults();
  message.hidden = true;
  if (phrase) renderMatches(phrase);
  else renderInitial();
  if (options.length) {
    results.hidden = false;
    query.setAttribute('aria-expanded', 'true');
    select(0);
  }
}

async function loadSearch() {
  showMessage('Loading…');
  try {
    items = await loadIndex();
    render();
  } catch {
    if (panel.open) showMessage('Could not load search', 'Try again in a moment.', true);
  }
}

function fitViewport() {
  if (panel.open && window.visualViewport) {
    panel.style.setProperty('--spotlight-viewport-height', `${window.visualViewport.height}px`);
  }
}

function open(trigger) {
  if (panel.open) return;
  source = trigger;
  query.value = '';
  renderedQuery = undefined;
  panel.showModal();
  fitViewport();
  query.focus();
  if (items) render();
  else loadSearch();
}

for (const trigger of document.querySelectorAll('[data-workspace-search]')) {
  trigger.addEventListener('click', () => open(trigger));
}
window.visualViewport?.addEventListener('resize', fitViewport);
panel.querySelector('[data-close-search]').addEventListener('click', () => panel.close());
retry.addEventListener('click', () => {
  query.focus();
  loadSearch();
});
panel.addEventListener('click', (event) => {
  if (event.target === panel) panel.close();
  const link = event.target.closest('.spotlight-option');
  if (link?.pathname === location.pathname && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    panel.close();
  }
});
panel.addEventListener('close', () => {
  clearTimeout(renderTimer);
  resetResults();
  message.hidden = true;
  composing = false;
  source?.focus({ preventScroll: true });
});

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || composing) return;
  if (event.key === 'Escape' && panel.open) {
    event.preventDefault();
    panel.close();
  } else if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (panel.open) query.focus();
    else if (!event.repeat) open(document.activeElement);
  }
});

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 70);
}

query.addEventListener('input', (event) => {
  if (!composing && !event.isComposing) scheduleRender();
});
query.addEventListener('compositionstart', () => { composing = true; });
query.addEventListener('compositionend', () => {
  composing = false;
  scheduleRender();
});
query.addEventListener('keydown', (event) => {
  if (composing || event.isComposing || event.keyCode === 229) return;
  if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
  render();
  if (!options.length) return;
  event.preventDefault();
  if (event.key === 'Enter') {
    options[selected]?.click();
  } else {
    const step = event.key === 'ArrowDown' ? 1 : -1;
    select((selected + step + options.length) % options.length, true);
  }
});
