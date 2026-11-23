import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { onlyOrderFields } from '../lib/order-validation.js';
import {
  notificationCount,
  listNotifications,
  readNotification,
  readAllNotifications,
} from '../services/notifications.js';
export const notificationsRouter = Router();
notificationsRouter.use(...requireRole(['buyer', 'farmer']));
notificationsRouter.get('/count', async (req, res) =>
  res.json({ success: true, unreadCount: await notificationCount(req.user.id) }),
);
notificationsRouter.get('/', async (req, res) =>
  res.json({ success: true, ...(await listNotifications(req.user.id, req.query)) }),
);
notificationsRouter.post('/read-all', async (req, res) => {
  onlyOrderFields(req.body, []);
  await readAllNotifications(req.user.id);
  res.json({ success: true });
});
notificationsRouter.post('/:id/read', async (req, res) => {
  onlyOrderFields(req.body, []);
  await readNotification(req.user.id, req.params.id);
  res.json({ success: true });
});
