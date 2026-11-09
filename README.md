# hsminu의 블로그

[https://hsminu.github.io](https://hsminu.github.io)

[Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 기반 Jekyll 블로그입니다. `main`에 변경 사항을 올리면 GitHub Actions가 빌드와 링크 검사를 거쳐 GitHub Pages에 배포합니다.

## 글 작성

`_posts/YYYY-MM-DD-slug.md` 파일을 만들고 다음과 같이 작성합니다.

```markdown
---
title: 글 제목
date: 2026-11-09 12:00:00 +0900
categories: [CTF, Web]
tags: [dreamhack, xss]
description: 글 내용을 소개하는 한 문장
---

## 개요

여기부터 본문을 작성합니다.
```

`categories`의 첫 번째 값으로 분야가 결정됩니다. 두 번째 값은 선택 사항인 하위 분류입니다. 태그는 소문자로 작성합니다.

| 사이드바 메뉴 | 첫 번째 카테고리 값 |
| --- | --- |
| 개발 | `개발` |
| CTF / Wargame | `CTF` |
| Bug Bounty | `Bug Bounty` |
| 블로그 / 기술문서 | `기술문서` |
| 논문 / 컨퍼런스 | `논문·컨퍼런스` |
| 공모전 / 자격증 | `공모전·자격증` |

예: `categories: [Bug Bounty, Web]`, `categories: [논문·컨퍼런스, 논문리뷰]`.

초안은 `_drafts/`에 둡니다. `_drafts/post-template.md`를 복사해 사용할 수 있으며, 초안은 공개 사이트에 나오지 않습니다. 발행하려면 파일을 `_posts/`로 옮기고 날짜를 포함한 파일명과 `date`를 지정합니다.

이미지는 `assets/img/posts/` 아래에 넣고 `![설명](/assets/img/posts/example.png)` 형태로 첨부합니다.

## 수정할 위치

- 제목, 소개 문구, 프로필 사진: `_config.yml`
- 소개 페이지: `_tabs/about.md`
- 여섯 분야의 메뉴와 설명: `_tabs/`의 해당 파일
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
