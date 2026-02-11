import { describe, it, expect, vi, beforeEach } from "vitest";
import { scheduleReminderTool } from "../../../services/multi-agent/tools/notification.tools";

// 通过模拟 db 链式调用，避免依赖真实数据库
function makeDbMock() {
  const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    select: vi.fn().mockReturnValue(selectChain),
  };
}

function makeConfig(db: any) {
  return {
    configurable: {
      db,
      userId: 1,
      timezoneOffsetMinutes: 0,
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("notification.tools - 正常 case", () => {
  it("跨天任务 -> 提醒时间 = 前一天 20:00", async () => {
    // 固定时间确保跨天任务日期始终在"明天"
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T10:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      { taskTitle: "出差", taskDate: "2026-02-12" },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.message).toContain("前一天 20:00");
  });

  it("当天任务有具体时间 -> 提醒时间 = 提前 2 小时", async () => {
    // 固定时间到测试日期当天早上，确保 10:00 任务的提醒（08:00）在当前时间之后
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T06:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      { taskTitle: "开会", taskDate: "2026-02-10", taskTime: "10:00" },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.message).toContain("前 2 小时");
  });

  it("有雨天气 -> 提醒内容包含建议", async () => {
    // 固定时间确保 09:00 任务的提醒（07:00）在当前时间之后
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T05:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      {
        taskTitle: "出门",
        taskDate: "2026-02-10",
        taskTime: "09:00",
        weatherInfo: "建议带伞",
      },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.message).toContain("带伞");
  });
});

describe("notification.tools - 异常 case", () => {
  it("已过去的任务 -> 不安排提醒", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T20:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      { taskTitle: "开会", taskDate: "2026-02-10", taskTime: "10:00" },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.status).toBe("error");
  });

  it("天气信息缺失 -> 仅发送任务提醒", async () => {
    // 固定时间确保提醒时间未过
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T06:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      { taskTitle: "开会", taskDate: "2026-02-10", taskTime: "10:00" },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.message).not.toContain("天气");
  });

  it("当天无具体时间 -> 当天 08:00 提醒", async () => {
    // 固定时间到 08:00 之前，确保提醒时间未过
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T05:00:00Z"));
    const db = makeDbMock();
    const result = await scheduleReminderTool.invoke(
      { taskTitle: "整理", taskDate: "2026-02-10" },
      makeConfig(db),
    );
    const json = JSON.parse(result as string);
    expect(json.message).toContain("当天 08:00");
  });
});
