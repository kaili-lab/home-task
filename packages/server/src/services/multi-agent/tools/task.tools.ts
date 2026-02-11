import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { TaskInfo, TimeSegment } from "shared";
import { TaskService } from "../../task.service";
import type { AgentConfigurable, ToolResult } from "../types";
import {
  buildSegmentNotAllowedMessage,
  formatTimeSegmentLabel,
  getDefaultTimeSegmentForDate,
  getTodayDate,
  isSegmentAllowedForToday,
  isTimeRangePassedForToday,
} from "../utils/time.helpers";
import {
  filterTimeConflicts,
  findSemanticConflicts,
  mergeConflictingTasks,
} from "../utils/conflict.helpers";

const createTaskSchema = z.object({
  title: z.string().describe("任务标题，简洁的动作短语"),
  description: z.string().optional().describe("任务描述，补充信息"),
  dueDate: z.string().optional().describe("执行日期 YYYY-MM-DD。未提供则默认今天"),
  startTime: z.string().optional().describe("开始时间 HH:MM，需与 endTime 同时提供"),
  endTime: z.string().optional().describe("结束时间 HH:MM，需与 startTime 同时提供"),
  timeSegment: z
    .enum(["all_day", "early_morning", "morning", "forenoon", "noon", "afternoon", "evening"])
    .optional()
    .describe("模糊时段，与 startTime/endTime 互斥"),
  priority: z.enum(["high", "medium", "low"]).optional().describe("优先级，默认 medium"),
  groupId: z.number().optional().describe("群组ID，个人任务不传"),
});

const queryTasksSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  dueDate: z.string().optional().describe("查询日期 YYYY-MM-DD"),
  priority: z.enum(["high", "medium", "low"]).optional(),
});

const modifyTaskSchema = z.object({
  title: z.string().optional().describe("要修改的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
  // 更新字段
  newTitle: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeSegment: z
    .enum(["all_day", "early_morning", "morning", "forenoon", "noon", "afternoon", "evening"])
    .optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});

const finishTaskSchema = z.object({
  title: z.string().optional().describe("要完成的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
});

const removeTaskSchema = z.object({
  title: z.string().optional().describe("要删除的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
});

function toJsonResult(result: ToolResult): string {
  // 统一序列化是为了让上层解析逻辑保持稳定
  return JSON.stringify(result);
}

function buildCandidatesMessage(candidates: TaskInfo[]): string {
  // 以固定格式输出候选列表，方便用户快速选择
  const lines = candidates.map((t) => `- [ID:${t.id}] ${t.title}`);
  return `找到多个匹配任务，请指定 ID：\n${lines.join("\n")}`;
}

async function findTaskByTitleOrId(
  db: AgentConfigurable["db"],
  userId: number,
  tzOffset: number,
  title?: string,
  taskId?: number,
): Promise<
  | { type: "found"; task: TaskInfo }
  | { type: "multiple"; candidates: TaskInfo[] }
  | { type: "not_found"; message: string }
> {
  // 统一入口是为了保证所有工具的匹配规则一致
  const taskService = new TaskService(db);
  if (taskId !== undefined) {
    const task = await taskService.getTaskById(taskId, userId);
    return { type: "found", task };
  }
  if (title) {
    const result = await taskService.getTasks(userId, {
      status: "pending",
      dueDate: getTodayDate(tzOffset),
    });
    const matches = findSemanticConflicts(result.tasks, title);
    if (matches.length === 1) return { type: "found", task: matches[0] };
    if (matches.length > 1) return { type: "multiple", candidates: matches };
    return { type: "not_found", message: "未找到匹配任务" };
  }
  return { type: "not_found", message: "请提供任务名称或ID" };
}

export const createTaskTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const {
      title,
      description,
      dueDate,
      startTime,
      endTime,
      timeSegment,
      priority,
      groupId,
    } = params;

    const hasStartTime = !!startTime;
    const hasEndTime = !!endTime;
    if (hasStartTime !== hasEndTime) {
      return toJsonResult({
        status: "need_confirmation",
        message: "请补充完整的开始/结束时间。",
      });
    }

    const effectiveDueDate = dueDate || getTodayDate(timezoneOffsetMinutes);

    let finalStartTime: string | null = null;
    let finalEndTime: string | null = null;
    let finalTimeSegment: TimeSegment | null = null;

    if (hasStartTime && hasEndTime) {
      finalStartTime = startTime || null;
      finalEndTime = endTime || null;
    } else {
      finalTimeSegment = timeSegment || getDefaultTimeSegmentForDate(effectiveDueDate, timezoneOffsetMinutes);
    }

    if (finalTimeSegment && !isSegmentAllowedForToday(effectiveDueDate, finalTimeSegment, timezoneOffsetMinutes)) {
      return toJsonResult({
        status: "need_confirmation",
        message: buildSegmentNotAllowedMessage(finalTimeSegment, timezoneOffsetMinutes),
      });
    }

    if (
      finalStartTime &&
      finalEndTime &&
      isTimeRangePassedForToday(effectiveDueDate, finalStartTime, finalEndTime, timezoneOffsetMinutes)
    ) {
      return toJsonResult({
        status: "need_confirmation",
        message: `今天已过你提到的时间段（${finalStartTime}-${finalEndTime}）。请确认是否调整。`,
      });
    }

    const taskService = new TaskService(db);
    const tasksForDate = await taskService.getTasks(userId, {
      status: "pending",
      dueDate: effectiveDueDate,
    });

    const timeConflicts =
      finalStartTime && finalEndTime
        ? filterTimeConflicts(tasksForDate.tasks, finalStartTime, finalEndTime)
        : [];
    const semanticConflicts = findSemanticConflicts(tasksForDate.tasks, title);

    if (timeConflicts.length > 0 || semanticConflicts.length > 0) {
      const merged = mergeConflictingTasks(timeConflicts, semanticConflicts);
      const formatTaskTime = (task: TaskInfo) =>
        task.startTime && task.endTime
          ? `${task.startTime}-${task.endTime}`
          : formatTimeSegmentLabel(task.timeSegment);
      const timeInfo = timeConflicts.map((t) => `- ${t.title}（${formatTaskTime(t)}）`).join("\n");
      const semanticInfo = semanticConflicts
        .map((t) => `- ${t.title}（${formatTaskTime(t)}）`)
        .join("\n");

      let message = "";
      if (timeConflicts.length > 0 && semanticConflicts.length === 0) {
        message = `时间冲突！以下任务与请求时间段重叠：\n${timeInfo}\n请调整时间后再创建。`;
      } else if (timeConflicts.length === 0 && semanticConflicts.length > 0) {
        message = `你当天已有类似任务：\n${semanticInfo}\n是否仍要创建？回复"确认"继续创建。`;
      } else {
        message = `时间冲突：\n${timeInfo}\n同时你当天已有类似任务：\n${semanticInfo}\n请先调整时间后再创建。`;
      }

      return toJsonResult({
        status: "conflict",
        message,
        conflictingTasks: merged,
      });
    }

    const task = await taskService.createTask(userId, {
      title,
      description,
      dueDate: effectiveDueDate,
      startTime: finalStartTime,
      endTime: finalEndTime,
      timeSegment: finalTimeSegment,
      priority: (priority as "high" | "medium" | "low") || "medium",
      groupId: groupId || null,
      source: "ai",
      assignedToIds: [userId],
    });

    const timeInfo = task.startTime
      ? `，时间${task.startTime}-${task.endTime}`
      : `（${formatTimeSegmentLabel(task.timeSegment)}）`;
    return toJsonResult({
      status: "success",
      message: `任务创建成功！标题"${task.title}"，日期${task.dueDate}${timeInfo}`,
      task,
      actionPerformed: "create",
    });
  },
  {
    name: "create_task",
    description: "创建任务，工具内部会处理时间合理性与冲突检测。",
    schema: createTaskSchema,
  },
);

export const queryTasksTool = tool(
  async (params, config) => {
    const { db, userId } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }
    const taskService = new TaskService(db);
    const result = await taskService.getTasks(userId, {
      status: params.status as "pending" | "completed" | "cancelled" | undefined,
      dueDate: params.dueDate,
      priority: params.priority as "high" | "medium" | "low" | undefined,
    });

    if (result.tasks.length === 0) {
      return toJsonResult({ status: "success", message: "没有找到符合条件的任务。" });
    }

    const message = result.tasks
      .map(
        (t) =>
          `[ID:${t.id}] ${t.title} | 日期:${t.dueDate} | ${
            t.startTime ? `时间:${t.startTime}-${t.endTime}` : formatTimeSegmentLabel(t.timeSegment)
          } | 状态:${t.status} | 优先级:${t.priority}`,
      )
      .join("\n");

    return toJsonResult({ status: "success", message });
  },
  {
    name: "query_tasks",
    description: "查询任务列表。",
    schema: queryTasksSchema,
  },
);

export const modifyTaskTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const lookup = await findTaskByTitleOrId(
      db,
      userId,
      timezoneOffsetMinutes,
      params.title,
      params.taskId,
    );
    if (lookup.type === "multiple") {
      return toJsonResult({
        status: "need_confirmation",
        message: buildCandidatesMessage(lookup.candidates),
      });
    }
    if (lookup.type === "not_found") {
      return toJsonResult({ status: "error", message: lookup.message });
    }

    const taskService = new TaskService(db);
    const updated = await taskService.updateTask(lookup.task.id, userId, {
      title: params.newTitle,
      description: params.description,
      dueDate: params.dueDate,
      startTime: params.startTime,
      endTime: params.endTime,
      timeSegment: params.timeSegment as TimeSegment | undefined,
      priority: params.priority as "high" | "medium" | "low" | undefined,
    });

    const timeInfo = updated.startTime
      ? `，时间${updated.startTime}-${updated.endTime}`
      : `（${formatTimeSegmentLabel(updated.timeSegment)}）`;
    return toJsonResult({
      status: "success",
      message: `任务更新成功！标题"${updated.title}"，日期${updated.dueDate}${timeInfo}`,
      task: updated,
      actionPerformed: "update",
    });
  },
  {
    name: "modify_task",
    description: "修改任务。支持按标题模糊匹配或 ID 精确匹配。",
    schema: modifyTaskSchema,
  },
);

export const finishTaskTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    const lookup = await findTaskByTitleOrId(
      db,
      userId,
      timezoneOffsetMinutes,
      params.title,
      params.taskId,
    );
    if (lookup.type === "multiple") {
      return toJsonResult({
        status: "need_confirmation",
        message: buildCandidatesMessage(lookup.candidates),
      });
    }
    if (lookup.type === "not_found") {
      return toJsonResult({ status: "error", message: lookup.message });
    }

    const taskService = new TaskService(db);
    const task = await taskService.updateTaskStatus(lookup.task.id, userId, "completed");
    return toJsonResult({
      status: "success",
      message: `任务 "${task.title}" 已标记为完成。`,
      task,
      actionPerformed: "complete",
    });
  },
  {
    name: "finish_task",
    description: "完成任务。",
    schema: finishTaskSchema,
  },
);

export const removeTaskTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = (config?.configurable || {}) as AgentConfigurable;
    if (!db || !userId) {
      return toJsonResult({ status: "error", message: "缺少运行时上下文" });
    }

    if (!params.title && params.taskId === undefined) {
      return toJsonResult({ status: "error", message: "请提供任务名称或ID" });
    }

    const lookup = await findTaskByTitleOrId(
      db,
      userId,
      timezoneOffsetMinutes,
      params.title,
      params.taskId,
    );
    if (lookup.type === "multiple") {
      return toJsonResult({
        status: "need_confirmation",
        message: buildCandidatesMessage(lookup.candidates),
      });
    }
    if (lookup.type === "not_found") {
      return toJsonResult({ status: "error", message: lookup.message });
    }

    const taskService = new TaskService(db);
    await taskService.deleteTask(lookup.task.id, userId);
    return toJsonResult({
      status: "success",
      message: "任务已删除。",
      actionPerformed: "delete",
    });
  },
  {
    name: "remove_task",
    description: "删除任务。",
    schema: removeTaskSchema,
  },
);

// 以数组导出是为了在 agent 侧按统一方式注册工具
export const taskTools = [
  createTaskTool,
  queryTasksTool,
  modifyTaskTool,
  finishTaskTool,
  removeTaskTool,
];
