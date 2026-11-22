# hsminu의 블로그

[https://hsminu.github.io](https://hsminu.github.io)

[Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 기반 Jekyll 블로그입니다. `main`에 변경 사항을 올리면 GitHub Actions가 빌드와 링크 검사를 거쳐 GitHub Pages에 배포합니다.

## GitHub에서 글 작성

추천: [github.dev 편집기](https://github.dev/hsminu/hsminu.github.io)를 열어 작성합니다. GitHub 저장소 화면에서 `.` 키를 눌러도 같은 편집기가 열립니다.

1. `_drafts/post-template.md`의 내용을 복사합니다.
2. `_posts/`에 `2026-11-22-first-post.md`처럼 날짜와 글 주소 이름으로 새 파일을 만듭니다.
3. 양식을 붙여넣고 제목, 날짜, 카테고리, 본문을 수정합니다. 아래 예시처럼 `date`도 지정합니다.
4. `Cmd+Shift+V`로 마크다운 미리보기를 확인합니다. Windows와 Linux에서는 `Ctrl+Shift+V`를 사용합니다.
5. 왼쪽 **Source Control**에서 변경 파일을 `+`로 스테이징하고, 메시지를 입력한 뒤 **Commit & Push**로 `main`에 저장합니다. 자동 배포가 끝나면 게시됩니다.

짧은 글은 [GitHub의 새 글 파일 화면](https://github.com/hsminu/hsminu.github.io/new/main/_posts)에서 파일명과 내용을 입력하고 **Preview**, **Commit changes**를 이용해 작성할 수도 있습니다.

미리보기는 마크다운 본문을 확인하는 용도이며, Chirpy 테마가 적용된 실제 화면은 배포 후 블로그에서 확인합니다.

## 파일로 글 작성

`_posts/YYYY-MM-DD-slug.md` 파일을 만들고 다음과 같이 작성합니다.

```markdown
---
title: 글 제목
date: 2026-11-22 12:00:00 +0900
categories: ["CTF & Wargame", Web]
tags: [dreamhack, xss]
description: 글 내용을 소개하는 한 문장
---

## 개요

여기부터 본문을 작성합니다.
```

`categories`의 첫 번째 값으로 분야가 결정됩니다. 두 번째 값은 선택 사항인 하위 분류입니다. 태그는 소문자로 작성합니다.

| 사이드바 메뉴 | 첫 번째 카테고리 값 |
| --- | --- |
| Security Research | `Security Research` |
| CTF & Wargame | `CTF & Wargame` |
| Projects | `Projects` |
| Notes | `Notes` |
| Activities | `Activities` |

예: `categories: [Security Research, Bug Bounty]`, `categories: ["CTF & Wargame", Web]`.

초안은 `_drafts/`에 둡니다. `_drafts/post-template.md`를 복사해 사용할 수 있으며, 초안은 공개 사이트에 나오지 않습니다. 발행하려면 파일을 `_posts/`로 옮기고 날짜를 포함한 파일명과 `date`를 지정합니다.

이미지는 `assets/img/posts/` 아래에 넣고 `![설명](/assets/img/posts/example.png)` 형태로 첨부합니다.

## 수정할 위치

- 제목, 소개 문구, 프로필 사진: `_config.yml`
- 소개 페이지: `_tabs/about.md`
- 다섯 분야의 메뉴와 설명: `_tabs/`의 해당 파일
- 분야별 글 목록: `_layouts/section.html`
- GitHub 등 프로필 링크: `_data/contact.yml`

전체 카테고리(`/categories/`), 태그(`/tags/`), 연도별 글(`/archives/`)은 소개 페이지에서 접근할 수 있습니다. 아직 글이 없는 분야도 사이드바에서 열 수 있습니다.

## 로컬 실행

Ruby 3.4와 Bundler를 설치한 환경에서 실행합니다.

```sh
bundle install
bundle exec jekyll serve
```

브라우저에서 `http://127.0.0.1:4000`으로 접속합니다. 초안까지 보려면 `bundle exec jekyll serve --drafts`를 사용합니다.

## 배포

저장소의 **Settings → Pages → Build and deployment → Source**는 **GitHub Actions**로 설정합니다. 배포 상태는 저장소의 **Actions → Build and Deploy**에서 확인할 수 있습니다.

Chirpy Starter와 테마의 원본 라이선스는 [LICENSE](LICENSE)를 참고하세요.
