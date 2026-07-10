import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'quack-data-v2';
const OLD_KEY = 'todos-v1';

export const emptyData = { todos: [], categories: [] };

export async function loadData() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
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
    return { ...emptyData, todos };
  }
  return emptyData;
}

export async function saveData(data) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
