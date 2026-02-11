import type { TaskInfo } from "shared";

// 这些冲突工具保持为纯函数，便于在不同工具中复用且易于测试

// 作用：对任务标题做语义归一化，便于后续相似度判断
export function normalizeTaskTitle(title: string): string {
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
export function buildBigrams(text: string): Set<string> {
  const chars = Array.from(text);
  const bigrams = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) {
    bigrams.add(chars[i] + chars[i + 1]);
  }
  return bigrams;
}

// 作用：计算两个字符串的 Dice 系数相似度
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const aBigrams = buildBigrams(a);
  const bBigrams = buildBigrams(b);
  let intersection = 0;
  aBigrams.forEach((bg) => {
    if (bBigrams.has(bg)) intersection += 1;
  });
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

// 作用：判断两个标题是否语义近似或重复
export function isSemanticDuplicate(newTitle: string, existingTitle: string): boolean {
  if (!newTitle || !existingTitle) return false;
  if (newTitle === existingTitle) return true;
  if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) return true;
  return diceCoefficient(newTitle, existingTitle) >= 0.75;
}

// 作用：找出与新任务语义冲突的已有任务
export function findSemanticConflicts(tasks: TaskInfo[], title: string): TaskInfo[] {
  const normalizedNew = normalizeTaskTitle(title);
  if (!normalizedNew) return [];
  return tasks.filter((task) => {
    const normalizedExisting = normalizeTaskTitle(task.title);
    return isSemanticDuplicate(normalizedNew, normalizedExisting);
  });
}

// 作用：筛出时间段发生重叠的任务
export function filterTimeConflicts(tasks: TaskInfo[], startTime: string, endTime: string): TaskInfo[] {
  return tasks.filter((t) => {
    if (!t.startTime || !t.endTime) return false;
    return t.startTime < endTime && t.endTime > startTime;
  });
}

// 作用：合并语义与时间冲突结果并去重
export function mergeConflictingTasks(
  timeConflicts: TaskInfo[],
  semanticConflicts: TaskInfo[],
): TaskInfo[] {
  const merged = new Map<number, TaskInfo>();
  timeConflicts.forEach((t) => merged.set(t.id, t));
  semanticConflicts.forEach((t) => merged.set(t.id, t));
  return Array.from(merged.values());
}
