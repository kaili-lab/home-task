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
