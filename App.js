import { StatusBar } from 'expo-status-bar';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Chip from './src/Chip';
import DayView from './src/DayView';
import EditTodoModal from './src/EditTodoModal';
import GuideModal from './src/GuideModal';
import MenuModal from './src/MenuModal';
import TodoRow from './src/TodoRow';
import { hapticStep } from './src/haptics';
import { authenticate } from './src/lock';
import {
  cancelReminder,
  scheduleReminder,
  scheduleWeeklyReport,
  updateBadge,
} from './src/notifications';
import { dateStr, spawnRepeats } from './src/repeat';
import {
  cleanArchived,
  emptyData,
  loadData,
  normalizeData,
  saveData,
  saveSnapshot,
} from './src/storage';
import { CATEGORY_COLORS, useTheme } from './src/theme';
import { hatchStreak, isDone, isStarted, weekHatchCount } from './src/utils';

export default function App() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isDarkMode = useColorScheme() === 'dark';
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState('list'); // 'list' | 'day'
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [newSteps, setNewSteps] = useState(1);
  const [newCat, setNewCat] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [swipeOpenId, setSwipeOpenId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  const [locked, setLocked] = useState(false);
  const settingsRef = useRef(null);
  settingsRef.current = data.settings;

  const listWrapRef = useRef(null);
  const listTopRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const rowLayouts = useRef({});
  const headerLayouts = useRef({});
  const dragArmed = useRef(null);
  const draggingRef = useRef(null);
  const movedRef = useRef(false);
  const sectionsRef = useRef([]);
  const collapsedRef = useRef({});

  const runMaintenance = useCallback(() => {
    setData((current) => {
      let next = spawnRepeats(current) ?? current;
      next = cleanArchived(next) ?? next;
      return next;
    });
  }, []);

  useEffect(() => {
    loadData().then((d) => {
      let next = spawnRepeats(d) ?? d;
      next = cleanArchived(next) ?? next;
      setData(next);
      setLoaded(true);
      saveSnapshot(next);
      if (!next.settings?.seenGuide) setGuideOpen(true);
      if (next.settings?.lockEnabled) {
        setLocked(true);
        setTimeout(() => {
          authenticate().then((ok) => ok && setLocked(false));
        }, 400);
      }
    });
    if (Platform.OS === 'web') {
      // 드래그 중 브라우저 텍스트 선택이 제스처를 가로채는 것 방지
      const style = document.createElement('style');
      style.textContent =
        'body { user-select: none; -webkit-user-select: none; } input, textarea { user-select: text; -webkit-user-select: text; }';
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runMaintenance();
    });

    let timer;
    const scheduleMidnightMaintenance = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 1, 0);
      timer = setTimeout(() => {
        runMaintenance();
        scheduleMidnightMaintenance();
      }, nextMidnight.getTime() - Date.now());
    };
    scheduleMidnightMaintenance();

    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [loaded, runMaintenance]);

  useEffect(() => {
    if (loaded) saveData(data);
  }, [data, loaded]);

  // 남은 알 개수를 앱 아이콘 배지로 (옵션, 기본 꺼짐 — 꺼져 있으면 배지를 지운다)
  useEffect(() => {
    if (!loaded) return;
    const count = data.settings?.badgeOn
      ? data.todos.filter((t) => !t.archived && !isDone(t)).length
      : 0;
    updateBadge(count);
  }, [data, loaded]);

  // 백그라운드로 가면 다시 잠금
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' && settingsRef.current?.lockEnabled) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  const tryUnlock = async () => {
    if (await authenticate()) setLocked(false);
  };

  // 주간 리포트 알림: 켜져 있으면 열 때마다 최신 내용으로 재예약
  useEffect(() => {
    if (!loaded) return;
    const s = data.settings ?? {};
    if (!s.weeklyReport) {
      if (s.weeklyReportNotifId) {
        cancelReminder(s.weeklyReportNotifId);
        setData((d) => ({
          ...d,
          settings: { ...d.settings, weeklyReportNotifId: null },
        }));
      }
      return;
    }
    (async () => {
      await cancelReminder(s.weeklyReportNotifId);
      const count = weekHatchCount(data.todos);
      try {
        const id = await scheduleWeeklyReport(
          count > 0
            ? `이번 주 ${count}마리 부화했어요! 다음 주도 화이팅, 꽥!`
            : '이번 주를 돌아보고 다음 주 알을 준비해요, 꽥!',
        );
        setData((d) => ({ ...d, settings: { ...d.settings, weeklyReportNotifId: id } }));
      } catch (e) {
        // 권한 거부 시 예약 생략
      }
    })();
  }, [loaded, data.settings?.weeklyReport]);

  const { todos, categories, collapsed, templates, pages } = data;
  collapsedRef.current = collapsed;
  const sortMode = data.settings?.sortMode ?? 'manual';
  const isCollapsed = (key) => collapsed[key] ?? key === 'archived';

  // ---- 페이지
  const currentPageId =
    data.settings?.lastPageId && pages.some((p) => p.id === data.settings.lastPageId)
      ? data.settings.lastPageId
      : pages[0].id;
  const pageIndex = pages.findIndex((p) => p.id === currentPageId);
  const currentPage = pages[pageIndex];
  const pagesRef = useRef({ pages, pageIndex });
  pagesRef.current = { pages, pageIndex };

  const selectPage = (i) => {
    const { pages: ps } = pagesRef.current;
    if (i < 0 || i >= ps.length) return;
    hapticStep();
    setData((d) => ({ ...d, settings: { ...d.settings, lastPageId: ps[i].id } }));
  };

  // 헤더(제목 영역)를 좌우로 쓸면 페이지 전환
  const headerPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        const { pageIndex: i } = pagesRef.current;
        if (g.dx < -50) selectPage(i + 1);
        else if (g.dx > 50) selectPage(i - 1);
      },
    }),
  ).current;

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const q = query.trim().toLowerCase();
  const matchesQuery = (t) =>
    !q ||
    t.title.toLowerCase().includes(q) ||
    t.steps?.some((s) => s.text?.toLowerCase().includes(q));

  const pageTodos = todos.filter((t) => t.pageId === currentPageId);
  const active = pageTodos.filter((t) => !t.archived && matchesQuery(t));
  const archived = pageTodos.filter((t) => t.archived && matchesQuery(t));

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

  // 진행 중 먼저, 완료는 뒤로. 마감일순 모드면 진행 중을 마감일 오름차순으로.
  // 중요(important)는 그 안에서 위로, 고정(pinned)은 항상 최상단으로
  // (안정 정렬이라 상대 순서는 유지 → pinned > important > 나머지).
  const orderTodos = (list) => {
    const act = list.filter((t) => !isDone(t));
    const dn = list.filter(isDone);
    if (sortMode === 'due') {
      act.sort((a, b) =>
        (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'),
      );
    }
    act.sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0));
    act.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return [...act, ...dn];
  };

  const sections = useMemo(() => {
    const make = (key, title, color, list) => ({
      key,
      title,
      color,
      total: list.length,
      doneCount: list.filter(isDone).length,
      todos: orderTodos(list),
    });
    if (filter === 'archived') return [make('archived', '완료', C.green, archived)];
    if (filter !== 'all') {
      const title = filter === 'none' ? '미분류' : (catById[filter]?.name ?? '');
      return [make(String(filter), title, catById[filter]?.color ?? null, visibleTodos)];
    }
    const secs = categories.map((c) =>
      make(c.id, c.name, c.color, active.filter((t) => t.categoryId === c.id)),
    );
    const none = active.filter((t) => !catById[t.categoryId]);
    if (none.length) secs.push(make('none', '미분류', null, none));
    const nonEmpty = secs.filter((sec) => sec.total > 0);
    // 오늘 포커스: 오늘 마감 + 오늘 알림 + 진행 중 (분류 섹션과 중복 표시)
    const today = dateStr();
    const focus = active.filter(
      (t) =>
        !isDone(t) &&
        (t.dueDate === today ||
          (t.reminder?.at && dateStr(new Date(t.reminder.at)) === today) ||
          isStarted(t)),
    );
    if (focus.length) nonEmpty.unshift(make('today', '오늘', C.orange, focus));
    if (archived.length) nonEmpty.push(make('archived', '완료', C.green, archived));
    return nonEmpty;
  }, [todos, categories, filter, catById, q, sortMode, currentPageId, C]);
  sectionsRef.current = sections;

  // ---- 드래그 앤 드롭
  const endDrag = () => {
    dragArmed.current = null;
    draggingRef.current = null;
    setDragging(null);
  };

  const performDrop = (contentY) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const secs = sectionsRef.current.filter(
      (sec) => sec.key !== 'archived' && sec.key !== 'today',
    );
    if (!secs.length) return;

    let target = secs[0];
    for (const sec of secs) {
      const hy = headerLayouts.current[sec.key];
      if (hy != null && contentY >= hy) target = sec;
    }
    const catId = target.key === 'none' ? null : target.key;

    let nextId = null;
    if (!collapsedRef.current[target.key]) {
      for (const t of target.todos) {
        if (t.id === drag.id) continue;
        const ly = rowLayouts.current[t.id];
        if (ly && contentY < ly.y + ly.h / 2) {
          nextId = t.id;
          break;
        }
      }
    }

    setData((d) => {
      const dragged = d.todos.find((t) => t.id === drag.id);
      if (!dragged) return d;
      const validCat = catId === null || d.categories.some((c) => c.id === catId);
      const updated = { ...dragged, categoryId: validCat ? catId : dragged.categoryId };
      const rest = d.todos.filter((t) => t.id !== drag.id);
      let idx = nextId ? rest.findIndex((t) => t.id === nextId) : -1;
      if (idx === -1) {
        const inTarget = (t) =>
          !t.archived &&
          (catId === null
            ? !d.categories.some((c) => c.id === t.categoryId)
            : t.categoryId === catId);
        const last = [...rest].reverse().find(inTarget);
        idx = last ? rest.indexOf(last) + 1 : 0;
      }
      rest.splice(idx, 0, updated);
      return { ...d, todos: rest };
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => dragArmed.current != null,
      onPanResponderMove: (_, g) => {
        const d = draggingRef.current;
        if (!d) return;
        movedRef.current = true;
        const vy = g.moveY - listTopRef.current;
        draggingRef.current = { ...d, vy, cy: vy + scrollOffsetRef.current };
        setDragging(draggingRef.current);
      },
      onPanResponderRelease: () => {
        const d = draggingRef.current;
        if (d && movedRef.current) performDrop(d.cy);
        endDrag();
      },
      onPanResponderTerminate: () => endDrag(),
    }),
  ).current;

  const startDrag = (todo) => {
    if (todo.archived || filter === 'archived') return;
    const ly = rowLayouts.current[todo.id];
    movedRef.current = false;
    dragArmed.current = todo.id;
    draggingRef.current = {
      id: todo.id,
      title: todo.title,
      vy: ly ? ly.y - scrollOffsetRef.current : 0,
      cy: ly ? ly.y : 0,
    };
    setDragging(draggingRef.current);
  };

  const handlePressOut = () => {
    setTimeout(() => {
      if (!movedRef.current && draggingRef.current) endDrag();
    }, 150);
  };

  // ---- 할 일
  const makeTodo = (title, categoryId, stepTexts) => ({
    id: Date.now().toString(),
    title,
    categoryId,
    pageId: currentPageId,
    totalSteps: stepTexts.length,
    doneSteps: 0,
    steps: stepTexts.map((t) => ({ text: t, attachments: [] })),
    timeline: [],
    archived: false,
    archivedAt: null,
    reminder: null,
    repeat: null,
    dueDate: null,
    lastSpawnedDate: null,
    important: false,
    pinned: false,
    note: '',
    createdAt: Date.now(),
  });

  const addTodo = () => {
    const title = text.trim();
    if (!title) return;
    const categoryId = newCat && catById[newCat] ? newCat : null;
    setData((d) => ({
      ...d,
      todos: [
        makeTodo(title, categoryId, Array.from({ length: newSteps }, () => '')),
        ...d.todos,
      ],
    }));
    setText('');
  };

  const addFromTemplate = (tpl) => {
    const categoryId = tpl.categoryId && catById[tpl.categoryId] ? tpl.categoryId : null;
    setData((d) => ({
      ...d,
      todos: [makeTodo(tpl.title, categoryId, tpl.stepTexts), ...d.todos],
    }));
  };

  const saveTemplate = (tpl) =>
    setData((d) => ({
      ...d,
      templates: [...d.templates, { id: 'tp' + Date.now(), ...tpl }],
    }));

  const deleteTemplate = (id) =>
    setData((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) }));

  const updateSettings = (patch) =>
    setData((d) => {
      const next = { ...d, settings: { ...d.settings, ...patch } };
      return cleanArchived(next) ?? next;
    });

  const addPage = (name) =>
    setData((d) => ({ ...d, pages: [...d.pages, { id: 'p' + Date.now(), name }] }));

  const renamePage = (id, name) =>
    setData((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

  // 페이지 삭제 시 소속 투두는 남은 첫 페이지로 이동 (마지막 페이지는 삭제 불가)
  const deletePage = (id) =>
    setData((d) => {
      if (d.pages.length <= 1) return d;
      const fallback = d.pages.find((p) => p.id !== id);
      return {
        ...d,
        pages: d.pages.filter((p) => p.id !== id),
        todos: d.todos.map((t) => (t.pageId === id ? { ...t, pageId: fallback.id } : t)),
        settings: {
          ...d.settings,
          lastPageId: d.settings.lastPageId === id ? fallback.id : d.settings.lastPageId,
        },
      };
    });

  const advance = (id) => {
    hapticStep();
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => {
        if (t.id !== id) return t;
        const now = new Date().toISOString();
        const timeline = t.timeline ?? [];
        if (!isStarted(t)) {
          return { ...t, timeline: [{ at: now, step: 1 }] };
        }
        const doneSteps = Math.min(t.totalSteps, t.doneSteps + 1);
        const entry =
          doneSteps >= t.totalSteps
            ? { at: now, step: 'done' }
            : { at: now, step: doneSteps + 1 };
        return { ...t, doneSteps, timeline: [...timeline, entry] };
      }),
    }));
  };

  const showUndo = (label, apply) => {
    clearTimeout(undoTimer.current);
    setUndo({ label, apply });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  const doUndo = () => {
    clearTimeout(undoTimer.current);
    undo?.apply();
    setUndo(null);
  };

  const applyArchived = (id, value) =>
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) =>
        t.id === id
          ? { ...t, archived: value, archivedAt: value ? new Date().toISOString() : null }
          : t,
      ),
    }));

  const setArchived = (id, value) => {
    hapticStep();
    applyArchived(id, value);
    if (value) showUndo('완료함으로 보냈어요', () => applyArchived(id, false));
  };

  const updateTodo = (id, fields) => {
    const prev = todos.find((t) => t.id === id);
    const { reminderAt, ...rest } = fields;
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...rest };
        merged.totalSteps = merged.steps.length;
        merged.doneSteps = Math.min(merged.doneSteps, merged.totalSteps);
        if (merged.doneSteps !== t.doneSteps) {
          const now = new Date().toISOString();
          const entry =
            merged.doneSteps >= merged.totalSteps
              ? { at: now, step: 'done' }
              : { at: now, step: merged.doneSteps + 1 };
          merged.timeline = [...(t.timeline ?? []), entry];
        }
        if (!isDone(merged)) {
          merged.archived = false;
          merged.archivedAt = null;
        }
        return merged;
      }),
    }));
    setEditingId(null);

    const prevAt = prev?.reminder?.at ?? null;
    if (reminderAt !== undefined && reminderAt !== prevAt) {
      (async () => {
        await cancelReminder(prev?.reminder?.notificationId);
        let notificationId = null;
        if (reminderAt) {
          try {
            notificationId = await scheduleReminder(
              rest.title ?? prev?.title ?? '',
              new Date(reminderAt),
            );
          } catch (e) {
            // 권한 거부 등 — 시간은 저장하되 예약은 생략
          }
        }
        setData((d) => ({
          ...d,
          todos: d.todos.map((t) =>
            t.id === id
              ? { ...t, reminder: reminderAt ? { at: reminderAt, notificationId } : null }
              : t,
          ),
        }));
      })();
    }
  };

  const removeTodo = (id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    const idx = todos.findIndex((x) => x.id === id);
    cancelReminder(t.reminder?.notificationId);
    setData((d) => ({ ...d, todos: d.todos.filter((x) => x.id !== id) }));
    setEditingId(null);
    showUndo('삭제했어요', () => {
      setData((d) => {
        const arr = [...d.todos];
        arr.splice(Math.min(idx, arr.length), 0, t);
        return { ...d, todos: arr };
      });
      // 미래 알림이 있었으면 다시 예약
      if (t.reminder?.at && new Date(t.reminder.at) > new Date()) {
        scheduleReminder(t.title, new Date(t.reminder.at))
          .then((nid) =>
            setData((d) => ({
              ...d,
              todos: d.todos.map((x) =>
                x.id === t.id
                  ? { ...x, reminder: { at: t.reminder.at, notificationId: nid } }
                  : x,
              ),
            })),
          )
          .catch(() => {});
      }
    });
  };

  const toggleSelectMode = () => {
    setSwipeOpenId(null);
    setSelectedIds([]);
    setSelectMode((v) => !v);
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const bulkDelete = () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    const removed = todos.filter((t) => ids.includes(t.id));
    removed.forEach((t) => cancelReminder(t.reminder?.notificationId));
    setData((d) => ({ ...d, todos: d.todos.filter((t) => !ids.includes(t.id)) }));
    setSelectedIds([]);
    setSelectMode(false);
    showUndo(`${removed.length}개 삭제했어요`, () => {
      setData((d) => ({ ...d, todos: [...removed, ...d.todos] }));
      removed.forEach((t) => {
        if (t.reminder?.at && new Date(t.reminder.at) > new Date()) {
          scheduleReminder(t.title, new Date(t.reminder.at))
            .then((nid) =>
              setData((d) => ({
                ...d,
                todos: d.todos.map((x) =>
                  x.id === t.id
                    ? { ...x, reminder: { at: t.reminder.at, notificationId: nid } }
                    : x,
                ),
              })),
            )
            .catch(() => {});
        }
      });
    });
  };

  const bulkMove = (categoryId) => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => (ids.includes(t.id) ? { ...t, categoryId } : t)),
    }));
    setSelectedIds([]);
    setSelectMode(false);
  };

  const importBackup = async (rawData) => {
    const imported = normalizeData(rawData);
    await Promise.all(data.todos.map((t) => cancelReminder(t.reminder?.notificationId)));

    const now = Date.now();
    const todos = await Promise.all(
      imported.todos.map(async (todo) => {
        const reminderAt = todo.reminder?.at;
        const reminderTime = reminderAt ? new Date(reminderAt).getTime() : NaN;
        if (!reminderAt || !Number.isFinite(reminderTime) || reminderTime <= now) {
          return { ...todo, reminder: null };
        }

        try {
          const notificationId = await scheduleReminder(todo.title, new Date(reminderAt));
          return { ...todo, reminder: { at: reminderAt, notificationId } };
        } catch {
          return { ...todo, reminder: { at: reminderAt, notificationId: null } };
        }
      }),
    );

    let next = { ...imported, todos };
    next = cleanArchived(next) ?? next;
    setData(next);
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

  const toggleCollapse = (key) => {
    setSwipeOpenId(null);
    setData((d) => ({
      ...d,
      collapsed: {
        ...d.collapsed,
        [key]: !(d.collapsed[key] ?? key === 'archived'),
      },
    }));
  };

  const selectFilter = (f) => {
    setSwipeOpenId(null);
    setFilter(f);
    setNewCat(f !== 'all' && f !== 'none' && f !== 'archived' ? f : null);
  };

  const bubbleMessage =
    page === 'day'
      ? '저를 누르면 투두로 돌아가요, 꽥!'
      : filter === 'archived'
        ? `지금까지 ${archived.length}마리 부화했어요, 꽥!`
        : visibleTodos.length === 0
          ? '오늘은 뭘 해볼까요? 꽥!'
          : remaining === 0
            ? '전부 부화 완료! 최고예요 꽥꽥 🎉'
            : `알이 ${remaining}개 남았어요, 꽥!`;

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) : null;
  const showOptions = inputFocused || !!text.trim();
  const streak = useMemo(() => hatchStreak(todos), [todos]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            testID="mascot-btn"
            onPress={() => {
              setSwipeOpenId(null);
              setPage((p) => (p === 'day' ? 'list' : 'day'));
            }}
            hitSlop={8}
          >
            <Image source={require('./assets/mascot.png')} style={styles.mascot} />
          </Pressable>
          <View style={styles.headerText} {...headerPan.panHandlers}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {page === 'day' ? '하루보기' : currentPage.name}
              </Text>
              {streak >= 2 && <Text style={styles.streak}>🔥 {streak}일</Text>}
            </View>
            {pages.length > 1 && (
              <View style={styles.dotsRow}>
                {pages.map((p, i) => (
                  <Pressable
                    key={p.id}
                    testID={`page-dot-${i}`}
                    onPress={() => selectPage(i)}
                    hitSlop={8}
                  >
                    <View
                      style={[styles.pageDot, i === pageIndex && styles.pageDotActive]}
                    />
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.bubble}>
              <View style={styles.bubbleTail} />
              <Text style={styles.bubbleText}>{bubbleMessage}</Text>
            </View>
          </View>
          <Pressable
            testID="menu-btn"
            style={styles.menuBtn}
            onPress={() => {
              setSwipeOpenId(null);
              setMenuOpen(true);
            }}
            hitSlop={6}
          >
            <Text style={styles.menuBtnText}>☰</Text>
          </Pressable>
        </View>

        {page === 'day' ? (
          <DayView
            todos={pageTodos}
            allTodos={todos}
            categories={categories}
            weeklyGoal={data.settings?.weeklyGoal}
            onOpenTodo={(id) => setEditingId(id)}
          />
        ) : (
          <>
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
                <Chip
                  testID="search-toggle"
                  label="🔍"
                  active={searchOpen}
                  onPress={() => {
                    setSwipeOpenId(null);
                    if (searchOpen) setQuery('');
                    setSearchOpen(!searchOpen);
                  }}
                />
                {visibleTodos.length > 0 && (
                  <Chip
                    testID="select-toggle"
                    label={selectMode ? '선택 취소' : '선택'}
                    active={selectMode}
                    onPress={toggleSelectMode}
                  />
                )}
              </ScrollView>
            </View>

            {searchOpen && (
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="제목이나 단계 내용으로 검색..."
                  placeholderTextColor={C.faint}
                  autoFocus
                />
              </View>
            )}

            <View
              style={styles.listWrap}
              ref={listWrapRef}
              {...pan.panHandlers}
              onLayout={() =>
                listWrapRef.current?.measureInWindow?.((x, y) => {
                  listTopRef.current = y;
                })
              }
            >
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                scrollEnabled={!dragging}
                onScroll={(e) => {
                  scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                }}
                onScrollBeginDrag={() => setSwipeOpenId(null)}
                scrollEventThrottle={16}
              >
                {sections.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Image
                      source={require('./assets/mascot.png')}
                      style={styles.emptyDuck}
                    />
                    <Text style={styles.empty}>
                      아직 할 일이 없어요.{'\n'}
                      할 일을 추가하면 알이 생기고,{'\n'}
                      단계를 끝낼 때마다 알이 깨져요!
                    </Text>
                  </View>
                ) : (
                  sections.map((sec) => (
                    <Fragment key={sec.key}>
                      <Pressable
                        testID={`section-${sec.title}`}
                        style={styles.sectionHeader}
                        onPress={() => toggleCollapse(sec.key)}
                        onLayout={(e) => {
                          headerLayouts.current[sec.key] = e.nativeEvent.layout.y;
                        }}
                      >
                        <Text style={styles.collapseArrow}>
                          {isCollapsed(sec.key) ? '▸' : '▾'}
                        </Text>
                        {sec.color ? (
                          <View
                            style={[styles.sectionDot, { backgroundColor: sec.color }]}
                          />
                        ) : null}
                        <Text style={styles.sectionTitle}>{sec.title}</Text>
                        <Text style={styles.sectionCount}>
                          {sec.doneCount}/{sec.total}
                        </Text>
                      </Pressable>
                      {!isCollapsed(sec.key) &&
                        sec.todos.map((item) => (
                          <TodoRow
                            key={`${sec.key}:${item.id}`}
                            item={item}
                            isDragging={dragging?.id === item.id}
                            sortLocked={sortMode === 'due' || sec.key === 'today' || selectMode}
                            soundOn={data.settings?.soundOn !== false}
                            selectMode={selectMode}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={toggleSelect}
                            isSwipeOpen={swipeOpenId === item.id}
                            anySwipeOpen={swipeOpenId != null}
                            onSwipeOpenChange={(open) =>
                              setSwipeOpenId(open ? item.id : null)
                            }
                            onDeleteSwipe={(id) => {
                              setSwipeOpenId(null);
                              removeTodo(id);
                            }}
                            onLayout={(e) => {
                              if (sec.key === 'today') return;
                              rowLayouts.current[item.id] = {
                                y: e.nativeEvent.layout.y,
                                h: e.nativeEvent.layout.height,
                              };
                            }}
                            onEdit={() => setEditingId(item.id)}
                            onStartDrag={() => startDrag(item)}
                            onPressOut={handlePressOut}
                            onAdvance={advance}
                            onSetArchived={setArchived}
                          />
                        ))}
                    </Fragment>
                  ))
                )}
              </ScrollView>
              {dragging && (
                <View pointerEvents="none" style={[styles.dragGhost, { top: dragging.vy }]}>
                  <Text style={styles.dragGhostText} numberOfLines={1}>
                    🥚 {dragging.title}
                  </Text>
                </View>
              )}
              {undo && (
                <View style={styles.undoBar}>
                  <Text style={styles.undoText}>{undo.label}</Text>
                  <Pressable testID="undo-btn" onPress={doUndo} hitSlop={8}>
                    <Text style={styles.undoAction}>실행 취소</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {selectMode ? (
              <View style={styles.selectionBar}>
                <Text style={styles.selectionCount}>{selectedIds.length}개 선택됨</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectionMoveRow}
                >
                  <Chip label="없음" onPress={() => bulkMove(null)} />
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      color={c.color}
                      onPress={() => bulkMove(c.id)}
                    />
                  ))}
                </ScrollView>
                <Pressable
                  testID="bulk-delete-btn"
                  style={styles.selectionDeleteBtn}
                  onPress={bulkDelete}
                >
                  <Text style={styles.selectionDeleteText}>삭제</Text>
                </Pressable>
              </View>
            ) : (
            <View style={styles.inputArea}>
              {showOptions && (
                <>
                  {templates.length > 0 && (
                    <View style={styles.optionRow}>
                      <Text style={styles.optionLabel}>서식</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {templates.map((tpl) => (
                          <Chip
                            key={tpl.id}
                            label={`📋 ${tpl.title}`}
                            onPress={() => addFromTemplate(tpl)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
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
                </>
              )}
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={addTodo}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 200)}
                  placeholder="새 할 일을 꽥꽥..."
                  placeholderTextColor={C.faint}
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
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {editingTodo && (
        <EditTodoModal
          todo={editingTodo}
          categories={categories}
          onSave={(fields) => updateTodo(editingTodo.id, fields)}
          onSaveTemplate={saveTemplate}
          onDelete={() => removeTodo(editingTodo.id)}
          onClose={() => setEditingId(null)}
        />
      )}
      {menuOpen && (
        <MenuModal
          data={data}
          onShowGuide={() => {
            setMenuOpen(false);
            setGuideOpen(true);
          }}
          onAddCategory={addCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onAddPage={addPage}
          onRenamePage={renamePage}
          onDeletePage={deletePage}
          onDeleteTemplate={deleteTemplate}
          onUpdateSettings={updateSettings}
          onImport={importBackup}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {guideOpen && (
        <GuideModal
          onClose={() => {
            setGuideOpen(false);
            if (!data.settings?.seenGuide) updateSettings({ seenGuide: true });
          }}
        />
      )}
      {locked && (
        <View style={styles.lockOverlay}>
          <Image source={require('./assets/mascot.png')} style={styles.lockMascot} />
          <Text style={styles.lockText}>잠겨 있어요, 꽥!</Text>
          <Pressable testID="unlock-btn" style={styles.lockBtn} onPress={tryUnlock}>
            <Text style={styles.lockBtnText}>잠금 해제</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
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
    width: 54,
    height: 54,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
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
    lineHeight: 19,
    fontWeight: '600',
    color: C.sub,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streak: {
    marginLeft: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: C.orange,
  },
  undoBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.text,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  undoText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '600',
  },
  undoAction: {
    color: C.orange,
    fontSize: 14,
    fontWeight: '800',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  lockMascot: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  lockText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    marginBottom: 18,
  },
  lockBtn: {
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  lockBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
    marginRight: 6,
  },
  pageDotActive: {
    backgroundColor: C.orange,
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
  searchBar: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchInput: {
    height: 38,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.text,
  },
  listWrap: {
    flex: 1,
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
    width: 130,
    height: 130,
    marginBottom: 14,
  },
  empty: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
    color: C.faint,
  },
  dragGhost: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.orange,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#5D4324',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  dragGhostText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  inputArea: {
    backgroundColor: C.barBg,
    borderTopWidth: 1.5,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.barBg,
    borderTopWidth: 1.5,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectionCount: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginRight: 8,
  },
  selectionMoveRow: {
    flex: 1,
  },
  selectionDeleteBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.danger,
  },
  selectionDeleteText: {
    color: C.danger,
    fontWeight: '700',
    fontSize: 13,
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
