import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C } from './theme';

const HOUR_W = 60; // 1시간당 픽셀
const CHART_W = 24 * HOUR_W;
const ROW_H = 44;
const STEP_COLORS = ['#FFD93B', '#FFB84C', '#FF9E2C', '#F2812B', '#E06A10'];

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

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
    let to;
    if (next) {
      to = new Date(next.at).getTime();
    } else {
      // 진행 중인 단계: 오늘이면 지금까지, 지난 날이면 그 날 끝까지
      to = now < dayEnd ? now : dayEnd;
    }
    const cf = Math.max(from, dayStart);
    const ct = Math.min(to, dayEnd);
    if (ct > cf) {
      segs.push({ step: e.step, from: cf, to: ct, startAt: new Date(from) });
    }
  }
  return segs;
}

export default function DayView({ todos, categories }) {
  const [date, setDate] = useState(startOfDay(new Date()));
  const chartRef = useRef(null);

  const dayStart = date.getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const isToday = startOfDay(new Date()).getTime() === dayStart;

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const rows = useMemo(
    () =>
      todos
        .map((t) => ({ todo: t, segs: segmentsFor(t, dayStart, dayEnd) }))
        .filter((r) => r.segs.length > 0),
    [todos, dayStart, dayEnd],
  );

  useEffect(() => {
    if (!chartRef.current) return;
    const firstHour = rows.length
      ? Math.min(...rows.map((r) => (r.segs[0].from - dayStart) / 3600000))
      : 8;
    const x = Math.max(0, (firstHour - 0.5) * HOUR_W);
    setTimeout(() => chartRef.current?.scrollTo({ x, animated: false }), 50);
  }, [dayStart, rows.length]);

  const moveDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(startOfDay(d));
  };

  const dateLabel = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <Pressable style={s.navBtn} onPress={() => moveDay(-1)} hitSlop={8}>
          <Text style={s.navBtnText}>◀</Text>
        </Pressable>
        <Text style={s.navDate}>{dateLabel}</Text>
        <Pressable style={s.navBtn} onPress={() => moveDay(1)} hitSlop={8}>
          <Text style={s.navBtnText}>▶</Text>
        </Pressable>
        {!isToday && (
          <Pressable style={s.todayBtn} onPress={() => setDate(startOfDay(new Date()))}>
            <Text style={s.todayBtnText}>오늘</Text>
          </Pressable>
        )}
      </View>

      {rows.length === 0 ? (
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
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
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
});
