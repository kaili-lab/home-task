import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatTimeSegmentLabel,
  getCurrentTimeSegment,
  getDefaultTimeSegmentForDate,
  getTodayDate,
  hasDateHint,
  hasExplicitTimeRange,
  hasTimeSegmentHint,
  inferTimeSegmentFromText,
  isSegmentAllowedForToday,
  isTodayDate,
  parseTimeToMinutes,
} from "../../../services/multi-agent/utils/time.helpers";

// 统一通过假时间控制时段判定，避免真实时间导致测试不稳定
function mockUtcTime(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("time.helpers - 正常 case", () => {
  it("inferTimeSegmentFromText(\"下午\") -> afternoon", () => {
    expect(inferTimeSegmentFromText("下午")).toBe("afternoon");
  });

  it("parseTimeToMinutes(\"14:30\") -> 870", () => {
    expect(parseTimeToMinutes("14:30")).toBe(870);
  });

  it("isTodayDate(todayStr, 0) -> true", () => {
    mockUtcTime("2025-01-02T10:00:00Z");
    const todayStr = getTodayDate(0);
    expect(isTodayDate(todayStr, 0)).toBe(true);
  });

  it("getCurrentTimeSegment(tzOffset) 在指定时间返回正确时段", () => {
    mockUtcTime("2025-01-02T15:00:00Z");
    expect(getCurrentTimeSegment(0)).toBe("afternoon");
  });

  it("getDefaultTimeSegmentForDate(todayStr, tzOffset) 晚上 -> evening", () => {
    mockUtcTime("2025-01-02T20:00:00Z");
    const todayStr = getTodayDate(0);
    expect(getDefaultTimeSegmentForDate(todayStr, 0)).toBe("evening");
  });

  it("formatTimeSegmentLabel(\"morning\") -> 早上", () => {
    expect(formatTimeSegmentLabel("morning")).toBe("早上");
  });

  it("hasTimeSegmentHint(\"下午开会\") -> true", () => {
    expect(hasTimeSegmentHint("下午开会")).toBe(true);
  });

  it("hasExplicitTimeRange(\"3点到5点\") -> true", () => {
    expect(hasExplicitTimeRange("3点到5点")).toBe(true);
  });

  it("hasDateHint(\"明天\") -> true", () => {
    expect(hasDateHint("明天")).toBe(true);
  });
});

describe("time.helpers - 异常 case", () => {
  it("inferTimeSegmentFromText(\"\") -> all_day", () => {
    expect(inferTimeSegmentFromText("")).toBe("all_day");
  });

  it("parseTimeToMinutes(\"25:00\") -> null", () => {
    expect(parseTimeToMinutes("25:00")).toBeNull();
  });

  it("parseTimeToMinutes(null) -> null", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
  });

  it("parseTimeToMinutes(\"abc\") -> null", () => {
    expect(parseTimeToMinutes("abc")).toBeNull();
  });

  it("isTodayDate(null, 0) -> false", () => {
    expect(isTodayDate(null, 0)).toBe(false);
  });

  it("isTodayDate(\"\", 0) -> false", () => {
    expect(isTodayDate("", 0)).toBe(false);
  });

  it("isSegmentAllowedForToday(todayStr, \"morning\", tzOffset) 当前晚上 -> false", () => {
    mockUtcTime("2025-01-02T20:00:00Z");
    const todayStr = getTodayDate(0);
    expect(isSegmentAllowedForToday(todayStr, "morning", 0)).toBe(false);
  });

  it("hasTimeSegmentHint(\"\") -> false", () => {
    expect(hasTimeSegmentHint("")).toBe(false);
  });

  it("hasExplicitTimeRange(\"开会\") -> false", () => {
    expect(hasExplicitTimeRange("开会")).toBe(false);
  });
});
