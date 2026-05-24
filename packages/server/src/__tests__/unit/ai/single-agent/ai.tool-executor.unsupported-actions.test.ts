import { describe, expect, it, vi } from "vitest";
import { ToolExecutor } from "../../../../services/ai/tool-executor";

vi.mock("../../../../services/task.service", () => ({
  TaskService: vi.fn(() => ({
    createTask: vi.fn(),
    getTasks: vi.fn(),
    updateTaskStatus: vi.fn(),
  })),
}));

function createExecutor() {
  const promptBuilder = {
    formatTimeSegmentLabel: vi.fn().mockReturnValue("全天"),
  };
  const conflictDetector = {
    getTasksForDate: vi.fn(),
    filterTimeConflicts: vi.fn(),
    findSemanticConflicts: vi.fn(),
    mergeConflictingTasks: vi.fn(),
  };
  return new ToolExecutor({} as any, promptBuilder as any, conflictDetector as any);
}

describe("ToolExecutor unsupported actions", () => {
  it.each(["update_task", "delete_task"])(
    "应拒绝在聊天内执行 %s",
    async (toolName) => {
      const executor = createExecutor();

      const result = await executor.executeToolCall(1, toolName, {}, "测试消息");

      expect(result).toEqual({
        status: "need_confirmation",
        message: "AI 聊天暂不支持修改或删除任务，请到任务列表中直接操作。",
        responseType: "text",
      });
    },
  );
});
