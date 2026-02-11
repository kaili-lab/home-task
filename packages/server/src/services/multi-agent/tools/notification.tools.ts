import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { reminders } from "../../../db/schema";
import type { AgentConfigurable, ToolResult } from "../types";
import { getTodayDate, getUserNow } from "../utils/time.helpers";

const scheduleReminderSchema = z.object({
  taskId: z.number().optional().describe("关联的任务ID"),
  taskTitle: z.string().describe("任务标题，用于生成提醒内容"),
  taskDate: z.string().describe("任务日期 YYYY-MM-DD"),
  taskTime: z.string().optional().describe("任务时间 HH:MM 或时段名称"),
  weatherInfo: z.string().optional().describe("天气信息，如有则附加到提醒内容"),
});

const listRemindersSchema = z.object({
  date: z.string().optional().describe("查询日期 YYYY-MM-DD"),
});

const cancelReminderSchema = z.object({
  reminderId: z.number().describe("提醒ID"),
});

function toJsonResult(result: ToolResult): string {
  // 统一结构返回，避免前端解析分叉
  return JSON.stringify(result);
}

function toUserDate(dateStr: string, hour: number, minute: number, tzOffset: number): Date {
  // 统一按用户时区构造时间，保证提醒时间与用户体验一致
  const [year, month, day] = dateStr.split("-").map((v) => Number.parseInt(v, 10));
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(utc - tzOffset * 60 * 1000);
}

function formatReminderContent(title: string, timeText: string, weatherInfo?: string): string {
  // 文案聚合在一起便于后续统一调整
  const base = `${title}（${timeText}）`;
  if (weatherInfo) return `${base}，${weatherInfo}`;
  return base;
}

export const scheduleReminderTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const now = getUserNow(timezoneOffsetMinutes);
    const today = getTodayDate(timezoneOffsetMinutes);
    const isSameDay = params.taskDate === today;

    let remindAt: Date;
    let timeText = params.taskTime || "当天";

    if (!isSameDay) {
      // 跨天任务：前一天 20:00
      remindAt = toUserDate(params.taskDate, 20, 0, timezoneOffsetMinutes);
      remindAt = new Date(remindAt.getTime() - 24 * 60 * 60 * 1000);
      timeText = "前一天 20:00";
    } else if (params.taskTime && params.taskTime.includes(":")) {
      // 当天有具体时间：提前 2 小时
      const [hourStr, minuteStr] = params.taskTime.split(":");
      const hour = Number.parseInt(hourStr, 10);
      const minute = Number.parseInt(minuteStr, 10);
      remindAt = toUserDate(params.taskDate, hour, minute, timezoneOffsetMinutes);
      remindAt = new Date(remindAt.getTime() - 2 * 60 * 60 * 1000);
      timeText = `${params.taskTime} 前 2 小时`;
    } else {
      // 当天无具体时间：当天 08:00
      remindAt = toUserDate(params.taskDate, 8, 0, timezoneOffsetMinutes);
      timeText = "当天 08:00";
    }

    if (remindAt.getTime() <= now.getTime()) {
      return toJsonResult({ status: "error", message: "任务时间已过，无法安排提醒" });
    }

    const content = formatReminderContent(params.taskTitle, timeText, params.weatherInfo);

    await db.insert(reminders).values({
      userId,
      taskId: params.taskId || null,
      remindAt,
      content,
      status: "pending",
      channel: "console",
    });

    console.log("[notification.reminder]", JSON.stringify({ userId, remindAt, content }));

    return toJsonResult({
      status: "success",
      message: `提醒已安排：${content}`,
      data: { remindAt: remindAt.toISOString() },
    });
  },
  {
    name: "schedule_reminder",
    description: "安排任务提醒。",
    schema: scheduleReminderSchema,
  },
);

export const listRemindersTool = tool(
  async (params, config) => {
    const { db, userId } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const conditions = [eq(reminders.userId, userId)];
    if (params.date) {
      conditions.push(sql`date(${reminders.remindAt}) = ${params.date}` as any);
    }

    const rows = await db.select().from(reminders).where(and(...conditions));
    if (rows.length === 0) {
      return toJsonResult({ status: "success", message: "没有找到提醒" });
    }

    const message = rows.map((r) => `[ID:${r.id}] ${r.content} | ${r.status}`).join("\n");
    return toJsonResult({ status: "success", message, data: { reminders: rows } });
  },
  {
    name: "list_reminders",
    description: "查询提醒列表。",
    schema: listRemindersSchema,
  },
);

export const cancelReminderTool = tool(
  async (params, config) => {
    const { db, userId } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    await db
      .update(reminders)
      .set({ status: "cancelled" })
      .where(and(eq(reminders.id, params.reminderId), eq(reminders.userId, userId)));

    return toJsonResult({ status: "success", message: "提醒已取消" });
  },
  {
    name: "cancel_reminder",
    description: "取消提醒。",
    schema: cancelReminderSchema,
  },
);

export const notificationTools = [scheduleReminderTool, listRemindersTool, cancelReminderTool];
