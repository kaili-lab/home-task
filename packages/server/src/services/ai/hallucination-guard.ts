import type {
  NoToolCallResponsePolicy,
  TaskIntent,
  ToolResult,
  UserMessagePolicy,
} from "./types";
import type { PromptBuilder } from "./prompt-builder";

export class HallucinationGuard {
  constructor(private promptBuilder: PromptBuilder) {}

  evaluateUserMessage(
    message: string,
    lastAssistantMessage?: string | null,
  ): UserMessagePolicy {
    const inferredIntent = this.inferTaskIntent(message);
    return {
      inferredIntent,
      requireToolCall: this.shouldRequireToolCall(message, inferredIntent),
      skipSemanticConflictCheck: this.shouldSkipSemanticConflictCheck(
        message,
        lastAssistantMessage,
      ),
    };
  }

  resolveNoToolCallResponse(params: {
    llmContent: string;
    inferredIntent: TaskIntent;
    lastSignificantResult: ToolResult | null;
  }): NoToolCallResponsePolicy {
    const { llmContent, inferredIntent, lastSignificantResult } = params;
    if (lastSignificantResult?.actionPerformed) {
      return { action: "return_as_is", content: llmContent };
    }
    if (!this.looksLikeActionSuccess(llmContent)) {
      return { action: "return_as_is", content: llmContent };
    }
    if (
      lastSignificantResult?.conflictingTasks &&
      lastSignificantResult.conflictingTasks.length > 0
    ) {
      return {
        action: "correct_with_conflict_context",
        content: "当前任务存在冲突或重复，请确认或调整后再创建。",
      };
    }
    return {
      action: "correct_with_not_executed_message",
      content: this.buildActionNotExecutedMessage(inferredIntent),
    };
  }

  private inferTaskIntent(message: string): TaskIntent {
    const text = message.toLowerCase();
    const hasAny = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));
    const deleteKeywords = ["删除", "移除", "取消任务", "作废", "清除", "delete", "remove"];
    const completeKeywords = [
      "完成",
      "做完",
      "搞定",
      "已完成",
      "标记完成",
      "完成任务",
      "done",
      "complete",
    ];
    const updateKeywords = [
      "修改",
      "更新",
      "改成",
      "改为",
      "调整",
      "更改",
      "延后",
      "提前",
      "update",
    ];
    const queryKeywords = [
      "查看",
      "列出",
      "显示",
      "有哪些",
      "有没有",
      "查询",
      "看看",
      "查一下",
      "任务列表",
      "list",
      "show",
    ];
    const createKeywords = [
      "提醒",
      "记得",
      "帮我安排",
      "安排",
      "创建",
      "新建",
      "添加",
      "新增",
      "设定",
      "设置",
      "记一下",
      "记下",
      "计划",
      "创建任务",
      "add",
      "create",
      "schedule",
      "remind",
    ];

    if (hasAny(deleteKeywords)) return "delete";
    if (hasAny(completeKeywords)) return "complete";
    if (hasAny(updateKeywords)) return "update";
    if (hasAny(queryKeywords)) return "query";
    if (hasAny(createKeywords)) return "create";
    return null;
  }

  private shouldRequireToolCall(message: string, intent: TaskIntent): boolean {
    if (!intent) return false;
    if (intent === "update" || intent === "delete") return false;
    if (intent === "query" && !this.promptBuilder.hasDateHint(message)) return false;
    return true;
  }

  private shouldSkipSemanticConflictCheck(
    message: string,
    lastAssistantMessage?: string | null,
  ): boolean {
    return (
      this.isAffirmativeMessage(message) &&
      this.didAskForSemanticConfirmation(lastAssistantMessage)
    );
  }

  private looksLikeActionSuccess(content: string): boolean {
    const text = content.toLowerCase();
    const successPhrases = [
      "已创建",
      "创建成功",
      "已经创建",
      "已为你创建",
      "已保存",
      "已更新",
      "更新成功",
      "已修改",
      "修改成功",
      "已完成",
      "完成成功",
      "已标记完成",
      "已删除",
      "删除成功",
      "已取消",
      "已移除",
      "created",
      "updated",
      "deleted",
      "completed",
    ];
    return successPhrases.some((phrase) => text.includes(phrase));
  }

  private buildActionNotExecutedMessage(intent: TaskIntent): string {
    switch (intent) {
      case "create":
        return "我还没有实际创建任务。请确认任务内容后我再创建。";
      case "update":
        return "AI 聊天暂不支持修改任务，请到任务列表中直接修改。";
      case "complete":
        return "我还没有完成任务。请告诉我要完成哪一条任务，或让我先帮你查找。";
      case "delete":
        return "AI 聊天暂不支持删除任务，请到任务列表中直接删除。";
      case "query":
        return "我还没有查询任务。请告诉我需要查看的日期。";
      default:
        return "我还没有执行任务操作。请再确认你的需求。";
    }
  }

  private isAffirmativeMessage(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) return false;
    const shortConfirmations = [
      "确认",
      "确定",
      "是",
      "是的",
      "好",
      "好的",
      "继续",
      "继续创建",
      "创建吧",
      "要",
      "要的",
    ];
    if (shortConfirmations.includes(trimmed)) return true;
    return (
      trimmed.includes("仍要创建") ||
      trimmed.includes("还是要创建") ||
      trimmed.includes("继续创建")
    );
  }

  private didAskForSemanticConfirmation(text?: string | null): boolean {
    if (!text) return false;
    return text.includes("是否仍要创建") || text.includes("回复“确认”继续创建");
  }
}
