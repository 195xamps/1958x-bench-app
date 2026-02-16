import { apiClient } from '../api';

export const articlesApi = {
  async list() {
    const { data } = await apiClient.get('/api/reference-articles');
    return data;
  },
  async get(id: string) {
    const { data } = await apiClient.get('/api/reference-articles/' + id);
    return data;
  },
  async importFromUrl(url: string) {
    const { data } = await apiClient.post('/api/reference-articles/import', { url });
    return data;
  },
  async updateTitle(id: string, title: string) {
    const { data } = await apiClient.patch('/api/reference-articles/' + id, { title });
    return data;
  },
  async delete(id: string) {
    await apiClient.delete('/api/reference-articles/' + id);
  },
};

export const podcastApi = {
  async listEpisodes() {
    const { data } = await apiClient.get('/api/podcast/episodes');
    return data;
  },
  async listTopics() {
    const { data } = await apiClient.get('/api/podcast/topics');
    return data;
  },
  async search(query: string) {
    if (!query.trim()) return [];
    const { data } = await apiClient.get('/api/podcast/search', { params: { q: query } });
    return data;
  },
  async sync() {
    const { data } = await apiClient.post('/api/podcast/sync');
    return data;
  },
};
