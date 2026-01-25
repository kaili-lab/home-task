import { eq, desc } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { messages, tasks } from "../db/schema";
import {
  createOpenAIClient,
  transcribeAudio,
  chatCompletion,
  chatCompletionStream,
  type ChatMessage,
} from "../utils/openai-client";
import { TaskService, type CreateTaskInput } from "./task.service";
import { z } from "zod";

export interface MessageInput {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "task_summary" | "question";
  payload?: Record<string, unknown>;
}

export interface AIChatInput {
  message: string;
  audioUrl?: string;
}

export interface AIChatResponse {
  content: string;
  taskId?: number;
  task?: unknown;
}

/**
 * AI Service层
 * 处理AI相关的业务逻辑
 */
export class AIService {
  private openaiClient: ReturnType<typeof createOpenAIClient>;

  constructor(
    private db: DbInstance,
    private taskService: TaskService,
    openaiApiKey: string,
    baseURL?: string
  ) {
    this.openaiClient = createOpenAIClient(openaiApiKey, baseURL);
  }

  /**
   * 语音转文字（Whisper）
   */
  async transcribeAudio(
    userId: number,
    audioFile: File | Blob
  ): Promise<{ text: string; audioUrl?: string }> {
    try {
      const result = await transcribeAudio(this.openaiClient, audioFile);
      // TODO: 可选：保存音频文件URL到云存储
      return {
        text: result.text,
        // audioUrl: "https://...", // 如果保存了音频文件
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`语音转文字失败: ${error.message}`);
      }
      throw new Error("语音转文字失败");
    }
  }

  /**
   * 保存对话消息
   */
  async saveMessage(userId: number, message: MessageInput): Promise<void> {
    await this.db.insert(messages).values({
      userId,
      role: message.role,
      content: message.content,
      type: message.type || "text",
      payload: message.payload || null,
    });
  }

  /**
   * 获取对话历史
   */
  async getMessages(userId: number, limit: number = 20): Promise<MessageInput[]> {
    const messageList = await this.db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 100)); // 最多100条

    return messageList
      .reverse()
      .map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        type: (msg.type as "text" | "task_summary" | "question") || "text",
        payload: (msg.payload as Record<string, unknown>) || undefined,
      }));
  }

  /**
   * AI对话（支持工具调用）
   */
  async chat(
    userId: number,
    message: string,
    audioUrl?: string,
    stream: boolean = false
  ): Promise<AIChatResponse | AsyncGenerator<string, void, unknown>> {
    // 加载对话历史（最近10条）
    const history = await this.getMessages(userId, 10);

    // 构建消息数组
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是一个智能任务助手，帮助用户管理任务。你可以：
1. 创建任务（解析用户意图，提取标题、描述、截止时间、分配给谁等信息）
2. 查询任务
3. 更新任务状态
4. 回答用户问题

用户信息：
- 用户ID: ${userId}
- 当前时间: ${new Date().toISOString()}

请用友好、简洁的中文回复用户。`,
      },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    // 定义工具（创建任务）
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "create_task",
          description: "创建新任务",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "任务标题",
              },
              description: {
                type: "string",
                description: "任务描述（可选）",
              },
              groupId: {
                type: "number",
                description: "群组ID（可选，如果未指定则为个人任务）",
              },
              assignedTo: {
                type: "number",
                description: "分配给的用户ID（可选，如果未指定则分配给创建者）",
              },
              dueDate: {
                type: "string",
                description: "截止时间（ISO 8601格式，可选）",
              },
            },
            required: ["title"],
          },
        },
      },
    ];

    // 保存用户消息
    await this.saveMessage(userId, {
      role: "user",
      content: message,
      type: "text",
      payload: audioUrl ? { audioUrl } : undefined,
    });

    if (stream) {
      // 流式返回
      return this.chatStream(userId, messages, tools);
    } else {
      // 完整响应
      const response = await chatCompletion(this.openaiClient, messages, {
        tools,
      });

      let taskId: number | undefined;
      let task: unknown | undefined;

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          if (toolCall.name === "create_task") {
            try {
              const params = JSON.parse(toolCall.arguments);
              const taskInput: CreateTaskInput = {
                title: params.title,
                description: params.description,
                groupId: params.groupId || null,
                assignedTo: params.assignedTo || null,
                dueDate: params.dueDate ? new Date(params.dueDate) : null,
                source: "ai",
              };

              const createdTask = await this.taskService.createTask(userId, taskInput);
              taskId = createdTask.id;
              task = createdTask;

              // 再次调用GPT生成用户友好的回复
              const finalResponse = await chatCompletion(this.openaiClient, [
                ...messages,
                {
                  role: "assistant",
                  content: JSON.stringify(response),
                },
                {
                  role: "system",
                  content: `任务已创建成功，任务ID: ${taskId}。请生成一个用户友好的回复，告知用户任务已创建，并展示任务的关键信息（标题、时间、分配给谁等）。`,
                },
              ]);

              response.content = finalResponse.content;
            } catch (error) {
              console.error("工具调用失败:", error);
              response.content = `抱歉，创建任务时出现错误: ${
                error instanceof Error ? error.message : "未知错误"
              }`;
            }
          }
        }
      }

      // 保存AI回复
      await this.saveMessage(userId, {
        role: "assistant",
        content: response.content,
        type: taskId ? "task_summary" : "text",
        payload: taskId
          ? {
              taskId,
              task,
            }
          : undefined,
      });

      return {
        content: response.content,
        taskId,
        task,
      };
    }
  }

  /**
   * 流式对话（内部方法）
   */
  private async* chatStream(
    userId: number,
    messages: ChatMessage[],
    tools: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>
  ): AsyncGenerator<string, void, unknown> {
    // 流式返回实现
    // 这里简化处理，实际应该处理工具调用的流式响应
    const stream = chatCompletionStream(this.openaiClient, messages, {
      tools,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      fullContent += chunk;
      yield chunk;
    }

    // 保存AI回复
    await this.saveMessage(userId, {
      role: "assistant",
      content: fullContent,
      type: "text",
    });
  }

  /**
   * 确认AI创建的任务
   */
  async confirmTask(userId: number, taskId: number): Promise<void> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    if (!task.isAiCreated) {
      throw new Error("该任务不是由AI创建的");
    }

    if (task.createdBy !== userId) {
      throw new Error("您无权确认此任务");
    }

    // TODO: 可以在这里触发后续操作（如发送通知等，暂不实现）
  }
}
