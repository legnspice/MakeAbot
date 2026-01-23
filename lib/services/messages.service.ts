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

export async function createMessage(data: {
  sender_id: string;
  receiver_id: string;
  content: string;
  request_bid_id?: string;
  post_bid_id?: string;
}) {
  try {
    return await messagesRepo.insertMessage(data);
  } catch (error) {
    console.error("Failed to insert message with db: ", error);
    throw error;
  }
}

export async function removeMessage(id: string) {
  try {
    return await messagesRepo.deleteMessage(id);
  } catch (error) {
    console.error("Failed to delete message from db: ", error);
    throw error;
  }
}
