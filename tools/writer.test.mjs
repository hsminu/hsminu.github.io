import test from 'node:test';
import assert from 'node:assert/strict';
import { createPost, githubEditorURL, seoulDate, slugify } from '../assets/js/writer-utils.mjs';

const values = {
  title: '첫 번째 CTF 풀이', date: '2026-11-09', category: 'CTF', subcategory: 'Web',
  tags: 'XSS, web, xss', description: '풀이 기록', slug: 'first-ctf', body: '## 풀이\n\n본문입니다.'
};

test('exports a post with two category levels, normalized tags, and a Seoul date', () => {
  const post = createPost(values);
  assert.equal(post.filename, '_posts/2026-11-09-first-ctf.md');
  assert.match(post.markdown, /categories: \["CTF", "Web"\]/);
  assert.match(post.markdown, /tags: \["xss", "web"\]/);
  assert.match(post.markdown, /date: 2026-11-09 00:00:00 \+0900/);
  assert.ok(post.markdown.endsWith('## 풀이\n\n본문입니다.\n'));
});

test('quotes YAML control characters without altering body indentation', () => {
  const post = createPost({ ...values, title: '제목: "인용"\n새 줄', body: '    print("hello")\n', description: '---\nextra: true' });
  assert.ok(post.markdown.includes('title: "제목: \\"인용\\"\\n새 줄"'));
  assert.ok(post.markdown.includes('description: "---\\nextra: true"'));
  assert.ok(post.markdown.endsWith('    print("hello")\n'));
});

test('rejects empty posts, impossible dates, future dates, and unusable slugs', () => {
  for (const change of [{ title: '' }, { body: '   ' }, { category: '' }, { date: '2026-02-30' }, { date: '9999-12-31' }, { slug: '../../' }]) {
    assert.throws(() => createPost({ ...values, ...change }));
  }
});

test('supports Korean filenames and removes path separators', () => {
  assert.equal(slugify('한글 CTF / 풀이'), '한글-ctf-풀이');
  assert.equal(createPost({ ...values, slug: '../nested/first-ctf' }).filename, '_posts/2026-11-09-nested-first-ctf.md');
});

test('computes the Korean calendar date around UTC midnight', () => {
  assert.equal(seoulDate(new Date('2026-11-21T15:00:00Z')), '2026-11-22');
  assert.equal(seoulDate(new Date('2026-11-21T14:59:59Z')), '2026-11-21');
});

test('keeps long manuscripts out of the GitHub URL', () => {
  const post = createPost({ ...values, body: '긴 원고 '.repeat(10000) });
  const url = new URL(githubEditorURL('hsminu/hsminu.github.io', 'main', post.filename));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('filename'), post.filename);
  assert.equal(url.searchParams.has('value'), false);
  assert.ok(url.href.length < 200);
});
