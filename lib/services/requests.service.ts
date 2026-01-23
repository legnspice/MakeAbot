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

export async function createRequest(data: {
  user_id: string;
  title: string;
  fee?: number;
  status?: RequestStatus;
  description?: string;
  urgency?: Urgency;
}) {
  try {
    return await requestsRepo.insertRequest(data);
  } catch (error) {
    console.error("Failed to create request with db: ", error);
    throw error;
  }
}

export async function createRequestBid(data: {
  request_id: string;
  bidder_id: string;
}) {
  try {
    return await requestsRepo.insertRequestBid(data);
  } catch (error) {
    console.error("Failed to create a request bid from db: ", error);
    throw error;
  }
}

export async function removeRequest(id: string) {
  try {
    return await requestsRepo.deleteRequest(id);
  } catch (error) {
    console.error("Failed to delete request from db: ", error);
    throw error;
  }
}

export async function removeRequestBid(id: string) {
  try {
    return await requestsRepo.deleteRequestBid(id);
  } catch (error) {
    console.error("Failed to delete request bid from db: ", error);
    throw error;
  }
}

export async function editRequest(
  id: string,
  data: {
    fee?: number;
    title?: string;
    description?: string;
    status?: RequestStatus;
    urgency?: Urgency;
    completed_at?: Date;
  },
) {
  try {
    return await requestsRepo.updateRequest(id, data);
  } catch (error) {
    console.error("Failed to update request from db: ", error);
    throw error;
  }
}
