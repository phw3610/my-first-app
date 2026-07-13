import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { exportBackup, pickBackup } from './backup';
import Chip from './Chip';
import { authenticate } from './lock';
import { listSnapshots, loadSnapshot } from './storage';
import { useTheme } from './theme';

export default function MenuModal({
  data,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onDeleteTemplate,
  onUpdateSettings,
  onShowGuide,
  onImport,
  onClose,
}) {
  const C = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newPageName, setNewPageName] = useState('');
  const [editPageId, setEditPageId] = useState(null);
  const [editPageName, setEditPageName] = useState('');
  const [pending, setPending] = useState(null);
  const [msg, setMsg] = useState('');
  const [cleanText, setCleanText] = useState('');
  const [goalText, setGoalText] = useState('');
  const [snapshots, setSnapshots] = useState([]);

  const settings = data.settings ?? {};

  useEffect(() => {
    listSnapshots().then(setSnapshots).catch(() => {});
  }, []);

  const restoreSnapshot = async (date) => {
    try {
      const snap = await loadSnapshot(date);
      if (snap) {
        setPending(snap);
        setMsg('');
      }
    } catch (e) {
      setMsg('스냅샷을 읽지 못했어요: ' + e.message);
    }
  };

  const applyCustomClean = () => {
    const n = Number(cleanText.trim());
    if (!Number.isInteger(n) || n < 1 || n > 3650) {
      setMsg('자동 정리 일수는 1~3650 사이 숫자로 입력해주세요');
      return;
    }
    setMsg('');
    setCleanText('');
    onUpdateSettings({ autoCleanDays: n });
  };

  const applyCustomGoal = () => {
    const n = Number(goalText.trim());
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      setMsg('주간 목표는 1~999 사이 숫자로 입력해주세요');
      return;
    }
    setMsg('');
    setGoalText('');
    onUpdateSettings({ weeklyGoal: n });
  };

  const toggleLock = async (enable) => {
    if (!(await authenticate())) {
      setMsg('인증에 실패해서 잠금 설정을 바꾸지 못했어요');
      return;
    }
    setMsg('');
    onUpdateSettings({ lockEnabled: enable });
  };

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    onAddCategory(name);
    setNewName('');
  };

  const addPage = () => {
    const name = newPageName.trim();
    if (!name) return;
    onAddPage(name);
    setNewPageName('');
  };

  const doExport = async () => {
    try {
      await exportBackup(data);
      setMsg('백업 파일을 내보냈어요, 꽥! 공유 시트에서 "파일에 저장" → iCloud Drive를 고르면 아이클라우드에 저장돼요.');
    } catch (e) {
      setMsg('내보내기 실패: ' + e.message);
    }
  };

  const doPick = async () => {
    try {
      const d = await pickBackup();
      if (d) {
        setPending(d);
        setMsg('');
      }
    } catch (e) {
      setMsg('불러오기 실패: ' + e.message);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            scrollIndicatorInsets={{ right: 2, top: 14, bottom: 14 }}
          >
            <View style={s.headerRow}>
              <Text style={s.heading}>메뉴</Text>
              <Pressable testID="menu-close" style={s.xBtn} onPress={onClose} hitSlop={8}>
                <Text style={s.xBtnText}>✕</Text>
              </Pressable>
            </View>
            <Text style={s.hint}>왼쪽 위 오리를 누르면 하루보기로 전환돼요!</Text>

            <Pressable testID="menu-guide" style={s.guideBtn} onPress={onShowGuide}>
              <Text style={s.guideBtnText}>📖 사용법 보기</Text>
            </Pressable>

            <View style={s.section}>
            <Text style={s.sectionTitle}>페이지 관리</Text>
            <Text style={s.hint}>
              제목 부분을 좌우로 쓸거나 점(●)을 눌러 페이지를 오갈 수 있어요.
            </Text>
            {(data.pages ?? []).map((p) =>
              editPageId === p.id ? (
                <View key={p.id} style={s.catRow}>
                  <TextInput
                    style={s.catEditInput}
                    value={editPageName}
                    onChangeText={setEditPageName}
                    autoFocus
                  />
                  <Pressable
                    style={s.smallBtn}
                    onPress={() => {
                      if (editPageName.trim()) onRenamePage(p.id, editPageName.trim());
                      setEditPageId(null);
                    }}
                  >
                    <Text style={s.smallBtnText}>저장</Text>
                  </Pressable>
                </View>
              ) : (
                <View key={p.id} style={s.catRow}>
                  <Text style={s.catName}>📄 {p.name}</Text>
                  <Pressable
                    style={s.smallGhostBtn}
                    onPress={() => {
                      setEditPageId(p.id);
                      setEditPageName(p.name);
                    }}
                  >
                    <Text style={s.smallGhostText}>수정</Text>
                  </Pressable>
                  {data.pages.length > 1 && (
                    <Pressable style={s.smallGhostBtn} onPress={() => onDeletePage(p.id)}>
                      <Text style={s.smallDangerText}>삭제</Text>
                    </Pressable>
                  )}
                </View>
              ),
            )}
            <View style={s.catRow}>
              <TextInput
                style={s.catEditInput}
                value={newPageName}
                onChangeText={setNewPageName}
                onSubmitEditing={addPage}
                placeholder="새 페이지 이름"
                placeholderTextColor={C.faint}
              />
              <Pressable testID="page-add-btn" style={s.smallBtn} onPress={addPage}>
                <Text style={s.smallBtnText}>추가</Text>
              </Pressable>
            </View>
            </View>

            <View style={s.section}>
            <Text style={s.sectionTitle}>분류 관리</Text>
            {data.categories.length === 0 && (
              <Text style={s.hint}>아직 분류가 없어요. 아래에서 추가해보세요!</Text>
            )}
            {data.categories.map((c) =>
              editId === c.id ? (
                <View key={c.id} style={s.catRow}>
                  <TextInput
                    style={s.catEditInput}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                  />
                  <Pressable
                    style={s.smallBtn}
                    onPress={() => {
                      if (editName.trim()) onRenameCategory(c.id, editName.trim());
                      setEditId(null);
                    }}
                  >
                    <Text style={s.smallBtnText}>저장</Text>
                  </Pressable>
                </View>
              ) : (
                <View key={c.id} style={s.catRow}>
                  <View style={[s.dot, { backgroundColor: c.color }]} />
                  <Text style={s.catName}>{c.name}</Text>
                  <Pressable
                    style={s.smallGhostBtn}
                    onPress={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                    }}
                  >
                    <Text style={s.smallGhostText}>수정</Text>
                  </Pressable>
                  <Pressable style={s.smallGhostBtn} onPress={() => onDeleteCategory(c.id)}>
                    <Text style={s.smallDangerText}>삭제</Text>
                  </Pressable>
                </View>
              ),
            )}
            <View style={s.catRow}>
              <TextInput
                style={s.catEditInput}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={addCategory}
                placeholder="새 분류 이름"
                placeholderTextColor={C.faint}
              />
              <Pressable testID="cat-add-btn" style={s.smallBtn} onPress={addCategory}>
                <Text style={s.smallBtnText}>추가</Text>
              </Pressable>
            </View>
            </View>

            {(data.templates ?? []).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>서식 관리</Text>
                {data.templates.map((tpl) => (
                  <View key={tpl.id} style={s.catRow}>
                    <Text style={s.catName}>📋 {tpl.title}</Text>
                    <Pressable style={s.smallGhostBtn} onPress={() => onDeleteTemplate(tpl.id)}>
                      <Text style={s.smallDangerText}>삭제</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={s.section}>
            <Text style={s.sectionTitle}>정렬</Text>
            <View style={s.chipRow}>
              <Chip
                label="수동 (드래그)"
                active={(settings.sortMode ?? 'manual') === 'manual'}
                onPress={() => onUpdateSettings({ sortMode: 'manual' })}
              />
              <Chip
                label="마감일순"
                active={settings.sortMode === 'due'}
                onPress={() => onUpdateSettings({ sortMode: 'due' })}
              />
            </View>
            </View>

            <View style={s.section}>
            <Text style={s.sectionTitle}>완료 자동 정리</Text>
            <Text style={s.hint}>
              완료로 보낸 뒤 설정한 일수가 지난 할 일을 앱을 열 때 자동으로 삭제해요.
              {settings.autoCleanDays ? ` (현재: ${settings.autoCleanDays}일)` : ' (현재: 끔)'}
            </Text>
            <View style={s.chipRow}>
              <Chip
                label="끄기"
                active={!settings.autoCleanDays}
                onPress={() => onUpdateSettings({ autoCleanDays: null })}
              />
              {[30, 60, 90].map((n) => (
                <Chip
                  key={n}
                  label={`${n}일`}
                  active={settings.autoCleanDays === n}
                  onPress={() => onUpdateSettings({ autoCleanDays: n })}
                />
              ))}
            </View>
            <View style={s.catRow}>
              <TextInput
                style={s.catEditInput}
                value={cleanText}
                onChangeText={setCleanText}
                onSubmitEditing={applyCustomClean}
                placeholder="직접 입력 (일수)"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
              />
              <Pressable style={s.smallBtn} onPress={applyCustomClean}>
                <Text style={s.smallBtnText}>적용</Text>
              </Pressable>
            </View>
            </View>

            <View style={s.section}>
            <Text style={s.sectionTitle}>앱 설정</Text>
            <Text style={s.settingLabel}>부화 효과음 (꽥!)</Text>
            <View style={s.chipRow}>
              <Chip
                label="켬"
                active={settings.soundOn !== false}
                onPress={() => onUpdateSettings({ soundOn: true })}
              />
              <Chip
                label="끔"
                active={settings.soundOn === false}
                onPress={() => onUpdateSettings({ soundOn: false })}
              />
            </View>
            <Text style={s.settingLabel}>주간 부화 목표 (주간 통계에 진행률 표시)</Text>
            <View style={s.chipRow}>
              <Chip
                label="끄기"
                active={!settings.weeklyGoal}
                onPress={() => onUpdateSettings({ weeklyGoal: null })}
              />
              {[5, 10, 15].map((n) => (
                <Chip
                  key={n}
                  label={`${n}마리`}
                  active={settings.weeklyGoal === n}
                  onPress={() => onUpdateSettings({ weeklyGoal: n })}
                />
              ))}
            </View>
            <View style={s.catRow}>
              <TextInput
                style={s.catEditInput}
                value={goalText}
                onChangeText={setGoalText}
                onSubmitEditing={applyCustomGoal}
                placeholder="직접 입력 (마리)"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
              />
              <Pressable style={s.smallBtn} onPress={applyCustomGoal}>
                <Text style={s.smallBtnText}>적용</Text>
              </Pressable>
            </View>
            <Text style={s.settingLabel}>앱 아이콘 배지 (남은 알 개수 표시)</Text>
            <View style={s.chipRow}>
              <Chip
                label="켬"
                active={!!settings.badgeOn}
                onPress={() => onUpdateSettings({ badgeOn: true })}
              />
              <Chip
                label="끔"
                active={!settings.badgeOn}
                onPress={() => onUpdateSettings({ badgeOn: false })}
              />
            </View>
            <Text style={s.settingLabel}>주간 리포트 알림 (일요일 저녁 8시)</Text>
            <View style={s.chipRow}>
              <Chip
                label="켬"
                active={!!settings.weeklyReport}
                onPress={() => onUpdateSettings({ weeklyReport: true })}
              />
              <Chip
                label="끔"
                active={!settings.weeklyReport}
                onPress={() => onUpdateSettings({ weeklyReport: false })}
              />
            </View>
            <Text style={s.settingLabel}>앱 잠금 (Face ID / 기기 암호)</Text>
            <View style={s.chipRow}>
              <Chip
                label="켬"
                active={!!settings.lockEnabled}
                onPress={() => toggleLock(true)}
              />
              <Chip
                label="끔"
                active={!settings.lockEnabled}
                onPress={() => toggleLock(false)}
              />
            </View>
            </View>

            <View style={s.section}>
            <Text style={s.sectionTitle}>데이터 백업</Text>
            <Text style={s.hint}>
              파일로 내보낸 뒤 iCloud Drive에 저장하면 안전하게 보관돼요. 다른 폰에서도
              불러올 수 있어요. (단계에 첨부한 파일은 백업에 포함되지 않아요.)
            </Text>
            <View style={s.backupRow}>
              <Pressable style={s.backupBtn} onPress={doExport}>
                <Text style={s.backupBtnText}>📤 백업 내보내기</Text>
              </Pressable>
              <Pressable style={s.backupBtn} onPress={doPick}>
                <Text style={s.backupBtnText}>📥 백업 불러오기</Text>
              </Pressable>
            </View>
            {snapshots.length > 0 && (
              <>
                <Text style={s.snapLabel}>
                  자동 백업 — 매일 첫 실행 때 저장돼요 (최근 3개)
                </Text>
                {snapshots.map((d) => (
                  <View key={d} style={s.catRow}>
                    <Text style={s.catName}>🕐 {d}</Text>
                    <Pressable style={s.smallGhostBtn} onPress={() => restoreSnapshot(d)}>
                      <Text style={s.smallGhostText}>복구</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}
            {pending && (
              <View style={s.confirmBox}>
                <Text style={s.confirmText}>
                  할 일 {pending.todos.length}개 · 분류 {pending.categories.length}개를
                  불러올까요?{'\n'}지금 있는 데이터는 사라져요!
                </Text>
                <View style={s.confirmRow}>
                  <Pressable style={s.smallGhostBtn} onPress={() => setPending(null)}>
                    <Text style={s.smallGhostText}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={s.smallBtn}
                    onPress={async () => {
                      await onImport(pending);
                      setPending(null);
                      setMsg('백업을 불러왔어요, 꽥!');
                    }}
                  >
                    <Text style={s.smallBtnText}>덮어쓰기</Text>
                  </Pressable>
                </View>
              </View>
            )}
            </View>

            {!!msg && <Text style={s.msg}>{msg}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(93, 67, 36, 0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: C.barBg,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
  },
  xBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.sub,
  },
  section: {
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: C.sub,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: C.faint,
    marginBottom: 8,
  },
  guideBtn: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guideBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
  snapLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: C.faint,
  },
  settingLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: C.faint,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 9,
  },
  catName: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    fontWeight: '600',
  },
  catEditInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
    marginRight: 8,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.orange,
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  smallGhostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  smallGhostText: {
    color: C.faint,
    fontWeight: '700',
    fontSize: 13,
  },
  smallDangerText: {
    color: C.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  backupRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  backupBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
  confirmBox: {
    marginTop: 10,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    padding: 12,
  },
  confirmText: {
    fontSize: 13,
    lineHeight: 19,
    color: C.text,
    fontWeight: '600',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  msg: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: C.sub,
    fontWeight: '600',
  },
});
