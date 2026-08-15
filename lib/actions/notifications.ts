"use server";

import * as notificationsService from "@/lib/services/notifications.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  UpdatePreferencesSchema,
  updatePreferencesSchema,
} from "@/lib/validation/notifications";

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

export async function updateNotificationPreferences(
  data: UpdatePreferencesSchema,
) {
  return await handleAction(async () => {
    const user = await requireAuth();
    // Parse, don't trust the type: a Server Action takes whatever the client
    // sends. Without this, a crafted `user_id` would be passed straight into
    // the UPDATE and could reassign another user's preferences row.
    const parsed = updatePreferencesSchema.parse(data);
    return notificationsService.updatePreferences(user.id, parsed);
  });
}

export async function markChatNotificationRead(contextId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.markChatRead(user.id, contextId);
  });
}
