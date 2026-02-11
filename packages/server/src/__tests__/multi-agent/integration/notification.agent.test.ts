import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { createNotificationAgent } from "../../../services/multi-agent/agents/notification.agent";

// 使用 FakeListChatModel 驱动工具调用，避免依赖真实模型

describe("notification.agent - 集成", () => {
  it("Mock LLM 调用 schedule_reminder -> 返回提醒记录", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "schedule_reminder",
              args: { taskTitle: "开会", taskDate: "2026-02-11", taskTime: "10:00" },
              id: "call_notify_1",
            },
          ],
        }),
        new AIMessage({ content: "提醒已安排" }),
      ],
    });

    const agent = createNotificationAgent(llm as any);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: "提醒我开会" }] },
      { configurable: { db: {}, userId: 1, timezoneOffsetMinutes: 0 } },
    );
    const lastMessage = result.messages[result.messages.length - 1];
    expect(String(lastMessage.content)).toContain("提醒已安排");
  });
});
