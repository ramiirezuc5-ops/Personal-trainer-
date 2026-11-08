import { Notification } from '../models/Notification.js';
import { notFound } from '../utils/errors.js';

export async function listMine(userId) {
  const [items, unread] = await Promise.all([Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50), Notification.countDocuments({ user: userId, readAt: null })]);
  return { items, unread };
}
export async function markRead(userId, id) {
  const n = await Notification.findOneAndUpdate({ _id: id, user: userId }, { $set: { readAt: new Date() } }, { new: true });
  if (!n) throw notFound('Notificación no encontrada.');
  return n;
}
export const markAllRead = (userId) => Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
