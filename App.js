import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Chip from './src/Chip';
import EditTodoModal from './src/EditTodoModal';
import EggIcon from './src/EggIcon';
import MenuModal from './src/MenuModal';
import { emptyData, loadData, normalizeData, saveData } from './src/storage';
import { C, CATEGORY_COLORS } from './src/theme';

const isDone = (t) => t.doneSteps >= t.totalSteps;

export default function App() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'none' | 'archived' | categoryId
  const [text, setText] = useState('');
  const [newSteps, setNewSteps] = useState(1);
  const [newCat, setNewCat] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveData(data);
  }, [data, loaded]);

  const { todos, categories, collapsed } = data;
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const active = todos.filter((t) => !t.archived);
  const archived = todos.filter((t) => t.archived);

  const visibleTodos =
    filter === 'all'
      ? active
      : filter === 'archived'
        ? archived
        : filter === 'none'
          ? active.filter((t) => !catById[t.categoryId])
          : active.filter((t) => t.categoryId === filter);

  const remaining = visibleTodos.filter((t) => !isDone(t)).length;
  const hasUncategorized = active.some((t) => !catById[t.categoryId]);

  const sortTodos = (list) =>
    [...list].sort((a, b) => isDone(a) - isDone(b) || b.createdAt - a.createdAt);

  const makeSection = (key, title, color, list) => ({
    key,
    title,
    color,
    total: list.length,
    doneCount: list.filter(isDone).length,
    data: collapsed[key] ? [] : sortTodos(list),
  });

  const sections = useMemo(() => {
    if (filter === 'archived') return [makeSection('archived', '완료', C.green, archived)];
    if (filter !== 'all') {
      const title = filter === 'none' ? '미분류' : (catById[filter]?.name ?? '');
      return [makeSection(String(filter), title, catById[filter]?.color ?? null, visibleTodos)];
    }
    const secs = categories.map((c) =>
      makeSection(c.id, c.name, c.color, active.filter((t) => t.categoryId === c.id)),
    );
    const none = active.filter((t) => !catById[t.categoryId]);
    if (none.length) secs.push(makeSection('none', '미분류', null, none));
    const nonEmpty = secs.filter((sec) => sec.total > 0);
    if (archived.length) nonEmpty.push(makeSection('archived', '완료', C.green, archived));
    return nonEmpty;
  }, [todos, categories, filter, catById, collapsed]);

  // ---- 할 일
  const addTodo = () => {
    const title = text.trim();
    if (!title) return;
    const categoryId = newCat && catById[newCat] ? newCat : null;
    setData((d) => ({
      ...d,
      todos: [
        {
          id: Date.now().toString(),
          title,
          categoryId,
          totalSteps: newSteps,
          doneSteps: 0,
          steps: Array.from({ length: newSteps }, () => ({ text: '', attachment: null })),
          archived: false,
          createdAt: Date.now(),
        },
        ...d.todos,
      ],
    }));
    setText('');
  };

  const advance = (id) =>
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) =>
        t.id === id ? { ...t, doneSteps: Math.min(t.totalSteps, t.doneSteps + 1) } : t,
      ),
    }));

  const setArchived = (id, value) =>
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => (t.id === id ? { ...t, archived: value } : t)),
    }));

  const updateTodo = (id, fields) => {
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...fields };
        merged.totalSteps = merged.steps.length;
        merged.doneSteps = Math.min(merged.doneSteps, merged.totalSteps);
        if (!isDone(merged)) merged.archived = false;
        return merged;
      }),
    }));
    setEditingId(null);
  };

  const removeTodo = (id) => {
    setData((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }));
    setEditingId(null);
  };

  // ---- 분류
  const addCategory = (name) =>
    setData((d) => ({
      ...d,
      categories: [
        ...d.categories,
        {
          id: 'c' + Date.now(),
          name,
          color: CATEGORY_COLORS[d.categories.length % CATEGORY_COLORS.length],
        },
      ],
    }));

  const renameCategory = (id, name) =>
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    }));

  const deleteCategory = (id) => {
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
      categories: d.categories.filter((c) => c.id !== id),
    }));
    if (filter === id) setFilter('all');
    if (newCat === id) setNewCat(null);
  };

  const toggleCollapse = (key) =>
    setData((d) => ({ ...d, collapsed: { ...d.collapsed, [key]: !d.collapsed[key] } }));

  const selectFilter = (f) => {
    setFilter(f);
    setNewCat(f !== 'all' && f !== 'none' && f !== 'archived' ? f : null);
  };

  const bubbleMessage =
    filter === 'archived'
      ? `지금까지 ${archived.length}마리 부화했어요, 꽥!`
      : visibleTodos.length === 0
        ? '오늘은 뭘 해볼까요? 꽥!'
        : remaining === 0
          ? '전부 부화 완료! 최고예요 꽥꽥 🎉'
          : `알이 ${remaining}개 남았어요, 꽥!`;

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) : null;

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
          <Pressable
            testID="menu-btn"
            style={styles.menuBtn}
            onPress={() => setMenuOpen(true)}
            hitSlop={6}
          >
            <Text style={styles.menuBtnText}>☰</Text>
          </Pressable>
        </View>

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip
              testID="filter-all"
              label="전체"
              active={filter === 'all'}
              onPress={() => selectFilter('all')}
            />
            {categories.map((c) => (
              <Chip
                key={c.id}
                testID={`filter-${c.name}`}
                label={c.name}
                color={c.color}
                active={filter === c.id}
                onPress={() => selectFilter(c.id)}
              />
            ))}
            {hasUncategorized && categories.length > 0 && (
              <Chip
                testID="filter-none"
                label="미분류"
                active={filter === 'none'}
                onPress={() => selectFilter('none')}
              />
            )}
            {archived.length > 0 && (
              <Chip
                testID="filter-archived"
                label="완료"
                color={C.green}
                active={filter === 'archived'}
                onPress={() => selectFilter('archived')}
              />
            )}
          </ScrollView>
        </View>

        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyDuck}>🐥</Text>
              <Text style={styles.empty}>
                아직 할 일이 없어요.{'\n'}
                할 일을 추가하면 알이 생기고,{'\n'}
                단계를 끝낼 때마다 알이 깨져요!
              </Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Pressable
              testID={`section-${section.title}`}
              style={styles.sectionHeader}
              onPress={() => toggleCollapse(section.key)}
            >
              <Text style={styles.collapseArrow}>
                {collapsed[section.key] ? '▸' : '▾'}
              </Text>
              {section.color ? (
                <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
              ) : null}
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.doneCount}/{section.total}
              </Text>
            </Pressable>
          )}
          renderItem={({ item }) => {
            const current = !isDone(item) ? item.steps?.[item.doneSteps] : null;
            return (
              <Pressable style={styles.row} onPress={() => setEditingId(item.id)}>
                <EggIcon total={item.totalSteps} done={item.doneSteps} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowText, isDone(item) && styles.rowTextDone]}>
                    {item.title}
                  </Text>
                  {(item.totalSteps > 1 || current?.text) && !isDone(item) && (
                    <View style={styles.progressRow}>
                      {item.totalSteps > 1 && (
                        <>
                          {Array.from({ length: item.totalSteps }, (_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.progressDot,
                                i < item.doneSteps && styles.progressDotDone,
                              ]}
                            />
                          ))}
                          <Text style={styles.progressText}>
                            {item.doneSteps}/{item.totalSteps} 단계
                          </Text>
                        </>
                      )}
                      {current?.text ? (
                        <Text style={styles.stepHint} numberOfLines={1}>
                          {item.totalSteps > 1 ? ' · ' : ''}
                          {current.text}
                          {current.attachment ? ' 📎' : ''}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
                {!isDone(item) ? (
                  <Pressable
                    accessibilityLabel="다음 단계"
                    style={styles.nextBtn}
                    onPress={() => advance(item.id)}
                    hitSlop={6}
                  >
                    <Text style={styles.nextBtnText}>❯</Text>
                  </Pressable>
                ) : !item.archived ? (
                  <Pressable
                    accessibilityLabel="완료로 보내기"
                    style={styles.archiveBtn}
                    onPress={() => setArchived(item.id, true)}
                    hitSlop={6}
                  >
                    <Text style={styles.nextBtnText}>✓</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityLabel="되돌리기"
                    style={styles.unarchiveBtn}
                    onPress={() => setArchived(item.id, false)}
                    hitSlop={6}
                  >
                    <Text style={styles.unarchiveBtnText}>↩</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />

        <View style={styles.inputArea}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>단계</Text>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip
                key={n}
                testID={`step-${n}`}
                label={String(n)}
                active={newSteps === n}
                onPress={() => setNewSteps(n)}
              />
            ))}
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>분류</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip
                testID="add-cat-none"
                label="없음"
                active={!newCat}
                onPress={() => setNewCat(null)}
              />
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  testID={`add-cat-${c.name}`}
                  label={c.name}
                  color={c.color}
                  active={newCat === c.id}
                  onPress={() => setNewCat(c.id)}
                />
              ))}
            </ScrollView>
          </View>
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
        </View>
      </KeyboardAvoidingView>

      {editingTodo && (
        <EditTodoModal
          todo={editingTodo}
          categories={categories}
          onSave={(fields) => updateTodo(editingTodo.id, fields)}
          onDelete={() => removeTodo(editingTodo.id)}
          onClose={() => setEditingId(null)}
        />
      )}
      {menuOpen && (
        <MenuModal
          data={data}
          onAddCategory={addCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onImport={(d) => setData(normalizeData(d))}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  mascot: {
    fontSize: 48,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: C.text,
  },
  bubble: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 11,
    width: 12,
    height: 12,
    backgroundColor: C.card,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: C.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  menuBtnText: {
    fontSize: 18,
    color: C.sub,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  collapseArrow: {
    width: 16,
    fontSize: 13,
    color: C.faint,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 7,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.sub,
  },
  sectionCount: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: C.faint,
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyDuck: {
    fontSize: 64,
    marginBottom: 14,
  },
  empty: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: C.faint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  rowBody: {
    flex: 1,
    marginLeft: 11,
  },
  rowText: {
    fontSize: 16,
    color: C.text,
  },
  rowTextDone: {
    color: C.done,
    textDecorationLine: 'line-through',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  progressDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 4,
  },
  progressDotDone: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  progressText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
  },
  stepHint: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: C.faint,
  },
  nextBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  archiveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unarchiveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unarchiveBtnText: {
    color: C.sub,
    fontSize: 15,
    fontWeight: '800',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  inputArea: {
    backgroundColor: C.barBg,
    borderTopWidth: 1.5,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: C.faint,
    width: 34,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.inputBg,
    paddingHorizontal: 18,
    fontSize: 16,
    color: C.text,
  },
  addBtn: {
    marginLeft: 10,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: C.orangeDim,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
