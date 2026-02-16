import { Platform } from 'react-native';

export function getApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
}

export const API_URL = getApiUrl();
