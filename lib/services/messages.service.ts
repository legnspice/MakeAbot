import * as messagesRepo from "../repo/messages.repo";

export async function getMessages(filters: {
  id?: string;
  sender_id?: string;
  receiver_id?: string;
  request_bid_id?: string;
  post_bid_id?: string;
  content?: string;
  timestamp?: Date;
}) {
  try {
    return await messagesRepo.findMessages(filters);
  } catch (error) {
    console.error("Failed to get messages from db: ", error);
    throw error;
  }
}
