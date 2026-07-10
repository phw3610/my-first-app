import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';

export default function Chip({ label, active, color, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[s.chip, active && s.active]}
    >
      {color ? <View style={[s.dot, { backgroundColor: color }]} /> : null}
      <Text style={[s.text, active && s.activeText]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 6,
  },
  active: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
  },
  activeText: {
    color: '#FFFFFF',
  },
});
