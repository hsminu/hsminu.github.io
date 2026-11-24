# hsminu의 블로그

[https://hsminu.github.io](https://hsminu.github.io)

[Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 기반 Jekyll 블로그입니다. GitHub Actions가 빌드와 링크 검사를 거쳐 GitHub Pages에 배포합니다. 글은 [Notion에서 작성해 발행](#notion에서-글-작성)하거나 Markdown 파일로 작성할 수 있습니다.

## Notion에서 글 작성

### 처음 한 번 설정하기

1. Notion에 블로그용 데이터베이스를 만든 뒤 아래 속성을 추가합니다.

   | 속성 | 유형 | 입력 예시 |
   | --- | --- | --- |
   | 이름 | 제목 | 2026 소개딩 참가 후기 |
   | 주소 | 텍스트 | `activities-sogeding` |
   | 카테고리 | 선택 | `Activities` |
   | 태그 | 다중 선택 | `대회`, `시큐어코딩` |
   | 소개 | 텍스트 | 검색 결과와 글 미리보기에 표시할 한 문장 |
   | 발행 요청 시각 | 날짜 | 아래 버튼으로 입력 |

   제목 속성은 이름을 자유롭게 정할 수 있습니다. 나머지 속성 이름은 표와 같아야 합니다. 태그와 소개는 값이 없어도 됩니다. 카테고리 옵션은 `Security Research`, `CTF & Wargame`, `Projects`, `Notes`, `Activities`입니다.
2. 데이터베이스에 `발행 요청` 버튼 속성을 추가합니다. 버튼 동작을 **속성 편집 → 발행 요청 시각**으로 정하고 값을 **지금(Now)** 또는 수식 `now()`로 지정합니다. 버튼을 누르기 전에는 날짜를 비워 둡니다. [Notion 버튼 설정](https://www.notion.com/help/database-buttons)
3. [Notion 개발자 포털](https://www.notion.so/my-integrations)에서 내부 연결을 만들고 **Read content** 권한을 켭니다. 블로그 데이터베이스의 **⋯ → 연결(Connections)**에서 해당 연결을 추가합니다. 데이터베이스 메뉴의 **Manage data sources → Copy data source ID**에서 ID를 복사합니다. [Notion 데이터 소스 ID 안내](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03)
4. 저장소의 **Settings → Secrets and variables → Actions → Secrets**에서 연결 토큰을 `NOTION_TOKEN`으로, 데이터 소스 ID를 `NOTION_DATA_SOURCE_ID`로 등록합니다. ID를 이미 **Variables**에 등록했다면 그 값도 사용할 수 있습니다. 두 곳에 같은 이름이 있으면 Secrets 값을 우선합니다. [저장소의 Actions 설정](https://github.com/hsminu/hsminu.github.io/settings/secrets/actions)
5. 워크플로와 동기화 스크립트를 기본 브랜치에 반영합니다. 이 저장소에서는 `main`입니다.

### 작성하고 발행하기

1. Notion 페이지에 글을 쓰고 사진을 이미지 블록으로 붙여넣습니다. 주소에는 영문 소문자, 숫자와 하이픈을 사용합니다.
2. **발행 요청**을 누릅니다. GitHub Actions가 15분 간격으로 확인합니다. 바로 확인하려면 **Actions → Build and Deploy → Run workflow**에서 기본 브랜치를 고르고 **Import requested Notion posts before deploying**을 켠 채 실행합니다. 저장소 파일만 다시 배포하려면 이 옵션을 끕니다.
3. 실행이 성공하면 글이 `/posts/주소/`에 공개됩니다. 발행된 Markdown은 `_posts/notion/`, 업로드한 사진은 `assets/img/posts/notion/주소/`에 저장됩니다. Notion에 올린 PNG, JPEG, GIF, WebP, AVIF 이미지는 내려받아 함께 게시하며, 외부 이미지는 원래 링크를 사용합니다.

수정할 때는 Notion에서 글을 고친 뒤 **발행 요청**을 다시 누릅니다. 첫 발행의 날짜와 주소를 유지하며, 발행 요청 이후 저장한 수정 사항도 가져오기 시점의 본문에 반영됩니다. 기존 주소를 쓰는 수동 작성 글이 있으면 새 글에 다른 주소를 지정합니다.

오류는 **Actions → Build and Deploy → Import requested Notion posts**에서 확인할 수 있습니다. Notion 전용 블록 일부는 Jekyll에서 표시가 다를 수 있으므로 사진과 코드가 있는 테스트 글로 첫 발행을 확인합니다. 공개 저장소에 60일간 활동이 없으면 GitHub가 예약 실행을 비활성화할 수 있습니다. [예약 실행 동작](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

### 글 내리기

1. Notion에서 발행한 글은 먼저 Notion의 **발행 요청 시각**을 비웁니다. 동기화가 이미 삭제한 글을 다시 가져오는 일을 막을 수 있습니다.
2. 저장소의 [_posts](_posts/)에서 해당 Markdown 파일을 삭제합니다. Notion으로 발행한 글은 [_posts/notion](_posts/notion/)에 있습니다. 글 전용 이미지도 함께 내릴 때는 해당 이미지 폴더를 삭제합니다.
3. 변경을 커밋하고 기본 브랜치에 올립니다. 다음 배포가 끝나면 공개 사이트의 글 목록과 글 주소에 반영됩니다.

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

## 홈의 대표 글

Markdown 글은 머리말에 `featured: true`를 추가하면 **Selected Work**에 표시됩니다. Notion에서 발행한 글은 [_data/featured.yml](_data/featured.yml)에 `/posts/주소/`를 키로 등록합니다. `description`과 `image.path`, `image.alt`는 선택 항목입니다. 공개된 대표 글이 없으면 **Selected Work**가 숨겨집니다.

## 수정할 위치

- 제목, 소개 문구, 프로필 사진: `_config.yml`
- 소개 페이지: `_tabs/about.md`
- 홈의 소개와 글 목록: `_layouts/home.html`
- 다섯 분야의 메뉴: `_tabs/`의 해당 파일
- 분야별 글 목록: `_layouts/section.html`
- GitHub 등 프로필 링크: `_data/contact.yml`
- 사이드바 구성: `_includes/sidebar.html`
- 하단 링크: `_includes/footer.html`
- 라이트·다크 색상과 사이드바 스타일: `_sass/custom.scss`
- 홈과 게시글의 레이아웃 및 타이포그래피: `_sass/_editorial.scss`

사이드바 하단에는 About·Archives와 테마 전환, GitHub 아이콘을 표시합니다. 테마는 기본적으로 시스템 설정을 따르며, 선택한 라이트·다크 모드는 브라우저에 저장됩니다. `_config.yml`의 `theme_mode`를 비워 두어야 전환 기능을 사용할 수 있습니다.

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
