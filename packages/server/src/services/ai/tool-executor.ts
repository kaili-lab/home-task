import type { TimeSegment, TaskInfo } from "shared";
import type { DbInstance } from "../../db/db";
import { TaskService } from "../task.service";
import type { ConflictDetector } from "./conflict-detector";
import type { PromptBuilder } from "./prompt-builder";
import type { ToolResult } from "./types";

type ExecutorLogger = (stage: string, details?: Record<string, unknown>) => void;

export class ToolExecutor {
  constructor(
    private db: DbInstance,
    private promptBuilder: PromptBuilder,
    private conflictDetector: ConflictDetector,
    private log?: ExecutorLogger,
    private toJsonPreview?: (value: unknown, maxLength?: number) => string,
  ) {}

  async executeToolCall(
    userId: number,
    toolName: string,
    toolArgs: Record<string, unknown>,
    userMessage: string,
    options?: { skipSemanticConflictCheck?: boolean },
  ): Promise<ToolResult> {
    const taskService = new TaskService(this.db);
    this.log?.("tool.execute.start", {
      userId,
      toolName,
      toolArgs: this.toJsonPreview?.(toolArgs, 500) ?? toolArgs,
      skipSemanticConflictCheck: options?.skipSemanticConflictCheck === true,
    });

    switch (toolName) {
      case "create_task": {
        const {
          title,
          description,
          dueDate,
          startTime,
          endTime,
          priority,
          groupId,
          timeSegment,
        } = toolArgs as {
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
          this.promptBuilder.hasExplicitTimeRange(userMessage) ||
          this.promptBuilder.hasExplicitTimePoint(userMessage);
        const hasSegmentHint = this.promptBuilder.hasTimeSegmentHint(userMessage);
        const hasDateHint = this.promptBuilder.hasDateHint(userMessage);

        if (hasExplicitTime && !hasTimeRange) {
          return {
            status: "need_confirmation",
            message: "你提到开始时间了，还需要结束时间或时长。请问几点结束/到几点/多久？",
            responseType: "question",
          };
        }

        const effectiveDueDate =
          hasDateHint && dueDate ? dueDate : this.promptBuilder.getTodayDate();
        const hintedSegment = hasSegmentHint
          ? this.promptBuilder.inferTimeSegmentFromText(userMessage)
          : null;

        if (
          hintedSegment &&
          !this.promptBuilder.isSegmentAllowedForToday(effectiveDueDate, hintedSegment)
        ) {
          return {
            status: "need_confirmation",
            message: this.promptBuilder.buildSegmentNotAllowedMessage(hintedSegment),
            responseType: "question",
          };
        }

        if (
          hasTimeRange &&
          this.promptBuilder.isTimeRangePassedForToday(
            effectiveDueDate,
            startTime,
            endTime,
          )
        ) {
          return {
            status: "need_confirmation",
            message: `今天已过你提到的时间段（${startTime}-${endTime}）。请确认是否改到今天稍后或明天，或提供新的时间段。`,
            responseType: "question",
          };
        }

        let finalTimeSegment = hasTimeRange
          ? null
          : timeSegment || this.promptBuilder.inferTimeSegmentFromText(userMessage);

        if (!hasTimeRange && !timeSegment && !hasSegmentHint && !hasExplicitTime) {
          finalTimeSegment =
            this.promptBuilder.getDefaultTimeSegmentForDate(effectiveDueDate);
        }

        if (
          finalTimeSegment &&
          !this.promptBuilder.isSegmentAllowedForToday(
            effectiveDueDate,
            finalTimeSegment,
          )
        ) {
          return {
            status: "need_confirmation",
            message:
              this.promptBuilder.buildSegmentNotAllowedMessage(finalTimeSegment),
            responseType: "question",
          };
        }

        const skipSemanticConflictCheck =
          options?.skipSemanticConflictCheck === true;
        const tasksForDate = await this.conflictDetector.getTasksForDate(
          userId,
          effectiveDueDate,
        );
        const timeConflicts =
          startTime && endTime
            ? this.conflictDetector.filterTimeConflicts(
                tasksForDate,
                startTime,
                endTime,
              )
            : [];
        const semanticConflicts = skipSemanticConflictCheck
          ? []
          : this.conflictDetector.findSemanticConflicts(tasksForDate, title);
        const hasTimeConflicts = timeConflicts.length > 0;
        const hasSemanticConflicts = semanticConflicts.length > 0;

        if (hasTimeConflicts || hasSemanticConflicts) {
          const merged = this.conflictDetector.mergeConflictingTasks(
            timeConflicts,
            semanticConflicts,
          );
          const formatTaskTime = (task: TaskInfo) =>
            task.startTime && task.endTime
              ? `${task.startTime}-${task.endTime}`
              : this.promptBuilder.formatTimeSegmentLabel(task.timeSegment);

          let message: string;
          if (hasTimeConflicts && !hasSemanticConflicts) {
            const conflictInfo = timeConflicts
              .map((task) => `- ${task.title}（${formatTaskTime(task)}）`)
              .join("\n");
            message = `时间冲突！以下任务与请求时间段重叠：\n${conflictInfo}\n请调整时间后再创建。`;
          } else if (!hasTimeConflicts && hasSemanticConflicts) {
            const conflictInfo = semanticConflicts
              .map((task) => `- ${task.title}（${formatTaskTime(task)}）`)
              .join("\n");
            message = `你当天已有类似任务：\n${conflictInfo}\n是否仍要创建？回复"确认"继续创建。`;
          } else {
            const timeInfo = timeConflicts
              .map((task) => `- ${task.title}（${formatTaskTime(task)}）`)
              .join("\n");
            const semanticInfo = semanticConflicts
              .map((task) => `- ${task.title}（${formatTaskTime(task)}）`)
              .join("\n");
            message = `时间冲突：\n${timeInfo}\n同时你当天已有类似任务：\n${semanticInfo}\n请先调整时间后再创建。`;
          }

          return {
            status: "conflict",
            message,
            conflictingTasks: merged,
            responseType: "question",
          };
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

        const timeInfo = task.startTime
          ? `，时间${task.startTime}-${task.endTime}`
          : `（${this.promptBuilder.formatTimeSegmentLabel(task.timeSegment)}）`;

        return {
          status: "success",
          message: `任务创建成功！标题"${task.title}"，日期${task.dueDate}${timeInfo}`,
          task,
          actionPerformed: "create",
          responseType: "task_summary",
        };
      }

      case "query_tasks": {
        const { status, dueDate, dueDateFrom, dueDateTo, priority } =
          toolArgs as {
            status?: string;
            dueDate?: string;
            dueDateFrom?: string;
            dueDateTo?: string;
            priority?: string;
          };

        if (!dueDate && !dueDateFrom && !dueDateTo) {
          return {
            status: "need_confirmation",
            message: "请先告诉我你要查询哪一天的任务（例如：今天、明天或具体日期）。",
            responseType: "question",
          };
        }

        const result = await taskService.getTasks(userId, {
          status: status as "pending" | "completed" | "cancelled" | undefined,
          dueDate,
          dueDateFrom,
          dueDateTo,
          priority: priority as "high" | "medium" | "low" | undefined,
        });

        if (result.tasks.length === 0) {
          return { status: "success", message: "没有找到符合条件的任务。" };
        }

        const message = result.tasks
          .map(
            (task) =>
              `[ID:${task.id}] ${task.title} | 日期:${task.dueDate} | ${
                task.startTime
                  ? `时间:${task.startTime}-${task.endTime}`
                  : this.promptBuilder.formatTimeSegmentLabel(task.timeSegment)
              } | 状态:${task.status} | 优先级:${task.priority}`,
          )
          .join("\n");
        return { status: "success", message };
      }

      case "update_task": {
        const {
          taskId,
          title,
          description,
          dueDate,
          startTime,
          endTime,
          priority,
          timeSegment,
        } = toolArgs as {
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

        const timeInfo = task.startTime
          ? `，时间${task.startTime}-${task.endTime}`
          : `（${this.promptBuilder.formatTimeSegmentLabel(task.timeSegment)}）`;
        return {
          status: "success",
          message: `任务更新成功！标题"${task.title}"，日期${task.dueDate}${timeInfo}`,
          task,
          actionPerformed: "update",
          responseType: "task_summary",
        };
      }

      case "complete_task": {
        const { taskId } = toolArgs as { taskId: number };
        const task = await taskService.updateTaskStatus(taskId, userId, "completed");
        return {
          status: "success",
          message: `任务 "${task.title}" 已标记为完成。`,
          task,
          actionPerformed: "complete",
          responseType: "task_summary",
        };
      }

      case "delete_task": {
        const { taskId } = toolArgs as { taskId: number };

        if (!this.hasDeleteConfirmation(userMessage)) {
          return {
            status: "need_confirmation",
            message: "删除前请先确认。请回复“确认删除”后我再执行删除。",
            responseType: "question",
          };
        }

        await taskService.deleteTask(taskId, userId);
        return {
          status: "success",
          message: "任务已删除。",
          actionPerformed: "delete",
        };
      }

      default:
        return { status: "error", message: `未知工具：${toolName}` };
    }
  }

  private hasDeleteConfirmation(text: string): boolean {
    return /(确认删除|确定删除|同意删除|继续删除|执行删除|删吧|删了吧|删除吧)/.test(
      text,
    );
  }
}
