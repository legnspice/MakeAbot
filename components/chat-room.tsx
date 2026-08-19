"use client";

import { RealtimeChat } from "@/components/realtime-chat";
import { RatingModal } from "@/components/rating-modal";
import { createMessage, getConversation } from "@/lib/actions/messages";
import { markChatNotificationRead } from "@/lib/actions/notifications";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import type { SelectMessage } from "@/lib/db/schema";
import { useAuth } from "@/contexts/auth-context";
import { getPublicUsers } from "@/lib/actions/users";
import { getDealStatus } from "@/lib/actions/deals";
import { Spinner } from "@/components/ui/spinner";
import {
  PushPermissionModal,
  PUSH_PROMPT_KEY,
} from "@/components/push-permission-modal";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { needsIosInstall } from "@/lib/pwa";

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
  offer_bid_id?: string | null;
  disabled?: boolean;
  otherName?: string;
  otherAvatarUrl?: string;
  dealDone?: boolean;
  /** Server-decided review eligibility. Passed by the chat page; when absent
   *  this component asks the server itself. Never derived on the client. */
  canReview?: boolean;
}
export const ChatRoom = ({
  other_user_id,
  request_bid_id,
  offer_bid_id,
  disabled = false,
  otherName,
  otherAvatarUrl: otherAvatarUrlProp,
  dealDone,
  canReview,
}: ChatRoomProps) => {
  const [dbMessages, setDbMessages] = useState<SelectMessage[]>([]);
  const [otherUserName, setOtherUserName] = useState("Unknown User");
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | undefined>();
  const [chatDataLoading, setChatDataLoading] = useState(true);
  const [showPushModal, setShowPushModal] = useState(false);
  const { requestPermissionAndSubscribe } = usePushSubscription();

  const processedMessageIds = useRef<Set<string>>(new Set());
  const processedIncomingIds = useRef<Set<string>>(new Set());

  const { userData } = useAuth();
  const publicUser = userData.publicUser;

  // Mark the coalesced message notification as read when the user opens this chat.
  useEffect(() => {
    const contextId = request_bid_id ?? offer_bid_id;
    if (!contextId) return;
    void markChatNotificationRead(contextId);
  }, [request_bid_id, offer_bid_id]);

  useEffect(() => {
    // Reset state for new conversation
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDbMessages([]);
    setChatDataLoading(true);
    processedMessageIds.current.clear();

    async function loadData() {
      const result = await getConversation({
        user1_id: publicUser.id,
        user2_id: other_user_id,
        request_bid_id: request_bid_id || null,
        offer_bid_id: offer_bid_id || null,
      });

      if (result.data) {
        setDbMessages(result.data);
        result.data.forEach((msg) => processedMessageIds.current.add(msg.id));
      }

      if (otherName === undefined) {
        const result2 = await getPublicUsers([other_user_id]);
        if (result2.data && result2.data.length > 0) {
          setOtherUserName(result2.data[0].name || "Unknown User");
          setOtherAvatarUrl(result2.data[0].avatar_url ?? undefined);
        }
      }

      setChatDataLoading(false);
    }
    loadData();
  }, [publicUser.id, other_user_id, request_bid_id, offer_bid_id]);

  // Mirror name/avatar props into state without touching messages/loading.
  useEffect(() => {
    if (otherName !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOtherUserName(otherName || "Unknown User");
      setOtherAvatarUrl(otherAvatarUrlProp);
    }
  }, [otherName, otherAvatarUrlProp]);

  const handleMessageLogic = useRef<(messages: ChatMessage[]) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    handleMessageLogic.current = async (messages: ChatMessage[]) => {
      // Mark notification read when the other user sends us a message while we're in this chat.
      // The upsert in push.service sets is_read=false on each new message; this re-marks it read.
      const contextId = request_bid_id ?? offer_bid_id;
      const newIncoming = messages.filter(
        (msg) =>
          msg.user.userId !== publicUser.id &&
          !processedIncomingIds.current.has(msg.id),
      );
      if (newIncoming.length > 0 && contextId) {
        newIncoming.forEach((msg) => processedIncomingIds.current.add(msg.id));
        void markChatNotificationRead(contextId);
      }

      // Existing outgoing-message logic (unchanged):
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
          offer_bid_id: offer_bid_id || null,
        });
      }

      // Contextual push prompt: messaging is the main funnel, so this is where
      // most users first have a reason to want notifications. Once only.
      // On iOS Safari `Notification` is undefined until the app is installed —
      // those users get the Add-to-Home-Screen variant of the modal instead.
      const canPrompt =
        typeof Notification !== "undefined"
          ? Notification.permission === "default"
          : needsIosInstall();
      if (
        newMessagesFromCurrentUser.length > 0 &&
        canPrompt &&
        !localStorage.getItem(PUSH_PROMPT_KEY)
      ) {
        setShowPushModal(true);
      }
    };
  }, [
    publicUser.name,
    publicUser.id,
    other_user_id,
    request_bid_id,
    offer_bid_id,
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
            ? (publicUser.name ?? "You")
            : otherUserName,
        userId: msg.sender_id,
      },
      createdAt: msg.timestamp.toISOString(),
    }));
  }, [dbMessages, publicUser.id, publicUser.name, otherUserName]);

  const bid_id = request_bid_id ?? offer_bid_id;
  const dealKind: "offer" | "request" = request_bid_id ? "request" : "offer";

  const [ratingOpen, setRatingOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Review eligibility is decided on the server (reviewEligibility) and simply
  // rendered here: it already accounts for bid completion, party membership and
  // whether this user has reviewed. Nothing is re-derived client-side.
  useEffect(() => {
    if (!bid_id || hasReviewed) return;
    (async () => {
      const eligible =
        canReview !== undefined
          ? canReview
          : ((await getDealStatus(bid_id, dealKind)).data?.canReview ?? false);
      if (eligible) setRatingOpen(true);
    })();
  }, [bid_id, dealKind, dealDone, canReview, hasReviewed]);

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
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <>
      <RealtimeChat
        roomName={roomName}
        username={publicUser.name || "You"}
        currentUserId={publicUser.id}
        onMessage={handleMessage}
        messages={formattedMessages}
        otherAvatarUrl={otherAvatarUrl}
        disabled={disabled}
      />
      <RatingModal
        open={ratingOpen}
        onClose={handleRatingClose}
        ratedUserId={other_user_id}
        offerBidId={offer_bid_id}
        requestBidId={request_bid_id}
      />
      {showPushModal && (
        <PushPermissionModal
          onEnable={async () => {
            localStorage.setItem(PUSH_PROMPT_KEY, "true");
            await requestPermissionAndSubscribe().catch(() => {});
            setShowPushModal(false);
          }}
          onSkip={() => {
            localStorage.setItem(PUSH_PROMPT_KEY, "true");
            setShowPushModal(false);
          }}
        />
      )}
    </>
  );
};
