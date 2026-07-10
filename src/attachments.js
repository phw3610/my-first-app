import { Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

async function copyToStorage(uri, name) {
  if (Platform.OS === 'web') return uri;
  const FileSystem = require('expo-file-system/legacy');
  const dir = FileSystem.documentDirectory + 'attachments/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const dest = dir + Date.now() + '-' + name;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

// 종류: 'link' | 'photo' | 'file' — 모두 {type, name, uri} 형태
export function makeLinkAttachment(url) {
  let u = url.trim();
  if (!u) return null;
  if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  return { type: 'link', name: url.trim(), uri: u };
}

export async function pickFileAttachment() {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const uri = await copyToStorage(asset.uri, asset.name);
  return { type: 'file', name: asset.name, uri };
}

export async function pickPhotoAttachment() {
  const ImagePicker = require('expo-image-picker');
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('사진 접근 권한이 필요해요');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  const uri = await copyToStorage(asset.uri, name);
  return { type: 'photo', name, uri };
}

export async function openAttachment(attachment) {
  if (!attachment.uri) return; // 백업에서 복원되어 파일 실체가 없는 경우
  if (attachment.type === 'link') {
    if (Platform.OS === 'web') window.open(attachment.uri, '_blank');
    else await Linking.openURL(attachment.uri);
    return;
  }
  if (Platform.OS === 'web') {
    window.open(attachment.uri, '_blank');
    return;
  }
  const Sharing = require('expo-sharing');
  await Sharing.shareAsync(attachment.uri);
}

export const attachmentIcon = (type) =>
  type === 'link' ? '🔗' : type === 'photo' ? '🖼️' : '📄';
