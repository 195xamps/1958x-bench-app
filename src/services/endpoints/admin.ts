import { apiClient } from '../api';
import type { AdminUser, AdminChat, AdminJob } from '../../types/admin';

export const adminApi = {
  async getUsers(): Promise<AdminUser[]> {
    const { data } = await apiClient.get('/api/admin/users');
    return data;
  },

  async getAllChats(): Promise<{ chat: AdminChat; user: AdminUser | null }[]> {
    const { data } = await apiClient.get('/api/admin/all-chats');
    return data;
  },

  async getAllJobs(): Promise<AdminJob[]> {
    const { data } = await apiClient.get('/api/admin/all-jobs');
    return data;
  },

  async getUserChats(userId: string): Promise<AdminChat[]> {
    const { data } = await apiClient.get(`/api/admin/users/${userId}/chats`);
    return data;
  },

  async getUserJobs(userId: string): Promise<AdminJob[]> {
    const { data } = await apiClient.get(`/api/admin/users/${userId}/jobs`);
    return data;
  },
};
