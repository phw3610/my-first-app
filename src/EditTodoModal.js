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
import { openAttachment, pickAttachment } from './attachments';
import Chip from './Chip';
import EggIcon from './EggIcon';
import { C } from './theme';

const resizeSteps = (steps, n) => {
  const next = steps.slice(0, n);
  while (next.length < n) next.push({ text: '', attachment: null });
  return next;
};

export default function EditTodoModal({ todo, categories, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(todo.title);
  const [categoryId, setCategoryId] = useState(todo.categoryId);
  const [steps, setSteps] = useState(resizeSteps(todo.steps ?? [], todo.totalSteps));
  const [doneSteps, setDoneSteps] = useState(todo.doneSteps);

  const totalSteps = steps.length;
  const done = Math.min(doneSteps, totalSteps);

  const setStepText = (i, text) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, text } : s)));

  const setStepAttachment = (i, attachment) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, attachment } : s)));

  const attach = async (i) => {
    try {
      const att = await pickAttachment();
      if (att) setStepAttachment(i, att);
    } catch (e) {
      // 선택 취소 등은 조용히 무시
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.headRow}>
              <EggIcon total={totalSteps} done={done} size={40} />
              <Text style={s.heading}>할 일 편집</Text>
            </View>

            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="할 일 내용"
              placeholderTextColor={C.faint}
            />

            <Text style={s.label}>분류</Text>
            <View style={s.chipRow}>
              <Chip label="없음" active={!categoryId} onPress={() => setCategoryId(null)} />
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  active={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>

            <Text style={s.label}>단계 수</Text>
            <View style={s.chipRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  active={totalSteps === n}
                  onPress={() => setSteps(resizeSteps(steps, n))}
                />
              ))}
            </View>

            <Text style={s.label}>단계별 내용</Text>
            {steps.map((step, i) => (
              <View key={i} style={s.stepBlock}>
                <View style={s.stepRow}>
                  <Text style={[s.stepNum, i < done && s.stepNumDone]}>
                    {i < done ? '✓' : i + 1}
                  </Text>
                  <TextInput
                    style={s.stepInput}
                    value={step.text}
                    onChangeText={(t) => setStepText(i, t)}
                    placeholder={`${i + 1}단계 내용`}
                    placeholderTextColor={C.faint}
                  />
                  <Pressable style={s.attachBtn} onPress={() => attach(i)} hitSlop={6}>
                    <Text style={s.attachBtnText}>📎</Text>
                  </Pressable>
                </View>
                {step.attachment && (
                  <View style={s.attachRow}>
                    <Pressable
                      style={s.attachName}
                      onPress={() => openAttachment(step.attachment)}
                    >
                      <Text style={s.attachNameText} numberOfLines={1}>
                        📄 {step.attachment.name}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setStepAttachment(i, null)} hitSlop={6}>
                      <Text style={s.attachRemove}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}

            <Text style={s.label}>진행 상황</Text>
            <View style={s.stepper}>
              <Pressable style={s.stepBtn} onPress={() => setDoneSteps(Math.max(0, done - 1))}>
                <Text style={s.stepBtnText}>−</Text>
              </Pressable>
              <Text style={s.stepValue}>
                {done} / {totalSteps} 단계
              </Text>
              <Pressable
                style={s.stepBtn}
                onPress={() => setDoneSteps(Math.min(totalSteps, done + 1))}
              >
                <Text style={s.stepBtnText}>＋</Text>
              </Pressable>
            </View>

            <View style={s.actions}>
              <Pressable style={s.deleteBtn} onPress={onDelete}>
                <Text style={s.deleteText}>삭제</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={s.saveBtn}
                onPress={() =>
                  onSave({
                    title: title.trim() || todo.title,
                    categoryId,
                    totalSteps,
                    steps,
                    doneSteps: done,
                  })
                }
              >
                <Text style={s.saveText}>저장</Text>
              </Pressable>
            </View>
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
    maxHeight: '88%',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginLeft: 10,
  },
  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
  },
  label: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '700',
    color: C.faint,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  stepBlock: {
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    textAlign: 'center',
    lineHeight: 23,
    fontSize: 13,
    fontWeight: '800',
    color: C.sub,
    overflow: 'hidden',
  },
  stepNumDone: {
    backgroundColor: C.orange,
    borderColor: C.orange,
    color: '#FFFFFF',
  },
  stepInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
    marginHorizontal: 8,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnText: {
    fontSize: 15,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 34,
    marginRight: 6,
  },
  attachName: {
    flex: 1,
  },
  attachNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    textDecorationLine: 'underline',
  },
  attachRemove: {
    fontSize: 13,
    color: C.faint,
    paddingHorizontal: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.inputBg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: C.sub,
  },
  stepValue: {
    marginHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  deleteBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.danger,
  },
  deleteText: {
    color: C.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  cancelText: {
    color: C.faint,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: C.orange,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
