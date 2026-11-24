const section = document.querySelector('[data-section-index]');
const list = section?.querySelector('.workspace-folder-files');

if (list) {
  const filters = Array.from(section.querySelectorAll('[data-section-filter]'));
  const sorters = Array.from(section.querySelectorAll('[data-file-sort]'));
  const filterStatus = document.querySelector('[data-filtered-status]');
  const count = document.querySelector('[data-filtered-count]');
  const collator = new Intl.Collator(['ko', 'en'], { numeric: true, sensitivity: 'base' });
  const files = Array.from(list.children, (element) => ({
    element,
    date: Number(element.dataset.fileDate),
    title: element.dataset.fileTitle,
    tags: new Set(Array.from(element.querySelectorAll('[data-file-tag]'), (link) => link.dataset.fileTag)),
  }));

  for (const filter of filters) {
    filter.addEventListener('click', () => {
      const tag = filter.dataset.sectionFilter;
      let visible = 0;
      for (const file of files) {
        const matches = !tag || file.tags.has(tag);
        file.element.hidden = !matches;
        visible += Number(matches);
      }
      for (const button of filters) button.setAttribute('aria-pressed', String(button === filter));
      if (filterStatus && count) {
        count.textContent = String(visible);
        filterStatus.hidden = !tag;
      }
    });
  }

  for (const sorter of sorters) {
    sorter.addEventListener('click', () => {
      const name = sorter.dataset.fileSort === 'title';
      const current = sorter.dataset.direction;
      const direction = current ? (current === 'asc' ? 'desc' : 'asc') : (name ? 'asc' : 'desc');
      const order = direction === 'asc' ? 1 : -1;
      files.sort((left, right) => order * (name ? collator.compare(left.title, right.title) : left.date - right.date));
      list.append(...files.map((file) => file.element));
      for (const button of sorters) {
        button.removeAttribute('data-direction');
        button.removeAttribute('aria-label');
        button.setAttribute('aria-pressed', String(button === sorter));
      }
      sorter.dataset.direction = direction;
      sorter.setAttribute('aria-label', `${sorter.textContent.trim()} ${direction === 'asc' ? '오름차순' : '내림차순'}`);
    });
  }
}
