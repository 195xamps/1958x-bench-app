import { apiClient } from '../api';

export const chatsApi = {
  async list() {
    const { data } = await apiClient.get('/api/chats');
    return data;
  },
  async get(id: string) {
    const { data } = await apiClient.get('/api/chats/' + id);
    return data;
  },
  async create(params?: { title?: string; benchJobId?: string }) {
    const { data } = await apiClient.post('/api/chats', {
      title: params?.title || 'New Chat',
      benchJobId: params?.benchJobId,
    });
    return data;
  },
  async rename(id: string, title: string) {
    const { data } = await apiClient.patch('/api/chats/' + id, { title });
    return data;
  },
  async delete(id: string) {
    await apiClient.delete('/api/chats/' + id);
  },
  async sendMessage(chatId: string, content: string, attachments?: any[] | null) {
    const { data } = await apiClient.post('/api/chats/' + chatId + '/messages', {
      content,
      attachments: attachments?.length ? attachments : undefined,
    });
    return data;
  },
  async convertToJob(chatId: string) {
    const { data } = await apiClient.post('/api/chats/' + chatId + '/convert-to-job');
    return data;
  },
};
