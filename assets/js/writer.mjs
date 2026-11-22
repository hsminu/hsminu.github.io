import markdownit from '../third-party/markdown-it-15.0.3/markdown-it.min.mjs';
import { createPost, githubEditorURL, seoulDate, slugify } from './writer-utils.mjs';

const root = document.getElementById('writer');
const form = document.getElementById('writer-form');
const draftStatus = document.getElementById('writer-draft-status');
const actionStatus = document.getElementById('writer-action-status');
const body = form.elements.body;
const preview = document.getElementById('writer-preview');
const exportPanel = document.getElementById('writer-export-panel');
const exported = document.getElementById('writer-export');
const publishLink = document.getElementById('writer-publish');
const fields = ['title', 'date', 'category', 'subcategory', 'tags', 'description', 'slug', 'body'];
const draftKey = 'hsminu-blog-writer-v1';
const markdown = markdownit({ html: false, breaks: true });
let saveTimer;
let preparedMarkdown = null;

function values() {
  return Object.fromEntries(fields.map(name => [name, form.elements[name].value]));
}

function hasContent() {
  return fields.some(name => !['date', 'category'].includes(name) && form.elements[name].value.trim());
}

function status(message, error = false) {
  actionStatus.textContent = message;
  actionStatus.classList.toggle('writer-error', error);
}

function saveDraft() {
  try {
    if (hasContent()) {
      localStorage.setItem(draftKey, JSON.stringify({ version: 1, values: values() }));
      draftStatus.textContent = '이 브라우저에 임시저장되었습니다.';
    } else {
      localStorage.removeItem(draftKey);
      draftStatus.textContent = '초안은 이 브라우저에 임시저장됩니다.';
    }
  } catch {
    draftStatus.textContent = '임시저장을 사용할 수 없습니다. 파일 다운로드로 원고를 보관하세요.';
  }
}

function update() {
  preparedMarkdown = null;
  publishLink.setAttribute('aria-disabled', 'true');
  const current = values();
  const slug = slugify(current.slug || current.title);
  document.getElementById('writer-filename').textContent = slug
    ? `_posts/${current.date}-${slug}.md` : '제목을 입력하면 저장할 파일명이 표시됩니다.';
  if (current.body.trim()) {
    preview.innerHTML = markdown.render(current.body);
  } else {
    preview.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'text-muted', textContent: '본문을 작성하면 이곳에서 미리 볼 수 있습니다.'
    }));
  }
  try {
    exported.value = createPost(current).markdown;
  } catch {
    exported.value = '';
  }
}

function prepare() {
  // A hidden required textarea cannot receive focus during browser validation.
  if (!body.value.trim()) setView('edit');
  if (!form.reportValidity()) return null;
  try {
    const post = createPost(values());
    exported.value = post.markdown;
    publishLink.href = githubEditorURL(root.dataset.repository, root.dataset.branch, post.filename);
    return post;
  } catch (error) {
    status(error.message, true);
    return null;
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* Fall back to selecting the generated manuscript. */ }
  }
  exportPanel.open = true;
  exported.focus();
  exported.select();
  if (!document.execCommand('copy')) throw new Error('copy failed');
}

function setView(view) {
  const editing = view === 'edit';
  body.hidden = !editing;
  preview.hidden = editing;
  document.getElementById('writer-toolbar').hidden = !editing;
  document.querySelectorAll('[data-writer-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.writerView === view));
  });
}

form.elements.date.value = seoulDate();
form.elements.date.max = seoulDate();
try {
  const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
  if (saved?.version === 1 && saved.values && typeof saved.values === 'object') {
    for (const name of fields) {
      if (typeof saved.values[name] !== 'string') continue;
      if (name === 'category' && !Array.from(form.elements.category.options).some(option => option.value === saved.values[name])) continue;
      form.elements[name].value = saved.values[name];
    }
    draftStatus.textContent = '이 브라우저에 저장된 초안을 불러왔습니다.';
  }
} catch {
  draftStatus.textContent = '저장된 초안을 불러오지 못했습니다. 새 글을 작성할 수 있습니다.';
}

form.addEventListener('input', () => {
  update();
  status('');
  draftStatus.textContent = '임시저장 중…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 500);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const post = prepare();
  if (!post) return;
  saveDraft();
  try {
    await copyText(post.markdown);
    // Ignore an old copy result if the author edited while clipboard access was pending.
    if (exported.value !== post.markdown) return;
    preparedMarkdown = post.markdown;
    publishLink.setAttribute('aria-disabled', 'false');
    status('원고를 복사했습니다. GitHub에서 게시를 눌러 본문에 붙여넣고 Commit changes로 저장하세요.');
  } catch {
    preparedMarkdown = post.markdown;
    publishLink.setAttribute('aria-disabled', 'false');
    exportPanel.open = true;
    exported.focus();
    exported.select();
    status('자동 복사를 사용할 수 없습니다. 선택된 원고를 직접 복사한 뒤 GitHub에 붙여넣어 주세요.', true);
  }
});

publishLink.addEventListener('click', event => {
  if (!preparedMarkdown || exported.value !== preparedMarkdown) {
    event.preventDefault();
    status('원고 복사를 먼저 눌러 최신 내용을 준비해 주세요.', true);
  }
});

document.getElementById('writer-download').addEventListener('click', () => {
  const post = prepare();
  if (!post) return;
  saveDraft();
  const url = URL.createObjectURL(new Blob([post.markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = post.filename.split('/').pop();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(`${link.download} 파일을 다운로드했습니다.`);
});

document.getElementById('writer-new').addEventListener('click', () => {
  if (hasContent() && !window.confirm('현재 초안을 지우고 새 글을 작성할까요? 필요한 원고는 먼저 다운로드해 주세요.')) return;
  clearTimeout(saveTimer);
  form.reset();
  form.elements.date.value = seoulDate();
  form.elements.date.max = seoulDate();
  exportPanel.open = false;
  setView('edit');
  update();
  saveDraft();
  status('새 글을 작성할 수 있습니다.');
  form.elements.title.focus();
});

document.querySelectorAll('[data-writer-view]').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.writerView));
});

const formats = {
  heading: ['## ', '', '소제목'], bold: ['**', '**', '강조할 내용'],
  code: ['\n```text\n', '\n```\n', '코드'], link: ['[', '](https://example.com)', '링크 이름'],
  image: ['![', '](https://example.com/image.png)', '이미지 설명']
};
document.querySelectorAll('[data-writer-format]').forEach(button => {
  button.addEventListener('click', () => {
    const [before, after, placeholder] = formats[button.dataset.writerFormat];
    const start = body.selectionStart;
    const selected = body.value.slice(start, body.selectionEnd) || placeholder;
    body.setRangeText(before + selected + after, start, body.selectionEnd, 'end');
    body.focus();
    body.setSelectionRange(start + before.length, start + before.length + selected.length);
    body.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  saveDraft();
});
update();
root.hidden = false;
document.getElementById('writer-loading').hidden = true;
