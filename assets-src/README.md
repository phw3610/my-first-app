# 에셋 원본

앱 아이콘/스플래시(`duck.html`)와 알 단계 이미지(`eggs.html`)의 SVG 원본.

수정 후 PNG로 다시 뽑는 방법: Playwright로 각 `<svg>` 요소를 스크린샷 찍어서
`assets/`에 복사한다 (아이콘은 배경 포함 `#icon`, 나머지는 `omitBackground: true`).

- `duck.html` → `assets/icon.png`(#icon), `assets/splash-icon.png` · `adaptive-icon.png` · `chick.png`(#fg)
- `eggs.html` → `assets/egg-0.png` ~ `egg-3.png` (#e0~#e3)
