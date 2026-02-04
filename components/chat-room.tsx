"use client";

import { RealtimeChat } from "@/components/realtime-chat";
import { createMessage, getConversation } from "@/app/actions/messages";
import { useCallback, useEffect, useState } from "react";
import type { SelectMessage } from "@/lib/db/schema";

interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string;
}

interface ChatRoomProps {
  current_user_id: string;
  current_user_name: string;
  other_user_id: string;
  other_user_name: string;
  request_bid_id?: string | null; // Changed to accept null
  post_bid_id?: string | null; // Changed to accept null
}

export const ChatRoom = ({
  current_user_id,
  current_user_name,
  other_user_id,
  other_user_name,
  request_bid_id,
  post_bid_id,
}: ChatRoomProps) => {
  const [dbMessages, setDbMessages] = useState<SelectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMessages() {
      const result = await getConversation({
        user1_id: current_user_id,
        user2_id: other_user_id,
        request_bid_id: request_bid_id || null,
        post_bid_id: post_bid_id || null,
      });

      if (result.data) {
        setDbMessages(result.data);
      }
      setIsLoading(false);
    }
    loadMessages();
  }, [current_user_id, other_user_id, request_bid_id, post_bid_id]);

  const formattedMessages: ChatMessage[] = dbMessages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    user: {
      name:
        msg.sender_id === current_user_id ? current_user_name : other_user_name,
    },
    createdAt: msg.timestamp.toISOString(),
  }));

  const handleMessage = useCallback(
    async (messages: ChatMessage[]) => {
      const newMessagesFromCurrentUser = messages.filter(
        (msg) =>
          msg.user.name === current_user_name &&
          !dbMessages.some((dbMsg) => dbMsg.id === msg.id),
      );

      for (const message of newMessagesFromCurrentUser) {
        await createMessage({
          sender_id: current_user_id,
          receiver_id: other_user_id,
          content: message.content,
          request_bid_id: request_bid_id || null,
          post_bid_id: post_bid_id || null,
        });
      }
    },
    [
      current_user_id,
      current_user_name,
      other_user_id,
      request_bid_id,
      post_bid_id,
      dbMessages,
    ],
  );

  const bid_id = request_bid_id ?? post_bid_id;
  const roomName = [current_user_id, other_user_id, bid_id].sort().join("_");

  if (isLoading) {
    return <div>Loading messages...</div>;
  }

  return (
    <RealtimeChat
      roomName={roomName}
      username={current_user_name}
      onMessage={handleMessage}
      messages={formattedMessages}
    />
  );
};
