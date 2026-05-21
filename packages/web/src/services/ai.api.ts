import { apiGet, apiPost } from "@/lib/api-client";
import type {
  AIChatInput,
  AIChatResponse,
  AIChatStreamDeltaEvent,
  AIChatStreamDoneEvent,
  AIChatStreamErrorEvent,
  AIChatStreamStatusEvent,
  MessageResponse,
  TaskInfo,
} from "shared";
import { formatLocalDateTime } from "@/utils/date";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

function mapMessageTimes(message: MessageResponse): MessageResponse {
  const createdAt = formatLocalDateTime(message.createdAt) ?? message.createdAt;
  return { ...message, createdAt };
}

function mapTaskInfoTimes(task: TaskInfo): TaskInfo {
  const createdAt = formatLocalDateTime(task.createdAt) ?? task.createdAt;
  const updatedAt = formatLocalDateTime(task.updatedAt) ?? task.updatedAt;
  const completedAt = task.completedAt
    ? (formatLocalDateTime(task.completedAt) ?? task.completedAt)
    : null;
  return { ...task, createdAt, updatedAt, completedAt };
}

function mapAiChatResponseTimes(response: AIChatResponse): AIChatResponse {
  if (!response.payload) return response;
  const task = response.payload.task ? mapTaskInfoTimes(response.payload.task) : undefined;
  const conflictingTasks = response.payload.conflictingTasks
    ? response.payload.conflictingTasks.map(mapTaskInfoTimes)
    : undefined;
  return {
    ...response,
    payload: {
      ...response.payload,
      task,
      conflictingTasks,
    },
  };
}

export interface AIChatStreamHandlers {
  onStatus?: (event: AIChatStreamStatusEvent) => void;
  onDelta?: (event: AIChatStreamDeltaEvent) => void;
  onDone?: (event: AIChatStreamDoneEvent) => void;
  onError?: (event: AIChatStreamErrorEvent) => void;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n").filter(Boolean);
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * AI 对话（SSE 流式，与 POST /api/ai/chat 一致）
 */
export async function chat(
  message: string,
  handlers: AIChatStreamHandlers = {},
): Promise<AIChatResponse> {
  const data: AIChatInput = { message };
  const url = API_BASE_URL ? `${API_BASE_URL}/api/ai/chat` : "/api/ai/chat";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Timezone-Offset": String(new Date().getTimezoneOffset()),
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    let errMessage = `请求失败: ${response.statusText}`;
    try {
      const json = (await response.json()) as { error?: string };
      if (json.error) errMessage = json.error;
    } catch {
      // 非 JSON 错误体
    }
    throw new Error(errMessage);
  }

  if (!response.body) {
    throw new Error("响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: AIChatResponse | null = null;

  const dispatch = (event: string, rawData: string) => {
    const parsed = JSON.parse(rawData) as unknown;
    switch (event) {
      case "status":
        handlers.onStatus?.(parsed as AIChatStreamStatusEvent);
        break;
      case "delta":
        handlers.onDelta?.(parsed as AIChatStreamDeltaEvent);
        break;
      case "done": {
        const done = parsed as AIChatStreamDoneEvent;
        finalResponse = mapAiChatResponseTimes(done.response);
        handlers.onDone?.({ response: finalResponse });
        break;
      }
      case "error": {
        const err = parsed as AIChatStreamErrorEvent;
        handlers.onError?.(err);
        throw new Error(err.message);
      }
      default:
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const block = parseSseBlock(part.trim());
      if (block) dispatch(block.event, block.data);
    }
  }

  if (buffer.trim()) {
    const block = parseSseBlock(buffer.trim());
    if (block) dispatch(block.event, block.data);
  }

  if (!finalResponse) {
    throw new Error("未收到完整 AI 回复");
  }

  return finalResponse;
}

/**
 * 语音转文字（Whisper）
 */
export async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiPost<{ text: string; audioUrl?: string }>(
    "/api/ai/transcribe",
    formData,
  );
  return response.data;
}

/**
 * 获取对话历史
 */
export async function getMessages(limit: number = 20) {
  const response = await apiGet<{ messages: MessageResponse[] }>(
    `/api/ai/messages?limit=${Math.min(limit, 100)}`,
  );
  return response.data.messages.map(mapMessageTimes);
}

/**
 * 确认AI创建的任务
 */
export async function confirmTask(taskId: number, confirmed: boolean) {
  const response = await apiPost<{ message: string }>(`/api/ai/tasks/${taskId}/confirm`, {
    confirmed,
  });
  return response.data;
}
