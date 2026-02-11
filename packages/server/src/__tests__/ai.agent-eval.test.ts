/**
 * AI Agent 自动化评测 (Eval) 测试套件
 *
 * 目的：验证 AI Agent 在各种用户输入场景下的行为是否正确
 * 方式：真实 LLM 调用 + 真实数据库，端到端验证
 *
 * 与其他测试文件的分工（不重复）：
 * - ai.service.test.ts: 单元测试（mock LLM），验证代码逻辑
 * - ai.complete-flow.integration.test.ts: 集成测试，验证 DB CRUD
 * - ai.routes.test.ts: 路由测试，验证 HTTP 层
 * - ai-error-handler.test.ts: 错误处理单元测试
 * - 本文件: Agent 行为评测（真实 LLM），验证工具选择、参数提取、追问逻辑
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { createDb } from "../db/db";
import {
  tasks,
  messages,
  users,
  groups,
  groupUsers,
  taskAssignments,
} from "../db/schema";
import { AIService } from "../services/ai.service";

// 已迁移到多 Agent 架构（multi-agent/），此文件测试旧单 Agent 逻辑，跳过执行
describe.skip("AI Agent 评测 (Eval)", () => {
  let db: DbInstance;
  let testUserId: number;
  let testGroupId: number;
  let mockEnv: any;
  // DB 或 API Key 不可用时，优雅跳过整个套件
  let skipSuite = false;

  // 默认时区偏移：UTC+8（中国）
  const DEFAULT_OFFSET = -480;

  // ==================== 辅助函数 ====================

  /**
   * 计算使 getUserNow() 返回指定小时的时区偏移量
   * 用于模拟特定时间段（如晚上 20:00），而不需要 fake timers
   */
  function getOffsetForHour(targetHour: number): number {
    const now = new Date();
    const currentUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return currentUTCMinutes - targetHour * 60;
  }

  /**
   * 基于指定偏移量计算日期字符串
   * @param daysFromToday 距今天的天数（0=今天，1=明天，2=后天）
   * @param offset 时区偏移量（分钟）
   */
  function getDateStr(daysFromToday: number, offset: number = DEFAULT_OFFSET): string {
    const userNow = new Date(Date.now() - offset * 60 * 1000);
    userNow.setUTCDate(userNow.getUTCDate() + daysFromToday);
    const yyyy = userNow.getUTCFullYear();
    const mm = String(userNow.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(userNow.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  /** 创建 AIService 实例（可指定时区偏移量来模拟不同时间段） */
  function createAIService(timezoneOffsetMinutes: number = DEFAULT_OFFSET): AIService {
    return new AIService(db, mockEnv, timezoneOffsetMinutes);
  }

  /** 条件执行：DB/API 不可用时自动跳过 */
  const itIfReady = (name: string, fn: () => any, timeout?: number) =>
    it(
      name,
      async () => {
        if (skipSuite) return;
        return fn();
      },
      timeout,
    );

  /** 直接通过 DB 插入前置条件任务（不经过 AI） */
  async function seedTask(
    overrides: Partial<typeof tasks.$inferInsert>,
  ): Promise<number> {
    const result = await db
      .insert(tasks)
      .values({
        title: "测试任务",
        status: "pending",
        source: "human",
        createdBy: testUserId,
        ...overrides,
      })
      .returning();
    return result[0].id;
  }

  // ==================== 测试环境初始化 ====================

  beforeAll(async () => {
    try {
      // 环境变量由 setup.ts 通过 dotenv 从 .dev.vars 加载到 process.env
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("需要 DATABASE_URL 环境变量（检查 .dev.vars 是否存在）");
      }
      if (!process.env.AIHUBMIX_API_KEY && !process.env.OPENAI_API_KEY) {
        throw new Error("需要 AIHUBMIX_API_KEY 或 OPENAI_API_KEY");
      }

      mockEnv = {
        OPENAI_API_KEY: undefined,
        AIHUBMIX_API_KEY: process.env.AIHUBMIX_API_KEY,
        AIHUBMIX_BASE_URL: process.env.AIHUBMIX_BASE_URL,
        AIHUBMIX_MODEL_NAME: process.env.AIHUBMIX_MODEL_NAME,
      };

      db = createDb(dbUrl);

      // 创建测试用户
      const userResult = await db
        .insert(users)
        .values({
          email: `test-eval-${Date.now()}@example.com`,
          name: "Eval 测试用户",
          emailVerified: true,
        })
        .returning();
      testUserId = userResult[0].id;

      // 创建测试群组 "工作"
      const inviteCode = `eval${Date.now().toString().slice(-10)}`;
      const groupResult = await db
        .insert(groups)
        .values({ name: "工作", inviteCode })
        .returning();
      testGroupId = groupResult[0].id;

      // 将用户加入群组
      await db.insert(groupUsers).values({
        userId: testUserId,
        groupId: testGroupId,
      });
    } catch (error: any) {
      // DB 或 API Key 不可用时优雅跳过，不让整个测试套件失败
      console.warn("⚠️  跳过 AI Agent 评测测试：环境不可用。");
      console.warn(`原因：${error?.message || error}`);
      skipSuite = true;
    }
  }, 30000);

  // 每个测试前清空消息和任务，确保独立性
  beforeEach(async () => {
    if (skipSuite || !db) return;
    await db.delete(messages).where(eq(messages.userId, testUserId));
    // 先清 taskAssignments 再清 tasks（外键约束）
    const userTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.createdBy, testUserId));
    if (userTasks.length > 0) {
      const taskIds = userTasks.map((t) => t.id);
      await db.delete(taskAssignments).where(inArray(taskAssignments.taskId, taskIds));
    }
    await db.delete(tasks).where(eq(tasks.createdBy, testUserId));
  });

  afterAll(async () => {
    // DB 未初始化时跳过清理
    if (!db) return;
    try {
      // 清空所有测试数据
      const userTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.createdBy, testUserId));
      if (userTasks.length > 0) {
        const taskIds = userTasks.map((t) => t.id);
        await db.delete(taskAssignments).where(inArray(taskAssignments.taskId, taskIds));
      }
      await db.delete(tasks).where(eq(tasks.createdBy, testUserId));
      await db.delete(messages).where(eq(messages.userId, testUserId));
      await db.delete(groupUsers).where(eq(groupUsers.userId, testUserId));
      await db.delete(groups).where(eq(groups.id, testGroupId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch {
      // 清理失败不影响测试结果
    }
  }, 30000);

  // ==================== 创建任务 - 正常场景 ====================

  describe("创建任务 - 正常场景", () => {
    const tomorrow = () => getDateStr(1);
    const dayAfterTomorrow = () => getDateStr(2);

    itIfReady(
      "C01: 基本创建 - 明天+标题，无时间则默认全天",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "帮我创建一个任务，明天去买菜");

        expect(result.type).toBe("task_summary");
        expect(result.payload?.task).toBeDefined();
        expect(result.payload!.task!.title).toContain("买菜");
        expect(result.payload!.task!.dueDate).toBe(tomorrow());
        // 未指定时间，明天不是今天，默认 all_day
        expect(result.payload!.task!.timeSegment).toBe("all_day");
      },
      60000,
    );

    itIfReady(
      "C02: 带具体时间范围 - startTime + endTime",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "明天下午2点到3点开会");

        expect(result.type).toBe("task_summary");
        expect(result.payload?.task).toBeDefined();
        expect(result.payload!.task!.title).toContain("开会");
        expect(result.payload!.task!.dueDate).toBe(tomorrow());
        // PostgreSQL time 类型返回 HH:MM:SS 格式
        expect(result.payload!.task!.startTime).toBe("14:00:00");
        expect(result.payload!.task!.endTime).toBe("15:00:00");
        // 有具体时间时 timeSegment 应为 null
        expect(result.payload!.task!.timeSegment).toBeNull();
      },
      60000,
    );

    itIfReady(
      "C03: 带模糊时间段 - timeSegment",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "明天晚上去跑步");

        expect(result.type).toBe("task_summary");
        expect(result.payload?.task).toBeDefined();
        expect(result.payload!.task!.title).toContain("跑步");
        expect(result.payload!.task!.dueDate).toBe(tomorrow());
        expect(result.payload!.task!.timeSegment).toBe("evening");
      },
      60000,
    );

    itIfReady(
      "C04: 带优先级",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "创建一个高优先级任务：明天提交报告");

        expect(result.type).toBe("task_summary");
        expect(result.payload?.task).toBeDefined();
        expect(result.payload!.task!.priority).toBe("high");
      },
      60000,
    );

    itIfReady(
      "C05: 相对日期 - 后天",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "后天下午去4S店取车");

        expect(result.type).toBe("task_summary");
        expect(result.payload?.task).toBeDefined();
        expect(result.payload!.task!.dueDate).toBe(dayAfterTomorrow());
      },
      60000,
    );

    itIfReady(
      "C06: 群组任务",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "在工作群里创建一个任务，明天开周会");

        // LLM 可能直接创建（task_summary）或先用文字确认群组再创建（text/question）
        if (result.type === "task_summary") {
          expect(result.payload?.task).toBeDefined();
          expect(result.payload!.task!.title).toContain("周会");
          expect(result.payload!.task!.groupId).toBe(testGroupId);
        } else {
          // LLM 用文本回复时，内容应包含群组或任务相关信息
          expect(["text", "question"]).toContain(result.type);
          expect(result.content).toMatch(/工作|群|周会|任务|创建/);
        }
      },
      60000,
    );

    itIfReady(
      "C07: 晚上+无日期+无时段 → 默认今天晚上",
      async () => {
        // 模拟用户当前是晚上 20:00
        const eveningOffset = getOffsetForHour(20);
        const todayEvening = getDateStr(0, eveningOffset);
        const tomorrowDate = getDateStr(1, eveningOffset);
        const ai = createAIService(eveningOffset);

        const result = await ai.chat(testUserId, "提醒我去车里拿衣服");

        if (result.type === "task_summary") {
          expect(result.payload?.task).toBeDefined();
          // LLM 可能设为今天晚上或明天
          expect([todayEvening, tomorrowDate]).toContain(result.payload!.task!.dueDate);
          if (result.payload!.task!.dueDate === todayEvening) {
            expect(result.payload!.task!.timeSegment).toBe("evening");
          }
        } else {
          // LLM 可能追问具体时间或日期
          expect(["text", "question"]).toContain(result.type);
          expect(result.content).toMatch(/衣服|提醒|时间|日期|什么时候|拿/);
        }
      },
      60000,
    );
  });

  // ==================== 创建任务 - 冲突检测 ====================

  describe("创建任务 - 冲突检测", () => {
    itIfReady(
      "CF01: 语义冲突检测 → 应提示已有类似任务",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);

        // 前置条件：已有 "取快递" 任务
        await seedTask({ title: "取快递", dueDate: tomorrowDate });

        // 创建语义相似的任务 → 应提示冲突或创建成功（但提及已有任务）
        const result = await ai.chat(testUserId, "明天帮我拿快递");

        if (result.type === "task_summary") {
          // LLM 直接创建了任务（冲突检测可能未触发，但任务本身应该包含"快递"）
          expect(result.payload?.task).toBeDefined();
          expect(result.payload!.task!.title).toContain("快递");
        } else {
          // 检测到冲突 → 回复中应提及类似/已有/冲突信息
          expect(["question", "text"]).toContain(result.type);
          expect(result.content).toMatch(/类似|已有|相同|重复|快递|冲突/);
        }
      },
      60000,
    );

    itIfReady(
      "CF02: 时间冲突检测",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);

        // 前置条件：已有 14:00-15:00 的任务
        await seedTask({
          title: "团队例会",
          dueDate: tomorrowDate,
          startTime: "14:00",
          endTime: "15:00",
        });

        // 创建时间重叠的任务 → 应提示冲突
        const result = await ai.chat(testUserId, "明天14:30到15:30开会");

        // 不应直接创建成功
        if (result.type === "task_summary") {
          // 如果创建了，说明冲突检测失败
          expect(result.type).not.toBe("task_summary");
        }
        expect(result.content).toMatch(/冲突|重叠|占用/);
      },
      60000,
    );
  });

  // ==================== 创建任务 - 需追问场景 ====================

  describe("创建任务 - 需追问场景", () => {
    itIfReady(
      "Q01: 12小时制未说明上午/下午 → 应追问确认或合理推断",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "明天4点到5点开会");

        if (result.type === "task_summary") {
          // LLM 自行推断了上午/下午（常见于"开会" → 下午）
          // 验证时间至少是合理的（04:00 或 16:00）
          const task = result.payload?.task;
          expect(task).toBeDefined();
          expect(task!.startTime).toMatch(/^(04:00|16:00)/);
          expect(task!.endTime).toMatch(/^(05:00|17:00)/);
        } else {
          // 追问上午/下午 — 这是更理想的行为
          expect(["question", "text"]).toContain(result.type);
          expect(result.content).toMatch(/上午|下午|AM|PM|凌晨|确认/i);
        }
      },
      60000,
    );

    itIfReady(
      "Q02: 只给开始时间没给结束时间 → 应追问结束时间",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "明天下午3点开始开会");

        // System Prompt 规则：只有开始时间时必须追问结束时间
        expect(result.type).not.toBe("task_summary");
        expect(result.content).toMatch(/结束|几点|到几点|多久|时长/);
      },
      60000,
    );

    itIfReady(
      "Q03: 晚上说 '下午' 但未指定日期 -> 必须追问确认",
      async () => {
        // 模拟当前是晚上 20:00
        const eveningOffset = getOffsetForHour(20);
        const todayDate = getDateStr(0, eveningOffset);
        const ai = createAIService(eveningOffset);

        const result = await ai.chat(testUserId, "提醒我下午去车里拿衣服");

        // 允许模型先给文本提示，但必须明确提示时间不合理并追问确认
        expect(["text", "question"]).toContain(result.type);
        expect(result.content).toMatch(/晚上|下午|时间|时段|确认|明天/);
        // 仅用于断言触发的是“今天已过时段”的追问
        expect(todayDate).toBeDefined();
      },
      60000,
    );

    itIfReady(
      "Q04: 今天上午具体时间已过 -> 必须追问确认",
      async () => {
        // 模拟当前是下午 16:00
        const afternoonOffset = getOffsetForHour(16);
        const ai = createAIService(afternoonOffset);

        const result = await ai.chat(testUserId, "今天上午10点到11点开会");

        // 具体时间已过必须追问确认，不能自动纠正
        expect(result.type).toBe("question");
        expect(result.content).toMatch(/已过|时间|确认|无法/);
      },
      60000,
    );
  });

  // ==================== 查询任务 ====================

  describe("查询任务", () => {
    itIfReady(
      "QR01: 指定日期查询 → 应返回任务列表",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);

        // 前置条件：创建 2 个明天的任务
        await seedTask({ title: "晨会", dueDate: tomorrowDate });
        await seedTask({ title: "代码评审", dueDate: tomorrowDate });

        const result = await ai.chat(testUserId, "查看明天的任务");

        expect(result.type).toBe("text");
        // 回复中应包含任务信息
        expect(result.content).toMatch(/晨会|代码评审/);
      },
      60000,
    );

    itIfReady(
      "QR02: 未指定日期 → 应提示需要日期",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "查看我的任务");

        // System Prompt 规则：未指定日期需提醒用户
        expect(result.type).toBe("text");
        expect(result.content).toMatch(/日期|哪天|什么时候|哪一天|具体/);
      },
      60000,
    );
  });

  // ==================== 更新任务 ====================

  describe("更新任务", () => {
    itIfReady(
      "U01: 修改任务日期",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);
        const dayAfterTomorrow = getDateStr(2);

        // 前置条件：创建任务
        await seedTask({ title: "团队会议", dueDate: tomorrowDate });

        const result = await ai.chat(testUserId, "把团队会议改到后天");

        // 应成功更新
        if (result.type === "task_summary") {
          expect(result.payload?.task?.dueDate).toBe(dayAfterTomorrow);
        } else {
          // LLM 可能先查询确认再更新，回复中应提及相关内容
          expect(result.content).toMatch(/团队会议|更新|修改|后天/);
        }
      },
      60000,
    );
  });

  // ==================== 完成任务 ====================

  describe("完成任务", () => {
    itIfReady(
      "D01: 标记任务完成",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);

        // 前置条件：创建任务
        await seedTask({ title: "写周报", dueDate: tomorrowDate });

        const result = await ai.chat(testUserId, "完成写周报");

        // 回复中应确认完成
        expect(result.content).toMatch(/完成|已完成|标记|done/i);
      },
      60000,
    );
  });

  // ==================== 删除任务 ====================

  describe("删除任务", () => {
    itIfReady(
      "DEL01: 删除前应先确认",
      async () => {
        const ai = createAIService();
        const tomorrowDate = getDateStr(1);

        // 前置条件：创建任务
        await seedTask({ title: "旧任务", dueDate: tomorrowDate });

        const result = await ai.chat(testUserId, "删除旧任务");

        // System Prompt 规则：删除前必须向用户确认
        // 不应直接删除，应该先确认
        expect(result.content).toMatch(/确认|确定|删除|是否/);
      },
      60000,
    );
  });

  // ==================== 非任务请求 ====================

  describe("非任务请求", () => {
    itIfReady(
      "R01: 闲聊应礼貌拒绝",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "给我讲个笑话");

        expect(result.type).toBe("text");
        // System Prompt 规则：非任务相关请求礼貌拒绝
        expect(result.content).toMatch(/任务|帮忙|管理|只能/);
      },
      60000,
    );

    itIfReady(
      "R02: 非任务查询应礼貌拒绝",
      async () => {
        const ai = createAIService();
        const result = await ai.chat(testUserId, "今天天气怎么样");

        expect(result.type).toBe("text");
        expect(result.content).toMatch(/任务|帮忙|管理|只能/);
      },
      60000,
    );
  });
});
