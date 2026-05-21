// AI相关类型定义
import type { TaskInfo } from "./tasks";

// 消息输入类型
export interface MessageInput {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "task_summary" | "question";
  payload?: Record<string, unknown>;
}

// 消息响应类型（包含 ID 和完整信息）
export interface MessageResponse extends MessageInput {
  id: number;
  createdAt: string;
}

// AI对话输入类型
export interface AIChatInput {
  message: string;
  audioUrl?: string;
}

// AI对话响应类型
export interface AIChatResponse {
  content: string;
  type: "text" | "task_summary" | "question";
  payload?: {
    task?: TaskInfo;
    conflictingTasks?: TaskInfo[];
  };
}

/** SSE：Agent 处理中 */
export interface AIChatStreamStatusEvent {
  message: string;
}

/** SSE：正文增量 */
export interface AIChatStreamDeltaEvent {
  content: string;
}

/** SSE：完整结果（含 type / payload） */
export interface AIChatStreamDoneEvent {
  response: AIChatResponse;
}

/** SSE：错误 */
export interface AIChatStreamErrorEvent {
  message: string;
}
