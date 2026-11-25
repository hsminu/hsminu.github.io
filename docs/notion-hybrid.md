# Notion 하이브리드 발행

발행 경로는 `GET /v1/pages/{page_id}/markdown?markdown_version=v2`와 Notion API `2026-03-11`을 사용합니다. 기본 본문은 Markdown으로 처리하고, `<unknown>`에 들어 있는 공식 Notion URL에서 UUID를 읽어 `GET /v1/blocks/{block_id}`로 보완합니다. 접근 권한 또는 잘림으로 `truncated`나 `unknown_block_ids`가 보고되면 발행을 중단하던 기존 동작을 유지합니다. [Markdown API](https://developers.notion.com/reference/retrieve-page-markdown#unknown-blocks) · [Blocks API](https://developers.notion.com/reference/retrieve-a-block)

## Markdown 버전과 확인한 응답

공식 마이그레이션 문서에 따르면 v1의 북마크 `<unknown>`은 v2에서 `<bookmark source="…" />`가 됩니다. 임베드와 미디어의 주소 속성은 `src`에서 `source`로, 토글은 `<details>`에서 `<toggle>`로, 동기화 블록은 `<synced_block>`에서 `<synced-block>`으로 바뀝니다. 발행기는 v2를 유지하고, 진단 명령에서만 v1도 요청합니다. [Notion v1·v2 비교](https://developers.notion.com/guides/data-apis/migrate-to-notion-flavored-markdown#syntax-differences)

- 소개딩 후기의 실제 Notion Markdown에는 블록 `423ffcd8-6341-8086-8c67-c926c642c54d`가 `alt="external_object_instance"`인 `<unknown>`으로 들어왔습니다. 이 응답의 URL은 Notion 페이지 내 블록 위치입니다. 저장소 주소는 포함되지 않았습니다.
- 이 환경에서 공식 REST의 해당 블록과 페이지 Markdown v1·v2에 인증 없이 요청하면 모두 `401 unauthorized`입니다. 연결된 Notion의 `fetch`는 해당 ID를 조회해도 Markdown 형태만 반환했습니다. 이 블록의 인증된 REST 응답 타입과 두 버전의 실제 본문 차이는 확인이 필요합니다.
- 사용자가 식별한 `hsminu/MCP-Runtime-Guard`는 무인증 GitHub REST에서 `public`으로 확인했습니다. 제목, 공개 설명, 주 언어만 카드에 사용했습니다. 이 URL은 [블록별 명시적 설정](../_data/notion_block_links.yml)에서 제공한 값입니다. Blocks API가 실제 주소를 제공하면 그 값을 우선합니다. [GitHub 저장소 조회 API](https://docs.github.com/en/rest/repos/repos#get-a-repository)

통합 토큰이 이미 로컬 환경 변수에 주입돼 있다면 다음 명령으로 확인합니다. 페이지 본문, 토큰, 미검증 외부 URL은 출력에서 제외합니다.

```sh
ruby tools/notion_diagnose.rb 421ffcd8-6341-8079-be56-d91e4a8c18f7 423ffcd8-6341-8086-8c67-c926c642c54d
```

## 블록별 처리

| 블록 | 변환 | 필요한 데이터와 한계 |
| --- | --- | --- |
| GitHub Link Preview | 공개 저장소 카드 | Markdown의 `<link-preview url>` 또는 Blocks API의 `link_preview.url`이 필요합니다. 저장소 이외의 경로는 공개 저장소임을 확인한 뒤 링크로 표시합니다. |
| Bookmark | 제목과 링크 | v2의 `source` 또는 Blocks API의 `bookmark.url`을 사용합니다. 외부 웹사이트의 제목이나 썸네일을 가져오지 않습니다. |
| YouTube | 격리된 플레이어와 링크 | 지원 주소에서 영상 ID를 읽고 `youtube-nocookie.com` 주소를 생성합니다. 재생 가능 여부는 YouTube 설정에 따릅니다. |
| Spotify | 격리된 플레이어와 링크 | 공개 공유 URL의 리소스 종류와 ID로 `open.spotify.com/embed` 주소를 생성합니다. 재생 가능 여부는 Spotify 설정에 따릅니다. |
| Figma | 파일·프로토타입 링크 | Figma 공유 URL에서 경로와 파일 ID를 사용합니다. 파일 본문을 가져오지 않으며 접근 권한은 Figma에서 처리합니다. |
| Embed | 서비스별 플레이어 또는 링크 | YouTube와 Spotify만 iframe을 생성합니다. 그 밖의 HTTPS 링크는 블로그가 외부 HTML을 가져오거나 실행하지 않습니다. |
| Callout | Chirpy 콜아웃 | v2에서 제공한 Markdown 본문과 지원 색상 계열을 사용합니다. Notion 아이콘 파일이나 사용자 정의 스타일은 가져오지 않습니다. |
| Toggle | `details`와 `summary` | 본문은 Markdown으로 렌더링하고 제목은 텍스트로 표시합니다. |
| Column | 기존 반응형 열 | v2에서 제공한 열과 가로 비율을 유지합니다. 좁은 화면에서는 세로로 배치합니다. |
| Synced Block | 반환된 본문 또는 Notion 링크 | Markdown에 포함된 사본을 발행합니다. 비어 있는 참조와 미지원 블록은 원본 링크를 표시하며, 다른 페이지의 내용을 별도로 따라가서 가져오지 않습니다. |

[Notion 블록 구조](https://developers.notion.com/reference/block) · [Notion-flavored Markdown 문법](https://developers.notion.com/guides/data-apis/notion-flavored-markdown) · [YouTube 플레이어](https://developers.google.com/youtube/player_parameters) · [Spotify 임베드](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed) · [Figma 공유 권한](https://developers.figma.com/docs/embeds/security-access/)

블록과 공개 GitHub 메타데이터 응답은 실행 중 메모리에 캐시합니다. REST 조회는 고정된 공식 호스트와 요청 타임아웃을 사용합니다. Blocks API에서 가져온 외부 주소는 블록의 상위 계층이 발행 신청한 페이지로 이어질 때 사용합니다. GitHub 요청은 무인증이며 비공개 또는 미검증 저장소의 메타데이터를 발행하지 않습니다. 일반 외부 링크는 HTTPS, 표준 포트, 사용자 정보 없는 호스트만 허용하고 쿼리와 프래그먼트를 제거합니다. HTML에 들어가는 URL과 메타데이터는 이스케이프하고, 플레이어는 서비스별로 검증한 ID로만 생성합니다. 기존 이미지 다운로드는 별도의 Notion 호스트 허용 규칙을 사용합니다. 발행 원본과 기존 작성 권한은 현재 설정을 따릅니다.

```sh
ruby tools/test_notion_blocks.rb
```

회귀 테스트는 문서 형식으로 만든 API 응답을 사용합니다. 데스크톱과 모바일의 Chromium 및 WebKit에서 기존 소개딩 글과 생성된 테스트 글의 카드, 콜아웃, 토글, 열, 동기화 콘텐츠, 플레이어 요소를 확인했습니다. 플레이어 테스트는 외부 응답을 대체했고 실제 재생은 확인하지 않았습니다. GitHub 무인증 요청 한도가 소진되면 공개 확인이 끝나지 않은 저장소는 원본 Notion 링크로 돌아갑니다.
