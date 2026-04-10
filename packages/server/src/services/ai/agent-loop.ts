import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Bindings } from "../../types/bindings";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import type { HistoryManager } from "./history-manager";
import type { PromptBuilder } from "./prompt-builder";
import type { HallucinationGuard } from "./hallucination-guard";
import type { ToolExecutor } from "./tool-executor";
import type { AIServiceResult, ToolResult } from "./types";

export class AgentLoop {
  constructor(
    private env: Bindings,
    private requestId: string,
    private historyManager: HistoryManager,
    private promptBuilder: PromptBuilder,
    private hallucinationGuard: HallucinationGuard,
    private toolExecutor: ToolExecutor,
  ) {}

  isDebugEnabled(): boolean {
    return this.env.NODE_ENV !== "production";
  }

  truncateText(text: string, maxLength = 240): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...(truncated)`;
  }

  toJsonPreview(value: unknown, maxLength = 800): string {
    try {
      const raw = JSON.stringify(value);
      if (!raw) return "";
      return this.truncateText(raw, maxLength);
    } catch {
      return "[unserializable]";
    }
  }

  toContentPreview(content: unknown): string {
    if (typeof content === "string") return this.truncateText(content);
    return this.toJsonPreview(content, 400);
  }

  toToolCallsPreview(
    toolCalls: Array<{ id?: string; name: string; args?: unknown }> | undefined,
  ): Array<{ id?: string; name: string; args: string }> {
    if (!toolCalls || toolCalls.length === 0) return [];
    return toolCalls.map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
      args: this.toJsonPreview(toolCall.args, 300),
    }));
  }

  debugLog(stage: string, details?: Record<string, unknown>): void {
    if (!this.isDebugEnabled()) return;
    const detailText = details ? ` ${this.toJsonPreview(details, 1200)}` : "";
    console.log(`[ai-debug][${this.requestId}][${stage}]${detailText}`);
  }

  createLLM(): ChatOpenAI {
    if (this.env.AIHUBMIX_API_KEY) {
      const config = {
        apiKey: this.env.AIHUBMIX_API_KEY,
        model: this.env.AIHUBMIX_MODEL_NAME || "deepseek-v3.2",
        temperature: 0,
        configuration: {
          baseURL: this.env.AIHUBMIX_BASE_URL,
        },
      };
      this.debugLog("model.select", {
        provider: "aihubmix",
        model: config.model,
        hasBaseURL: !!this.env.AIHUBMIX_BASE_URL,
      });
      return new ChatOpenAI(config as any);
    }

    this.debugLog("model.select", {
      provider: "openai",
      model: "gpt-4o",
    });
    return new ChatOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      model: "gpt-4o",
      temperature: 0,
    });
  }

  async chat(userId: number, message: string): Promise<AIServiceResult> {
    const llm = this.createLLM();
    const systemPrompt = await this.promptBuilder.buildSystemPrompt(userId);
    const chatHistory = await this.historyManager.loadHistory(userId);
    const lastAssistantMessage =
      await this.historyManager.loadLastAssistantMessage(userId);
    const skipSemanticConflictCheck =
      this.hallucinationGuard.shouldSkipSemanticConflictCheck(
        message,
        lastAssistantMessage?.content,
      );
    const inferredIntent = this.hallucinationGuard.inferTaskIntent(message);
    this.debugLog("chat.start", {
      userId,
      messagePreview: this.toContentPreview(message),
      inferredIntent,
      historyCount: chatHistory.length,
      hasLastAssistantMessage: !!lastAssistantMessage,
      skipSemanticConflictCheck,
    });

    let lastSignificantResult: ToolResult | null = null;

    if (message.includes("今天") && this.promptBuilder.hasTimeSegmentHint(message)) {
      const hinted = this.promptBuilder.inferTimeSegmentFromText(message);
      if (
        !this.promptBuilder.isSegmentAllowedForToday(
          this.promptBuilder.getTodayDate(),
          hinted,
        )
      ) {
        const content = this.promptBuilder.buildSegmentNotAllowedMessage(hinted);
        this.debugLog("chat.rule.shortCircuit", {
          userId,
          reason: "today_segment_passed",
          hintedSegment: hinted,
          contentPreview: this.toContentPreview(content),
        });
        await this.historyManager.saveMessage(userId, "user", message);
        await this.historyManager.saveMessage(userId, "assistant", content, "question");
        return { content, type: "question" };
      }
    }

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(message),
    ];

    for (let index = 0; index < 10; index++) {
      const toolChoice =
        index === 0 &&
        (this.hallucinationGuard.shouldRequireToolCall(message) ||
          skipSemanticConflictCheck)
          ? "required"
          : undefined;
      this.debugLog("llm.invoke.request", {
        round: index + 1,
        toolChoice: toolChoice || "auto",
        messageCount: messages.length,
      });
      const response = await llm.invoke(messages, {
        tools: TOOL_DEFINITIONS,
        tool_choice: toolChoice,
      });
      messages.push(response);

      const toolCalls = response.tool_calls || [];
      this.debugLog("llm.invoke.response", {
        round: index + 1,
        contentPreview: this.toContentPreview(response.content),
        toolCallCount: toolCalls.length,
        toolCalls: this.toToolCallsPreview(
          toolCalls as Array<{ id?: string; name: string; args?: unknown }>,
        ),
      });

      if (toolCalls.length === 0) {
        let content = typeof response.content === "string" ? response.content : "";
        const hasAction = lastSignificantResult?.actionPerformed;
        if (!hasAction && this.hallucinationGuard.looksLikeActionSuccess(content)) {
          this.debugLog("llm.response.hallucination", {
            round: index + 1,
            inferredIntent,
            contentPreview: this.toContentPreview(content),
            hasConflictContext:
              !!lastSignificantResult?.conflictingTasks &&
              lastSignificantResult.conflictingTasks.length > 0,
          });
          if (
            lastSignificantResult?.conflictingTasks &&
            lastSignificantResult.conflictingTasks.length > 0
          ) {
            content = "当前任务存在冲突或重复，请确认或调整后再创建。";
          } else {
            content =
              this.hallucinationGuard.buildActionNotExecutedMessage(inferredIntent);
          }
        }

        const type =
          lastSignificantResult?.responseType ||
          (lastSignificantResult?.task ? "task_summary" : "text");

        await this.historyManager.saveMessage(userId, "user", message);
        await this.historyManager.saveMessage(userId, "assistant", content, type, {
          task: lastSignificantResult?.task,
          conflictingTasks: lastSignificantResult?.conflictingTasks,
        });
        this.debugLog("chat.finish.no_tool_calls", {
          userId,
          type,
          hasTask: !!lastSignificantResult?.task,
          hasConflicts:
            !!lastSignificantResult?.conflictingTasks &&
            lastSignificantResult.conflictingTasks.length > 0,
          contentPreview: this.toContentPreview(content),
        });

        return {
          content,
          type,
          payload: {
            task: lastSignificantResult?.task,
            conflictingTasks: lastSignificantResult?.conflictingTasks,
          },
        };
      }

      for (const toolCall of toolCalls) {
        let toolResult: ToolResult;
        try {
          toolResult = await this.toolExecutor.executeToolCall(
            userId,
            toolCall.name,
            toolCall.args as Record<string, unknown>,
            message,
            { skipSemanticConflictCheck },
          );
        } catch (error) {
          this.debugLog("tool.execute.error", {
            toolName: toolCall.name,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        this.debugLog("tool.execute.result", {
          toolName: toolCall.name,
          status: toolResult.status,
          actionPerformed: toolResult.actionPerformed || null,
          hasTask: !!toolResult.task,
          conflictingTasksCount: toolResult.conflictingTasks?.length || 0,
          responseType: toolResult.responseType || null,
          messagePreview: this.toContentPreview(toolResult.message),
        });

        if (toolResult.task || toolResult.conflictingTasks || toolResult.actionPerformed) {
          lastSignificantResult = toolResult;
        }

        if (
          toolResult.status === "need_confirmation" ||
          toolResult.status === "conflict"
        ) {
          const content = toolResult.message;
          const type = toolResult.responseType || "question";
          await this.historyManager.saveMessage(userId, "user", message);
          await this.historyManager.saveMessage(userId, "assistant", content, type, {
            conflictingTasks: toolResult.conflictingTasks,
          });
          this.debugLog("chat.finish.need_user_confirmation", {
            userId,
            status: toolResult.status,
            type,
            conflictingTasksCount: toolResult.conflictingTasks?.length || 0,
            contentPreview: this.toContentPreview(content),
          });
          return {
            content,
            type,
            payload: { conflictingTasks: toolResult.conflictingTasks },
          };
        }

        const toolId = toolCall.id || `tool_${Date.now()}_${Math.random()}`;
        messages.push(
          new ToolMessage({ content: toolResult.message, tool_call_id: toolId }),
        );
        this.debugLog("llm.tool_message.appended", {
          toolName: toolCall.name,
          toolCallId: toolId,
        });
      }
    }

    const fallback = "抱歉，处理超时，请重新尝试。";
    await this.historyManager.saveMessage(userId, "user", message);
    await this.historyManager.saveMessage(userId, "assistant", fallback);
    this.debugLog("chat.finish.timeout", {
      userId,
      contentPreview: fallback,
    });
    return { content: fallback, type: "text" };
  }
}
