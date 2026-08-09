"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAdmin } from "@/lib/actions/auth";
import { AppError } from "@/lib/error/app-error";
import { isValidReportStatus } from "@/lib/reports";
import * as reportsRepo from "@/lib/repo/reports.repo";
import * as usersRepo from "@/lib/repo/users.repo";
import * as offersRepo from "@/lib/repo/offers.repo";
import * as requestsRepo from "@/lib/repo/requests.repo";
import type { SelectReport } from "@/lib/db/schema";

export type AdminReportRow = {
  report: SelectReport;
  reporterName: string;
  targetLabel: string;
};

export async function getReports(filters: { status?: string } = {}) {
  return await handleAction<AdminReportRow[]>(async () => {
    await requireAdmin();
    const rows = await reportsRepo.findReports(filters);

    const userIds = new Set<string>();
    const offerIds = new Set<string>();
    const requestIds = new Set<string>();
    for (const r of rows) {
      userIds.add(r.reporter_id);
      if (r.reported_user_id) userIds.add(r.reported_user_id);
      if (r.reported_offer_id) offerIds.add(r.reported_offer_id);
      if (r.reported_request_id) requestIds.add(r.reported_request_id);
    }

    const users = userIds.size
      ? await usersRepo.findUsers({ ids: Array.from(userIds) })
      : [];
    const userName = new Map(users.map((u) => [u.id, u.name ?? "User"]));
    const offers = await Promise.all(
      Array.from(offerIds).map((id) => offersRepo.findOfferById(id)),
    );
    const offerTitle = new Map(
      offers.filter(Boolean).map((o) => [o!.id, o!.title]),
    );
    const requests = await Promise.all(
      Array.from(requestIds).map((id) => requestsRepo.findRequestById(id)),
    );
    const requestTitle = new Map(
      requests.filter(Boolean).map((r) => [r!.id, r!.title]),
    );

    return rows.map((report) => {
      let targetLabel = "—";
      if (report.reported_user_id)
        targetLabel = `User: ${userName.get(report.reported_user_id) ?? "User"}`;
      else if (report.reported_offer_id)
        targetLabel = `Offer: ${offerTitle.get(report.reported_offer_id) ?? "(deleted)"}`;
      else if (report.reported_request_id)
        targetLabel = `Request: ${requestTitle.get(report.reported_request_id) ?? "(deleted)"}`;
      return {
        report,
        reporterName: userName.get(report.reporter_id) ?? "User",
        targetLabel,
      };
    });
  });
}

export async function updateReportStatus(id: string, status: string) {
  return await handleAction(async () => {
    await requireAdmin();
    if (!isValidReportStatus(status)) {
      throw new AppError("Invalid status.", 400);
    }
    await reportsRepo.updateReportStatus(id, status);
    return { success: true };
  });
}
