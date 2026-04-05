import * as notificationsRepo from "../repo/notifications.repo";
import { UpdatePreferencesSchema } from "../validation/notifications";

export async function getNotificationsForUser(userId: string) {
  return await notificationsRepo.findNotificationsForUser(userId);
}

export async function getUnreadCount(userId: string) {
  return await notificationsRepo.countUnreadForUser(userId);
}

export async function markRead(notificationId: string, userId: string) {
  return await notificationsRepo.markNotificationRead(notificationId, userId);
}

export async function markAllRead(userId: string) {
  return await notificationsRepo.markAllNotificationsRead(userId);
}

export async function getPreferences(userId: string) {
  return await notificationsRepo.findPreferences(userId);
}

export async function updatePreferences(userId: string, data: UpdatePreferencesSchema) {
  return await notificationsRepo.updatePreferences(userId, data);
}

export async function markChatRead(userId: string, contextId: string) {
  return await notificationsRepo.markMessageNotificationReadByContext(userId, contextId);
}
