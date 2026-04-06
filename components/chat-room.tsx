"use client";

import { RealtimeChat } from "@/components/realtime-chat";
import { DealActionBanner } from "@/components/deal-action-banner";
import { RatingModal } from "@/components/rating-modal";
import { createMessage, getConversation } from "@/lib/actions/messages";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import type { SelectMessage } from "@/lib/db/schema";
import { useAuth } from "@/contexts/auth-context";
import { getUsers } from "@/lib/actions/users";
import { getReviews } from "@/lib/actions/reviews";
import { getDealStatus } from "@/lib/actions/deals";

interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
    userId: string;
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
          msg.user.userId === publicUser.id &&
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
            ? publicUser.name ?? "You"
            : otherUserName,
        userId: msg.sender_id,
      },
      createdAt: msg.timestamp.toISOString(),
    }));
  }, [dbMessages, publicUser.id, publicUser.name, otherUserName]);

  const bid_id = request_bid_id ?? post_bid_id;
  const dealKind: "offer" | "request" = request_bid_id ? "request" : "offer";

  const [ratingOpen, setRatingOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Check if user already left a review for this deal
  useEffect(() => {
    if (!bid_id) return;
    (async () => {
      const statusResult = await getDealStatus(bid_id, dealKind);
      const isCompleted =
        dealKind === "request"
          ? statusResult.data?.parentStatus === "Completed"
          : statusResult.data?.parentStatus === "Closed";

      if (isCompleted) {
        const reviewsResult = await getReviews({
          creator_id: publicUser.id,
          ...(request_bid_id
            ? { request_bid_id }
            : { post_bid_id: post_bid_id! }),
        });
        const alreadyReviewed = (reviewsResult.data ?? []).length > 0;
        setHasReviewed(alreadyReviewed);
        if (!alreadyReviewed) {
          setRatingOpen(true);
        }
      }
    })();
  }, [bid_id, dealKind, publicUser.id, request_bid_id, post_bid_id]);

  const handleDealFinished = () => {
    setRatingOpen(true);
  };

  const handleRatingClose = () => {
    setRatingOpen(false);
    setHasReviewed(true);
  };

  const roomName = useMemo(
    () => [publicUser.id, other_user_id, bid_id].sort().join("_"),
    [publicUser.id, other_user_id, bid_id],
  );

  // NOW you can do the early return - AFTER all hooks
  if (chatDataLoading) {
    return <div>Loading messages...</div>;
  }

  const dealButton = bid_id ? (
    <DealActionBanner
      bidId={bid_id}
      kind={dealKind}
      currentUserId={publicUser.id}
      onFinished={handleDealFinished}
    />
  ) : undefined;

  return (
    <>
      <RealtimeChat
        roomName={roomName}
        username={publicUser.name || "You"}
        currentUserId={publicUser.id}
        onMessage={handleMessage}
        messages={formattedMessages}
        actionButton={dealButton}
      />
      <RatingModal
        open={ratingOpen}
        onClose={handleRatingClose}
        ratedUserId={other_user_id}
        postBidId={post_bid_id}
        requestBidId={request_bid_id}
      />
    </>
  );
};
