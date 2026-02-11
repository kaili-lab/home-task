import { createSupervisor } from "@langchain/langgraph-supervisor";
import { MemorySaver } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import { createTaskAgent } from "./agents/task.agent";
import { createCalendarAgent } from "./agents/calendar.agent";
import { createWeatherAgent } from "./agents/weather.agent";
import { createNotificationAgent } from "./agents/notification.agent";

const SUPERVISOR_PROMPT = `你是一个智能助手的调度中心，负责将用户请求分发给合适的专家。

可用专家：
- task_agent：处理任务的创建、查询、修改、完成、删除
- calendar_agent：查看日程安排、查找空闲时间
- weather_agent：查询天气信息
- notification_agent：安排任务提醒

分发规则：
- 涉及任务操作（创建/完成/修改/删除/查询任务）→ task_agent
- 询问日程/时间安排/是否有空 → calendar_agent
- 询问天气 → weather_agent
- 涉及提醒/通知 → notification_agent
- 复合请求（如"周末去机场接人"）→ 依次分发给相关专家
- 非以上范围 → 礼貌告知只能处理任务和日程相关需求

回复规范：使用中文，简洁友好。`;

export function buildSupervisorGraph(llm: ChatOpenAI, tzOffset: number) {
  // 统一在此构建所有 agent，保证路由层只关注分发逻辑
  const taskAgent = createTaskAgent(llm, tzOffset);
  const calendarAgent = createCalendarAgent(llm, tzOffset);
  const weatherAgent = createWeatherAgent(llm);
  const notificationAgent = createNotificationAgent(llm);

  const workflow = createSupervisor({
    agents: [taskAgent, calendarAgent, weatherAgent, notificationAgent],
    llm,
    prompt: SUPERVISOR_PROMPT,
    // 默认 "last_message" 只保留子 Agent 最后一条消息，
    // 会丢失 ToolMessage，导致无法提取 task payload 给前端渲染
    outputMode: "full_history",
  });

  return workflow.compile({ checkpointer: new MemorySaver() });
}
