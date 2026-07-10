import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'todos-v1';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setTodos(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos, loaded]);

  const addTodo = () => {
    const title = text.trim();
    if (!title) return;
    setTodos([{ id: Date.now().toString(), title, done: false }, ...todos]);
    setText('');
  };

  const toggleTodo = (id) =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeTodo = (id) => setTodos(todos.filter((t) => t.id !== id));

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>할 일</Text>
          <Text style={styles.subtitle}>
            {todos.length === 0
              ? '오늘은 어떤 일을 할까요?'
              : remaining === 0
                ? '전부 끝냈어요! 🎉'
                : `${remaining}개 남음`}
          </Text>
        </View>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={todos}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              아직 할 일이 없어요.{'\n'}아래 입력창에서 추가해보세요.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.rowBody} onPress={() => toggleTodo(item.id)}>
                <View style={[styles.check, item.done && styles.checkDone]}>
                  {item.done && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.rowText, item.done && styles.rowTextDone]}>
                  {item.title}
                </Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => removeTodo(item.id)}
                hitSlop={8}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          )}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={addTodo}
            placeholder="새 할 일 입력..."
            placeholderTextColor="#9A9AA0"
            returnKeyType="done"
          />
          <Pressable
            style={[styles.addBtn, !text.trim() && styles.addBtnDisabled]}
            onPress={addTodo}
          >
            <Text style={styles.addBtnText}>추가</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#8E8E93',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  empty: {
    marginTop: 80,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: '#AEAEB2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  rowTextDone: {
    color: '#AEAEB2',
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 4,
  },
  deleteText: {
    fontSize: 16,
    color: '#C7C7CC',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1C1C1E',
  },
  addBtn: {
    marginLeft: 10,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: '#B5D6FB',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
