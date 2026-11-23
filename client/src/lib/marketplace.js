import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from './api.js';

export const marketFilterKeys = [
  'q',
  'district',
  'upazila',
  'unit',
  'minQuantity',
  'maxQuantity',
  'minPrice',
  'maxPrice',
  'harvestFrom',
  'harvestTo',
  'availableFrom',
  'availableTo',
];
export const emptyMarketFilters = Object.fromEntries(marketFilterKeys.map((key) => [key, '']));

export function useMarketResource(path) {
  const { user, loading: authLoading } = useAuth();
  const key = `${path}|${user?.id || 'guest'}|${user?.role || ''}|${user?.buyerProfile?.status || ''}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', data: null, loading: true, error: null });
  useEffect(() => {
    if (authLoading) return;
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
    ...(state.key === key && !authLoading ? state : { data: null, loading: true, error: null }),
    reload: () => setRevision((value) => value + 1),
  };
}
