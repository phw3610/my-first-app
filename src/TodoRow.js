import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import EggIcon from './EggIcon';
import { hapticHatch } from './haptics';
import { dateStr } from './repeat';
import { useTheme } from './theme';
import { fmtReminderShort, isDone, isStarted } from './utils';

export default function TodoRow({
  item,
  isDragging,
  sortLocked,
  onLayout,
  onEdit,
  onStartDrag,
  onPressOut,
  onAdvance,
  onSetArchived,
}) {
  const C = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const translateX = useRef(new Animated.Value(0)).current;
  const eggScale = useRef(new Animated.Value(1)).current;
  const itemRef = useRef(item);
  itemRef.current = item;
  const done = isDone(item);
  const prevDone = useRef(done);
  const swipingRef = useRef(false);
  const lastSwipeAt = useRef(0);

  // 부화 순간: 햅틱 + 알이 통통 튀는 애니메이션
  useEffect(() => {
    if (done && !prevDone.current) {
      hapticHatch();
      Animated.sequence([
        Animated.spring(eggScale, {
          toValue: 1.7,
          speed: 24,
          bounciness: 16,
          useNativeDriver: true,
        }),
        Animated.spring(eggScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    prevDone.current = done;
  }, [done]);

  // 좌우 스와이프: 오른쪽 = 다음 단계, 왼쪽 = 완료 보내기/되돌리기
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_, g) => {
        swipingRef.current = true;
        translateX.setValue(Math.max(-100, Math.min(100, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const t = itemRef.current;
        if (g.dx > 70 && !isDone(t)) onAdvance(t.id);
        else if (g.dx < -70) {
          if (isDone(t) && !t.archived) onSetArchived(t.id, true);
          else if (t.archived) onSetArchived(t.id, false);
        }
        swipingRef.current = false;
        lastSwipeAt.current = Date.now();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        swipingRef.current = false;
        lastSwipeAt.current = Date.now();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // 스와이프 직후의 탭/롱프레스 오인식 방지
  const guardedEdit = () => {
    if (swipingRef.current || Date.now() - lastSwipeAt.current < 400) return;
    onEdit();
  };
  const guardedDrag = () => {
    if (swipingRef.current || Date.now() - lastSwipeAt.current < 400) return;
    onStartDrag();
  };

  const current = !done ? item.steps?.[item.doneSteps] : null;
  const overdue = item.dueDate && item.dueDate < dateStr() && !done;
  const remLabel = item.reminder?.at ? fmtReminderShort(item.reminder.at) : null;
  const hasMeta =
    item.totalSteps > 1 ||
    current?.text ||
    current?.attachments?.length ||
    item.dueDate ||
    remLabel;

  return (
    <Animated.View
      onLayout={onLayout}
      {...swipe.panHandlers}
      style={[s.row, isDragging && s.rowDragging, { transform: [{ translateX }] }]}
    >
      <Pressable
        style={s.rowInner}
        onPress={guardedEdit}
        onLongPress={sortLocked ? undefined : guardedDrag}
        onPressOut={onPressOut}
        delayLongPress={220}
      >
        <Animated.View style={{ transform: [{ scale: eggScale }] }}>
          <EggIcon total={item.totalSteps} done={item.doneSteps} />
        </Animated.View>
        <View style={s.rowBody}>
          <Text style={[s.rowText, done && s.rowTextDone]}>
            {item.title}
            {item.repeat ? ' 🔁' : ''}
          </Text>
          {hasMeta && !done && (
            <View style={s.progressRow}>
              {item.dueDate && (
                <Text style={[s.dueBadge, overdue && s.dueBadgeOver]}>
                  📅 {Number(item.dueDate.slice(5, 7))}/{Number(item.dueDate.slice(8, 10))}
                  {overdue ? ' 지남!' : ''}
                </Text>
              )}
              {remLabel && <Text style={s.dueBadge}>⏰ {remLabel}</Text>}
              {item.totalSteps > 1 && (
                <>
                  {Array.from({ length: item.totalSteps }, (_, i) => (
                    <View
                      key={i}
                      style={[s.progressDot, i < item.doneSteps && s.progressDotDone]}
                    />
                  ))}
                  <Text style={s.progressText}>
                    {item.doneSteps}/{item.totalSteps} 단계
                  </Text>
                </>
              )}
              {current?.text || current?.attachments?.length ? (
                <Text style={s.stepHint} numberOfLines={1}>
                  {item.totalSteps > 1 || item.dueDate || remLabel ? ' · ' : ''}
                  {current.text}
                  {current.attachments?.length ? ` 📎${current.attachments.length}` : ''}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
      {!done ? (
        <Pressable
          accessibilityLabel="다음 단계"
          style={s.nextBtn}
          onPress={() => onAdvance(item.id)}
          hitSlop={6}
        >
          <Text style={s.nextBtnText}>{isStarted(item) ? '❯' : '▶'}</Text>
        </Pressable>
      ) : !item.archived ? (
        <Pressable
          accessibilityLabel="완료로 보내기"
          style={s.archiveBtn}
          onPress={() => onSetArchived(item.id, true)}
          hitSlop={6}
        >
          <Text style={s.nextBtnText}>✓</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="되돌리기"
          style={s.unarchiveBtn}
          onPress={() => onSetArchived(item.id, false)}
          hitSlop={6}
        >
          <Text style={s.unarchiveBtnText}>↩</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDragging: {
    opacity: 0.35,
  },
  rowBody: {
    flex: 1,
    marginLeft: 11,
  },
  rowText: {
    fontSize: 16,
    color: C.text,
  },
  rowTextDone: {
    color: C.done,
    textDecorationLine: 'line-through',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  progressDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 4,
  },
  progressDotDone: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  progressText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
  },
  stepHint: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: C.faint,
  },
  dueBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
    marginRight: 4,
  },
  dueBadgeOver: {
    color: C.danger,
  },
  nextBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  archiveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unarchiveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unarchiveBtnText: {
    color: C.sub,
    fontSize: 15,
    fontWeight: '800',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
