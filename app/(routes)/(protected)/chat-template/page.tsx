"use-client";

import { ChatRoom } from "@/components/chat-room";

export default function ChatTemplate() {
  return (
    <ChatRoom
      current_user_id=""
      current_user_name=""
      other_user_id=""
      other_user_name=""
      request_bid_id=""
      post_bid_id=""
    />
  );
}
