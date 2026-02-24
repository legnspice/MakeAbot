"use client";

import { RealtimeChat } from "@/components/realtime-chat";
import { createMessage, getConversation } from "@/lib/actions/messages";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import type { SelectMessage } from "@/lib/db/schema";
import { useAuth } from "@/contexts/auth-context";
import { getUsers } from "@/lib/actions/users";

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

  const handleMessageLogic = useRef<(messages: ChatMessage[]) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    handleMessageLogic.current = async (messages: ChatMessage[]) => {
      const newMessagesFromCurrentUser = messages.filter(
        (msg) =>
          msg.user.name === publicUser.name &&
          !processedMessageIds.current.has(msg.id),
      );

      for (const message of newMessagesFromCurrentUser) {
        processedMessageIds.current.add(message.id);

        await createMessage({
          sender_id: publicUser.id,
          receiver_id: other_user_id,
          content: message.content,
          request_bid_id: request_bid_id || null,
          post_bid_id: post_bid_id || null,
        });
      }
    };
  }, [
    publicUser.name,
    publicUser.id,
    other_user_id,
    request_bid_id,
    post_bid_id,
  ]);

  const handleMessage = useCallback((messages: ChatMessage[]) => {
    return handleMessageLogic.current(messages);
  }, []);

  // Memoize formattedMessages BEFORE the early return
  const formattedMessages = useMemo<ChatMessage[]>(() => {
    return dbMessages.map((msg) => ({
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
  }, [dbMessages, publicUser.id, publicUser.name, otherUserName]);

  const bid_id = request_bid_id ?? post_bid_id;
  const roomName = useMemo(
    () => [publicUser.id, other_user_id, bid_id].sort().join("_"),
    [publicUser.id, other_user_id, bid_id],
  );

  // NOW you can do the early return - AFTER all hooks
  if (chatDataLoading) {
    return <div>Loading messages...</div>;
  }

  return (
    <RealtimeChat
      roomName={roomName}
      username={publicUser.name || "You"}
      onMessage={handleMessage}
      messages={formattedMessages}
    />
  );
};
