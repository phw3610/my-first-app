import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export async function pickAttachment() {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled) return null;
  const asset = res.assets[0];

  if (Platform.OS === 'web') {
    return { name: asset.name, uri: asset.uri };
  }

  const FileSystem = require('expo-file-system/legacy');
  const dir = FileSystem.documentDirectory + 'attachments/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const dest = dir + Date.now() + '-' + asset.name;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  return { name: asset.name, uri: dest };
}

export async function openAttachment(attachment) {
  if (Platform.OS === 'web') {
    window.open(attachment.uri, '_blank');
    return;
  }
  const Sharing = require('expo-sharing');
  await Sharing.shareAsync(attachment.uri);
}
