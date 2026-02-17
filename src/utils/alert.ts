import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? title + '\n\n' + message : title);
  } else {
    Alert.alert(title, message);
  }
}

export function showConfirm(
  title: string,
  message: string,
  options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): Promise<boolean> {
  const { confirmText = 'OK', cancelText = 'Cancel', destructive = false } = options || {};
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(title + '\n\n' + message));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function showError(message: string): void {
  showAlert('Error', message);
}

export function openUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    const { Linking } = require('react-native');
    Linking.openURL(url);
  }
}
