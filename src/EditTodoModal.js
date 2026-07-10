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
import {
  attachmentIcon,
  makeLinkAttachment,
  openAttachment,
  pickFileAttachment,
  pickPhotoAttachment,
} from './attachments';
import Chip from './Chip';
import EggIcon from './EggIcon';
import { C } from './theme';

const resizeSteps = (steps, n) => {
  const next = steps.slice(0, n);
  while (next.length < n) next.push({ text: '', attachments: [] });
  return next;
};

const pad = (n) => String(n).padStart(2, '0');
const fmtReminder = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function EditTodoModal({ todo, categories, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(todo.title);
  const [categoryId, setCategoryId] = useState(todo.categoryId);
  const [steps, setSteps] = useState(resizeSteps(todo.steps ?? [], todo.totalSteps));
  const [doneSteps, setDoneSteps] = useState(todo.doneSteps);
  const [chooserFor, setChooserFor] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [linkText, setLinkText] = useState('');
  const [reminder, setReminder] = useState(todo.reminder?.at ?? null);
  const [remDay, setRemDay] = useState('today');
  const [remTime, setRemTime] = useState('');
  const [repeat, setRepeat] = useState(todo.repeat ?? null);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? null);
  const [dueText, setDueText] = useState('');
  const [msg, setMsg] = useState('');

  const totalSteps = steps.length;
  const done = Math.min(doneSteps, totalSteps);

  const patchStep = (i, fn) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? fn(s) : s)));

  const addAttachment = (i, att) => {
    if (!att) return;
    patchStep(i, (s) => ({ ...s, attachments: [...s.attachments, att] }));
  };

  const removeAttachment = (i, j) =>
    patchStep(i, (s) => ({
      ...s,
      attachments: s.attachments.filter((_, idx) => idx !== j),
    }));

  const addLink = (i) => {
    const att = makeLinkAttachment(linkText);
    if (att) addAttachment(i, att);
    setLinkText('');
    setLinkFor(null);
  };

  const addPhoto = async (i) => {
    setChooserFor(null);
    try {
      addAttachment(i, await pickPhotoAttachment());
    } catch (e) {
      setMsg(e.message);
    }
  };

  const addFile = async (i) => {
    setChooserFor(null);
    try {
      addAttachment(i, await pickFileAttachment());
    } catch (e) {
      setMsg(e.message);
    }
  };

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const toggleWeekday = (d) => {
    const days = repeat?.days ?? [];
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    setRepeat({ kind: 'weekly', days: next });
  };

  const dateFromOffset = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const applyDueDate = () => {
    const m = dueText.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) {
      setMsg('마감일을 7/15 형식으로 입력해주세요');
      return;
    }
    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, Number(m[1]) - 1, Number(m[2]));
    if (candidate < new Date(year, now.getMonth(), now.getDate())) year += 1;
    setMsg('');
    setDueDate(
      `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`,
    );
    setDueText('');
  };

  const applyReminder = () => {
    const m = remTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      setMsg('시간을 20:00 형식으로 입력해주세요');
      return;
    }
    const d = new Date();
    if (remDay === 'tomorrow') d.setDate(d.getDate() + 1);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (d.getTime() <= Date.now()) {
      setMsg('이미 지난 시간이에요');
      return;
    }
    setMsg('');
    setReminder(d.toISOString());
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
                    onChangeText={(t) => patchStep(i, (st) => ({ ...st, text: t }))}
                    placeholder={`${i + 1}단계 내용`}
                    placeholderTextColor={C.faint}
                  />
                  <Pressable
                    testID={`attach-${i}`}
                    style={s.attachBtn}
                    onPress={() => {
                      setChooserFor(chooserFor === i ? null : i);
                      setLinkFor(null);
                    }}
                    hitSlop={6}
                  >
                    <Text style={s.attachBtnText}>📎</Text>
                  </Pressable>
                </View>

                {chooserFor === i && (
                  <View style={s.chooserRow}>
                    <Chip
                      label="🔗 링크"
                      onPress={() => {
                        setChooserFor(null);
                        setLinkFor(i);
                      }}
                    />
                    <Chip label="🖼️ 사진" onPress={() => addPhoto(i)} />
                    <Chip label="📄 파일" onPress={() => addFile(i)} />
                  </View>
                )}

                {linkFor === i && (
                  <View style={s.linkRow}>
                    <TextInput
                      style={s.linkInput}
                      value={linkText}
                      onChangeText={setLinkText}
                      onSubmitEditing={() => addLink(i)}
                      placeholder="https://..."
                      placeholderTextColor={C.faint}
                      autoFocus
                    />
                    <Pressable style={s.smallBtn} onPress={() => addLink(i)}>
                      <Text style={s.smallBtnText}>추가</Text>
                    </Pressable>
                  </View>
                )}

                {step.attachments.map((att, j) => (
                  <View key={j} style={s.attachRow}>
                    <Pressable style={s.attachName} onPress={() => openAttachment(att)}>
                      <Text
                        style={[s.attachNameText, !att.uri && s.attachNameMissing]}
                        numberOfLines={1}
                      >
                        {attachmentIcon(att.type)} {att.name}
                        {!att.uri ? ' (파일 없음)' : ''}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => removeAttachment(i, j)} hitSlop={6}>
                      <Text style={s.attachRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
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

            <Text style={s.label}>알림</Text>
            {reminder ? (
              <View style={s.reminderRow}>
                <Text style={s.reminderText}>⏰ {fmtReminder(reminder)}</Text>
                <Pressable style={s.smallGhostBtn} onPress={() => setReminder(null)}>
                  <Text style={s.smallDangerText}>해제</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.reminderRow}>
                <Chip
                  label="오늘"
                  active={remDay === 'today'}
                  onPress={() => setRemDay('today')}
                />
                <Chip
                  label="내일"
                  active={remDay === 'tomorrow'}
                  onPress={() => setRemDay('tomorrow')}
                />
                <TextInput
                  style={s.timeInput}
                  value={remTime}
                  onChangeText={setRemTime}
                  onSubmitEditing={applyReminder}
                  placeholder="20:00"
                  placeholderTextColor={C.faint}
                />
                <Pressable style={s.smallBtn} onPress={applyReminder}>
                  <Text style={s.smallBtnText}>설정</Text>
                </Pressable>
              </View>
            )}
            <Text style={s.label}>반복</Text>
            <View style={s.chipRow}>
              <Chip label="없음" active={!repeat} onPress={() => setRepeat(null)} />
              <Chip
                label="매일"
                active={repeat?.kind === 'daily'}
                onPress={() => setRepeat({ kind: 'daily' })}
              />
              <Chip
                label="매주"
                active={repeat?.kind === 'weekly'}
                onPress={() => setRepeat({ kind: 'weekly', days: repeat?.days ?? [] })}
              />
            </View>
            {repeat?.kind === 'weekly' && (
              <View style={[s.chipRow, s.weekdayRow]}>
                {WEEKDAYS.map((name, d) => (
                  <Chip
                    key={d}
                    label={name}
                    active={(repeat.days ?? []).includes(d)}
                    onPress={() => toggleWeekday(d)}
                  />
                ))}
              </View>
            )}

            <Text style={s.label}>마감일</Text>
            {dueDate ? (
              <View style={s.reminderRow}>
                <Text style={s.reminderText}>
                  📅 {Number(dueDate.slice(5, 7))}/{Number(dueDate.slice(8, 10))}
                </Text>
                <Pressable style={s.smallGhostBtn} onPress={() => setDueDate(null)}>
                  <Text style={s.smallDangerText}>해제</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.reminderRow}>
                <Chip label="오늘" onPress={() => setDueDate(dateFromOffset(0))} />
                <Chip label="내일" onPress={() => setDueDate(dateFromOffset(1))} />
                <TextInput
                  style={s.timeInput}
                  value={dueText}
                  onChangeText={setDueText}
                  onSubmitEditing={applyDueDate}
                  placeholder="7/15"
                  placeholderTextColor={C.faint}
                />
                <Pressable style={s.smallBtn} onPress={applyDueDate}>
                  <Text style={s.smallBtnText}>설정</Text>
                </Pressable>
              </View>
            )}

            {!!msg && <Text style={s.msg}>{msg}</Text>}

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
                    reminderAt: reminder,
                    repeat,
                    dueDate,
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
  chooserRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginLeft: 34,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 34,
  },
  linkInput: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    paddingHorizontal: 10,
    fontSize: 13,
    color: C.text,
    marginRight: 8,
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
  attachNameMissing: {
    textDecorationLine: 'none',
    color: C.faint,
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
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekdayRow: {
    marginTop: 6,
  },
  reminderText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginRight: 8,
  },
  timeInput: {
    width: 74,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    paddingHorizontal: 10,
    fontSize: 14,
    color: C.text,
    textAlign: 'center',
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
  smallDangerText: {
    color: C.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  msg: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: C.danger,
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
