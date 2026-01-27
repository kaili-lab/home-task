import { apiGet, apiPost } from "@/lib/api-client";
import type {
  AIChatInput,
  AIChatResponse,
  MessageInput,
} from "shared";

/**
 * 语音转文字（Whisper）
 */
export async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiPost<{ text: string; audioUrl?: string }>(
    "/api/ai/transcribe",
    formData
  );
  return response.data;
}

/**
 * AI对话（支持流式返回）
 * @param message - 消息内容
 * @param audioUrl - 音频URL（可选）
 * @param stream - 是否使用流式返回（默认false）
 * @returns 如果stream=true，返回EventSource，否则返回完整响应
 */
export async function chat(
  message: string,
  audioUrl?: string,
  stream: boolean = false
): Promise<AIChatResponse | EventSource> {
  const data: AIChatInput = { message };
  if (audioUrl) {
    data.audioUrl = audioUrl;
  }

  if (stream) {
    // 流式返回：使用EventSource
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    const url = `${API_BASE_URL}/api/ai/chat?stream=true`;
    
    // 注意：EventSource只支持GET请求，但我们需要POST
    // 所以需要使用fetch的stream模式
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`请求失败: ${response.statusText}`);
    }

    // 返回ReadableStream，调用者可以使用EventSource或直接读取stream
    // 这里简化处理，返回response.body，调用者需要自己处理SSE格式
    return response.body as unknown as EventSource;
  }

  // 完整响应
  const response = await apiPost<AIChatResponse>("/api/ai/chat", data);
  return response.data;
}

/**
 * 获取对话历史
 */
export async function getMessages(limit: number = 20) {
  const response = await apiGet<{ messages: MessageInput[] }>(
    `/api/ai/messages?limit=${Math.min(limit, 100)}`
  );
  return response.data.messages;
}

/**
 * 确认AI创建的任务
 */
export async function confirmTask(taskId: number, confirmed: boolean) {
  const response = await apiPost<{ message: string }>(
    `/api/ai/tasks/${taskId}/confirm`,
    { confirmed }
  );
  return response.data;
}
