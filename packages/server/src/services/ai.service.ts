import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Bindings } from "../types/bindings";
import type { DbInstance } from "../db/db";
import { TaskService } from "./task.service";
import { messages as messagesTable, groupUsers, groups } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { TaskInfo, TimeSegment } from "shared";

/*
工具定义集中在文件顶部，避免在执行循环中分散查找。
保持与 OpenAI 原生 schema 对齐，是为了减少运行时适配层和依赖体积，
在 Serverless 环境下更容易控制包大小与冷启动时间。
*/
// ==================== Tool 定义（OpenAI JSON Schema 格式）====================
// 使用 OpenAI 原生 tool 格式而非 LangChain StructuredTool，避免 zod v3/v4 版本冲突；同时减少 bundle 体积（适配 Cloudflare Workers）。
const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description:
        "创建一个新任务。当用户明确要求创建任务且信息充分时调用。若用户未指定日期，强制默认今天；若用户仅提到模糊时间段（全天/凌晨/早上/上午/中午/下午/晚上）且无具体时间，直接传 timeSegment，不追问时间。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题" },
          description: {
            type: "string",
            description: "任务描述（用户未提供时可省略）",
          },
          dueDate: {
            type: "string",
            description: "执行日期，必须是 YYYY-MM-DD 格式。将“明天”“下周一”等转换为具体日期",
          },
          startTime: {
            type: "string",
            description: "开始时间，HH:MM 格式。与 endTime 成对使用，模糊时间段时不传",
          },
          endTime: {
            type: "string",
            description: "结束时间，HH:MM 格式。必须和 startTime 同时传或同时不传",
          },
          timeSegment: {
            type: "string",
            enum: [
              "all_day",
              "early_morning",
              "morning",
              "forenoon",
              "noon",
              "afternoon",
              "evening",
            ],
            description:
              "模糊时间段：全天/凌晨/早上/上午/中午/下午/晚上。与 startTime/endTime 互斥。",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "优先级，默认 medium",
          },
          groupId: {
            type: "number",
            description: "所属群组 ID。个人任务不传。仅当用户明确提到某个群组时才传",
          },
        },
        required: ["title", "dueDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_tasks",
      description:
        "查询用户的任务列表。当用户想要查看、列出、查找任务时调用。修改或删除任务前如不确定任务 ID，也先用此工具查询。",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "completed", "cancelled"],
            description: "按状态过滤",
          },
          dueDate: {
            type: "string",
            description: "精确日期过滤，YYYY-MM-DD 格式",
          },
          dueDateFrom: {
            type: "string",
            description: "日期范围开始，YYYY-MM-DD 格式",
          },
          dueDateTo: {
            type: "string",
            description: "日期范围结束，YYYY-MM-DD 格式",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "按优先级过滤",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description:
        "更新一个已存在任务。需要任务 ID（通常先用 query_tasks 查到）。只传用户要改的字段，其它字段不传。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要更新的任务 ID" },
          title: { type: "string", description: "新标题" },
          description: { type: "string", description: "新描述" },
          dueDate: {
            type: "string",
            description: "新日期，YYYY-MM-DD 格式",
          },
          startTime: {
            type: "string",
            description: "新开始时间，HH:MM 格式",
          },
          endTime: {
            type: "string",
            description: "新结束时间，HH:MM 格式",
          },
          timeSegment: {
            type: "string",
            enum: [
              "all_day",
              "early_morning",
              "morning",
              "forenoon",
              "noon",
              "afternoon",
              "evening",
            ],
            description:
              "模糊时间段：全天/凌晨/早上/上午/中午/下午/晚上。与 startTime/endTime 互斥。",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "新优先级",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "将一个任务标记为已完成。需要任务 ID。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要标记完成的任务 ID" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_task",
      description: "删除一个任务。需要任务 ID。删除前必须先向用户确认。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要删除的任务 ID" },
        },
        required: ["taskId"],
      },
    },
  },
];

// ==================== 响应类型 ====================

export interface AIServiceResult {
  content: string;
  type: "text" | "task_summary" | "question";
  payload?: {
    task?: TaskInfo;
    conflictingTasks?: TaskInfo[];
  };
}

type ToolActionType = "create" | "update" | "complete" | "delete";

type ResultCapture = {
  task?: TaskInfo;
  conflictingTasks?: TaskInfo[];
  actionPerformed?: ToolActionType;
  responseTypeOverride?: "text" | "task_summary" | "question";
  // 用于在时间不合理时强制追问并中止后续 LLM 回合，避免模型擅自纠正
  forcedReply?: string;
};

// ==================== AIService ====================

/**
 * AI Agent 服务层
 * 使用 LangChain 的 ChatOpenAI 作为模型接口，手动管理 Agent 调用循环。
 * 不使用 AgentExecutor，原因：避免引入 langchain 主包（bundle 体积），
 * 且手动 loop 对 Cloudflare Workers 的请求生命周期更透明。
 * 架构本身仍符合 LangChain 的分层设计：Model 层可替换，Tool 逻辑独立。
 */
export class AIService {
  // 作用：初始化服务依赖与请求级上下文信息
  constructor(
    private db: DbInstance,
    private env: Bindings,
    private timezoneOffsetMinutes: number = 0,
    private requestId: string = `ai_${Date.now()}_${Math.random()}`,
  ) {}

  // == Model 层（可替换：换模型只改这个方法）==
  // 作用：创建并配置 LLM 实例
  private createLLM(): ChatOpenAI {
    // 支持中转服务是为了在不同模型提供方间切换时不侵入业务逻辑
    // 如果配置了 AIHUBMIX（中转服务），使用中转服务和自定义 baseURL
    if (this.env.AIHUBMIX_API_KEY) {
      const config = {
        apiKey: this.env.AIHUBMIX_API_KEY,
        model: this.env.AIHUBMIX_MODEL_NAME || "deepseek-v3.2",
        temperature: 0,
        // ChatOpenAI 需要通过 configuration.baseURL 传递自定义端点，避免默认端点不匹配中转服务
        configuration: {
          baseURL: this.env.AIHUBMIX_BASE_URL,
        },
      };
      return new ChatOpenAI(config as any);
    }
    // 使用官方 OpenAI API
    return new ChatOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
      model: "gpt-4o",
      temperature: 0,
    });
  }

  // == History 层：加载对话历史 ==
  // 作用：读取并转换历史消息为模型可用的消息序列
  private async loadHistory(userId: number, limit = 20): Promise<BaseMessage[]> {
    const rows = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.userId, userId))
      // 先按时间倒序取最新消息，减少读取量再翻转为时间顺序
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    // 倒序加载后反转为时间顺序
    rows.reverse();

    /*
    system 消息由 buildSystemPrompt 动态生成，包含“当前”上下文信息。
    如果把历史的 system 消息混入，会造成过期上下文重复，既浪费窗口又可能冲突。
    */
    return rows
      .filter((row) => row.role !== "system")
      .map((row) =>
        row.role === "user" ? new HumanMessage(row.content) : new AIMessage(row.content),
      );
  }

  // 作用：读取最近一条助手消息用于后续确认逻辑
  private async loadLastAssistantMessage(
    userId: number,
  ): Promise<{ content: string; type: string } | null> {
    const rows = await this.db
      .select({ content: messagesTable.content, type: messagesTable.type })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, userId), eq(messagesTable.role, "assistant")))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  // == History 层：保存消息 ==
  // 作用：持久化当前对话消息，便于后续上下文恢复
  private async saveMessage(
    userId: number,
    role: "user" | "assistant",
    content: string,
    type: "text" | "task_summary" | "question" = "text",
    payload?: Record<string, unknown>,
  ) {
    await this.db.insert(messagesTable).values({
      userId,
      role,
      content,
      type,
      payload: payload || null,
    });
  }

  // == 系统提示：包含今日日期 + 用户群组信息 ==
  // 作用：生成系统提示以提供统一规则与上下文
  private async buildSystemPrompt(userId: number): Promise<string> {
    /*
    把日期、时段、群组信息一次性注入提示，
    是为了减少模型在关键字段上的二次追问，提升一次命中率。
    */
    const today = this.getTodayDate();
    const weekday = this.getWeekdayLabel(this.getUserNow());
    const currentSegment = this.formatTimeSegmentLabel(this.getCurrentTimeSegment());

    // 查询用户所在群组
    const userGroups = await this.db
      .select({ groupId: groupUsers.groupId, groupName: groups.name })
      .from(groupUsers)
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")));

    const groupsList =
      userGroups.length > 0
        ? userGroups.map((g) => `- ${g.groupName}（ID: ${g.groupId}）`).join("\n")
        : "（未加入任何群组）";

    return `你是一个任务管理助手，帮助用户通过对话管理任务。

## 当前上下文

- 今天：${today}（${weekday}）
- 当前时段：${currentSegment}
- 用户群组：
${groupsList}

## 一、信息提取

从用户的自然语言描述中推理出任务字段：
- **title**：简洁的动作短语（如"去4S店取车"、"开家长会"）
- **description**：title 无法涵盖的补充信息（如地点、注意事项）；用户未提及则省略
- **dueDate**：用户未指定日期时，强制默认今天（${today}），不得擅自推断为其他日期
- **priority**：用户未指定时不传

## 二、时间处理

任务时间分为两种模式，**互斥**：

**模式A — 具体时间范围（startTime + endTime）：**
- 必须同时有开始和结束时间
- 用户用12小时制且未说明上午/下午（如"4点到5点"），必须追问确认
- 用户用24小时制（如"14点到15点"）或已说明（如"下午4点到5点"），无需追问
- 用户只给了开始时间没给结束时间，必须追问

**模式B — 模糊时间段（timeSegment）：**
- 用户提到以下关键词时，传对应的 timeSegment 值，不追问：
  - 全天 → all_day
  - 凌晨 → early_morning
  - 早上 → morning
  - 上午 → forenoon
  - 中午 → noon
  - 下午 → afternoon
  - 晚上 → evening
- 用户既没说具体时间也没说模糊时间段时：
  - 任务日期是今天且当前已是晚上 → 传 timeSegment = evening
  - 其他情况 → 传 timeSegment = all_day
- 若任务日期是今天且用户给出的时间段或具体时间已过，必须追问确认，不能自动纠正
- 模糊时间段判断以用户原话为准，不得自行替换

两种模式互斥：有具体时间时不传 timeSegment，有 timeSegment 时不传 startTime/endTime。

## 三、创建任务

**步骤：**
1. 先调用 query_tasks 查询该日期的所有任务
2. 拿到结果后，做两项判断：
   - **语义冲突**：新任务与已有任务是否表达相同的事（如"取快递"≈"拿快递"≈"去拿包裹"）
   - **时间冲突**：仅当新任务有具体时间段时，检查是否与已有任务时间重叠，如果是segment模式则不检查时间冲突，只检查语义冲突
   - 需要两个都不冲突才直接创建
3. 根据判断结果：
   - 无冲突 → 直接调用 create_task
   - 仅语义冲突 → 提示用户"你当天已有类似任务：XXX"，请求确认后再创建
   - 仅时间冲突 → 提示用户时间段被占用，建议调整时间
   - 两者都有 → 同时说明两种冲突
4. 用户确认后，再调用 create_task

## 四、查询任务

- 用户未指定日期 → 提醒用户需要指定具体日期
- 仅支持查询具体某一天，不支持日期范围查询；用户要求日期范围查询时需告知暂不支持

## 五、更新任务

- 不确定目标任务时，先调用 query_tasks 查找，向用户确认是哪个任务
- 涉及时间变更时，需要做冲突检测（流程同创建任务，但排除当前正在修改的任务本身）

## 六、完成任务

- 不确定目标任务时，先调用 query_tasks 查找确认

## 七、删除任务

- 删除前必须向用户确认，说明将要删除的任务信息

## 八、群组任务

- 用户提到群组时，从「用户群组」列表中模糊匹配（如"骑行大队" → "骑行群"）：
  - 匹配到唯一群组 → 直接使用
  - 匹配到多个候选 → 列出候选，让用户选择
  - 无法匹配 → 告知用户当前加入的群组列表
- 群组任务的时间规则和冲突检测与个人任务相同

## 回复规范

- 使用中文
- 简洁友好
- 非任务相关的请求，礼貌告知只能帮忙管理任务`;
  }

  /*
  时间/日期的启发式识别用于“先分流后决策”：
  先判断用户表达更接近具体时间还是模糊时段，
  可以避免不必要的追问并稳定工具参数形态。
  */
  // 作用：判断文本是否包含模糊时间段提示
  private hasTimeSegmentHint(text: string): boolean {
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

  // 作用：判断文本是否包含明确的时间范围表达
  private hasExplicitTimeRange(text: string): boolean {
    // 匹配“3点到5点”/“4:00-15:00”等
    const timePattern = /(\d{1,2})([:点时](\d{1,2}))?/g;
    const matches = text.match(timePattern) || [];
    if (matches.length >= 2) return true;
    return /(\d{1,2}(?:[:点时]\d{1,2})?)\s*[-到至~]\s*(\d{1,2}(?:[:点时]\d{1,2})?)/.test(text);
  }

  // 作用：判断文本是否包含明确的时间点表达
  private hasExplicitTimePoint(text: string): boolean {
    return /(\d{1,2})([:点时](\d{1,2}))/.test(text);
  }

  // 作用：判断文本是否包含日期相关线索
  private hasDateHint(text: string): boolean {
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
    return keywords.some((k) => text.includes(k));
  }

  /*
  意图推断作为轻量级兜底，避免完全依赖模型输出。
  这样可以在模型未触发 tool call 时仍能给出合理的提示或补救。
  */
  // 作用：从用户文本中粗粒度推断意图
  private inferTaskIntent(
    message: string,
  ): "create" | "query" | "update" | "complete" | "delete" | null {
    const text = message.toLowerCase();
    const hasAny = (keywords: string[]) => keywords.some((k) => text.includes(k));
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

  // 作用：判断是否需要强制模型触发工具调用
  private shouldRequireToolCall(message: string): boolean {
    const intent = this.inferTaskIntent(message);
    if (!intent) return false;
    if (intent === "query" && !this.hasDateHint(message)) return false;
    return true;
  }

  // 作用：识别用户是否在语义冲突提示后给出肯定回复
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
      trimmed.includes("仍要创建") || trimmed.includes("还是要创建") || trimmed.includes("继续创建")
    );
  }

  // 作用：判断上一条助手消息是否在请求语义冲突确认
  private didAskForSemanticConfirmation(text?: string | null): boolean {
    if (!text) return false;
    return text.includes("是否仍要创建") || text.includes("回复“确认”继续创建");
  }

  // 作用：根据上下文决定是否跳过语义冲突检查
  private shouldSkipSemanticConflictCheck(
    message: string,
    lastAssistantMessage?: string | null,
  ): boolean {
    return (
      this.isAffirmativeMessage(message) && this.didAskForSemanticConfirmation(lastAssistantMessage)
    );
  }

  // 作用：粗判模型回复是否像“已执行成功”的话术
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

  // 作用：当模型误判已执行时，给出未执行的澄清提示
  private buildActionNotExecutedMessage(
    intent: "create" | "query" | "update" | "complete" | "delete" | null,
  ): string {
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

  // 作用：从文本中推断模糊时间段枚举值
  private inferTimeSegmentFromText(text: string): TimeSegment {
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

  // 作用：将时间段枚举转换为可读中文标签
  private formatTimeSegmentLabel(segment: TimeSegment | null | undefined): string {
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
  // 作用：为时间段排序提供稳定的序号
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

  // 作用：基于用户时区获取当前时间段
  private getCurrentTimeSegment(): TimeSegment {
    const hour = this.getUserNow().getUTCHours();
    if (hour >= 0 && hour < 6) return "early_morning";
    if (hour >= 6 && hour < 9) return "morning";
    if (hour >= 9 && hour < 12) return "forenoon";
    if (hour >= 12 && hour < 14) return "noon";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour <= 23) return "evening";
    return "morning";
  }

  // 作用：按用户时区获取“现在”的时间
  private getUserNow(): Date {
    return new Date(Date.now() - this.timezoneOffsetMinutes * 60 * 1000);
  }

  // 作用：把时间字符串转为当天分钟数，避免重复解析导致“已过”判断不一致
  private parseTimeToMinutes(time?: string | null): number | null {
    if (!time) return null;
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
    if (!match) return null;
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }
  // 作用：将日期映射为中文星期标签
  private getWeekdayLabel(date: Date): string {
    const labels = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    return labels[date.getUTCDay()];
  }

  // 作用：判断给定日期字符串是否为“今天”
  private isTodayDate(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const today = this.getUserNow();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    return dateStr === `${yyyy}-${mm}-${dd}`;
  }

  /*
  默认时段与“今天限制”规则单独封装，
  是为了让时间策略集中可控，避免散落在多处逻辑里导致不一致。
  */
  // 作用：在缺少时间线索时给出默认时段
  private getDefaultTimeSegmentForDate(dateStr: string): TimeSegment {
    if (!this.isTodayDate(dateStr)) return "all_day";
    const current = this.getCurrentTimeSegment();
    if (current === "evening") return "evening";
    return "all_day";
  }

  // 作用：判断“今天”情况下目标时段是否合法
  private isSegmentAllowedForToday(dateStr: string, segment: TimeSegment): boolean {
    if (!this.isTodayDate(dateStr)) return true;
    const current = this.getCurrentTimeSegment();
    if (segment === "all_day") return current !== "evening";
    const currentOrder = this.getTimeSegmentOrder(current);
    const targetOrder = this.getTimeSegmentOrder(segment);
    return targetOrder >= currentOrder;
  }

  // 作用：判断今天的具体时间段是否已过，防止模型在不合理时间直接创建
  private isTimeRangePassedForToday(
    dateStr: string,
    startTime?: string | null,
    endTime?: string | null,
  ): boolean {
    if (!this.isTodayDate(dateStr)) return false;
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return false;
    // 避免跨天或异常范围误判为“已过”
    if (endMinutes < startMinutes) return false;
    const now = this.getUserNow();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return endMinutes <= nowMinutes;
  }
  // 作用：生成“时段不可选”的用户提示文案
  private buildSegmentNotAllowedMessage(target: TimeSegment): string {
    const nowLabel = this.formatTimeSegmentLabel(this.getCurrentTimeSegment());
    const targetLabel = this.formatTimeSegmentLabel(target);
    if (target === "all_day") {
      return "现在已是晚上，无法设置为全天。请确认要改成晚上，或提供具体时间段。";
    }
    return `现在已经是${nowLabel}了，无法选择${targetLabel}时间段。请确认要改成${nowLabel}或更晚的时间段，或提供具体时间段。`;
  }

  // 作用：获取用户时区下的今日日期字符串
  private getTodayDate(): string {
    const now = this.getUserNow();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 作用：对任务标题做语义归一化，便于后续相似度判断
  private normalizeTaskTitle(title: string): string {
    let text = title.toLowerCase();
    const replacements: Array<[RegExp, string]> = [
      [/提醒我|帮我|麻烦|请|一下|记得|我要|我想|需要|安排|计划/g, ""],
      [/拿|取|领取|取回|带回/g, "取"],
      [/快递|包裹|快件|邮件/g, "快递"],
      [/衣物|衣服/g, "衣服"],
      [/车子|车里|车内|车上/g, "车"],
      [/回到家|带回家/g, "回家"],
      [/购买|采购/g, "买"],
    ];
    replacements.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement);
    });
    text = text.replace(
      /[\s~`!@#$%^&*()_\-+=[\]{}|;:'",.<>/?，。！？、；：“”‘’（）【】《》]+/g,
      "",
    );
    return text;
  }

  // 作用：构建字符串的二元组集合以支持相似度计算
  private buildBigrams(text: string): Set<string> {
    const chars = Array.from(text);
    const bigrams = new Set<string>();
    for (let i = 0; i < chars.length - 1; i += 1) {
      bigrams.add(chars[i] + chars[i + 1]);
    }
    return bigrams;
  }

  // 作用：计算两个字符串的 Dice 系数相似度
  private diceCoefficient(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const aBigrams = this.buildBigrams(a);
    const bBigrams = this.buildBigrams(b);
    let intersection = 0;
    aBigrams.forEach((bg) => {
      if (bBigrams.has(bg)) intersection += 1;
    });
    return (2 * intersection) / (aBigrams.size + bBigrams.size);
  }

  // 作用：判断两个标题是否语义近似或重复
  private isSemanticDuplicate(newTitle: string, existingTitle: string): boolean {
    if (!newTitle || !existingTitle) return false;
    if (newTitle === existingTitle) return true;
    if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) return true;
    return this.diceCoefficient(newTitle, existingTitle) >= 0.75;
  }

  // 作用：找出与新任务语义冲突的已有任务
  private findSemanticConflicts(tasks: TaskInfo[], title: string): TaskInfo[] {
    const normalizedNew = this.normalizeTaskTitle(title);
    if (!normalizedNew) return [];
    return tasks.filter((task) => {
      const normalizedExisting = this.normalizeTaskTitle(task.title);
      return this.isSemanticDuplicate(normalizedNew, normalizedExisting);
    });
  }

  // 作用：筛出时间段发生重叠的任务
  private filterTimeConflicts(tasks: TaskInfo[], startTime: string, endTime: string): TaskInfo[] {
    return tasks.filter((t) => {
      if (!t.startTime || !t.endTime) return false;
      return t.startTime < endTime && t.endTime > startTime;
    });
  }

  // 作用：合并语义与时间冲突结果并去重
  private mergeConflictingTasks(
    timeConflicts: TaskInfo[],
    semanticConflicts: TaskInfo[],
  ): TaskInfo[] {
    const merged = new Map<number, TaskInfo>();
    timeConflicts.forEach((t) => merged.set(t.id, t));
    semanticConflicts.forEach((t) => merged.set(t.id, t));
    return Array.from(merged.values());
  }

  // 作用：获取指定日期的待办任务集合用于冲突判断
  private async getTasksForDate(userId: number, dueDate: string): Promise<TaskInfo[]> {
    const taskService = new TaskService(this.db);
    const result = await taskService.getTasks(userId, {
      status: "pending",
      dueDate,
    });
    return result.tasks;
  }

  // == 冲突检测：检查时间段是否与已有任务重叠 ==
  // 作用：在指定日期内计算时间冲突任务
  private async checkTimeConflict(
    userId: number,
    dueDate: string,
    startTime: string,
    endTime: string,
  ): Promise<TaskInfo[]> {
    // 只在具体时间段模式下计算冲突，避免把“全天/模糊时段”错误当作重叠
    const tasks = await this.getTasksForDate(userId, dueDate);
    return this.filterTimeConflicts(tasks, startTime, endTime);
  }

  // == Tool 层：执行工具调用（每个 case 独立，加新功能只需加 case）==
  // 作用：根据工具名执行任务并统一收集结果
  private async executeToolCall(
    userId: number,
    toolName: string,
    toolArgs: Record<string, unknown>,
    resultCapture: ResultCapture,
    userMessage: string,
    options?: { skipSemanticConflictCheck?: boolean },
  ): Promise<string> {
    /*
    把工具调用集中在一个函数中，便于统一记录日志与收集结果，
    也能避免对话循环里混入大量业务分支，降低维护成本。
    */
    console.log(
      "[ai.tool.start]",
      JSON.stringify({
        requestId: this.requestId,
        userId,
        toolName,
        toolArgs,
      }),
    );
    const taskService = new TaskService(this.db);
    switch (toolName) {
      case "create_task": {
        const { title, description, dueDate, startTime, endTime, priority, groupId, timeSegment } =
          toolArgs as {
            title: string;
            description?: string;
            dueDate: string;
            startTime?: string;
            endTime?: string;
            priority?: string;
            groupId?: number;
            timeSegment?: TimeSegment;
          };
        const hasTimeRange = !!startTime && !!endTime;
        const hasExplicitTime =
          this.hasExplicitTimeRange(userMessage) || this.hasExplicitTimePoint(userMessage);
        const hasSegmentHint = this.hasTimeSegmentHint(userMessage);
        const hasDateHint = this.hasDateHint(userMessage);
        // 用户未提及日期时强制按“今天”处理，避免模型自行推断造成偏差
        const effectiveDueDate = hasDateHint && dueDate ? dueDate : this.getTodayDate();
        const hintedSegment = hasSegmentHint ? this.inferTimeSegmentFromText(userMessage) : null;

        if (hintedSegment && !this.isSegmentAllowedForToday(effectiveDueDate, hintedSegment)) {
          const content = this.buildSegmentNotAllowedMessage(hintedSegment);
          resultCapture.forcedReply = content;
          resultCapture.responseTypeOverride = "question";
          return content;
        }

        if (hasTimeRange && this.isTimeRangePassedForToday(effectiveDueDate, startTime, endTime)) {
          const content = `今天已过你提到的时间段（${startTime}-${endTime}）。请确认是否改到今天稍后或明天，或提供新的时间段。`;
          resultCapture.forcedReply = content;
          resultCapture.responseTypeOverride = "question";
          return content;
        }

        let finalTimeSegment = hasTimeRange
          ? null
          : timeSegment || this.inferTimeSegmentFromText(userMessage);

        if (!hasTimeRange && !timeSegment && !hasSegmentHint && !hasExplicitTime) {
          // 用户没给任何时间线索时，使用可解释的默认策略，避免反复追问
          finalTimeSegment = this.getDefaultTimeSegmentForDate(effectiveDueDate);
        }

        if (finalTimeSegment && !this.isSegmentAllowedForToday(effectiveDueDate, finalTimeSegment)) {
          // 今天已过时段时直接提示，避免创建无意义任务
          return this.buildSegmentNotAllowedMessage(finalTimeSegment);
        }

        const skipSemanticConflictCheck = options?.skipSemanticConflictCheck === true;
        const tasksForDate = await this.getTasksForDate(userId, effectiveDueDate);
        const timeConflicts =
          startTime && endTime ? this.filterTimeConflicts(tasksForDate, startTime, endTime) : [];
        const semanticConflicts = skipSemanticConflictCheck
          ? []
          : this.findSemanticConflicts(tasksForDate, title);
        const hasTimeConflicts = timeConflicts.length > 0;
        const hasSemanticConflicts = semanticConflicts.length > 0;

        if (hasTimeConflicts || hasSemanticConflicts) {
          resultCapture.conflictingTasks = this.mergeConflictingTasks(
            timeConflicts,
            semanticConflicts,
          );
          const formatTaskTime = (task: TaskInfo) =>
            task.startTime && task.endTime
              ? `${task.startTime}-${task.endTime}`
              : this.formatTimeSegmentLabel(task.timeSegment);
          if (hasTimeConflicts && !hasSemanticConflicts) {
            const conflictInfo = timeConflicts
              .map((t) => `- ${t.title}（${formatTaskTime(t)}）`)
              .join("\n");
            return `时间冲突！以下任务与请求时间段重叠：\n${conflictInfo}\n请调整时间后再创建。`;
          }
          if (!hasTimeConflicts && hasSemanticConflicts) {
            resultCapture.responseTypeOverride = "question";
            const conflictInfo = semanticConflicts
              .map((t) => `- ${t.title}（${formatTaskTime(t)}）`)
              .join("\n");
            return `你当天已有类似任务：\n${conflictInfo}\n是否仍要创建？回复“确认”继续创建。`;
          }
          const timeInfo = timeConflicts
            .map((t) => `- ${t.title}（${formatTaskTime(t)}）`)
            .join("\n");
          const semanticInfo = semanticConflicts
            .map((t) => `- ${t.title}（${formatTaskTime(t)}）`)
            .join("\n");
          return `时间冲突：\n${timeInfo}\n同时你当天已有类似任务：\n${semanticInfo}\n请先调整时间后再创建。`;
        }

        const task = await taskService.createTask(userId, {
          title,
          description,
          dueDate: effectiveDueDate,
          startTime: hasTimeRange ? startTime : null,
          endTime: hasTimeRange ? endTime : null,
          timeSegment: finalTimeSegment,
          priority: (priority as "high" | "medium" | "low") || "medium",
          groupId: groupId || null,
          source: "ai",
          assignedToIds: [userId],
        });

        resultCapture.task = task;
        resultCapture.actionPerformed = "create";
        console.log(
          "[ai.tool.success]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
            taskId: task.id,
          }),
        );
        const timeInfo = task.startTime
          ? `，时间${task.startTime}-${task.endTime}`
          : `（${this.formatTimeSegmentLabel(task.timeSegment)}）`;
        return `任务创建成功！标题"${task.title}"，日期${task.dueDate}${timeInfo}`;
      }

      case "query_tasks": {
        const { status, dueDate, dueDateFrom, dueDateTo, priority } = toolArgs as {
          status?: string;
          dueDate?: string;
          dueDateFrom?: string;
          dueDateTo?: string;
          priority?: string;
        };

        const result = await taskService.getTasks(userId, {
          status: status as "pending" | "completed" | "cancelled" | undefined,
          dueDate,
          dueDateFrom,
          dueDateTo,
          priority: priority as "high" | "medium" | "low" | undefined,
        });

        if (result.tasks.length === 0) return "没有找到符合条件的任务。";

        console.log(
          "[ai.tool.success]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
            resultCount: result.tasks.length,
          }),
        );
        return result.tasks
          .map(
            (t) =>
              `[ID:${t.id}] ${t.title} | 日期:${t.dueDate} | ${
                t.startTime
                  ? `时间:${t.startTime}-${t.endTime}`
                  : this.formatTimeSegmentLabel(t.timeSegment)
              } | 状态:${t.status} | 优先级:${t.priority}`,
          )
          .join("\n");
      }

      case "update_task": {
        const { taskId, title, description, dueDate, startTime, endTime, priority, timeSegment } =
          toolArgs as {
            taskId: number;
            title?: string;
            description?: string;
            dueDate?: string;
            startTime?: string;
            endTime?: string;
            priority?: string;
            timeSegment?: TimeSegment;
          };

        const task = await taskService.updateTask(taskId, userId, {
          title,
          description,
          dueDate,
          startTime,
          endTime,
          timeSegment,
          priority: priority as "high" | "medium" | "low" | undefined,
        });

        resultCapture.task = task;
        resultCapture.actionPerformed = "update";
        console.log(
          "[ai.tool.success]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
            taskId: task.id,
          }),
        );
        const timeInfo = task.startTime
          ? `，时间${task.startTime}-${task.endTime}`
          : `（${this.formatTimeSegmentLabel(task.timeSegment)}）`;
        return `任务更新成功！标题"${task.title}"，日期${task.dueDate}${timeInfo}`;
      }

      case "complete_task": {
        const { taskId } = toolArgs as { taskId: number };
        const task = await taskService.updateTaskStatus(taskId, userId, "completed");
        resultCapture.task = task;
        resultCapture.actionPerformed = "complete";
        console.log(
          "[ai.tool.success]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
            taskId: task.id,
          }),
        );
        return `任务 "${task.title}" 已标记为完成。`;
      }

      case "delete_task": {
        const { taskId } = toolArgs as { taskId: number };
        await taskService.deleteTask(taskId, userId);
        resultCapture.actionPerformed = "delete";
        console.log(
          "[ai.tool.success]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
            taskId,
          }),
        );
        return "任务已删除。";
      }

      default:
        console.log(
          "[ai.tool.unknown]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            toolName,
          }),
        );
        return `未知工具：${toolName}`;
    }
  }

  // ==================== 主入口：对话方法 ====================
  /**
   * 处理用户消息，返回 AI 回复。
   * 内部管理 Agent 调用循环：调用 Model -> 判断是否有 Tool Call -> 执行 Tool ->
   * 把结果回传给 Model -> 循环直到最终文本回复。
   */
  async chat(userId: number, message: string): Promise<AIServiceResult> {
    // 作用：作为对话主入口驱动模型与工具的协作流程
    /*
    主循环负责把“模型推理”和“确定性执行”解耦：
    模型给出工具调用，代码执行后再把结果回传模型生成最终回复。
    这样可以同时保留可控性与对话体验。
    */
    const llm = this.createLLM();
    const systemPrompt = await this.buildSystemPrompt(userId);
    const chatHistory = await this.loadHistory(userId);
    const lastAssistantMessage = await this.loadLastAssistantMessage(userId);
    const skipSemanticConflictCheck = this.shouldSkipSemanticConflictCheck(
      message,
      lastAssistantMessage?.content,
    );
    const inferredIntent = this.inferTaskIntent(message);
    const resultCapture: ResultCapture = {};
    console.log(
      "[ai.chat.start]",
      JSON.stringify({
        requestId: this.requestId,
        userId,
        timezoneOffsetMinutes: this.timezoneOffsetMinutes,
        historyCount: chatHistory.length,
        messageLength: message.length,
        message,
      }),
    );

    // 规则兜底：用户明确说“今天上午/下午”等但当前已过该时间段，直接提醒确认
    if (message.includes("今天") && this.hasTimeSegmentHint(message)) {
      const hinted = this.inferTimeSegmentFromText(message);
      if (!this.isSegmentAllowedForToday(this.getTodayDate(), hinted)) {
        const content = this.buildSegmentNotAllowedMessage(hinted);
        await this.saveMessage(userId, "user", message);
        await this.saveMessage(userId, "assistant", content, "question");
        return { content, type: "question" };
      }
    }

    // 构建初始消息列表
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...chatHistory,
      new HumanMessage(message),
    ];

    // Agent 调用循环（最多 10 轮，防止无限循环）
    for (let i = 0; i < 10; i++) {
      // 首轮强制工具调用是为了在必要时确保进入可执行路径，减少“空口回答”
      const toolChoice =
        i === 0 && (this.shouldRequireToolCall(message) || skipSemanticConflictCheck)
          ? "required"
          : undefined;
      const response = await llm.invoke(messages, {
        tools: TOOL_DEFINITIONS,
        tool_choice: toolChoice,
      });
      console.log(
        "[ai.llm.response]",
        JSON.stringify({
          requestId: this.requestId,
          userId,
          iteration: i + 1,
          toolChoice,
          toolCalls: response.tool_calls?.map((call) => ({
            name: call.name,
            id: call.id,
          })),
          hasToolCalls: !!response.tool_calls && response.tool_calls.length > 0,
        }),
      );
      messages.push(response);

      // 无 Tool Call -> 最终文本回复，loop 结束
      if (!response.tool_calls || response.tool_calls.length === 0) {
        let content = typeof response.content === "string" ? response.content : "";

        if (!resultCapture.actionPerformed && this.looksLikeActionSuccess(content)) {
          if (resultCapture.conflictingTasks && resultCapture.conflictingTasks.length > 0) {
            content = "当前任务存在冲突或重复，请确认或调整后再创建。";
            resultCapture.responseTypeOverride = resultCapture.responseTypeOverride || "question";
          } else {
            content = this.buildActionNotExecutedMessage(inferredIntent);
            resultCapture.responseTypeOverride = "question";
          }
        }

        // 确定响应类型
        const type: "text" | "task_summary" | "question" =
          resultCapture.responseTypeOverride || (resultCapture.task ? "task_summary" : "text");

        // 保存数据库
        await this.saveMessage(userId, "user", message);
        await this.saveMessage(userId, "assistant", content, type, {
          task: resultCapture.task,
          conflictingTasks: resultCapture.conflictingTasks,
        });
        console.log(
          "[ai.chat.end]",
          JSON.stringify({
            requestId: this.requestId,
            userId,
            type,
            hasTask: !!resultCapture.task,
          }),
        );

        return {
          content,
          type,
          payload: {
            task: resultCapture.task,
            conflictingTasks: resultCapture.conflictingTasks,
          },
        };
      }

      // 有 Tool Call -> 逐个执行，结果加入消息列表
      for (const toolCall of response.tool_calls) {
        let toolResult: string;
        try {
          toolResult = await this.executeToolCall(
            userId,
            toolCall.name,
            toolCall.args,
            resultCapture,
            message,
            { skipSemanticConflictCheck },
          );
        } catch (error) {
          console.log(
            "[ai.tool.error]",
            JSON.stringify({
              requestId: this.requestId,
              userId,
              toolName: toolCall.name,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          throw error;
        }
        if (resultCapture.forcedReply) {
          // 需要追问时直接返回，避免继续回到 LLM 导致自动纠正或误创建
          const content = resultCapture.forcedReply;
          await this.saveMessage(userId, "user", message);
          await this.saveMessage(userId, "assistant", content, "question");
          return { content, type: "question" };
        }
        // 工具调用必须包含 ID，用于将结果关联回工具调用
        const toolId = toolCall.id || `tool_${Date.now()}_${Math.random()}`;
        messages.push(new ToolMessage({ content: toolResult, tool_call_id: toolId }));
      }
    }

    // 安全兜底：超过最大迭代次数
    const fallback = "抱歉，处理超时，请重新尝试。";
    await this.saveMessage(userId, "user", message);
    await this.saveMessage(userId, "assistant", fallback);
    console.log(
      "[ai.chat.timeout]",
      JSON.stringify({
        requestId: this.requestId,
        userId,
      }),
    );
    return { content: fallback, type: "text" };
  }
}
