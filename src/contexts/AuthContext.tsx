import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/api';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();
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
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

/** Load saved token and set as default header */
async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
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
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  delete apiClient.defaults.headers.common['Authorization'];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/user`, {
        credentials: 'include',
        headers: apiClient.defaults.headers.common['Authorization']
          ? { Authorization: apiClient.defaults.headers.common['Authorization'] as string }
          : {},
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
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
    if (Platform.OS === 'web') {
      window.location.href = `${API_URL}/api/login`;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/login?mobile=true`,
        'benchapp195x://auth-complete'
      );
      console.log('Auth session result:', result);
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        
        if (token) {
          try {
            const response = await fetch(`${API_URL}/api/auth/mobile-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ token }),
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('Mobile auth successful:', data.user?.email);
              if (data.apiToken) {
                await saveToken(data.apiToken);
              }
              setUser(data.user);
            } else {
              console.error('Token exchange failed:', await response.text());
            }
          } catch (error) {
            console.error('Error exchanging token:', error);
          }
        } else {
          await refreshUser();
        }
      }
    }
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
    if (Platform.OS === 'web') {
      window.location.href = `${API_URL}/api/logout`;
    } else {
      try {
        await fetch(`${API_URL}/api/logout`, { credentials: 'include' });
      } catch {}
    }
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
