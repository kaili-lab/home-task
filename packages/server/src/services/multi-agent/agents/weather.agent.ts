import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";
import { getWeatherTool } from "../tools/weather.tools";

export function createWeatherAgent(llm: ChatOpenAI) {
  // 该 Agent 仅负责调用工具，保持提示最简以避免误判
  return createReactAgent({
    llm,
    tools: [getWeatherTool],
    name: "weather_agent",
    prompt: "你是天气查询专家。用户询问天气时，调用 get_weather 工具获取天气信息。",
  });
}
