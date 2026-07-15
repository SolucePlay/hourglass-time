import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { decodeHourglassJwt } from '../utils/jwt';

const JWT_KEY = 'hourglass_jwt';

// Abstraction pour le stockage sécurisé (SecureStore sur mobile, localStorage sur web)
const StorageAdapter = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    } else {
      try {
        const SecureStore = await import('expo-secure-store');
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    }
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {}
    } else {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(key, value);
      } catch {}
    }
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {}
    } else {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
      } catch {}
    }
  },
};

interface AuthState {
  jwt: string | null;
  xsrfToken: string | null;
  userUuid: string | null;
  isLoading: boolean;
  signIn: (jwt: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [jwt, setJwt] = useState<string | null>(null);
  const [xsrfToken, setXsrfToken] = useState<string | null>(null);
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await StorageAdapter.getItemAsync(JWT_KEY);
      if (stored) applyToken(stored);
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyToken(token: string) {
    // D'abord on stocke le token brut (XSRF token du login WebView)
    setJwt(token);
    setXsrfToken(token);
    
    // Ensuite on essaie de décoder si c'est un JWT
    const payload = decodeHourglassJwt(token);
    if (payload) {
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        // Expiré, on nettoie
        setJwt(null);
        setXsrfToken(null);
        setUserUuid(null);
        return;
      }
      setXsrfToken(payload.xsrf_token ?? token);
      setUserUuid(payload.user_uuid ?? null);
    }
  }

  async function signIn(token: string) {
    await StorageAdapter.setItemAsync(JWT_KEY, token);
    applyToken(token);
  }

  async function signOut() {
    await StorageAdapter.deleteItemAsync(JWT_KEY);
    setJwt(null);
    setXsrfToken(null);
    setUserUuid(null);
  }

  return (
    <AuthContext.Provider value={{ jwt, xsrfToken, userUuid, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur d\'un <AuthProvider>');
  return ctx;
}