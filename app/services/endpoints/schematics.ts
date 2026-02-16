import { apiClient } from '../api';

export const schematicsApi = {
  async list() {
    const { data } = await apiClient.get('/api/schematics');
    return data;
  },
  async get(id: string) {
    const { data } = await apiClient.get('/api/schematics/' + id);
    return data;
  },
  async search(query: string) {
    const { data } = await apiClient.get('/api/schematics/search', { params: { q: query } });
    return data;
  },
  async create(payload: any) {
    const { data } = await apiClient.post('/api/schematics', payload);
    return data;
  },
  async update(id: string, updates: any) {
    const { data } = await apiClient.patch('/api/schematics/' + id, updates);
    return data;
  },
  async delete(id: string) {
    await apiClient.delete('/api/schematics/' + id);
  },
  async listAttachments(schematicId: string) {
    const { data } = await apiClient.get('/api/schematics/' + schematicId + '/attachments');
    return data;
  },
  async addAttachment(schematicId: string, attachment: any) {
    const { data } = await apiClient.post('/api/schematics/' + schematicId + '/attachments', attachment);
    return data;
  },
  async deleteAttachment(schematicId: string, attachmentId: string) {
    await apiClient.delete('/api/schematics/' + schematicId + '/attachments/' + attachmentId);
  },
};
