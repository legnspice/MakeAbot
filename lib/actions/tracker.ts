"use server";

import * as trackerService from "@/lib/services/tracker.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";

export async function getTrackerData() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return trackerService.getTrackerData(user.id);
  });
}
