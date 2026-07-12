let player = null;

// 부화 효과음 (설정에서 끌 수 있음). 실패해도 앱 동작에 영향 없음.
export function playQuack() {
  try {
    const { createAudioPlayer } = require('expo-audio');
    if (!player) player = createAudioPlayer(require('../assets/quack.wav'));
    player.seekTo(0);
    player.play();
  } catch (e) {
    // 오디오 미지원 환경은 조용히 무시
  }
}
