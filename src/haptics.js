import { Platform } from 'react-native';

const get = () => {
  if (Platform.OS === 'web') return null;
  return require('expo-haptics');
};

export const hapticStep = () => {
  const H = get();
  if (H) H.impactAsync(H.ImpactFeedbackStyle.Light).catch(() => {});
};

export const hapticHatch = () => {
  const H = get();
  if (H) H.notificationAsync(H.NotificationFeedbackType.Success).catch(() => {});
};
