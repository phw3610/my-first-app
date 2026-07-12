import { dateStr } from './repeat';

export const isDone = (t) => t.doneSteps >= t.totalSteps;
export const isStarted = (t) => (t.timeline?.length ?? 0) > 0 || t.doneSteps > 0;

// 연속 부화 일수: 오늘(아직 없으면 어제)부터 거꾸로 이어지는 부화 날짜 수
export function hatchStreak(todos) {
  const days = new Set();
  todos.forEach((t) =>
    (t.timeline ?? []).forEach((e) => {
      if (e.step === 'done') days.add(dateStr(new Date(e.at)));
    }),
  );
  let streak = 0;
  const d = new Date();
  if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1);
  while (days.has(dateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// 이번 주(일요일 시작) 부화 수
export function weekHatchCount(todos) {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  return todos.reduce(
    (sum, t) =>
      sum +
      (t.timeline ?? []).filter(
        (e) => e.step === 'done' && new Date(e.at).getTime() >= from,
      ).length,
    0,
  );
}

export const fmtReminderShort = (iso) => {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return dateStr(d) === dateStr() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
