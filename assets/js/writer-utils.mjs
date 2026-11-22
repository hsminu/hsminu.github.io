export function seoulDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function slugify(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80).replace(/-+$/g, '');
}

export function createPost(values) {
  const title = values.title.trim();
  const category = values.category.trim();
  const subcategory = values.subcategory.trim();
  const slug = slugify(values.slug.trim() || title);
  const date = values.date;
  const parsedDate = new Date(`${date}T00:00:00+09:00`);

  if (!title) throw new Error('제목을 입력해 주세요.');
  if (!category) throw new Error('카테고리를 선택해 주세요.');
  if (!slug) throw new Error('글 주소 이름에 한글, 영문 또는 숫자를 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || seoulDate(parsedDate) !== date) {
    throw new Error('올바른 작성일을 선택해 주세요.');
  }
  if (date > seoulDate()) throw new Error('작성일은 오늘 또는 이전 날짜로 선택해 주세요.');
  if (!values.body.trim()) throw new Error('본문을 입력해 주세요.');

  const categories = subcategory && subcategory !== category ? [category, subcategory] : [category];
  const tags = [...new Set(values.tags.split(/[,，\n]/u).map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  const list = items => `[${items.map(item => JSON.stringify(item)).join(', ')}]`;
  const lines = [
    '---', `title: ${JSON.stringify(title)}`, `date: ${date} 00:00:00 +0900`,
    `categories: ${list(categories)}`, `tags: ${list(tags)}`
  ];
  if (values.description.trim()) lines.push(`description: ${JSON.stringify(values.description.trim())}`);
  lines.push('---', '');
  const body = values.body.endsWith('\n') ? values.body : `${values.body}\n`;
  return { filename: `_posts/${date}-${slug}.md`, markdown: `${lines.join('\n')}\n${body}` };
}

export function githubEditorURL(repository, branch, filename) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('저장소 설정을 확인해 주세요.');
  const url = new URL(`https://github.com/${repository}/new/${encodeURIComponent(branch)}`);
  url.searchParams.set('filename', filename);
  return url.href;
}
