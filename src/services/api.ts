import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_URL } from '../utils/config';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
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
