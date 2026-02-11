import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";
import { notificationTools } from "../tools/notification.tools";

export function createNotificationAgent(llm: ChatOpenAI) {
  // 提醒时间由工具计算，Agent 只负责收集必要信息
  return createReactAgent({
    llm,
    tools: notificationTools,
    name: "notification_agent",
    prompt: `你是通知提醒专家。帮助用户安排和管理任务提醒。
提醒时间由工具自动计算，你只需提供任务信息即可。
如果有天气信息，请一并传递给工具，以便在提醒中附加天气建议。`,
  });
}
