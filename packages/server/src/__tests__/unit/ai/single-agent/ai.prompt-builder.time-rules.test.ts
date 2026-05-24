import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptBuilder } from "../../../../services/ai/prompt-builder";

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
};

function createMockDb(): MockDb {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function createBuilder() {
  return new PromptBuilder(createMockDb() as any, 0);
}

describe("PromptBuilder 时间规则", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("应识别时段提示词", () => {
    const builder = createBuilder();

    expect(builder.hasTimeSegmentHint("今天下午开会")).toBe(true);
    expect(builder.hasTimeSegmentHint("夜里去机场接人")).toBe(true);
    expect(builder.hasTimeSegmentHint("明天提交报告")).toBe(false);
  });

  it.each([
    ["全天整理房间", "all_day"],
    ["凌晨去赶飞机", "early_morning"],
    ["早上去跑步", "morning"],
    ["上午开会", "forenoon"],
    ["中午吃饭", "noon"],
    ["下午面试", "afternoon"],
    ["晚上写周报", "evening"],
    ["傍晚散步", "evening"],
  ])("应将 %s 推断为 %s", (text, expected) => {
    const builder = createBuilder();
    expect(builder.inferTimeSegmentFromText(text)).toBe(expected);
  });

  it.each([
    {
      now: new Date(Date.UTC(2026, 3, 11, 10, 0, 0)),
      dateStr: "2026-04-11",
      segment: "morning",
      expected: false,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 10, 0, 0)),
      dateStr: "2026-04-11",
      segment: "forenoon",
      expected: true,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 10, 0, 0)),
      dateStr: "2026-04-11",
      segment: "afternoon",
      expected: true,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 19, 0, 0)),
      dateStr: "2026-04-11",
      segment: "all_day",
      expected: false,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 19, 0, 0)),
      dateStr: "2026-04-11",
      segment: "evening",
      expected: true,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 19, 0, 0)),
      dateStr: "2026-04-12",
      segment: "morning",
      expected: true,
    },
  ])(
    "应按当前时段判断今天能否选择时段: $segment -> $expected",
    ({ now, dateStr, segment, expected }) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const builder = createBuilder();

      expect(builder.isSegmentAllowedForToday(dateStr, segment as any)).toBe(expected);
    },
  );

  it.each([
    {
      now: new Date(Date.UTC(2026, 3, 11, 16, 0, 0)),
      dateStr: "2026-04-11",
      startTime: "10:00",
      endTime: "11:00",
      expected: true,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 16, 0, 0)),
      dateStr: "2026-04-11",
      startTime: "17:00",
      endTime: "18:00",
      expected: false,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 16, 0, 0)),
      dateStr: "2026-04-11",
      startTime: "18:00",
      endTime: "17:00",
      expected: false,
    },
    {
      now: new Date(Date.UTC(2026, 3, 11, 16, 0, 0)),
      dateStr: "2026-04-12",
      startTime: "10:00",
      endTime: "11:00",
      expected: false,
    },
  ])(
    "应判断今天的具体时间段是否已经过去: $startTime-$endTime -> $expected",
    ({ now, dateStr, startTime, endTime, expected }) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const builder = createBuilder();

      expect(
        builder.isTimeRangePassedForToday(dateStr, startTime, endTime),
      ).toBe(expected);
    },
  );

  it("应生成晚上禁止全天的提示文案", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 11, 19, 0, 0)));
    const builder = createBuilder();

    expect(builder.buildSegmentNotAllowedMessage("all_day")).toBe(
      "现在已是晚上，无法设置为全天。请确认要改成晚上，或提供具体时间段。",
    );
  });

  it("应生成已过时段的提示文案", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 11, 16, 0, 0)));
    const builder = createBuilder();

    expect(builder.buildSegmentNotAllowedMessage("morning")).toBe(
      "现在已经是下午了，无法选择早上时间段。请确认要改成下午或更晚的时间段，或提供具体时间段。",
    );
  });
});


