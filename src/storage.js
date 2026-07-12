import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'quack-data-v2';
const OLD_KEY = 'todos-v1';

export const MAIN_PAGE_ID = 'main';

export const emptyData = {
  todos: [],
  categories: [],
  collapsed: {},
  templates: [],
  pages: [{ id: MAIN_PAGE_ID, name: '꽥! 투두' }],
  settings: {
    sortMode: 'manual',
    autoCleanDays: null,
    lastPageId: MAIN_PAGE_ID,
    soundOn: true,
    weeklyGoal: null,
    weeklyReport: false,
    lockEnabled: false,
  },
};

function normalizeStep(s) {
  const attachments = Array.isArray(s.attachments)
    ? s.attachments
    : s.attachment
      ? [{ type: 'file', ...s.attachment }]
      : [];
  return { text: s.text ?? '', attachments };
}

export function normalizeTodo(t) {
  const totalSteps = t.totalSteps ?? 1;
  const steps = (Array.isArray(t.steps) ? t.steps.slice(0, totalSteps) : []).map(
    normalizeStep,
  );
  while (steps.length < totalSteps) steps.push({ text: '', attachments: [] });
  const timeline = Array.isArray(t.timeline) ? t.timeline : [];
  return {
    archived: false,
    archivedAt: null,
    reminder: null,
    repeat: null,
    dueDate: null,
    lastSpawnedDate: null,
    pageId: MAIN_PAGE_ID,
    ...t,
    totalSteps,
    steps,
    timeline,
  };
}

// 완료 보관함 자동 정리: archivedAt이 없으면 지금으로 찍고(유예),
// 설정된 일수보다 오래된 완료 항목은 삭제한다.
export function cleanArchived(data) {
  const days = data.settings?.autoCleanDays;
  let changed = false;
  let todos = data.todos.map((t) => {
    if (t.archived && !t.archivedAt) {
      changed = true;
      return { ...t, archivedAt: new Date().toISOString() };
    }
    return t;
  });
  if (days) {
    const cutoff = Date.now() - days * 86400000;
    const kept = todos.filter(
      (t) => !(t.archived && t.archivedAt && new Date(t.archivedAt).getTime() < cutoff),
    );
    if (kept.length !== todos.length) {
      changed = true;
      todos = kept;
    }
  }
  return changed ? { ...data, todos } : null;
}

export function normalizeData(data) {
  return {
    ...emptyData,
    ...data,
    todos: (data.todos ?? []).map(normalizeTodo),
    categories: data.categories ?? [],
    collapsed: data.collapsed ?? {},
    templates: data.templates ?? [],
    pages: data.pages?.length ? data.pages : emptyData.pages,
    settings: { ...emptyData.settings, ...data.settings },
  };
}

export async function loadData() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return normalizeData(JSON.parse(raw));
  const old = await AsyncStorage.getItem(OLD_KEY);
  if (old) {
    const todos = JSON.parse(old).map((t) => ({
      id: t.id,
      title: t.title,
      categoryId: null,
      totalSteps: 1,
      doneSteps: t.done ? 1 : 0,
      createdAt: Number(t.id) || Date.now(),
    }));
    return normalizeData({ todos });
  }
  return emptyData;
}

export async function saveData(data) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

// ---- 자동 스냅샷: 하루 1회, 최근 3개 보관 (데이터 사고 시 복구용)
const SNAP_PREFIX = 'quack-snap-';
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function saveSnapshot(data) {
  try {
    const key = SNAP_PREFIX + localDate();
    if (await AsyncStorage.getItem(key)) return;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    const keys = (await AsyncStorage.getAllKeys())
      .filter((k) => k.startsWith(SNAP_PREFIX))
      .sort();
    for (const k of keys.slice(0, -3)) await AsyncStorage.removeItem(k);
  } catch (e) {
    // 스냅샷 실패는 앱 동작에 영향 주지 않음
  }
}

export async function listSnapshots() {
  const keys = (await AsyncStorage.getAllKeys())
    .filter((k) => k.startsWith(SNAP_PREFIX))
    .sort()
    .reverse();
  return keys.map((k) => k.slice(SNAP_PREFIX.length));
}

export async function loadSnapshot(date) {
  const raw = await AsyncStorage.getItem(SNAP_PREFIX + date);
  return raw ? JSON.parse(raw) : null;
}
