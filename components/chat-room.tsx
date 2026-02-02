"use-client";

import { RealtimeChat } from "@/components/realtime-chat";
import { createMessage } from "@/app/actions/messages";
import { createClient } from "@/lib/client";
import { useMessagesQuery } from "@/hooks/use-messages-query";

interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string;
}

export const ChatRoom = async ({
  user_id1,
  user_id2,
  request_bid_id,
  post_bid_id,
}: {
  user_id1: string;
  user_id2: string;
  request_bid_id?: string | undefined;
  post_bid_id?: string | undefined;
}) => {
  // const supabase = await createClient();

  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();

  // const user_id = user?.id;

  const handleMessage = async (content: string) => {
    // Store messages in your database

    await createMessage({
      sender_id: user_id1,
      receiver_id: user_id2,
      content,
      request_bid_id,
      post_bid_id,
    });
  };

  // const { data: messages } = useMessagesQuery();
  const bid_id = request_bid_id ? request_bid_id : post_bid_id;
  const roomName = [user_id1, user_id2, bid_id].sort().join("_");

  return (
    <RealtimeChat
      roomName={roomName}
      username="john_doe"
      // onMessage={handleMessage}
      // messages={messages}
    />
  );
};
