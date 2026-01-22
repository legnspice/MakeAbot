import * as requestsRepo from "../repo/requests.repo";
import { RequestStatus, Urgency } from "../db/schema";

export async function getRequests(filters: {
  id?: string;
  user_id?: string;
  fee?: number;
  title?: string;
  status?: RequestStatus;
  created_at?: Date;
  urgency?: Urgency;
}) {
  try {
    return await requestsRepo.findRequests(filters);
  } catch (error) {
    console.error("Failed to get requests from db: ", error);
    throw error;
  }
}

export async function getRequestBids(filters: {
  id?: string;
  request_id?: string;
  bidder_id?: string;
  created_at?: Date;
}) {
  try {
    return await requestsRepo.findRequestBids(filters);
  } catch (error) {
    console.error("Failed to get request bids from db: ", error);
    throw error;
  }
}
