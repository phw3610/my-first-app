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
import { hapticHatch, hapticStep } from './haptics';
import { dateStr } from './repeat';
import { playQuack } from './sound';
import { useTheme } from './theme';
import { fmtReminderShort, isDone, isStarted } from './utils';

const REVEAL_WIDTH = 84;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function TodoRow({
  item,
  isDragging,
  sortLocked,
  isSwipeOpen,
  anySwipeOpen,
  onSwipeOpenChange,
  onDeleteSwipe,
  onLayout,
  onEdit,
  onStartDrag,
  onPressOut,
  onAdvance,
  onSetArchived,
  soundOn,
  selectMode,
  selected,
  onToggleSelect,
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
  const startXRef = useRef(0);
  // PanResponder 콜백은 최초 렌더 시점 클로저에 갇히므로, 매 렌더마다 최신값을 ref로 반영해 참조한다.
  const selectModeRef = useRef(selectMode);
  selectModeRef.current = selectMode;
  const isSwipeOpenRef = useRef(isSwipeOpen);
  isSwipeOpenRef.current = isSwipeOpen;

  // 부화 순간: 햅틱 + 알이 통통 튀는 애니메이션
  useEffect(() => {
    if (done && !prevDone.current) {
      hapticHatch();
      if (soundOn) playQuack();
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

  // 열림/닫힘 목표 위치로 애니메이션 (드래그 중이 아닐 때: 외부에서 닫혔을 때 포함)
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: isSwipeOpen ? REVEAL_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [isSwipeOpen]);

  // 오른쪽으로 쓸면 삭제 버튼 노출, 열린 상태에서 왼쪽으로 쓸면 닫힘
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !selectModeRef.current &&
        Math.abs(g.dx) > 12 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderGrant: () => {
        startXRef.current = isSwipeOpenRef.current ? REVEAL_WIDTH : 0;
      },
      onPanResponderMove: (_, g) => {
        swipingRef.current = true;
        translateX.setValue(clamp(startXRef.current + g.dx, 0, REVEAL_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        const finalX = clamp(startXRef.current + g.dx, 0, REVEAL_WIDTH);
        const shouldOpen = finalX > REVEAL_WIDTH * 0.4;
        if (shouldOpen && !isSwipeOpenRef.current) hapticStep();
        onSwipeOpenChange(shouldOpen);
        swipingRef.current = false;
        lastSwipeAt.current = Date.now();
      },
      onPanResponderTerminate: () => {
        onSwipeOpenChange(false);
        swipingRef.current = false;
        lastSwipeAt.current = Date.now();
      },
    }),
  ).current;

  // 스와이프 직후의 탭/롱프레스 오인식 방지 + 열려 있으면 탭으로 닫기
  const guardedEdit = () => {
    if (swipingRef.current || Date.now() - lastSwipeAt.current < 400) return;
    if (selectMode) {
      onToggleSelect(item.id);
      return;
    }
    if (anySwipeOpen) {
      onSwipeOpenChange(false);
      return;
    }
    onEdit();
  };
  const guardedDrag = () => {
    if (swipingRef.current || Date.now() - lastSwipeAt.current < 400) return;
    if (selectMode || anySwipeOpen) {
      if (anySwipeOpen) onSwipeOpenChange(false);
      return;
    }
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
    <View style={s.rowWrap} onLayout={onLayout}>
      <View style={s.deleteLayer}>
        <Pressable
          testID={`delete-${item.id}`}
          accessibilityLabel="삭제"
          style={s.deleteBtn}
          onPress={() => onDeleteSwipe(item.id)}
        >
          <Text style={s.deleteIcon}>🗑️</Text>
          <Text style={s.deleteLabel}>삭제</Text>
        </Pressable>
      </View>
      <Animated.View
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
          {selectMode && (
            <View style={[s.checkCircle, selected && s.checkCircleOn]}>
              {selected && <Text style={s.checkMark}>✓</Text>}
            </View>
          )}
          <Animated.View style={{ transform: [{ scale: eggScale }] }}>
            <EggIcon total={item.totalSteps} done={item.doneSteps} />
          </Animated.View>
          <View style={s.rowBody}>
            <Text style={[s.rowText, done && s.rowTextDone]}>
              {item.pinned ? '📌 ' : ''}
              {item.important ? '⭐ ' : ''}
              {item.title}
              {item.repeat ? ' 🔁' : ''}
              {item.note?.trim() ? ' 📝' : ''}
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
        {!selectMode && (!done ? (
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
        ))}
      </Animated.View>
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
  rowWrap: {
    position: 'relative',
    marginTop: 8,
  },
  deleteLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.danger,
  },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  deleteLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDragging: {
    opacity: 0.35,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkCircleOn: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
