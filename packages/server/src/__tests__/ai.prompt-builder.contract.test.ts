import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptBuilder } from "../services/ai/prompt-builder";

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
};

function createMockDb(
  groups: Array<{ groupId: number; groupName: string }> = [],
): MockDb {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(groups),
  };
}

describe("PromptBuilder 合约测试", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("应包含 7 个节且顺序正确", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 10, 10, 0, 0)));
    const db = createMockDb();
    const builder = new PromptBuilder(db as any, 0);

    const prompt = await builder.buildSystemPrompt(1);
    const sections = [
      "## 1) Role & Capabilities",
      "## 2) Dynamic Context",
      "## 3) Intent Recognition",
      "## 4) Tool Routing",
      "## 5) Parameter Extraction",
      "## 6) Constraints / Rules",
      "## 7) Output Format",
    ];

    let previousIndex = -1;
    for (const section of sections) {
      const currentIndex = prompt.indexOf(section);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("应包含能力清单与边界约束", async () => {
    const db = createMockDb();
    const builder = new PromptBuilder(db as any, 0);

    const prompt = await builder.buildSystemPrompt(1);

    expect(prompt).toContain("create_task");
    expect(prompt).toContain("query_tasks");
    expect(prompt).toContain("update_task");
    expect(prompt).toContain("complete_task");
    expect(prompt).toContain("delete_task");
    expect(prompt).toContain("你只处理任务管理相关请求");
  });

  it("应包含集中硬约束与输出类型契约", async () => {
    const db = createMockDb();
    const builder = new PromptBuilder(db as any, 0);

    const prompt = await builder.buildSystemPrompt(1);

    expect(prompt).toContain("硬性约束（必须遵守）");
    expect(prompt).toContain("未调用工具前，不得声称");
    expect(prompt).toContain("查询任务时，用户没给日期必须先追问具体日期");
    expect(prompt).toContain("删除任务前必须先确认将删除的任务信息");
    expect(prompt).toContain("类型契约：");
    expect(prompt).toContain("task_summary");
    expect(prompt).toContain("question");
    expect(prompt).toContain("text");
  });

  it("应注入动态上下文（日期、星期、时段、群组）", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 10, 10, 0, 0)));
    const db = createMockDb([
      { groupId: 11, groupName: "工作群" },
      { groupId: 22, groupName: "骑行群" },
    ]);
    const builder = new PromptBuilder(db as any, 0);

    const prompt = await builder.buildSystemPrompt(214);

    expect(prompt).toContain("今天：2026-04-10（星期五）");
    expect(prompt).toContain("当前时段：上午");
    expect(prompt).toContain("- 工作群（ID: 11）");
    expect(prompt).toContain("- 骑行群（ID: 22）");
  });
});
