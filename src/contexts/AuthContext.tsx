import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const TOKEN_KEY = 'benchapp_api_token';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  isApproved: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Store API token and set as default header */
async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

/** Load saved token and set as default header */
async function loadToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  } catch {
    return null;
  }
}

/** Clear saved token */
async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const auth = apiClient.defaults.headers.common['Authorization'];
      if (!auth) {
        setUser(null);
        return;
      }
      const response = await fetch(`${API_URL}/api/auth/user`, {
        headers: { Authorization: auth as string },
      });
      if (response.ok) {
        setUser(await response.json());
      } else {
        setUser(null);
        await clearToken();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadToken();
      await fetchUser();
    };
    init();
  }, []);

  const login = async () => {
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_URL}/api/login?mobile=true`,
      'benchapp195x://auth-complete'
    );
    if (result.type !== 'success' || !result.url) return;

    const url = new URL(result.url);
    const token = url.searchParams.get('token');
    if (!token) {
      await refreshUser();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/mobile-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        console.error('Token exchange failed:', await response.text());
        return;
      }
      const data = await response.json();
      if (data.apiToken) await saveToken(data.apiToken);
      setUser(data.user);
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
    try {
      await fetch(`${API_URL}/api/logout`);
    } catch {}
  };

  const refreshUser = async () => {
    setIsLoading(true);
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
