"use client";

import { RealtimeChat } from "@/components/realtime-chat";
import { createMessage, getConversation } from "@/app/actions/messages";
import { useCallback, useEffect, useState, useRef } from "react";
import type { SelectMessage } from "@/lib/db/schema";
import { useAuth } from "@/contexts/auth-context";
import { getUsers } from "@/app/actions/users";

interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string;
}

interface ChatRoomProps {
  other_user_id: string;
  request_bid_id?: string | null;
  post_bid_id?: string | null;
}

export const ChatRoom = ({
  other_user_id,
  request_bid_id,
  post_bid_id,
}: ChatRoomProps) => {
  const [dbMessages, setDbMessages] = useState<SelectMessage[]>([]);
  const [otherUserName, setOtherUserName] = useState("Unknown User");
  const [chatDataLoading, setChatDataLoading] = useState(true);

  // Use ref to track processed messages - doesn't cause re-renders
  const processedMessageIds = useRef<Set<string>>(new Set());

  const { userData } = useAuth();
  const publicUser = userData.publicUser;

  useEffect(() => {
    async function loadData() {
      const result = await getConversation({
        user1_id: publicUser.id,
        user2_id: other_user_id,
        request_bid_id: request_bid_id || null,
        post_bid_id: post_bid_id || null,
      });

      if (result.data) {
        setDbMessages(result.data);
        // Mark existing messages as processed
        result.data.forEach((msg) => processedMessageIds.current.add(msg.id));
      }

      const result2 = await getUsers({ id: other_user_id });
      if (result2.data && result2.data.length > 0) {
        setOtherUserName(result2.data[0].name || "Unknown User");
      }

      setChatDataLoading(false);
    }
    loadData();
  }, [publicUser.id, other_user_id, request_bid_id, post_bid_id]);

  const handleMessage = useCallback(
    async (messages: ChatMessage[]) => {
      // Find new messages from current user that haven't been processed
      const newMessagesFromCurrentUser = messages.filter(
        (msg) =>
          msg.user.name === publicUser.name &&
          !processedMessageIds.current.has(msg.id),
      );

      // Save each new message
      for (const message of newMessagesFromCurrentUser) {
        // Mark as processed BEFORE saving to prevent duplicates
        processedMessageIds.current.add(message.id);

        await createMessage({
          sender_id: publicUser.id,
          receiver_id: other_user_id,
          content: message.content,
          request_bid_id: request_bid_id || null,
          post_bid_id: post_bid_id || null,
        });
      }
    },
    [
      publicUser.name,
      publicUser.id,
      other_user_id,
      request_bid_id,
      post_bid_id,
    ],
  );

  // Show loading while chat data loads
  if (chatDataLoading) {
    return <div>Loading messages...</div>;
  }

  // Format messages for display
  const formattedMessages: ChatMessage[] = dbMessages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    user: {
      name:
        msg.sender_id === publicUser.id
          ? publicUser.name || "You"
          : otherUserName,
    },
    createdAt: msg.timestamp.toISOString(),
  }));

  // Determine realtime chat parameters
  const bid_id = request_bid_id ?? post_bid_id;
  const roomName = [publicUser.id, other_user_id, bid_id].sort().join("_");

  return (
    <RealtimeChat
      roomName={roomName}
      username={publicUser.name || "Anonymous"}
      onMessage={handleMessage}
      messages={formattedMessages}
    />
  );
};
