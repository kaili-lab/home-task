import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { createCalendarAgent } from "../../../services/multi-agent/agents/calendar.agent";

// 使用 FakeListChatModel 控制工具调用链，避免依赖真实模型

describe("calendar.agent - 集成", () => {
  it("Mock LLM 调用 find_free_slots -> 返回空闲时间段", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "find_free_slots",
              args: { date: "2026-02-11", startHour: 9, endHour: 18 },
              id: "call_calendar_1",
            },
          ],
        }),
        new AIMessage({ content: "空闲时间已返回" }),
      ],
    });

    const agent = createCalendarAgent(llm as any, 0);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: "明天下午有空吗" }] },
      { configurable: { db: {}, userId: 1, timezoneOffsetMinutes: 0 } },
    );
    const lastMessage = result.messages[result.messages.length - 1];
    expect(String(lastMessage.content)).toContain("空闲时间已返回");
  });
});
