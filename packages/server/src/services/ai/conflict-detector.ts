import type { TaskInfo } from "shared";
import type { DbInstance } from "../../db/db";
import { TaskService } from "../task.service";

export class ConflictDetector {
  constructor(private db: DbInstance) {}

  normalizeTaskTitle(title: string): string {
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

  findSemanticConflicts(tasks: TaskInfo[], title: string): TaskInfo[] {
    const normalizedNew = this.normalizeTaskTitle(title);
    if (!normalizedNew) return [];
    return tasks.filter((task) => {
      const normalizedExisting = this.normalizeTaskTitle(task.title);
      return this.isSemanticDuplicate(normalizedNew, normalizedExisting);
    });
  }

  filterTimeConflicts(tasks: TaskInfo[], startTime: string, endTime: string): TaskInfo[] {
    return tasks.filter((task) => {
      if (!task.startTime || !task.endTime) return false;
      return task.startTime < endTime && task.endTime > startTime;
    });
  }

  mergeConflictingTasks(timeConflicts: TaskInfo[], semanticConflicts: TaskInfo[]): TaskInfo[] {
    const merged = new Map<number, TaskInfo>();
    timeConflicts.forEach((task) => merged.set(task.id, task));
    semanticConflicts.forEach((task) => merged.set(task.id, task));
    return Array.from(merged.values());
  }

  async getTasksForDate(userId: number, dueDate: string): Promise<TaskInfo[]> {
    const taskService = new TaskService(this.db);
    const result = await taskService.getTasks(userId, {
      status: "pending",
      dueDate,
    });
    return result.tasks;
  }

  async checkTimeConflict(
    userId: number,
    dueDate: string,
    startTime: string,
    endTime: string,
  ): Promise<TaskInfo[]> {
    const tasks = await this.getTasksForDate(userId, dueDate);
    return this.filterTimeConflicts(tasks, startTime, endTime);
  }

  private buildBigrams(text: string): Set<string> {
    const chars = Array.from(text);
    const bigrams = new Set<string>();
    for (let i = 0; i < chars.length - 1; i += 1) {
      bigrams.add(chars[i] + chars[i + 1]);
    }
    return bigrams;
  }

  private diceCoefficient(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const aBigrams = this.buildBigrams(a);
    const bBigrams = this.buildBigrams(b);
    let intersection = 0;
    aBigrams.forEach((bigram) => {
      if (bBigrams.has(bigram)) intersection += 1;
    });
    return (2 * intersection) / (aBigrams.size + bBigrams.size);
  }

  private isSemanticDuplicate(newTitle: string, existingTitle: string): boolean {
    if (!newTitle || !existingTitle) return false;
    if (newTitle === existingTitle) return true;
    if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) return true;
    return this.diceCoefficient(newTitle, existingTitle) >= 0.75;
  }
}
