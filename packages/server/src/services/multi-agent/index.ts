import type { BaseMessage } from "@langchain/core/messages";
import type { DbInstance } from "../../db/db";
import type { Bindings } from "../../types/bindings";
import { messages as messagesTable } from "../../db/schema";
import { createLLM } from "./utils/llm.factory";
import { buildSupervisorGraph } from "./supervisor";
import type { MultiAgentServiceResult, ToolResult } from "./types";

export class MultiAgentService {
  constructor(
    private db: DbInstance,
    private env: Bindings,
    private timezoneOffsetMinutes: number = 0,
  ) {}

  async chat(userId: number, message: string): Promise<MultiAgentServiceResult> {
    // 每次对话创建 LLM 实例，便于后续在环境层切换配置
    const llm = createLLM(this.env);

    // Supervisor 负责路由多 Agent
    const graph = buildSupervisorGraph(llm, this.timezoneOffsetMinutes);

    const result = await graph.invoke(
      { messages: [{ role: "user", content: message }] },
      {
        configurable: {
          db: this.db,
          userId,
          timezoneOffsetMinutes: this.timezoneOffsetMinutes,
          thread_id: `user_${userId}`,
        },
      },
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const content = typeof lastMessage.content === "string" ? lastMessage.content : "";

    const payload = this.extractPayloadFromMessages(result.messages);

    const type = payload.task
      ? "task_summary"
      : payload.conflictingTasks?.length
        ? "question"
        : "text";

    await this.saveMessages(userId, message, content, type, payload);

    return { content, type, payload };
  }

  /**
   * 从 graph 执行结果的消息列表中提取最后一个 ToolResult 的 payload
   */
  private extractPayloadFromMessages(messages: BaseMessage[]) {
    // 倒序遍历保证拿到最近的工具执行结果
    // 不使用 instanceof ToolMessage，因为 LangGraph 图执行后消息可能
    // 经过序列化/反序列化，导致 instanceof 检查失效
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      // 兼容多种判断方式：_getType()（LangChain 标准）或 tool_call_id 属性（ToolMessage 特有）
      const isToolMsg =
        (msg as any)._getType?.() === "tool" || !!(msg as any).tool_call_id;
      if (!isToolMsg) continue;

      const content = msg.content;
      if (typeof content !== "string") continue;
      try {
        const parsed = JSON.parse(content) as ToolResult;
        // 只提取包含有效 payload 的 ToolResult（跳过 transfer 等无关工具消息）
        if (parsed.task || parsed.conflictingTasks) {
          return {
            task: parsed.task,
            conflictingTasks: parsed.conflictingTasks,
          };
        }
      } catch {
        // JSON 解析失败（如 supervisor transfer 消息），继续查找下一个
        continue;
      }
    }
    return {};
  }

  private async saveMessages(
    userId: number,
    userMessage: string,
    assistantMessage: string,
    type: "text" | "task_summary" | "question",
    payload?: { task?: unknown; conflictingTasks?: unknown[] },
  ) {
    // 复用 messages 表保存对话，便于统一历史读取逻辑
    await this.db.insert(messagesTable).values({
      userId,
      role: "user",
      content: userMessage,
      type: "text",
      payload: null,
    });

    await this.db.insert(messagesTable).values({
      userId,
      role: "assistant",
      content: assistantMessage,
      type,
      payload: payload || null,
    });
  }
}
