import type { ChatMessage as ChatMessageType } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { currentUser } = useCurrentUser();
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-white text-sm",
            isUser
              ? `bg-linear-to-br ${currentUser.color}`
              : "bg-linear-to-br from-purple-400 to-purple-500",
          )}
        >
          {isUser ? currentUser.initials : "🤖"}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex-1 flex", isUser && "justify-end")}>
        <div
          className={cn(
            "rounded-2xl p-4 max-w-md",
            isUser
              ? "bg-orange-500 text-white rounded-tr-none"
              : "bg-white text-gray-700 rounded-tl-none shadow-sm border border-gray-100",
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          <time className={cn("text-xs mt-2 block", isUser ? "text-orange-100" : "text-gray-400")}>
            {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      </div>
    </div>
  );
}
