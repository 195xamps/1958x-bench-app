import { apiClient } from '../api';
import type { AdminUser, AdminChat, AdminJob, AdminStats } from '../../types/admin';

interface Paged<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

interface PageOpts { limit?: number; offset?: number }

function pageQuery(opts?: PageOpts): string {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.offset != null) params.set('offset', String(opts.offset));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  async getUsers(opts?: PageOpts): Promise<Paged<AdminUser>> {
    const { data } = await apiClient.get(`/api/admin/users${pageQuery(opts)}`);
    return data;
  },

  async getAllChats(opts?: PageOpts): Promise<Paged<{ chat: AdminChat; user: AdminUser | null }>> {
    const { data } = await apiClient.get(`/api/admin/all-chats${pageQuery(opts)}`);
    return data;
  },

  async getAllJobs(opts?: PageOpts): Promise<Paged<AdminJob>> {
    const { data } = await apiClient.get(`/api/admin/all-jobs${pageQuery(opts)}`);
    return data;
  },

  async getUserChats(userId: string, opts?: PageOpts): Promise<AdminChat[]> {
    const { data } = await apiClient.get(`/api/admin/users/${userId}/chats${pageQuery(opts)}`);
    return data;
  },

  async getUserJobs(userId: string, opts?: PageOpts): Promise<AdminJob[]> {
    const { data } = await apiClient.get(`/api/admin/users/${userId}/jobs${pageQuery(opts)}`);
    return data;
  },

  async getStats(): Promise<AdminStats> {
    const { data } = await apiClient.get('/api/admin/stats');
    return data;
  },

  async updateUser(userId: string, patch: { isAdmin?: boolean; isApproved?: boolean; tokenQuota?: number | null }): Promise<AdminUser> {
    const { data } = await apiClient.patch(`/api/admin/users/${userId}`, patch);
    return data.user;
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/api/admin/users/${userId}`);
  },

  async deleteJob(jobId: string): Promise<void> {
    await apiClient.delete(`/api/admin/jobs/${jobId}`);
  },
};
