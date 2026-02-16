import { apiClient } from '../api';

export const communityApi = {
  async list(params?: { search?: string; circuitFamily?: string; make?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.circuitFamily) query.append('circuitFamily', params.circuitFamily);
    if (params?.make) query.append('make', params.make);
    const { data } = await apiClient.get('/api/community/jobs?' + query.toString());
    return data;
  },
  async get(id: string) {
    const { data } = await apiClient.get('/api/community/jobs/' + id);
    return data;
  },
};
