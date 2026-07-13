import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Chip from './Chip';
import { hapticStep } from './haptics';
import PondDuck from './PondDuck';
import { useTheme } from './theme';

function Crumb({ x, y, onDone }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 1600,
      delay: 500,
      useNativeDriver: true,
    }).start(onDone);
  }, []);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{ position: 'absolute', left: x - 8, top: y - 8, fontSize: 15, opacity }}
    >
      🌾
    </Animated.Text>
  );
}

const HOUR_W = 60; // 1시간당 픽셀
const CHART_W = 24 * HOUR_W;
const ROW_H = 44;
const STEP_COLORS = ['#FFD93B', '#FFB84C', '#FF9E2C', '#F2812B', '#E06A10'];
const DAY_MS = 24 * 3600 * 1000;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function segmentsFor(todo, dayStart, dayEnd) {
  const tl = todo.timeline ?? [];
  const now = Date.now();
  const segs = [];
  for (let i = 0; i < tl.length; i++) {
    const e = tl[i];
    if (e.step === 'done') continue;
    const from = new Date(e.at).getTime();
    const next = tl[i + 1];
    const to = next ? new Date(next.at).getTime() : now < dayEnd ? now : dayEnd;
    const cf = Math.max(from, dayStart);
    const ct = Math.min(to, dayEnd);
    if (ct > cf) segs.push({ step: e.step, from: cf, to: ct, startAt: new Date(from) });
  }
  return segs;
}

const trackedMs = (todos, dayStart, dayEnd) =>
  todos.reduce(
    (sum, t) =>
      sum + segmentsFor(t, dayStart, dayEnd).reduce((a, s) => a + (s.to - s.from), 0),
    0,
  );

const hatchCount = (todos, dayStart, dayEnd) =>
  todos.reduce(
    (sum, t) =>
      sum +
      (t.timeline ?? []).filter((e) => {
        if (e.step !== 'done') return false;
        const at = new Date(e.at).getTime();
        return at >= dayStart && at < dayEnd;
      }).length,
    0,
  );

const fmtDuration = (ms) => {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
};

export default function DayView({ todos, allTodos, categories, weeklyGoal }) {
  const C = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [mode, setMode] = useState('day'); // 'day' | 'week' | 'month' | 'pond'
  const [date, setDate] = useState(startOfDay(new Date()));
  const [selectedDuck, setSelectedDuck] = useState(null);
  const [pondSize, setPondSize] = useState({ width: 0, height: 0 });
  const [feedSignal, setFeedSignal] = useState(null);
  const [crumbs, setCrumbs] = useState([]);
  const chartRef = useRef(null);

  const dayStart = date.getTime();
  const dayEnd = dayStart + DAY_MS;
  const isToday = startOfDay(new Date()).getTime() === dayStart;

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const move = (dir) => {
    const d = new Date(date);
    if (mode === 'day') d.setDate(d.getDate() + dir);
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(startOfDay(d));
  };

  // ---- 하루 (간트)
  const rows = useMemo(
    () =>
      todos
        .map((t) => ({ todo: t, segs: segmentsFor(t, dayStart, dayEnd) }))
        .filter((r) => r.segs.length > 0),
    [todos, dayStart, dayEnd],
  );

  // 차트 초기 스크롤: 오늘이면 현재 시각을 화면 가운데로, 다른 날은 첫 활동 위치로
  const chartVisibleW = Dimensions.get('window').width - 24 - 96;
  const desiredX = (() => {
    let x;
    if (isToday) {
      const nowH = (Date.now() - dayStart) / 3600000;
      x = nowH * HOUR_W - chartVisibleW / 2;
    } else {
      const firstHour = rows.length
        ? Math.min(...rows.map((r) => (r.segs[0].from - dayStart) / 3600000))
        : 8;
      x = (firstHour - 0.5) * HOUR_W;
    }
    return Math.min(Math.max(0, x), CHART_W - chartVisibleW);
  })();

  const scrollToDesired = () => chartRef.current?.scrollTo({ x: desiredX, animated: false });

  useEffect(() => {
    if (mode !== 'day') return;
    const t = setTimeout(scrollToDesired, 60);
    return () => clearTimeout(t);
  }, [dayStart, rows.length, mode]);

  // ---- 주간
  const week = useMemo(() => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // 일요일 시작
    const days = Array.from({ length: 7 }, (_, i) => {
      const ds = startOfDay(new Date(start.getTime() + i * DAY_MS)).getTime();
      return {
        date: new Date(ds),
        ms: trackedMs(todos, ds, ds + DAY_MS),
        hatched: hatchCount(todos, ds, ds + DAY_MS),
      };
    });
    return { start, days };
  }, [todos, dayStart]);

  // ---- 월간
  const month = useMemo(() => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = new Date(date.getFullYear(), date.getMonth(), d).getTime();
      cells.push({ day: d, hatched: hatchCount(todos, ds, ds + DAY_MS) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const totalHatched = cells.reduce((s, c) => s + (c?.hatched ?? 0), 0);
    return { cells, totalHatched };
  }, [todos, date]);

  const navLabel =
    mode === 'day'
      ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`
      : mode === 'week'
        ? `${week.start.getMonth() + 1}/${week.start.getDate()} ~ ${new Date(week.start.getTime() + 6 * DAY_MS).getMonth() + 1}/${new Date(week.start.getTime() + 6 * DAY_MS).getDate()}`
        : `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

  const weekMax = Math.max(...week.days.map((d) => d.ms), 1);
  const weekTotalMs = week.days.reduce((sum, d) => sum + d.ms, 0);
  const weekTotalHatched = week.days.reduce((sum, d) => sum + d.hatched, 0);

  // 주간 분류별 시간 합계
  const weekCatStats = useMemo(() => {
    const start = week.start.getTime();
    const end = start + 7 * DAY_MS;
    const byCat = new Map();
    todos.forEach((t) => {
      const ms = segmentsFor(t, start, end).reduce((a, seg) => a + (seg.to - seg.from), 0);
      if (!ms) return;
      const key = t.categoryId && catById[t.categoryId] ? t.categoryId : 'none';
      byCat.set(key, (byCat.get(key) ?? 0) + ms);
    });
    return [...byCat.entries()]
      .map(([key, ms]) => ({
        key,
        ms,
        name: key === 'none' ? '미분류' : catById[key].name,
        color: key === 'none' ? null : catById[key].color,
      }))
      .sort((a, b) => b.ms - a.ms);
  }, [todos, week, catById]);

  const heatColor = (n) =>
    n === 0
      ? 'transparent'
      : `rgba(255, 158, 44, ${Math.min(0.2 + n * 0.2, 0.85)})`;

  // ---- 연못: 지금까지 부화시킨 오리들 (모든 페이지)
  const [pondQuery, setPondQuery] = useState('');

  const hatched = useMemo(() => {
    const list = (allTodos ?? todos)
      .filter((t) => t.doneSteps >= t.totalSteps)
      .map((t) => {
        const doneEntry = [...(t.timeline ?? [])]
          .reverse()
          .find((e) => e.step === 'done');
        const cat = t.categoryId ? catById[t.categoryId] : null;
        return {
          id: t.id,
          title: t.title,
          totalSteps: t.totalSteps,
          categoryName: cat?.name ?? null,
          categoryColor: cat?.color ?? null,
          at: doneEntry ? new Date(doneEntry.at) : null,
        };
      })
      .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
    return list;
  }, [allTodos, todos, catById]);

  const pondQ = pondQuery.trim().toLowerCase();
  const filteredHatched = pondQ
    ? hatched.filter((h) => h.title.toLowerCase().includes(pondQ))
    : hatched;

  const newThisWeek = useMemo(() => {
    const start = week.start.getTime();
    return hatched.filter((h) => h.at && h.at.getTime() >= start).length;
  }, [hatched, week]);

  const MILESTONES = [1, 5, 10, 25, 50, 100, 200, 500, 1000];
  const currentMilestone = [...MILESTONES].reverse().find((m) => hatched.length >= m);
  const nextMilestone = MILESTONES.find((m) => m > hatched.length);

  const hashPos = (id, salt) => {
    let h = 7;
    const str = id + salt;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 100;
  };

  // 테두리를 둘러싼 풀/돌 장식: 윗쪽엔 풀, 아랫쪽엔 돌, 옆쪽엔 갈대
  const POND_DECOR = useMemo(() => {
    const items = [
      { emoji: '☀️', left: '88%', top: '3%', size: 22 },
      { emoji: '🪷', left: '14%', top: '82%', size: 24 },
      { emoji: '🪷', left: '68%', top: '88%', size: 18 },
    ];
    const grassEmojis = ['🌿', '🌾'];
    for (let i = 0; i < 6; i++) {
      items.push({
        emoji: grassEmojis[i % 2],
        left: `${4 + i * 15}%`,
        top: '0%',
        size: 18 + (i % 3) * 4,
        rotate: `${(i % 2 ? 1 : -1) * (8 + i * 2)}deg`,
      });
    }
    for (let i = 0; i < 5; i++) {
      items.push({
        emoji: '🪨',
        left: `${8 + i * 19}%`,
        top: '90%',
        size: 16 + (i % 2) * 6,
      });
    }
    items.push({ emoji: '🌾', left: '2%', top: '40%', size: 20, rotate: '-20deg' });
    items.push({ emoji: '🌾', left: '95%', top: '55%', size: 20, rotate: '20deg' });
    return items;
  }, []);

  const handleFeed = () => {
    if (!pondSize.width) return;
    hapticStep();
    const fx = pondSize.width / 2;
    const fy = pondSize.height * 0.88;
    setFeedSignal({ token: Date.now(), until: Date.now() + 5000 });
    setCrumbs((prev) => [
      ...prev,
      ...[0, 1, 2].map((i) => ({
        id: Date.now() + i,
        x: fx + (Math.random() - 0.5) * 46,
        y: fy + (Math.random() - 0.5) * 18,
      })),
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.tabs}>
        <Chip label="하루" active={mode === 'day'} onPress={() => setMode('day')} />
        <Chip label="주간" active={mode === 'week'} onPress={() => setMode('week')} />
        <Chip label="월간" active={mode === 'month'} onPress={() => setMode('month')} />
        <Chip label="연못" active={mode === 'pond'} onPress={() => setMode('pond')} />
      </View>

      <View style={[s.nav, mode === 'pond' && { display: 'none' }]}>
        <Pressable style={s.navBtn} onPress={() => move(-1)} hitSlop={8}>
          <Text style={s.navBtnText}>◀</Text>
        </Pressable>
        <Text style={s.navDate}>{navLabel}</Text>
        <Pressable style={s.navBtn} onPress={() => move(1)} hitSlop={8}>
          <Text style={s.navBtnText}>▶</Text>
        </Pressable>
        {!isToday && (
          <Pressable style={s.todayBtn} onPress={() => setDate(startOfDay(new Date()))}>
            <Text style={s.todayBtnText}>오늘</Text>
          </Pressable>
        )}
      </View>

      {mode === 'day' &&
        (rows.length === 0 ? (
          <View style={s.emptyBox}>
            <Image source={require('../assets/mascot.png')} style={s.emptyDuck} />
            <Text style={s.empty}>이 날은 진행한 알이 없어요, 꽥!</Text>
          </View>
        ) : (
          <ScrollView style={s.body}>
            <View style={s.chartArea}>
              <View style={s.titleCol}>
                <View style={s.axisSpacer} />
                {rows.map(({ todo }) => (
                  <View key={todo.id} style={s.titleCell}>
                    {catById[todo.categoryId] ? (
                      <View
                        style={[s.titleDot, { backgroundColor: catById[todo.categoryId].color }]}
                      />
                    ) : null}
                    <Text style={s.titleText} numberOfLines={2}>
                      {todo.title}
                    </Text>
                  </View>
                ))}
              </View>
              <ScrollView
                horizontal
                ref={chartRef}
                showsHorizontalScrollIndicator
                onContentSizeChange={scrollToDesired}
              >
                <View style={{ width: CHART_W + 20 }}>
                  <View style={s.axisRow}>
                    {Array.from({ length: 25 }, (_, h) => (
                      <Text key={h} style={[s.axisLabel, { left: h * HOUR_W - 14 }]}>
                        {pad(h)}시
                      </Text>
                    ))}
                  </View>
                  <View>
                    {Array.from({ length: 25 }, (_, h) => (
                      <View key={h} style={[s.gridLine, { left: h * HOUR_W }]} />
                    ))}
                    {isToday && (
                      <View
                        style={[
                          s.nowLine,
                          { left: ((Date.now() - dayStart) / 3600000) * HOUR_W },
                        ]}
                      />
                    )}
                    {rows.map(({ todo, segs }) => (
                      <View key={todo.id} style={s.barRow}>
                        {segs.map((seg, i) => {
                          const left = ((seg.from - dayStart) / 3600000) * HOUR_W;
                          const width = Math.max(
                            6,
                            ((seg.to - seg.from) / 3600000) * HOUR_W,
                          );
                          const label =
                            width > 86
                              ? `${seg.step}단계 ${fmtTime(seg.startAt)}`
                              : width > 44
                                ? fmtTime(seg.startAt)
                                : '';
                          return (
                            <View
                              key={i}
                              style={[
                                s.seg,
                                {
                                  left,
                                  width,
                                  backgroundColor:
                                    STEP_COLORS[(seg.step - 1) % STEP_COLORS.length],
                                },
                              ]}
                            >
                              {label ? (
                                <Text style={s.segText} numberOfLines={1}>
                                  {label}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>

            <Text style={s.detailHeading}>기록</Text>
            {rows.map(({ todo, segs }) => (
              <View key={todo.id} style={s.detailRow}>
                <Text style={s.detailTitle}>{todo.title}</Text>
                <Text style={s.detailTimes}>
                  {segs
                    .map((seg) => `${seg.step}단계 ${fmtTime(new Date(seg.from))}`)
                    .join(' → ')}
                  {todo.timeline?.some((e) => e.step === 'done')
                    ? ` → 완료 ${fmtTime(
                        new Date(todo.timeline[todo.timeline.length - 1].at),
                      )}`
                    : ' → 진행 중'}
                </Text>
              </View>
            ))}
          </ScrollView>
        ))}

      {mode === 'week' && (
        <ScrollView style={s.body}>
          <View style={s.statCard}>
            <Text style={s.statSummary}>
              이번 주 부화 {weekTotalHatched}마리 · 총 {fmtDuration(weekTotalMs)}
            </Text>
            {weeklyGoal ? (
              <View style={s.goalBox}>
                <Text style={s.goalText}>
                  주간 목표 {Math.min(weekTotalHatched, weeklyGoal)}/{weeklyGoal}마리
                  {weekTotalHatched >= weeklyGoal ? ' 달성! 🎉' : ''}
                </Text>
                <View style={s.goalTrack}>
                  <View
                    style={[
                      s.goalFill,
                      { width: `${Math.min(100, (weekTotalHatched / weeklyGoal) * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            ) : null}
            <View style={s.weekChart}>
              {week.days.map((d, i) => {
                const h = Math.round((d.ms / weekMax) * 110);
                const today = startOfDay(new Date()).getTime() === d.date.getTime();
                return (
                  <View key={i} style={s.weekCol}>
                    {d.ms > 0 && (
                      <Text style={s.weekValue}>{fmtDuration(d.ms)}</Text>
                    )}
                    <View style={[s.weekBar, { height: Math.max(d.ms > 0 ? 6 : 2, h) }]} />
                    <Text style={[s.weekDay, today && s.weekDayToday]}>
                      {DAY_NAMES[d.date.getDay()]}
                    </Text>
                    <Text style={s.weekDate}>{d.date.getDate()}</Text>
                    <Text style={s.weekHatch}>{d.hatched > 0 ? `🐥${d.hatched}` : ' '}</Text>
                  </View>
                );
              })}
            </View>
            {weekCatStats.length > 0 && (
              <View style={s.catStats}>
                {weekCatStats.map((cs) => (
                  <View key={cs.key} style={s.catStatRow}>
                    <View
                      style={[
                        s.titleDot,
                        { backgroundColor: cs.color ?? C.faint },
                      ]}
                    />
                    <Text style={s.catStatName}>{cs.name}</Text>
                    <Text style={s.catStatMs}>{fmtDuration(cs.ms)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {mode === 'month' && (
        <ScrollView style={s.body}>
          <View style={s.statCard}>
            <Text style={s.statSummary}>이번 달 부화 {month.totalHatched}마리</Text>
            <View style={s.monthHead}>
              {DAY_NAMES.map((n) => (
                <Text key={n} style={s.monthHeadCell}>
                  {n}
                </Text>
              ))}
            </View>
            <View style={s.monthGrid}>
              {month.cells.map((cell, i) => (
                <View
                  key={i}
                  style={[s.monthCell, cell && { backgroundColor: heatColor(cell.hatched) }]}
                >
                  {cell && (
                    <>
                      <Text style={s.monthDay}>{cell.day}</Text>
                      {cell.hatched > 0 && (
                        <Text style={s.monthCount}>{cell.hatched}</Text>
                      )}
                    </>
                  )}
                </View>
              ))}
            </View>
            <Text style={s.monthHint}>색이 진할수록 그 날 많이 부화했어요</Text>
          </View>
        </ScrollView>
      )}

      {mode === 'pond' && (
        <ScrollView style={s.body}>
          <View style={s.pondHeadRow}>
            <Text style={s.pondCount}>🐥 {hatched.length}마리</Text>
            {newThisWeek > 0 && (
              <Text style={s.pondNew}>이번 주 +{newThisWeek}마리</Text>
            )}
          </View>

          {currentMilestone && (
            <View style={s.milestoneBox}>
              <Text style={s.milestoneText}>
                🏅 {currentMilestone}마리 달성!
                {nextMilestone
                  ? ` 다음 목표 ${nextMilestone}마리까지 ${nextMilestone - hatched.length}마리 남았어요`
                  : ' 최고 기록이에요, 꽥!'}
              </Text>
              {nextMilestone && (
                <View style={s.goalTrack}>
                  <View
                    style={[
                      s.goalFill,
                      {
                        width: `${Math.min(100, ((hatched.length - currentMilestone) / (nextMilestone - currentMilestone)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          )}

          <View
            style={s.pondCard}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setPondSize({ width, height });
            }}
          >
            <View style={[s.pondBand, s.pondBandTop]} />
            <View style={[s.pondBand, s.pondBandBottom]} />
            {POND_DECOR.map((d, i) => (
              <Text
                key={i}
                style={[
                  s.pondDeco,
                  {
                    left: d.left,
                    top: d.top,
                    fontSize: d.size,
                    transform: d.rotate ? [{ rotate: d.rotate }] : undefined,
                  },
                ]}
              >
                {d.emoji}
              </Text>
            ))}
            {pondSize.width > 0 &&
              filteredHatched.slice(0, 40).map((h) => (
                <PondDuck
                  key={h.id}
                  duck={h}
                  pondSize={pondSize}
                  feedSignal={feedSignal}
                  onSelect={setSelectedDuck}
                  baseSize={30 + (hashPos(h.id, 's') % 10)}
                />
              ))}
            {crumbs.map((c) => (
              <Crumb
                key={c.id}
                x={c.x}
                y={c.y}
                onDone={() => setCrumbs((prev) => prev.filter((p) => p.id !== c.id))}
              />
            ))}
            {hatched.length === 0 && (
              <View style={s.pondEmpty}>
                <Image source={require('../assets/egg-0.png')} style={s.pondEmptyEgg} />
                <Text style={s.pondEmptyText}>
                  아직 연못이 비어 있어요.{'\n'}첫 알을 부화시켜 보세요!
                </Text>
              </View>
            )}
            {hatched.length > 0 && filteredHatched.length === 0 && (
              <View style={s.pondEmpty}>
                <Text style={s.pondEmptyText}>그런 오리는 없어요, 꽥!</Text>
              </View>
            )}
          </View>

          {hatched.length > 0 && (
            <Pressable testID="feed-btn" style={s.feedBtn} onPress={handleFeed}>
              <Text style={s.feedBtnText}>🌾 먹이 주기</Text>
            </Pressable>
          )}

          {hatched.length > 8 && (
            <View style={s.pondSearchBar}>
              <TextInput
                style={s.pondSearchInput}
                value={pondQuery}
                onChangeText={setPondQuery}
                placeholder="부화시킨 오리 이름으로 검색..."
                placeholderTextColor={C.faint}
              />
            </View>
          )}

          {selectedDuck && (
            <View style={s.duckInfo}>
              <Image source={require('../assets/chick.png')} style={s.duckInfoImg} />
              <View style={{ flex: 1 }}>
                <Text style={s.duckInfoTitle}>{selectedDuck.title}</Text>
                <Text style={s.duckInfoDate}>
                  {selectedDuck.at
                    ? `${selectedDuck.at.getFullYear()}.${selectedDuck.at.getMonth() + 1}.${selectedDuck.at.getDate()} 부화`
                    : '부화 시각 기록 없음'}
                  {selectedDuck.totalSteps > 1 ? ` · ${selectedDuck.totalSteps}단계` : ''}
                </Text>
                {selectedDuck.categoryName && (
                  <View style={s.duckInfoCatRow}>
                    <View
                      style={[s.titleDot, { backgroundColor: selectedDuck.categoryColor }]}
                    />
                    <Text style={s.duckInfoCat}>{selectedDuck.categoryName}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {filteredHatched.length > 40 && (
            <Text style={s.pondMore}>최근 40마리만 헤엄치고 있어요</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 2,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  navBtnText: {
    fontSize: 13,
    color: C.sub,
  },
  navDate: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  todayBtn: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: C.orange,
  },
  todayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 70,
  },
  emptyDuck: {
    width: 130,
    height: 130,
    marginBottom: 14,
  },
  empty: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: C.faint,
  },
  chartArea: {
    flexDirection: 'row',
    marginHorizontal: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  titleCol: {
    width: 96,
    borderRightWidth: 1.5,
    borderRightColor: C.border,
  },
  axisSpacer: {
    height: 22,
  },
  titleCell: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  titleDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  titleText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: C.text,
  },
  axisRow: {
    height: 22,
  },
  axisLabel: {
    position: 'absolute',
    top: 2,
    fontSize: 10,
    fontWeight: '700',
    color: C.faint,
    width: 30,
    textAlign: 'center',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: C.bg,
  },
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: C.danger,
    opacity: 0.6,
  },
  barRow: {
    height: ROW_H,
    justifyContent: 'center',
  },
  seg: {
    position: 'absolute',
    top: 8,
    height: ROW_H - 16,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailHeading: {
    marginTop: 16,
    marginBottom: 4,
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '800',
    color: C.sub,
  },
  detailRow: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  detailTimes: {
    marginTop: 3,
    fontSize: 12,
    color: C.sub,
  },
  statCard: {
    marginHorizontal: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 14,
  },
  statSummary: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
    marginBottom: 14,
  },
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weekValue: {
    fontSize: 9,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 3,
  },
  weekBar: {
    width: 18,
    borderRadius: 4,
    backgroundColor: C.orange,
  },
  weekDay: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
  },
  weekDayToday: {
    color: C.orange,
  },
  weekDate: {
    fontSize: 10,
    color: C.faint,
  },
  weekHatch: {
    marginTop: 2,
    fontSize: 10,
    color: C.sub,
  },
  catStats: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  catStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  catStatName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginLeft: 3,
  },
  catStatMs: {
    fontSize: 13,
    color: C.sub,
  },
  goalBox: {
    marginBottom: 12,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 5,
  },
  goalTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.inputBg,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: C.orange,
  },
  pondHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pondCount: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
  },
  pondNew: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: C.orange,
  },
  milestoneBox: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 6,
  },
  pondCard: {
    marginHorizontal: 12,
    height: 360,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.pond,
    overflow: 'hidden',
  },
  pondBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  pondBandTop: {
    top: 0,
    height: '45%',
    backgroundColor: '#FFFFFF',
    opacity: 0.16,
  },
  pondBandBottom: {
    bottom: 0,
    height: '30%',
    backgroundColor: '#000000',
    opacity: 0.08,
  },
  pondDeco: {
    position: 'absolute',
    opacity: 0.85,
  },
  feedBtn: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  feedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pondSearchBar: {
    marginHorizontal: 12,
    marginTop: 10,
  },
  pondSearchInput: {
    height: 40,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.text,
  },
  pondEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pondEmptyEgg: {
    width: 70,
    height: 70,
    marginBottom: 10,
  },
  pondEmptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: C.sub,
  },
  duckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
  },
  duckInfoImg: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  duckInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
  },
  duckInfoDate: {
    marginTop: 2,
    fontSize: 12,
    color: C.sub,
  },
  duckInfoCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  duckInfoCat: {
    fontSize: 12,
    fontWeight: '700',
    color: C.sub,
    marginLeft: 3,
  },
  pondMore: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: C.faint,
  },
  monthHead: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  monthHeadCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  monthDay: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
  },
  monthCount: {
    fontSize: 9,
    fontWeight: '800',
    color: C.sub,
  },
  monthHint: {
    marginTop: 8,
    fontSize: 11,
    color: C.faint,
  },
});
