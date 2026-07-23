const pad = (n) => String(n).padStart(2, '0');
export const dateStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// dayOfMonth가 그 달의 마지막 날보다 크면(예: 31) 그 달의 말일로 취급한다.
function matchesDayOfMonth(now, dayOfMonth) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() === Math.min(dayOfMonth ?? 1, lastDay);
}

// 반복 설정된 투두가 완료된 채로 예정일을 맞으면 새 알로 다시 낳는다.
// 이전 회차는 완료 보관함으로 보내고(기록 유지), 반복 설정은 새 회차가 이어받는다.
export function spawnRepeats(data) {
  const now = new Date();
  const today = dateStr(now);
  const dow = now.getDay();
  const spawned = [];

  const todos = data.todos.map((t) => {
    if (!t.repeat) return t;
    const isScheduledToday =
      t.repeat.kind === 'daily' ||
      (t.repeat.kind === 'weekly' && (t.repeat.days ?? []).includes(dow)) ||
      (t.repeat.kind === 'monthly' && matchesDayOfMonth(now, t.repeat.dayOfMonth));
    const finished = t.doneSteps >= t.totalSteps || t.archived;
    const completedAt =
      [...(t.timeline ?? [])].reverse().find((entry) => entry.step === 'done')?.at ??
      t.archivedAt;
    const completedToday = completedAt && dateStr(new Date(completedAt)) === today;
    if (!isScheduledToday || !finished || completedToday || t.lastSpawnedDate === today) {
      return t;
    }

    spawned.push({
      ...t,
      id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6),
      doneSteps: 0,
      timeline: [],
      archived: false,
      reminder: null,
      dueDate: null,
      createdAt: Date.now(),
      lastSpawnedDate: today,
      steps: t.steps.map((s) => ({
        text: s.text,
        attachments: (s.attachments ?? []).map((a) => ({ ...a })),
      })),
    });
    return { ...t, repeat: null, archived: true, archivedAt: new Date().toISOString() };
  });

  if (spawned.length === 0) return null;
  return { ...data, todos: [...spawned, ...todos] };
}
