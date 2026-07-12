import { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from './theme';

const TIPS = [
  ['▶ / ❯ 버튼', '할 일을 시작하고, 단계를 하나씩 끝내요. 다 끝나면 알이 부화해요!'],
  ['행을 오른쪽으로 쓸기', '다음 단계로 진행돼요.'],
  ['행을 왼쪽으로 쓸기', '부화한 할 일을 완료함으로 보내요. (완료함에선 되돌리기)'],
  ['행을 길게 누르기', '드래그해서 순서를 바꾸거나 다른 분류로 옮겨요.'],
  ['행을 탭', '내용·단계·알림·반복·마감일을 편집하는 팝업이 열려요.'],
  ['왼쪽 위 오리를 탭', '하루보기(시간 차트/통계)로 전환돼요.'],
  ['제목을 좌우로 쓸기', '페이지(점 ●)를 오가요. 점을 눌러도 돼요.'],
  ['분류 제목을 탭', '그 분류를 접거나 펼쳐요.'],
];

export default function GuideModal({ onClose }) {
  const C = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <ScrollView contentContainerStyle={s.scrollContent}>
            <View style={s.headerRow}>
              <Text style={s.heading}>사용법</Text>
              <Pressable testID="guide-close" style={s.xBtn} onPress={onClose} hitSlop={8}>
                <Text style={s.xBtnText}>✕</Text>
              </Pressable>
            </View>
            <View style={s.mascotBox}>
              <Image source={require('../assets/mascot.png')} style={s.mascot} />
              <Text style={s.welcome}>할 일을 알에서 부화시켜 보세요, 꽥!</Text>
            </View>
            {TIPS.map(([title, desc]) => (
              <View key={title} style={s.tip}>
                <Text style={s.tipTitle}>{title}</Text>
                <Text style={s.tipDesc}>{desc}</Text>
              </View>
            ))}
            <Pressable testID="guide-start" style={s.startBtn} onPress={onClose}>
              <Text style={s.startBtnText}>시작하기 🐥</Text>
            </Pressable>
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
    mascotBox: {
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 10,
    },
    mascot: {
      width: 96,
      height: 96,
    },
    welcome: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '700',
      color: C.sub,
    },
    tip: {
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 8,
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: C.text,
    },
    tipDesc: {
      marginTop: 3,
      fontSize: 13,
      lineHeight: 19,
      color: C.sub,
    },
    startBtn: {
      marginTop: 16,
      backgroundColor: C.orange,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    startBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
  });
