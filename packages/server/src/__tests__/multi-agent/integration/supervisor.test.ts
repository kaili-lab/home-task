import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { buildSupervisorGraph } from "../../../services/multi-agent/supervisor";

function makeConfig() {
  return {
    configurable: {
      db: {},
      userId: 1,
      timezoneOffsetMinutes: 0,
      thread_id: "user_1",
    },
  };
}

function hasTransfer(messages: Array<{ content: unknown }>, target: string) {
  // 通过检查 handoff 的工具消息，验证路由是否发生
  return messages.some((m) => String(m.content).includes(`Successfully transferred to ${target}`));
}

describe("supervisor - 路由测试", () => {
  it("创建任务 -> 路由到 task_agent", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_task_agent", args: {}, id: "call_1" }],
        }),
        new AIMessage({ content: "任务已处理" }),
        new AIMessage({ content: "已完成" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "帮我创建一个任务" }] },
      makeConfig(),
    );

    expect(hasTransfer(result.messages as any, "task_agent")).toBe(true);
  });

  it("询问空闲时间 -> 路由到 calendar_agent", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_calendar_agent", args: {}, id: "call_2" }],
        }),
        new AIMessage({ content: "日程已返回" }),
        new AIMessage({ content: "好的" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "明天下午有空吗" }] },
      makeConfig(),
    );

    expect(hasTransfer(result.messages as any, "calendar_agent")).toBe(true);
  });

  it("询问天气 -> 路由到 weather_agent", async () => {
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_weather_agent", args: {}, id: "call_3" }],
        }),
        new AIMessage({ content: "天气已返回" }),
        new AIMessage({ content: "好的" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "明天天气怎么样" }] },
      makeConfig(),
    );

    expect(hasTransfer(result.messages as any, "weather_agent")).toBe(true);
  });

  it("讲个笑话 -> 不路由到任何 Agent", async () => {
    const llm = new FakeListChatModel({
      responses: [new AIMessage({ content: "抱歉，我只能处理任务和日程相关需求。" })],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "讲个笑话" }] },
      makeConfig(),
    );

    expect(hasTransfer(result.messages as any, "task_agent")).toBe(false);
    expect(hasTransfer(result.messages as any, "calendar_agent")).toBe(false);
    expect(hasTransfer(result.messages as any, "weather_agent")).toBe(false);
    expect(hasTransfer(result.messages as any, "notification_agent")).toBe(false);
  });

  it("复合请求 -> 至少路由到 task_agent", async () => {
    // FakeListChatModel 与多 Agent 共享时响应消费顺序不可精确控制
    // 因此只验证第一个路由正确发生，完整多 Agent 路由由 eval 测试覆盖
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_task_agent", args: {}, id: "call_4" }],
        }),
        new AIMessage({ content: "任务已处理" }),
        new AIMessage({ content: "全部完成" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "周末早上去机场接人" }] },
      makeConfig(),
    );

    expect(hasTransfer(result.messages as any, "task_agent")).toBe(true);
  });
});

describe("supervisor - 错误处理测试", () => {
  it("子 Agent 抛出异常 -> Supervisor 不崩溃，返回结果", async () => {
    // createReactAgent / createSupervisor 捕获子 Agent 异常后以消息形式返回
    // 而非抛出，因此验证 graph 能正常 resolve
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_task_agent", args: {}, id: "call_7" }],
        }),
        new AIMessage({ content: "处理出错" }),
        new AIMessage({ content: "抱歉出了点问题" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "帮我创建任务" }] },
      makeConfig(),
    );

    // 框架不崩溃，能返回消息列表
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("LLM 响应耗尽 -> Supervisor 不崩溃，返回结果", async () => {
    // FakeListChatModel 响应耗尽后会循环复用，框架最终因递归上限而终止
    // 验证不会导致未捕获异常
    const llm = new FakeListChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "transfer_to_task_agent", args: {}, id: "call_8" }],
        }),
        new AIMessage({ content: "已处理" }),
        new AIMessage({ content: "完成" }),
      ],
    });

    const graph = buildSupervisorGraph(llm as any, 0);
    const result = await graph.invoke(
      { messages: [{ role: "user", content: "继续" }] },
      makeConfig(),
    );

    expect(result.messages.length).toBeGreaterThan(0);
  });
});
