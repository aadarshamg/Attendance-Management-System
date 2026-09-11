import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '@ams/shared';
import { api, setAuthToken } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (employeeCode: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  consent: () => Promise<void>;
}

const STORAGE_KEY = 'ams.auth';
const AuthCtx = createContext<AuthState | null>(null);

interface Persisted {
  token: string;
  user: AuthUser;
}

function readPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function persist(p: Persisted | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted | null>(() => {
    const p = readPersisted();
    if (p) setAuthToken(p.token);
    return p;
  });

  const logout = useCallback(() => {
    setAuthToken(null);
    persist(null);
    setState(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('ams:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ams:unauthorized', onUnauthorized);
  }, [logout]);

  const login = useCallback(async (employeeCode: string, password: string) => {
    const res = await api.login(employeeCode, password);
    setAuthToken(res.token);
    const next: Persisted = { token: res.token, user: res.user };
    persist(next);
    setState(next);
    return res.user;
  }, []);

  const refresh = useCallback(async () => {
    const user = await api.me();
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user };
      persist(next);
      return next;
    });
  }, []);

  const consent = useCallback(async () => {
    await api.giveConsent();
    await refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user: state?.user ?? null,
      token: state?.token ?? null,
      login,
      logout,
      refresh,
      consent,
    }),
    [state, login, logout, refresh, consent],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
