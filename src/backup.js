import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export async function exportBackup(data) {
  const json = JSON.stringify(
    { app: 'quack-todo', version: 2, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
  const filename = `quack-todo-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '백업 파일 저장',
  });
}

export async function pickBackup() {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];

  let text;
  if (Platform.OS === 'web') {
    text = await (await fetch(asset.uri)).text();
  } else {
    const FileSystem = require('expo-file-system/legacy');
    text = await FileSystem.readAsStringAsync(asset.uri);
  }

  const parsed = JSON.parse(text);
  const data = parsed.data ?? parsed;
  if (!Array.isArray(data.todos) || !Array.isArray(data.categories)) {
    throw new Error('올바른 백업 파일이 아니에요');
  }
  return data;
}
