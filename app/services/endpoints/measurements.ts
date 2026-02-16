import { apiClient } from '../api';

export const measurementsApi = {
  async list(benchJobId: string) {
    const { data } = await apiClient.get('/api/measurements/' + benchJobId);
    return data;
  },
  async create(payload: any) {
    const { data } = await apiClient.post('/api/measurements', payload);
    return data;
  },
};
