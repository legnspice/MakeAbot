"use server";

import * as notificationsService from "@/lib/services/notifications.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { UpdatePreferencesSchema } from "@/lib/validation/notifications";

export async function getNotifications() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.getNotificationsForUser(user.id);
  });
}

export async function markNotificationRead(notificationId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.markRead(notificationId, user.id);
  });
}

export async function markAllRead() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.markAllRead(user.id);
  });
}

export async function getNotificationPreferences() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.getPreferences(user.id);
  });
}

export async function updateNotificationPreferences(data: UpdatePreferencesSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.updatePreferences(user.id, data);
  });
}
