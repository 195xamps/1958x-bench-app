import { apiClient } from '../api';
import { API_URL } from '../../utils/config';

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
  /**
   * Stream a chat message response via SSE.
   * onToken is called with each text chunk as it arrives.
   * Returns { userMessage, assistantMessage } when complete.
   */
  streamMessage(
    chatId: string,
    content: string,
    onToken: (token: string) => void,
    attachments?: any[] | null,
  ): { promise: Promise<{ userMessage: any; assistantMessage: any }>; abort: () => void } {
    const xhr = new XMLHttpRequest();
    let userMessage: any = null;
    let assistantMessage: any = null;
    let lastIndex = 0;

    const promise = new Promise<{ userMessage: any; assistantMessage: any }>((resolve, reject) => {
      xhr.open('POST', `${API_URL}/api/chats/${chatId}/messages?stream=true`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.withCredentials = true;

      xhr.onprogress = () => {
        const newText = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;

        const lines = newText.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'userMessage') {
              userMessage = event.message;
            } else if (event.type === 'token') {
              onToken(event.token);
            } else if (event.type === 'done') {
              assistantMessage = event.message;
            } else if (event.type === 'error') {
              reject(new Error(event.error));
            }
          } catch {}
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && assistantMessage) {
          resolve({ userMessage, assistantMessage });
        } else if (!assistantMessage) {
          // Process any remaining data
          xhr.onprogress?.call(xhr, {} as any);
          if (assistantMessage) {
            resolve({ userMessage, assistantMessage });
          } else {
            reject(new Error('Stream ended without completion'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timed out'));
      xhr.timeout = 120000; // 2 minutes for long responses

      xhr.send(JSON.stringify({
        content,
        attachments: attachments?.length ? attachments : undefined,
      }));
    });

    return { promise, abort: () => xhr.abort() };
  },
  async convertToJob(chatId: string) {
    const { data } = await apiClient.post('/api/chats/' + chatId + '/convert-to-job');
    return data;
  },
};
