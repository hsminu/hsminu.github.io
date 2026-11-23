const section = document.querySelector('[data-section-index]');
const filters = section.querySelector('.section-tags');
const buttons = [...filters.querySelectorAll('[data-section-filter]')];
const count = section.querySelector('.section-count');
const posts = [...section.querySelectorAll('.section-post')].map((post) => ({
  element: post,
  tags: [...post.querySelectorAll('[data-post-tag]')].map((link) => link.dataset.postTag)
}));

for (const button of buttons) {
  button.addEventListener('click', () => {
    const tag = button.dataset.sectionFilter;
    let visible = 0;

    for (const post of posts) {
      const matches = !tag || post.tags.includes(tag);
      post.element.hidden = !matches;
      if (matches) visible++;
    }

    for (const option of buttons) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    count.textContent = `${visible} ${visible === 1 ? 'post' : 'posts'}`;
  });
}

filters.hidden = false;
