import { describe, expect, it, vi } from "vitest";
import { HallucinationGuard } from "../../../../services/ai/hallucination-guard";
import { PromptBuilder } from "../../../../services/ai/prompt-builder";

function createPromptBuilder() {
  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return new PromptBuilder(db as any, 0);
}

describe("HallucinationGuard", () => {
  it.each([
    ["提醒我明天开会", "create", true],
    ["查看明天的任务", "query", true],
    ["查看任务", "query", false],
    ["把任务改为后天", "update", true],
    ["完成周报", "complete", true],
    ["删除会议", "delete", true],
    ["你好呀", null, false],
  ])("应评估用户消息策略: %s", (message, expectedIntent, expectedRequireToolCall) => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(guard.evaluateUserMessage(message, null)).toEqual({
      inferredIntent: expectedIntent,
      requireToolCall: expectedRequireToolCall,
      skipSemanticConflictCheck: false,
    });
  });

  it("应识别语义冲突确认场景", () => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(
      guard.evaluateUserMessage(
        "确认",
        "你当天已有类似任务：\n- 取快递（下午）\n是否仍要创建？回复“确认”继续创建。",
      ),
    ).toMatchObject({
      skipSemanticConflictCheck: true,
    });
    expect(guard.evaluateUserMessage("好的", "已帮你创建任务。")).toMatchObject({
      skipSemanticConflictCheck: false,
    });
  });

  it("无 tool call 且无动作成功表述时应原样返回", () => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(
      guard.resolveNoToolCallResponse({
        llmContent: "我可以帮你创建任务。",
        inferredIntent: "create",
        lastSignificantResult: null,
      }),
    ).toEqual({
      action: "return_as_is",
      content: "我可以帮你创建任务。",
    });
  });

  it("无 tool call 且有成功措辞时应返回未执行提示", () => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(
      guard.resolveNoToolCallResponse({
        llmContent: "已为你创建任务。",
        inferredIntent: "create",
        lastSignificantResult: null,
      }),
    ).toEqual({
      action: "correct_with_not_executed_message",
      content: "我还没有实际创建任务。请确认任务内容后我再创建。",
    });
  });

  it("有冲突上下文时应优先返回冲突提示", () => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(
      guard.resolveNoToolCallResponse({
        llmContent: "已为你创建任务。",
        inferredIntent: "create",
        lastSignificantResult: {
          status: "conflict",
          message: "存在冲突，请先确认。",
          conflictingTasks: [{ id: 1, title: "开会" } as any],
        },
      }),
    ).toEqual({
      action: "correct_with_conflict_context",
      content: "当前任务存在冲突或重复，请确认或调整后再创建。",
    });
  });

  it("已经执行过动作时不应修正内容", () => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(
      guard.resolveNoToolCallResponse({
        llmContent: "已为你创建任务。",
        inferredIntent: "create",
        lastSignificantResult: {
          status: "success",
          message: "任务创建成功",
          actionPerformed: "create",
        },
      }),
    ).toEqual({
      action: "return_as_is",
      content: "已为你创建任务。",
    });
  });
});


