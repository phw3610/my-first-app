# AGENTS.md — 꽥! 투두 개발 가이드

이 문서는 이 프로젝트를 개발하는 모든 AI 에이전트(Claude, Codex)와 사람이 따르는 공통 기준이다.

## 프로젝트 개요

- **꽥! 투두**: 오리/병아리 테마의 iOS 할 일 앱. 할 일 = 알(🥚), 단계를 끝낼 때마다 알이 깨지고 마지막에 병아리(🐥)로 부화한다.
- Expo(React Native) **SDK 54 고정** — App Store의 Expo Go가 SDK 54에 멈춰 있기 때문 (2026-07 기준, Expo Go 신버전이 Apple 심사 계류 + TestFlight 정원 초과). **SDK 업그레이드 금지.** 올리려면 먼저 App Store의 Expo Go 지원 SDK를 확인할 것.
- 배포: 앱스토어 아님. **unsigned ipa → 사용자가 SideStore로 사이드로딩** (무료 Apple ID 재서명). 나중에 유료 계정 + 앱스토어 전환 예정.

## 무료 서명 환경의 한계 (기능 설계 시 필수 확인)

- ❌ 원격 푸시(APNs), iCloud entitlement, App Groups 의존 기능 — 동작 안 함
- ✅ 로컬 알림, 파일 공유 시트, 순수 JS SDK(Firebase 등)는 동작
- 위젯/확장은 서명 이슈로 불안정 — 사전 논의 없이 추가하지 말 것

## 아키텍처

- `App.js` — 메인 화면(리스트/페이지/드래그/입력), 상태와 데이터 액션의 중심
- `src/TodoRow.js` — 행 컴포넌트 (스와이프 제스처, 부화 애니메이션)
- `src/EditTodoModal.js` — 편집 팝업 (단계별 내용/첨부/알림/반복/마감일/서식 저장)
- `src/MenuModal.js` — 메뉴 (페이지/분류/서식 관리, 정렬·자동정리 설정, 백업)
- `src/DayView.js` — 하루보기(간트) + 주간/월간 통계
- `src/storage.js` — AsyncStorage 저장/로드/마이그레이션(`normalizeData`), 완료 자동 정리
- `src/repeat.js` — 반복 투두 재생성(spawnRepeats), 날짜 유틸
- `src/backup.js` — JSON 내보내기/불러오기 (링크는 통째, 사진/파일 첨부는 이름만)
- `src/notifications.js` / `haptics.js` / `attachments.js` — 웹에서 깨지지 않도록 **네이티브 모듈은 함수 안에서 lazy require**
- `src/theme.js` — 라이트/다크 팔레트. **시작 시점의 시스템 스킴으로 고정** (모든 StyleSheet가 모듈 로드 시 색을 굳히므로 런타임 전환은 전면 리팩터링 필요)
- `assets-src/` — 아이콘/알 그래픽 SVG 원본과 재생성 방법

### 데이터 모델 (AsyncStorage 키 `quack-data-v2`)

```
{ todos, categories, pages, templates, collapsed, settings }
todo: { id, title, pageId, categoryId, totalSteps, doneSteps,
        steps: [{ text, attachments: [{type: link|photo|file, name, uri}] }],
        timeline: [{ at: ISO, step: 번호|'done' }],   // 시간 기록의 원천
        archived, archivedAt, reminder: {at, notificationId},
        repeat: {kind: daily|weekly, days}, dueDate, lastSpawnedDate, createdAt }
```

- 스키마 변경 시 `normalizeData`/`normalizeTodo`에 기본값을 추가해 **기존 사용자 데이터가 깨지지 않게** 마이그레이션한다.
- `doneSteps`는 완료된 단계 수. 첫 ▶는 1단계 "시작"만 기록(doneSteps 불변), 이후 ❯가 완료+다음 시작.

## 개발 및 검증 루프

사용자는 Expo Go를 못 쓴다. 검증은 웹 미리보기 + Playwright 스크린샷으로 한다:

```
CI=1 BROWSER=none npx expo start --web --port 8081   # CI 모드라 코드 수정 시 재시작 필요
```

- Playwright(chromium)로 390×844 뷰포트 스크린샷. 테스트 데이터는
  `page.addInitScript(() => localStorage.setItem('quack-data-v2', JSON.stringify(seed)))`로 시드.
- UI 자동화용 testID가 곳곳에 있음 (`menu-btn`, `mascot-btn`, `filter-*`, `step-N`, `add-cat-*`, `section-*`, `page-dot-N` 등) — 지우지 말 것.
- 제스처 주의: 행 좌우 스와이프(단계/완료), 행 롱프레스 드래그, 헤더 스와이프(페이지 전환)가 공존한다.
  스와이프 직후 400ms 탭/롱프레스 무시 가드(TodoRow)가 있어야 오동작이 없다. 제스처 코드를 만지면 반드시 세 제스처 모두 재검증.

## 빌드 / 릴리스

- `main`에 푸시하면 GitHub Actions(`.github/workflows/build-ios.yml`)가 unsigned ipa를 빌드해
  **GitHub Releases에 자동 발행** (`v{version}-build{run_number}`). 사용자는 폰에서 받아 SideStore로 설치.
- 문서만 바꾼 커밋은 메시지에 `[skip ci]`를 붙여 불필요한 빌드를 막는다.
- 러너는 `macos-15` 고정 (macos-latest = macOS 26/Xcode 26.5는 SDK 54 시절 RN과 궁합 위험).
- 버전: `app.json`의 `version`(semver). 기능 추가 = minor, 버그 수정 = patch. 빌드 번호는 CI가 자동 주입.
- 사용자 대상 릴리스마다 버전을 올리고, 커밋 메시지 첫 줄에 `vX.Y.Z:` 접두사를 쓴다.

## 에이전트 협업 규칙

1. **한 기능은 한 에이전트가 끝까지** 맡는다 (설계→구현→검증→커밋/푸시).
2. 같은 파일·같은 기능을 두 에이전트가 동시에 수정하지 않는다.
3. **작업 시작 전**: `git fetch` + `git status` + 최근 로그로 상대 에이전트의 변경을 확인하고, 미완성 작업 트리가 있으면 덮어쓰지 말고 사용자에게 확인한다.
4. **작업 종료 시(핸드오프)**: 커밋 메시지에 변경 파일 요약·검증 결과·남은 이슈를 남긴다. 검증 못 한 것은 "미검증"으로 명시한다.
5. 이 문서와 어긋나는 결정을 했다면 이 문서를 같은 커밋에서 갱신한다.

## 함정 (실제로 겪은 것)

- **Windows PowerShell 5.1로 소스 파일 내용을 읽고 쓰지 말 것** — UTF-8 한글이 깨진다(실제 사고).
  파일 조작은 에이전트의 파일 편집 도구로만. PowerShell은 복사/이동/git 용도로만.
- `app.json`의 `userInterfaceStyle`은 `automatic` 유지 (light로 두면 다크 모드 전체가 죽는다).
- 웹에서 드래그 제스처는 브라우저 텍스트 선택과 충돌 → App.js가 web에서 `user-select: none`을 주입한다. 제거 금지.
- `.xcworkspace`는 디렉터리다 — 셸에서 `ls -d`.

## 로드맵

- **v0.8.0 (예정)**: Firebase(Firestore + 익명 인증)로 실시간 공유 페이지. 초대 코드로 참여,
  공유 페이지만 클라우드/로컬 페이지는 AsyncStorage 유지. v0.7.0의 페이지 구조가 그 기반.
  사용자의 Firebase 콘솔 세팅(프로젝트/Firestore(서울)/익명 인증)과 firebaseConfig 전달이 선행되어야 한다.
- 장기: Apple 유료 계정 → TestFlight/App Store, Apple 로그인, (가능해지면) 위젯.

참고: Expo 공식 문서는 버전 고정 링크로 볼 것 — https://docs.expo.dev/versions/v54.0.0/
