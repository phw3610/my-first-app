import { Appearance } from 'react-native';

const LIGHT = {
  bg: '#FFF6DA',
  card: '#FFFFFF',
  border: '#FFE9A8',
  borderStrong: '#FFE29A',
  text: '#5D4324',
  sub: '#8A6B3A',
  faint: '#B99C5F',
  done: '#C9B37E',
  orange: '#FF9E2C',
  orangeDim: '#FFD8A6',
  inputBg: '#FFF3CC',
  barBg: '#FFFDF5',
  danger: '#E96A4C',
  green: '#7BC67E',
};

const DARK = {
  bg: '#241C12',
  card: '#382D1E',
  border: '#55432C',
  borderStrong: '#5F4B31',
  text: '#F5E8CD',
  sub: '#D9C29A',
  faint: '#A98F65',
  done: '#7E6C50',
  orange: '#FF9E2C',
  orangeDim: '#8A5F27',
  inputBg: '#463823',
  barBg: '#2C2317',
  danger: '#F07E62',
  green: '#7BC67E',
};

// 시스템 다크 모드를 따라감 (앱 시작 시점 기준)
export const isDark = Appearance.getColorScheme() === 'dark';
export const C = isDark ? DARK : LIGHT;

export const CATEGORY_COLORS = [
  '#FF9E2C', '#7BC67E', '#6FA8DC', '#C58AD6', '#E88CA0', '#8FD3C7',
];
