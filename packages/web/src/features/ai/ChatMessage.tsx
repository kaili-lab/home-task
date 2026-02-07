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
  const formatTimeSegment = (segment?: string | null) => {
    if (segment === "early_morning") return "凌晨";
    if (segment === "morning") return "早上";
    if (segment === "forenoon") return "上午";
    if (segment === "noon") return "中午";
    if (segment === "afternoon") return "下午";
    if (segment === "evening") return "晚上";
    return "全天";
  };

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

      <div className={cn("flex-1 flex flex-col", isUser && "items-end")}>
        {/* 主消息框 */}
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

        {/* 任务卡片（仅 AI 消息） */}
        {!isUser && message.payload?.task && (
          <div className="mt-3 max-w-md w-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 text-gray-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">✅</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900">{message.payload.task.title}</h4>
                <div className="text-sm text-gray-700 mt-2 space-y-1">
                  <p>📅 {message.payload.task.dueDate}</p>
                  {message.payload.task.startTime ? (
                    <p>⏰ {message.payload.task.startTime}-{message.payload.task.endTime}</p>
                  ) : (
                    <p>⏰ {formatTimeSegment(message.payload.task.timeSegment)}</p>
                  )}
                  <p>🏷️ 优先级: {message.payload.task.priority}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 冲突警告（仅 AI 消息） */}
        {!isUser && message.payload?.conflictingTasks && message.payload.conflictingTasks.length > 0 && (
          <div className="mt-3 max-w-md w-full bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200 text-gray-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-red-900">时间冲突</h4>
                <div className="text-sm text-gray-700 mt-2 space-y-1">
                  {message.payload.conflictingTasks.map((task, idx) => (
                    <p key={idx}>
                      • {task.title} ({task.startTime}-{task.endTime})
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
