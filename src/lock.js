import { Platform } from 'react-native';

// Face ID / Touch ID / 기기 암호로 인증. 사용할 수 없는 기기면 잠그지 않는다.
export async function authenticate() {
  if (Platform.OS === 'web') return true;
  try {
    const LA = require('expo-local-authentication');
    const hasHardware = await LA.hasHardwareAsync();
    const enrolled = hasHardware && (await LA.isEnrolledAsync());
    if (!enrolled) return true;
    const res = await LA.authenticateAsync({
      promptMessage: '잠금 해제',
      cancelLabel: '취소',
    });
    return res.success;
  } catch (e) {
    return true;
  }
}
