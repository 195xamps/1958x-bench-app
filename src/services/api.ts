import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_URL } from '../utils/config';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// iOS URLCache (and React Native's underlying networking layer) can cache
// GET responses aggressively, sometimes ignoring server Cache-Control. To
// guarantee freshness, we send no-cache request headers AND tag every GET
// with a millisecond cache-buster query param so the URL itself is unique.
apiClient.interceptors.request.use((config) => {
  if ((config.method || 'get').toLowerCase() === 'get') {
    config.headers = config.headers || {};
    (config.headers as any)['Cache-Control'] = 'no-cache';
    (config.headers as any)['Pragma'] = 'no-cache';
    config.params = { ...(config.params || {}), _t: Date.now() };
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    const status = error.response?.status;
    return Promise.reject({ message, status, original: error });
  }
);

export interface ApiError {
  message: string;
  status?: number;
  original: AxiosError;
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'message' in error && 'original' in error;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
