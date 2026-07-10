import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'quack-data-v2';
const OLD_KEY = 'todos-v1';

export const emptyData = { todos: [], categories: [], collapsed: {} };

export function normalizeTodo(t) {
  const totalSteps = t.totalSteps ?? 1;
  const steps = Array.isArray(t.steps) ? t.steps.slice(0, totalSteps) : [];
  while (steps.length < totalSteps) steps.push({ text: '', attachment: null });
  return { archived: false, ...t, totalSteps, steps };
}

export function normalizeData(data) {
  return {
    ...emptyData,
    ...data,
    todos: (data.todos ?? []).map(normalizeTodo),
    categories: data.categories ?? [],
    collapsed: data.collapsed ?? {},
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
