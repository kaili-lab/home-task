import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { TaskInfo } from "shared";
import { TaskService } from "../../task.service";
import type { AgentConfigurable, ToolResult } from "../types";
import { formatTimeSegmentLabel, parseTimeToMinutes } from "../utils/time.helpers";

const getDayScheduleSchema = z.object({
  date: z.string().describe("查看日期 YYYY-MM-DD"),
});

const findFreeSlotsSchema = z.object({
  date: z.string().describe("查找日期 YYYY-MM-DD"),
  startHour: z.number().optional().describe("搜索起始小时，默认 9"),
  endHour: z.number().optional().describe("搜索结束小时，默认 18"),
});

function toJsonResult(result: ToolResult): string {
  // 统一返回结构是为了让上层解析逻辑保持一致
  return JSON.stringify(result);
}

function formatTaskLine(task: TaskInfo): string {
  // 统一格式输出，便于用户快速扫视
  if (task.startTime && task.endTime) {
    return `${task.startTime}-${task.endTime} ${task.title}`;
  }
  return `${formatTimeSegmentLabel(task.timeSegment)} ${task.title}`;
}

export const getDayScheduleTool = tool(
  async (params, config) => {
    const { db, userId } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const taskService = new TaskService(db);
    const result = await taskService.getTasks(userId, { dueDate: params.date });
    if (result.tasks.length === 0) {
      return toJsonResult({ status: "success", message: "当天没有安排" });
    }

    const sorted = [...result.tasks].sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });

    const message = sorted.map((t) => formatTaskLine(t)).join("\n");
    return toJsonResult({ status: "success", message, data: { tasks: sorted } });
  },
  {
    name: "get_day_schedule",
    description: "查看指定日期的日程安排。",
    schema: getDayScheduleSchema,
  },
);

export const findFreeSlotsTool = tool(
  async (params, config) => {
    const { db, userId } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const startHour = params.startHour ?? 9;
    const endHour = params.endHour ?? 18;

    const taskService = new TaskService(db);
    const result = await taskService.getTasks(userId, { dueDate: params.date });
    const timedTasks = result.tasks
      .filter((t) => t.startTime && t.endTime)
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

    if (timedTasks.length === 0) {
      return toJsonResult({ status: "success", message: "当天没有安排" });
    }

    const freeSlots: Array<{ start: string; end: string }> = [];
    let cursor = startHour * 60;
    const endBoundary = endHour * 60;

    timedTasks.forEach((task) => {
      const startMinutes = parseTimeToMinutes(task.startTime) ?? 0;
      const endMinutes = parseTimeToMinutes(task.endTime) ?? 0;
      if (startMinutes > cursor) {
        freeSlots.push({
          start: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
          end: `${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}`,
        });
      }
      cursor = Math.max(cursor, endMinutes);
    });

    if (cursor < endBoundary) {
      freeSlots.push({
        start: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
        end: `${String(Math.floor(endBoundary / 60)).padStart(2, "0")}:${String(endBoundary % 60).padStart(2, "0")}`,
      });
    }

    if (freeSlots.length === 0) {
      return toJsonResult({ status: "success", message: "当天没有空闲时间" });
    }

    const message = freeSlots.map((slot) => `${slot.start}-${slot.end}`).join("\n");
    return toJsonResult({ status: "success", message, data: { freeSlots } });
  },
  {
    name: "find_free_slots",
    description: "查找指定日期的空闲时间段。",
    schema: findFreeSlotsSchema,
  },
);

export const calendarTools = [getDayScheduleTool, findFreeSlotsTool];
