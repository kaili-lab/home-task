// AI相关类型定义

// 消息输入类型
export interface MessageInput {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "task_summary" | "question";
  payload?: Record<string, unknown>;
}

// AI对话输入类型
export interface AIChatInput {
  message: string;
  audioUrl?: string;
}

// AI对话响应类型
export interface AIChatResponse {
  content: string;
  taskId?: number;
  task?: unknown;
}
