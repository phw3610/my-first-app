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

  const bubbleMessage =
    todos.length === 0
      ? '오늘은 뭘 해볼까요? 꽥!'
      : remaining === 0
        ? '전부 부화 완료! 최고예요 꽥꽥 🎉'
        : `알이 ${remaining}개 남았어요, 꽥!`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.mascot}>🐥</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>꽥! 투두</Text>
            <View style={styles.bubble}>
              <View style={styles.bubbleTail} />
              <Text style={styles.bubbleText}>{bubbleMessage}</Text>
            </View>
          </View>
        </View>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={todos}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyDuck}>🐥</Text>
              <Text style={styles.empty}>
                아직 할 일이 없어요.{'\n'}
                할 일을 추가하면 알이 생기고,{'\n'}
                끝내면 병아리로 부화해요!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.rowBody} onPress={() => toggleTodo(item.id)}>
                <Text style={styles.eggIcon}>{item.done ? '🐥' : '🥚'}</Text>
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
            placeholder="새 할 일을 꽥꽥..."
            placeholderTextColor="#C9AE6B"
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
    backgroundColor: '#FFF6DA',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 14,
  },
  mascot: {
    fontSize: 56,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#5D4324',
  },
  bubble: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFE29A',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 12,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#FFE29A',
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A6B3A',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 70,
  },
  emptyDuck: {
    fontSize: 64,
    marginBottom: 14,
  },
  empty: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: '#B99C5F',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFE9A8',
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eggIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    color: '#5D4324',
  },
  rowTextDone: {
    color: '#C9B37E',
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 4,
  },
  deleteText: {
    fontSize: 15,
    color: '#E0C98F',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFDF5',
    borderTopWidth: 1.5,
    borderTopColor: '#FFE9A8',
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF3CC',
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#5D4324',
  },
  addBtn: {
    marginLeft: 10,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    backgroundColor: '#FF9E2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: '#FFD8A6',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
