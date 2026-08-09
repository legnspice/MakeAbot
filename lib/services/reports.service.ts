import * as reportsRepo from "../repo/reports.repo";
import * as relationshipsRepo from "../repo/relationships.repo";
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import { mergeReportDetails, isSelfReport } from "../reports";
import { AppError } from "../error/app-error";
import type { InsertReportSchema } from "../validation/reports";

export async function createReport(
  data: InsertReportSchema & { reporter_id: string },
): Promise<{ coalesced: boolean }> {
  // Self-report guards.
  if (isSelfReport(data.reporter_id, data.reported_user_id)) {
    throw new AppError("You can't report yourself.", 400);
  }
  if (data.reported_offer_id) {
    const offer = await offersRepo.findOfferById(data.reported_offer_id);
    if (offer?.user_id === data.reporter_id) {
      throw new AppError("You can't report your own post.", 400);
    }
  }
  if (data.reported_request_id) {
    const req = await requestsRepo.findRequestById(data.reported_request_id);
    if (req?.user_id === data.reporter_id) {
      throw new AppError("You can't report your own post.", 400);
    }
  }

  // User reports require a prior interaction; post reports stay open.
  if (data.reported_user_id) {
    const related = await relationshipsRepo.relationshipExists(
      data.reporter_id,
      data.reported_user_id,
    );
    if (!related) {
      throw new AppError(
        "You can only report someone you've interacted with.",
        403,
      );
    }
  }

  const target = {
    reported_user_id: data.reported_user_id,
    reported_offer_id: data.reported_offer_id,
    reported_request_id: data.reported_request_id,
  };
  const open = await reportsRepo.findOpenReportByTarget(data.reporter_id, target);
  if (open) {
    const merged = mergeReportDetails(open.details, data.details);
    await reportsRepo.coalesceReport(open.id, merged);
    return { coalesced: true };
  }

  await reportsRepo.insertReport(data);
  return { coalesced: false };
}
