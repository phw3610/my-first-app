import { useState } from 'react';
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
import { C } from './theme';

export default function MenuModal({
  data,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onImport,
  onClose,
}) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [pending, setPending] = useState(null);
  const [msg, setMsg] = useState('');

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    onAddCategory(name);
    setNewName('');
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
          <ScrollView>
            <Text style={s.heading}>메뉴 🐥</Text>

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
                    onPress={() => {
                      onImport(pending);
                      setPending(null);
                      setMsg('백업을 불러왔어요, 꽥!');
                    }}
                  >
                    <Text style={s.smallBtnText}>덮어쓰기</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {!!msg && <Text style={s.msg}>{msg}</Text>}

            <Pressable testID="menu-close" style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeText}>닫기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    padding: 20,
    maxHeight: '85%',
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
  },
  sectionTitle: {
    marginTop: 18,
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
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
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
  closeBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
});
