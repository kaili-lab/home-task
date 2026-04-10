import type { TaskIntent } from "./types";
import type { PromptBuilder } from "./prompt-builder";

export class HallucinationGuard {
  constructor(private promptBuilder: PromptBuilder) {}

  inferTaskIntent(message: string): TaskIntent {
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

  shouldRequireToolCall(message: string): boolean {
    const intent = this.inferTaskIntent(message);
    if (!intent) return false;
    if (intent === "query" && !this.promptBuilder.hasDateHint(message)) return false;
    return true;
  }

  shouldSkipSemanticConflictCheck(
    message: string,
    lastAssistantMessage?: string | null,
  ): boolean {
    return (
      this.isAffirmativeMessage(message) &&
      this.didAskForSemanticConfirmation(lastAssistantMessage)
    );
  }

  looksLikeActionSuccess(content: string): boolean {
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

  buildActionNotExecutedMessage(intent: TaskIntent): string {
    switch (intent) {
      case "create":
        return "我还没有实际创建任务。请确认任务内容后我再创建。";
      case "update":
        return "我还没有更新任务。请告诉我要修改哪一条任务，或让我先帮你查找。";
      case "complete":
        return "我还没有完成任务。请告诉我要完成哪一条任务，或让我先帮你查找。";
      case "delete":
        return "我还没有删除任务。请确认要删除哪一条任务，或让我先帮你查找。";
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
