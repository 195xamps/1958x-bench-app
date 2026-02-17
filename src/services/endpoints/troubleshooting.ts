import { apiClient } from '../api';

export const troubleshootingApi = {
  async start(params: { benchJobId?: string; mode?: string }) {
    const { data } = await apiClient.post('/api/troubleshooting/start', {
      benchJobId: params.benchJobId,
      mode: params.mode || 'guided',
    });
    return data;
  },
  async chat(payload: { sessionId: string; message: string; benchJobContext?: any }) {
    const { data } = await apiClient.post('/api/troubleshooting/chat', payload);
    return data;
  },
};
