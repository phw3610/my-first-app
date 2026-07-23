import { Platform } from 'react-native';
import { dateStr } from './repeat';
import { isDone, isStarted } from './utils';

function getBridge() {
  if (Platform.OS !== 'ios') return null;
  return require('../modules/widget-bridge').default;
}

// 홈 화면 위젯이 읽을 데이터 스냅샷을 App Group 공유 컨테이너에 쓴다.
// "오늘 할일"과 "분류별 미완료" 위젯 둘 다 이 스냅샷 하나를 공유한다.
export function syncWidgets(data) {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    const today = dateStr();
    const categories = (data.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));
    const todos = data.todos
      .filter((t) => !t.archived && !isDone(t))
      .sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryId: t.categoryId ?? null,
        totalSteps: t.totalSteps,
        doneSteps: t.doneSteps,
        important: !!t.important,
        pinned: !!t.pinned,
        isToday:
          t.dueDate === today ||
          (t.reminder?.at && dateStr(new Date(t.reminder.at)) === today) ||
          isStarted(t),
      }));
    bridge.syncWidgetData(
      JSON.stringify({ updatedAt: new Date().toISOString(), categories, todos }),
    );
  } catch (e) {
    // 위젯 동기화 실패는 앱 동작에 영향 주지 않음
  }
}
