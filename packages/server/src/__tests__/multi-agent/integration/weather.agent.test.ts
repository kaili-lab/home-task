import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { createWeatherAgent } from "../../../services/multi-agent/agents/weather.agent";

// 使用 FakeListChatModel 驱动工具调用，避免依赖真实模型

describe("weather.agent - 集成", () => {
  it("Mock LLM 调用 get_weather -> 返回 mock 数据", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "get_weather",
              args: { city: "北京", date: "2026-02-11" },
              id: "call_weather_1",
            },
          ],
        }),
        new AIMessage({ content: "天气已返回" }),
      ],
    });

    const agent = createWeatherAgent(llm as any);
    const result = await agent.invoke({ messages: [{ role: "user", content: "北京明天天气" }] });
    const lastMessage = result.messages[result.messages.length - 1];
    expect(String(lastMessage.content)).toContain("天气已返回");
  });
});
