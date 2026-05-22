import type { TimeSegment } from "@/types";
import { getTodayLocalDate } from "@/utils/date";

export function getStartOfToday(now: Date = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getCurrentTimeSegment(now: Date = new Date()): TimeSegment {
  const hour = now.getHours();
  if (hour >= 0 && hour < 6) return "early_morning";
  if (hour >= 6 && hour < 9) return "morning";
  if (hour >= 9 && hour < 12) return "forenoon";
  if (hour >= 12 && hour < 14) return "noon";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour <= 23) return "evening";
  return "morning";
}

export function getSegmentOrder(segment: TimeSegment): number {
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

export function isTodayDueDate(dueDate: string): boolean {
  if (!dueDate) return false;
  return dueDate === getTodayLocalDate();
}

/** 仅当 dueDate 为今天时，判断该时段是否应禁用（早于当前时段） */
export function isSegmentDisabledForToday(
  segment: TimeSegment,
  dueDate: string,
  now: Date = new Date()
): boolean {
  if (!isTodayDueDate(dueDate)) return false;
  const current = getCurrentTimeSegment(now);
  if (segment === "all_day") return current === "evening";
  return getSegmentOrder(segment) < getSegmentOrder(current);
}
