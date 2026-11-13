import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, AUTH_EXPIRED_EVENT } from '../services/api';
import { authApi } from '../services/endpoints';
import type { User } from '../types/api';

type Status = 'loading' | 'authenticated' | 'anonymous';
interface AuthApi { user: User | null; status: Status; login: (email: string, password: string, portal?: 'trainer' | 'student') => Promise<User>; logout: () => Promise<void> }

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    authApi.me().then(
      ({ user: u }) => { if (!cancelled) { setUser(u); setStatus('authenticated'); } },
      (err: unknown) => { if (!cancelled) { setUser(null); setStatus('anonymous'); if (!(err instanceof ApiError) || err.status !== 401) console.error(err); } },
    );
    return () => { cancelled = true; };
  }, []);

  // Si la sesión no se puede renovar, volvemos al ingreso.
  useEffect(() => {
    const onExpired = () => { setUser(null); setStatus('anonymous'); };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string, portal?: 'trainer' | 'student') => {
    const { user: u } = await authApi.login(email, password, portal);
    setUser(u); setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { setUser(null); setStatus('anonymous'); }
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
