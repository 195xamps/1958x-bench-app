import { apiClient } from '../api';

export const jobsApi = {
  async list(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const { data } = await apiClient.get('/api/bench-jobs?' + query.toString());
    return data;
  },
  async get(id: string) {
    const { data } = await apiClient.get('/api/bench-jobs/' + id);
    return data;
  },
  async create(payload: any) {
    const { data } = await apiClient.post('/api/bench-jobs', payload);
    return data;
  },
  async delete(id: string) {
    await apiClient.delete('/api/bench-jobs/' + id);
  },
  async updateStatus(id: string, status: string) {
    const { data } = await apiClient.patch('/api/bench-jobs/' + id + '/status', { status });
    return data;
  },
  async updateNotes(id: string, techNotes: string) {
    const { data } = await apiClient.patch('/api/bench-jobs/' + id + '/notes', { techNotes });
    return data;
  },
  async completeSafetyChecklist(id: string) {
    const { data } = await apiClient.patch('/api/bench-jobs/' + id + '/safety-checklist');
    return data;
  },
  async updateAmpProfile(id: string, profile: any) {
    const { data } = await apiClient.patch('/api/bench-jobs/' + id + '/amp-profile', profile);
    return data;
  },
  async updateSharing(id: string, sharing: any) {
    const { data } = await apiClient.patch('/api/bench-jobs/' + id + '/sharing', sharing);
    return data;
  },
  async getChat(jobId: string) {
    const { data } = await apiClient.get('/api/bench-jobs/' + jobId + '/chat');
    return data;
  },
  async getSchematics(jobId: string) {
    const { data } = await apiClient.get('/api/bench-jobs/' + jobId + '/schematics');
    return data;
  },
  async attachSchematic(jobId: string, schematicId: string) {
    await apiClient.post('/api/bench-jobs/' + jobId + '/schematics', { schematicId });
  },
  async detachSchematic(jobId: string, schematicId: string) {
    await apiClient.delete('/api/bench-jobs/' + jobId + '/schematics/' + schematicId);
  },
};
