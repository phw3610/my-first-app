# 에셋 원본

- `hatch-set.png` — 사용자 제공 알 5단계 + 부화 오리 시트 (→ assets/egg-0~4.png, chick.png).
  체커보드가 박혀 있어 가장자리 flood-fill로 중립 회백색 제거 후 크롭한다.
- `mascot-src.png` — 사용자 제공 헤더 마스코트 원본 (→ assets/mascot.png, 같은 방식으로 처리)
- `duck.html` / `eggs.html` — 구버전 SVG 원본 (스플래시 splash-icon.png는 아직 duck.html의 #fg 사용)

수정 후 PNG로 다시 뽑는 방법: Playwright로 각 `<svg>` 요소를 스크린샷 찍어서
`assets/`에 복사한다 (아이콘은 배경 포함 `#icon`, 나머지는 `omitBackground: true`).

- `duck.html` → `assets/icon.png`(#icon), `assets/splash-icon.png` · `adaptive-icon.png` · `chick.png`(#fg)
- `eggs.html` → `assets/egg-0.png` ~ `egg-3.png` (#e0~#e3)
