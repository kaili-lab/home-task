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
    ["提醒我明天开会", "create"],
    ["查看明天的任务", "query"],
    ["把任务改为后天", "update"],
    ["完成周报", "complete"],
    ["删除会议", "delete"],
    ["你好呀", null],
  ])("应识别意图: %s -> %s", (message, expected) => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(guard.inferTaskIntent(message)).toBe(expected);
  });

  it("应判断哪些请求必须先触发 tool call", () => {
    const guard = new HallucinationGuard(createPromptBuilder());

    expect(guard.shouldRequireToolCall("提醒我明天下午开会")).toBe(true);
    expect(guard.shouldRequireToolCall("查看明天的任务")).toBe(true);
    expect(guard.shouldRequireToolCall("查看任务")).toBe(false);
    expect(guard.shouldRequireToolCall("你好")).toBe(false);
  });

  it("应识别语义冲突确认场景", () => {
    const guard = new HallucinationGuard(createPromptBuilder());

    expect(
      guard.shouldSkipSemanticConflictCheck(
        "确认",
        "你当天已有类似任务：\n- 取快递（下午）\n是否仍要创建？回复“确认”继续创建。",
      ),
    ).toBe(true);

    expect(
      guard.shouldSkipSemanticConflictCheck(
        "好的",
        "已帮你创建任务。",
      ),
    ).toBe(false);
  });

  it("应识别疑似已经执行成功的幻觉表述", () => {
    const guard = new HallucinationGuard(createPromptBuilder());

    expect(guard.looksLikeActionSuccess("已为你创建任务")).toBe(true);
    expect(guard.looksLikeActionSuccess("任务更新成功")).toBe(true);
    expect(guard.looksLikeActionSuccess("我可以帮你创建任务")).toBe(false);
  });

  it.each([
    ["create", "我还没有实际创建任务。请确认任务内容后我再创建。"],
    ["update", "我还没有更新任务。请告诉我要修改哪一条任务，或让我先帮你查找。"],
    ["complete", "我还没有完成任务。请告诉我要完成哪一条任务，或让我先帮你查找。"],
    ["delete", "我还没有删除任务。请确认要删除哪一条任务，或让我先帮你查找。"],
    ["query", "我还没有查询任务。请告诉我需要查看的日期。"],
    [null, "我还没有执行任务操作。请再确认你的需求。"],
  ])("应返回对应的未执行提示: %s", (intent, expected) => {
    const guard = new HallucinationGuard(createPromptBuilder());
    expect(guard.buildActionNotExecutedMessage(intent as any)).toBe(expected);
  });
});


