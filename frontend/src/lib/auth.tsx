import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth as authApi, users as usersApi } from '../api';
import type { RegisterPayload, UserPublic } from '../api/types';
import { clearToken, loadToken, saveToken } from '../api/client';

type Ctx = {
  user: UserPublic | null;
  ready: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUser(await usersApi.me());
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { access_token } = await authApi.login(identifier.trim(), password);
    await saveToken(access_token);
    setUser(await usersApi.me());
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    await signIn(payload.phone || payload.email || '', payload.password);
  }, [signIn]);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, refresh }),
    [user, ready, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
