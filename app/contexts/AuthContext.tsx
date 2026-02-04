import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || '';
};

const API_URL = getApiUrl();

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/user`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
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
        // Parse token from the redirect URL
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        
        if (token) {
          try {
            // Exchange token for session
            const response = await fetch(`${API_URL}/api/auth/mobile-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ token }),
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('Mobile auth successful:', data.user?.email);
              setUser(data.user);
            } else {
              console.error('Token exchange failed:', await response.text());
            }
          } catch (error) {
            console.error('Error exchanging token:', error);
          }
        } else {
          // Fallback to refreshing user
          await refreshUser();
        }
      }
    }
  };

  const logout = () => {
    if (Platform.OS === 'web') {
      window.location.href = `${API_URL}/api/logout`;
    } else {
      Linking.openURL(`${API_URL}/api/logout`);
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
