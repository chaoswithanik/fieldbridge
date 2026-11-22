import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest('auth/me');
      if (current === revision.current) setUser(data.user);
    } catch (error) {
      if (current === revision.current) {
        setUser(null);
        setLoadError(error.message);
      }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    await apiRequest('auth/logout', { method: 'POST' });
    revision.current++;
    setUser(null);
    setLoadError('');
    setLoading(false);
  }

  function acceptUser(nextUser) {
    revision.current++;
    setUser(nextUser);
    setLoading(false);
    setLoadError('');
  }

  return (
    <AuthContext.Provider value={{ user, loading, loadError, refresh, acceptUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
