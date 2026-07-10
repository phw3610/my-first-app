import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Chip from './Chip';
import { C } from './theme';

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

export default function DayView({ todos, categories }) {
  const [mode, setMode] = useState('day'); // 'day' | 'week' | 'month'
  const [date, setDate] = useState(startOfDay(new Date()));
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

  useEffect(() => {
    if (mode !== 'day' || !chartRef.current) return;
    const firstHour = rows.length
      ? Math.min(...rows.map((r) => (r.segs[0].from - dayStart) / 3600000))
      : 8;
    const x = Math.max(0, (firstHour - 0.5) * HOUR_W);
    setTimeout(() => chartRef.current?.scrollTo({ x, animated: false }), 50);
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
  const weekTotalMs = week.days.reduce((s, d) => s + d.ms, 0);
  const weekTotalHatched = week.days.reduce((s, d) => s + d.hatched, 0);

  const heatColor = (n) =>
    n === 0
      ? 'transparent'
      : `rgba(255, 158, 44, ${Math.min(0.2 + n * 0.2, 0.85)})`;

  return (
    <View style={s.container}>
      <View style={s.tabs}>
        <Chip label="하루" active={mode === 'day'} onPress={() => setMode('day')} />
        <Chip label="주간" active={mode === 'week'} onPress={() => setMode('week')} />
        <Chip label="월간" active={mode === 'month'} onPress={() => setMode('month')} />
      </View>

      <View style={s.nav}>
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
            <Text style={s.emptyDuck}>🐥</Text>
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
              <ScrollView horizontal ref={chartRef} showsHorizontalScrollIndicator>
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
    </View>
  );
}

const s = StyleSheet.create({
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
