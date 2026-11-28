import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from './api.js';

// Discard a previous account's response immediately, including during a new request.
export function useApiResource(path) {
  const { user, loading: authLoading } = useAuth();
  const key = `${path}|${user?.id || 'guest'}|${user?.role || ''}|${user?.buyerProfile?.status || ''}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', data: null, loading: true, error: null });
  useEffect(() => {
    if (authLoading || !path) return;
    let active = true;
    setState({ key, data: null, loading: true, error: null });
    apiRequest(path)
      .then((data) => {
        if (active) setState({ key, data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ key, data: null, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [path, key, authLoading, revision]);
  return {
    ...(!path
      ? { data: null, loading: false, error: null }
      : state.key === key && !authLoading
        ? state
        : { data: null, loading: true, error: null }),
    replaceData: (data) => setState((current) =>
      current.key === key ? { key, data, loading: false, error: null } : current,
    ),
    reload: () => setRevision((value) => value + 1),
  };
}
