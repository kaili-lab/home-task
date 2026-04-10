import { and, eq } from "drizzle-orm";
import type { TimeSegment } from "shared";
import type { DbInstance } from "../../db/db";
import { groupUsers, groups } from "../../db/schema";

export class PromptBuilder {
  constructor(
    private db: DbInstance,
    private timezoneOffsetMinutes: number = 0,
  ) {}

  async buildSystemPrompt(userId: number): Promise<string> {
    const today = this.getTodayDate();
    const weekday = this.getWeekdayLabel(this.getUserNow());
    const currentSegment = this.formatTimeSegmentLabel(this.getCurrentTimeSegment());

    const userGroups = await this.db
      .select({ groupId: groupUsers.groupId, groupName: groups.name })
      .from(groupUsers)
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")));

    const groupsList =
      userGroups.length > 0
        ? userGroups.map((group) => `- ${group.groupName}（ID: ${group.groupId}）`).join("\n")
        : "（未加入任何群组）";

    return `你是一个任务管理助手，帮助用户通过对话管理任务。

## 1) Role & Capabilities

你拥有以下工具能力：
- create_task：创建任务
- query_tasks：查询任务
- update_task：更新任务
- complete_task：标记任务完成
- delete_task：删除任务

你只处理任务管理相关请求。非任务相关请求要礼貌拒绝，并说明你只能协助任务管理。

## 2) Dynamic Context

- 今天：${today}（${weekday}）
- 当前时段：${currentSegment}
- 用户群组：
${groupsList}

## 3) Intent Recognition

先判断用户意图，再选工具，避免混淆：
- "完成XXX"、"XXX做完了"、"搞定了XXX" → complete_task（不是 create_task）
- "删除XXX"、"取消XXX任务" → delete_task（不是 create_task）
- "修改XXX"、"把XXX改成..." → update_task（不是 create_task）
- "提醒我XXX"、"帮我安排XXX"、"创建XXX" → create_task
- "看看任务"、"今天有什么安排"、"查一下任务" → query_tasks

## 4) Tool Routing

- 创建任务时调用 create_task
- 查看/筛选任务时调用 query_tasks
- 更新、完成、删除都需要 taskId；若 taskId 不明确，先调用 query_tasks 帮用户定位
- 删除任务必须先得到用户确认，再调用 delete_task
- 用户提到群组时，从「用户群组」列表做模糊匹配：
  - 匹配到唯一群组：直接使用 groupId
  - 匹配到多个候选：列出候选让用户选择
  - 无法匹配：告知用户当前加入的群组列表

## 5) Parameter Extraction

从用户自然语言提取字段：
- title：简洁动作短语（如"去4S店取车"、"开家长会"）
- description：title 之外的补充信息；未提及可省略
- dueDate：未给日期时，默认今天（${today}）
- priority：用户未指定时默认 medium
- groupId：仅当用户明确提到某个群组时传入

时间字段提取规则：
- 具体时间模式：startTime 与 endTime 成对传入
- 模糊时间段模式：传 timeSegment（all_day/early_morning/morning/forenoon/noon/afternoon/evening）
- 两种模式互斥：有 startTime/endTime 时不传 timeSegment；有 timeSegment 时不传 startTime/endTime
- 用户未提时间时：
  - 若 dueDate 是今天且当前已是晚上，默认 timeSegment = evening
  - 其他情况默认 timeSegment = all_day

## 6) Constraints / Rules

硬性约束（必须遵守）：
- 未调用工具前，不得声称"已创建/已更新/已删除/已完成"
- 用户只给单个时间点或只给开始时间时，必须追问结束时间（不能猜）
- 用户用 12 小时制但未说明上午/下午时，必须追问确认
- 查询任务时，用户没给日期必须先追问具体日期
- 删除任务前必须先确认将删除的任务信息；未确认时不要调用 delete_task
- 任务日期未给出时，dueDate 必须默认今天（${today}）
- 今天的任务若给出已过去的时段或时间范围，必须追问是否调整，不能自动纠正
- 非任务请求必须礼貌拒绝

## 7) Output Format

- 回复语言：中文；语气简洁友好
- 类型契约：
  - task_summary：任务已被实际创建/更新/完成，且有任务摘要可返回
  - question：需要补充信息、二次确认或存在冲突
  - text：普通说明、拒绝非任务请求、操作失败说明
- 场景化结构：
  - 创建成功：确认语 + 任务摘要（标题、日期、时间/时段）
  - 存在冲突：冲突原因 + 冲突任务信息 + 询问下一步
  - 需要追问：明确缺失字段，一次只问一个关键问题
  - 操作失败：说明原因 + 给出下一步建议`;
  }

  hasTimeSegmentHint(text: string): boolean {
    return (
      text.includes("全天") ||
      text.includes("凌晨") ||
      text.includes("清晨") ||
      text.includes("早晨") ||
      text.includes("早上") ||
      text.includes("上午") ||
      text.includes("中午") ||
      text.includes("下午") ||
      text.includes("午后") ||
      text.includes("晚上") ||
      text.includes("夜晚") ||
      text.includes("夜里") ||
      text.includes("傍晚")
    );
  }

  hasExplicitTimeRange(text: string): boolean {
    const timePattern = /(\d{1,2})([:点时](\d{1,2}))?/g;
    const matches = text.match(timePattern) || [];
    if (matches.length >= 2) return true;
    return /(\d{1,2}(?:[:点时]\d{1,2})?)\s*[-到至~]\s*(\d{1,2}(?:[:点时]\d{1,2})?)/.test(
      text,
    );
  }

  hasExplicitTimePoint(text: string): boolean {
    return /(\d{1,2})([:点时](\d{1,2}))/.test(text);
  }

  hasDateHint(text: string): boolean {
    if (/\d{4}-\d{2}-\d{2}/.test(text)) return true;
    const keywords = [
      "今天",
      "明天",
      "后天",
      "昨天",
      "今晚",
      "今早",
      "本周",
      "这周",
      "下周",
      "下星期",
      "本月",
      "这个月",
      "下个月",
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
      "周六",
      "周日",
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
      "星期六",
      "星期日",
      "周末",
    ];
    return keywords.some((keyword) => text.includes(keyword));
  }

  inferTimeSegmentFromText(text: string): TimeSegment {
    if (text.includes("全天")) return "all_day";
    if (text.includes("凌晨") || text.includes("清晨")) return "early_morning";
    if (text.includes("早上") || text.includes("早晨")) return "morning";
    if (text.includes("上午")) return "forenoon";
    if (text.includes("中午")) return "noon";
    if (text.includes("下午") || text.includes("午后")) return "afternoon";
    if (
      text.includes("晚上") ||
      text.includes("夜晚") ||
      text.includes("夜里") ||
      text.includes("傍晚")
    ) {
      return "evening";
    }
    return "all_day";
  }

  formatTimeSegmentLabel(segment: TimeSegment | null | undefined): string {
    switch (segment) {
      case "early_morning":
        return "凌晨";
      case "morning":
        return "早上";
      case "forenoon":
        return "上午";
      case "noon":
        return "中午";
      case "afternoon":
        return "下午";
      case "evening":
        return "晚上";
      case "all_day":
      default:
        return "全天";
    }
  }

  getCurrentTimeSegment(): TimeSegment {
    const hour = this.getUserNow().getUTCHours();
    if (hour >= 0 && hour < 6) return "early_morning";
    if (hour >= 6 && hour < 9) return "morning";
    if (hour >= 9 && hour < 12) return "forenoon";
    if (hour >= 12 && hour < 14) return "noon";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour <= 23) return "evening";
    return "morning";
  }

  getUserNow(): Date {
    return new Date(Date.now() - this.timezoneOffsetMinutes * 60 * 1000);
  }

  parseTimeToMinutes(time?: string | null): number | null {
    if (!time) return null;
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
    if (!match) return null;
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  getWeekdayLabel(date: Date): string {
    const labels = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    return labels[date.getUTCDay()];
  }

  isTodayDate(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const today = this.getUserNow();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    return dateStr === `${yyyy}-${mm}-${dd}`;
  }

  getDefaultTimeSegmentForDate(dateStr: string): TimeSegment {
    if (!this.isTodayDate(dateStr)) return "all_day";
    const current = this.getCurrentTimeSegment();
    if (current === "evening") return "evening";
    return "all_day";
  }

  isSegmentAllowedForToday(dateStr: string, segment: TimeSegment): boolean {
    if (!this.isTodayDate(dateStr)) return true;
    const current = this.getCurrentTimeSegment();
    if (segment === "all_day") return current !== "evening";
    const currentOrder = this.getTimeSegmentOrder(current);
    const targetOrder = this.getTimeSegmentOrder(segment);
    return targetOrder >= currentOrder;
  }

  isTimeRangePassedForToday(
    dateStr: string,
    startTime?: string | null,
    endTime?: string | null,
  ): boolean {
    if (!this.isTodayDate(dateStr)) return false;
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return false;
    if (endMinutes < startMinutes) return false;
    const now = this.getUserNow();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return endMinutes <= nowMinutes;
  }

  buildSegmentNotAllowedMessage(target: TimeSegment): string {
    const nowLabel = this.formatTimeSegmentLabel(this.getCurrentTimeSegment());
    const targetLabel = this.formatTimeSegmentLabel(target);
    if (target === "all_day") {
      return "现在已是晚上，无法设置为全天。请确认要改成晚上，或提供具体时间段。";
    }
    return `现在已经是${nowLabel}了，无法选择${targetLabel}时间段。请确认要改成${nowLabel}或更晚的时间段，或提供具体时间段。`;
  }

  getTodayDate(): string {
    const now = this.getUserNow();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  private getTimeSegmentOrder(segment: TimeSegment): number {
    switch (segment) {
      case "early_morning":
        return 0;
      case "morning":
        return 1;
      case "forenoon":
        return 2;
      case "noon":
        return 3;
      case "afternoon":
        return 4;
      case "evening":
        return 5;
      case "all_day":
      default:
        return -1;
    }
  }
}
