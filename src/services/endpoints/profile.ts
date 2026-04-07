import { apiClient } from '../api';

export interface UserProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  hasCustomApiKey: boolean;
  chatCount: number;
  jobCount: number;
}

export const profileApi = {
  async getMe(): Promise<UserProfile> {
    const { data } = await apiClient.get('/api/profile/me');
    return data;
  },
  async updateApiKey(apiKey: string | null): Promise<{ hasCustomApiKey: boolean }> {
    const { data } = await apiClient.patch('/api/profile/api-key', { apiKey });
    return data;
  },
};
