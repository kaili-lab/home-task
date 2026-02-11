import type { TimeSegment } from "shared";

// 这些时间工具保持为纯函数是为了便于复用与测试，避免依赖类内部状态

// 作用：判断文本是否包含模糊时间段提示
export function hasTimeSegmentHint(text: string): boolean {
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
export function hasExplicitTimeRange(text: string): boolean {
  // 匹配“3点到5点”/“4:00-15:00”等
  const timePattern = /(\d{1,2})([:点时](\d{1,2}))?/g;
  const matches = text.match(timePattern) || [];
  if (matches.length >= 2) return true;
  return /(\d{1,2}(?:[:点时]\d{1,2})?)\s*[-到至~]\s*(\d{1,2}(?:[:点时]\d{1,2})?)/.test(text);
}

// 作用：判断文本是否包含明确的时间点表达
export function hasExplicitTimePoint(text: string): boolean {
  return /(\d{1,2})([:点时](\d{1,2}))/.test(text);
}

// 作用：判断文本是否包含日期相关线索
export function hasDateHint(text: string): boolean {
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

// 作用：从文本中推断模糊时间段枚举值
export function inferTimeSegmentFromText(text: string): TimeSegment {
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
export function formatTimeSegmentLabel(segment: TimeSegment | null | undefined): string {
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
export function getTimeSegmentOrder(segment: TimeSegment): number {
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

// 作用：按用户时区获取“现在”的时间
export function getUserNow(tzOffset: number): Date {
  // 用偏移量修正时间，保证后续判断与用户本地一致
  return new Date(Date.now() - tzOffset * 60 * 1000);
}

// 作用：基于用户时区获取当前时间段
export function getCurrentTimeSegment(tzOffset: number): TimeSegment {
  const hour = getUserNow(tzOffset).getUTCHours();
  if (hour >= 0 && hour < 6) return "early_morning";
  if (hour >= 6 && hour < 9) return "morning";
  if (hour >= 9 && hour < 12) return "forenoon";
  if (hour >= 12 && hour < 14) return "noon";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour <= 23) return "evening";
  return "morning";
}

// 作用：把时间字符串转为当天分钟数，避免重复解析导致“已过”判断不一致
export function parseTimeToMinutes(time?: string | null): number | null {
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
export function getWeekdayLabel(date: Date): string {
  const labels = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return labels[date.getUTCDay()];
}

// 作用：判断给定日期字符串是否为“今天”
export function isTodayDate(dateStr: string | null | undefined, tzOffset: number): boolean {
  if (!dateStr) return false;
  const today = getUserNow(tzOffset);
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  return dateStr === `${yyyy}-${mm}-${dd}`;
}

// 作用：在缺少时间线索时给出默认时段
export function getDefaultTimeSegmentForDate(dateStr: string, tzOffset: number): TimeSegment {
  // 默认策略集中化，避免不同模块各自选择不同默认值
  if (!isTodayDate(dateStr, tzOffset)) return "all_day";
  const current = getCurrentTimeSegment(tzOffset);
  if (current === "evening") return "evening";
  return "all_day";
}

// 作用：判断“今天”情况下目标时段是否合法
export function isSegmentAllowedForToday(
  dateStr: string,
  segment: TimeSegment,
  tzOffset: number,
): boolean {
  if (!isTodayDate(dateStr, tzOffset)) return true;
  const current = getCurrentTimeSegment(tzOffset);
  if (segment === "all_day") return current !== "evening";
  const currentOrder = getTimeSegmentOrder(current);
  const targetOrder = getTimeSegmentOrder(segment);
  return targetOrder >= currentOrder;
}

// 作用：判断今天的具体时间段是否已过，防止模型在不合理时间直接创建
export function isTimeRangePassedForToday(
  dateStr: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  tzOffset: number,
): boolean {
  if (!isTodayDate(dateStr, tzOffset)) return false;
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return false;
  // 避免跨天或异常范围误判为“已过”
  if (endMinutes < startMinutes) return false;
  const now = getUserNow(tzOffset);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return endMinutes <= nowMinutes;
}

// 作用：生成“时段不可选”的用户提示文案
export function buildSegmentNotAllowedMessage(target: TimeSegment, tzOffset: number): string {
  const nowLabel = formatTimeSegmentLabel(getCurrentTimeSegment(tzOffset));
  const targetLabel = formatTimeSegmentLabel(target);
  if (target === "all_day") {
    return "现在已是晚上，无法设置为全天。请确认要改成晚上，或提供具体时间段。";
  }
  return `现在已经是${nowLabel}了，无法选择${targetLabel}时间段。请确认要改成${nowLabel}或更晚的时间段，或提供具体时间段。`;
}

// 作用：获取用户时区下的今日日期字符串
export function getTodayDate(tzOffset: number): string {
  const now = getUserNow(tzOffset);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
