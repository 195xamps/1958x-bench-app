import { API_URL } from '../../utils/config';

export const authApi = {
  async getCurrentUser() {
    try {
      const response = await fetch(API_URL + '/api/auth/user', { credentials: 'include' });
      if (response.ok) return await response.json();
      return null;
    } catch { return null; }
  },
  async exchangeMobileToken(token: string) {
    try {
      const response = await fetch(API_URL + '/api/auth/mobile-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (response.ok) return await response.json();
      return null;
    } catch { return null; }
  },
  getLoginUrl(mobile = false) {
    return API_URL + '/api/login' + (mobile ? '?mobile=true' : '');
  },
  getLogoutUrl() {
    return API_URL + '/api/logout';
  },
};
