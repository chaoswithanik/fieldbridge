import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from './api.js';
export function useNotificationCount(user) {
  const { pathname } = useLocation(),
    id = ['buyer', 'farmer'].includes(user?.role) ? user.id : null;
  const [state, setState] = useState({ id: null, count: 0 });
  useEffect(() => {
    if (!id) return;
    let active = true,
      sequence = 0;
    async function update() {
      const current = ++sequence;
      try {
        const data = await apiRequest('notifications/count');
        if (active && sequence === current) setState({ id, count: data.unreadCount });
      } catch {
        /* The notification page provides explicit retry/error feedback. */
      }
    }
    update();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') update();
    }, 30000);
    window.addEventListener('focus', update);
    window.addEventListener('fieldbridge:notifications', update);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', update);
      window.removeEventListener('fieldbridge:notifications', update);
    };
  }, [id, pathname]);
  return state.id === id ? state.count : 0;
}
