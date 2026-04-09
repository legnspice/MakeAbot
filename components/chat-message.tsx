import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-realtime-chat";

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
  avatarUrl?: string;
}

export const ChatMessageItem = ({
  message,
  isOwnMessage,
  showHeader,
  avatarUrl,
}: ChatMessageItemProps) => {
  return (
    <div
      className={`flex mt-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar for other user */}
      {!isOwnMessage && (
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mr-2 mt-auto">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={message.user.name}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="flex items-center justify-center w-full h-full text-xs font-medium text-gray-500 uppercase">
              {message.user.name.charAt(0)}
            </span>
          )}
        </div>
      )}
      <div
        className={cn("max-w-[75%] w-fit flex flex-col gap-1", {
          "items-end": isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn("flex items-center gap-2 text-xs px-3", {
              "justify-end flex-row-reverse": isOwnMessage,
            })}
          >
            <span className="font-medium">{message.user.name}</span>
            <span className="text-foreground/50 text-xs">
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            "py-2 px-3 rounded-xl text-sm w-fit",
            isOwnMessage
              ? "bg-[#3761B0] text-white"
              : "bg-muted text-foreground",
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};
