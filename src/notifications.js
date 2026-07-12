import { Platform } from 'react-native';

function getNotifications() {
  if (Platform.OS === 'web') return null;
  return require('expo-notifications');
}

let handlerSet = false;
function ensureHandler(Notifications) {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// 예약 성공 시 notificationId, 웹이면 null 반환
export async function scheduleReminder(title, date) {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  ensureHandler(Notifications);
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('알림 권한이 필요해요');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '꽥! 부화시킬 시간이에요',
      body: `🥚 ${title}`,
      sound: true,
    },
    trigger: { type: 'date', date },
  });
}

// 주간 리포트: 다음 일요일 20:00 일회성 예약 (앱을 열 때마다 최신 내용으로 재예약)
export async function scheduleWeeklyReport(body) {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  ensureHandler(Notifications);
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('알림 권한이 필요해요');
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return Notifications.scheduleNotificationAsync({
    content: { title: '주간 리포트 꽥! 🦆', body, sound: true },
    trigger: { type: 'date', date: d },
  });
}

// 남은 알 개수를 앱 아이콘 배지로 (알림 권한이 이미 있을 때만, 권한 팝업 없이)
export async function updateBadge(count) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return;
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    // 배지 실패는 무시
  }
}

export async function cancelReminder(notificationId) {
  if (!notificationId) return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
