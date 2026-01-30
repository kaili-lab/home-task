import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { TaskService } from "../services/task.service";
import type { TaskStatus, Priority } from "shared";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const tasksRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

// 创建任务的Zod Schema
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  assignedToIds: z.array(z.number().int().positive()).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  isRecurring: z.boolean().optional(),
  recurringRule: z
    .object({
      freq: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().int().positive(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      endAfterOccurrences: z.number().int().positive().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
    })
    .nullable()
    .optional(),
});

// 更新任务的Zod Schema
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  assignedToIds: z.array(z.number().int().positive()).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  isRecurring: z.boolean().optional(),
  recurringRule: z
    .object({
      freq: z.enum(["daily", "weekly", "monthly"]),
      interval: z.number().int().positive(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      endAfterOccurrences: z.number().int().positive().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
    })
    .nullable()
    .optional(),
});

// 更新任务状态的Zod Schema
const updateTaskStatusSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled", "in_progress"]),
});

/**
 * POST /api/tasks
 * 创建任务
 */
tasksRoutes.post("/", zValidator("json", createTaskSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const data = c.req.valid("json");

    const taskService = new TaskService(db);
    const task = await taskService.createTask(userId, {
      ...data,
      dueDate: data.dueDate || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      priority: data.priority,
      isRecurring: data.isRecurring,
      recurringRule: data.recurringRule ?? undefined,
    });

    return c.json(successResponse(task), 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/tasks
 * 获取混合任务流（个人任务 + 所有群组任务）
 */
tasksRoutes.get("/", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);

    // 解析查询参数
    const status = c.req.query("status") as TaskStatus | undefined;
    const groupIdParam = c.req.query("groupId");
    const assignedToParam = c.req.query("assignedTo");
    const priorityParam = c.req.query("priority");
    const excludeRecurringInstancesParam = c.req.query("excludeRecurringInstances");
    const pageParam = c.req.query("page");
    const limitParam = c.req.query("limit");

    const filters: Parameters<TaskService["getTasks"]>[1] = {};

    if (status && ["pending", "completed", "cancelled", "in_progress"].includes(status)) {
      filters.status = status;
    }

    if (groupIdParam !== undefined) {
      if (groupIdParam === "null" || groupIdParam === "") {
        filters.groupId = undefined;
      } else {
        const groupId = parseInt(groupIdParam, 10);
        if (!isNaN(groupId)) {
          filters.groupId = groupId;
        }
      }
    }

    if (assignedToParam !== undefined) {
      if (assignedToParam === "me") {
        filters.assignedTo = "me";
      } else {
        const assignedTo = parseInt(assignedToParam, 10);
        if (!isNaN(assignedTo)) {
          filters.assignedTo = assignedTo;
        }
      }
    }

    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page) && page > 0) {
        filters.page = page;
      }
    }

    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        filters.limit = limit;
      }
    }

    if (priorityParam && ["high", "medium", "low"].includes(priorityParam)) {
      filters.priority = priorityParam as Priority;
    }

    if (excludeRecurringInstancesParam === "true") {
      filters.excludeRecurringInstances = true;
    }

    const taskService = new TaskService(db);
    const result = await taskService.getTasks(userId, filters);

    return c.json(successResponse(result));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/tasks/:id
 * 获取任务详情
 */
tasksRoutes.get("/:id", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const taskId = parseInt(c.req.param("id"), 10);

    if (isNaN(taskId)) {
      return c.json(
        {
          success: false,
          error: "无效的任务ID",
        },
        400,
      );
    }

    const taskService = new TaskService(db);
    const task = await taskService.getTaskById(taskId, userId);

    return c.json(successResponse(task));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * PATCH /api/tasks/:id
 * 更新任务内容
 */
tasksRoutes.patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const taskId = parseInt(c.req.param("id"), 10);
    const data = c.req.valid("json");

    if (isNaN(taskId)) {
      return c.json(
        {
          success: false,
          error: "无效的任务ID",
        },
        400,
      );
    }

    const taskService = new TaskService(db);
    const task = await taskService.updateTask(taskId, userId, {
      title: data.title,
      description: data.description,
      assignedToIds: data.assignedToIds === null ? undefined : data.assignedToIds,
      dueDate: data.dueDate !== undefined ? data.dueDate : undefined,
      startTime: data.startTime !== undefined ? data.startTime : undefined,
      endTime: data.endTime !== undefined ? data.endTime : undefined,
      priority: data.priority,
      isRecurring: data.isRecurring,
      recurringRule: data.recurringRule,
    });

    return c.json(successResponse(task));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * PATCH /api/tasks/:id/status
 * 更新任务状态
 */
tasksRoutes.patch("/:id/status", zValidator("json", updateTaskStatusSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const taskId = parseInt(c.req.param("id"), 10);
    const { status } = c.req.valid("json");

    if (isNaN(taskId)) {
      return c.json(
        {
          success: false,
          error: "无效的任务ID",
        },
        400,
      );
    }

    const taskService = new TaskService(db);
    const task = await taskService.updateTaskStatus(taskId, userId, status);

    return c.json(successResponse(task));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * DELETE /api/tasks/:id
 * 删除任务
 */
tasksRoutes.delete("/:id", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const taskId = parseInt(c.req.param("id"), 10);

    if (isNaN(taskId)) {
      return c.json(
        {
          success: false,
          error: "无效的任务ID",
        },
        400,
      );
    }

    const taskService = new TaskService(db);
    await taskService.deleteTask(taskId, userId);

    return c.json(successResponse({ message: "任务已删除" }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

export default tasksRoutes;
