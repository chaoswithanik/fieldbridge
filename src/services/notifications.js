import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { privatePage, uuidPattern } from '../lib/order-validation.js';
export async function notificationCount(userId) {
  return models.Notification.count({ where: { recipientId: userId, readAt: null } });
}
export async function listNotifications(userId, query) {
  const page = privatePage(query);
  const { rows, count } = await models.Notification.findAndCountAll({
    where: { recipientId: userId },
    limit: 20,
    offset: (page - 1) * 20,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  return {
    notifications: rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      orderId: row.orderId,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    unreadCount: await notificationCount(userId),
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / 20)),
  };
}
export async function readNotification(userId, id) {
  if (!uuidPattern.test(id || '')) throw new AppError(404, 'নোটিফিকেশনটি খুঁজে পাওয়া যায়নি।');
  const row = await models.Notification.findOne({ where: { id, recipientId: userId } });
  if (!row) throw new AppError(404, 'নোটিফিকেশনটি খুঁজে পাওয়া যায়নি।');
  // Retain the original read time when a request is repeated.
  await models.Notification.update(
    { readAt: new Date() },
    { where: { id, recipientId: userId, readAt: null } },
  );
}
export async function readAllNotifications(userId) {
  await models.Notification.update(
    { readAt: new Date() },
    { where: { recipientId: userId, readAt: null } },
  );
}
