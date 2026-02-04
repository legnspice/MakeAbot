"use client";

import { useEffect, useState } from "react";
import { getUsers } from "@/app/actions/users";
import { ChatRoom } from "@/components/chat-room";

export default function ChatTemplate() {
  // Functionality test; TODO: REMOVE STATES AND CONFIGURE APPROPRIATELY TO UI
  const [otherUserId, setOtherUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOtherUserId() {
      const result = await getUsers({});
      if (result.data && result.data.length > 0) {
        setOtherUserId(result.data[1].id);
      }
      setIsLoading(false);
    }

    loadOtherUserId();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <ChatRoom other_user_id={otherUserId} request_bid_id="" post_bid_id="" />
  );
}
