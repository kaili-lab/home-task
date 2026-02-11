import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";
import { getTodayDate } from "../utils/time.helpers";
import { calendarTools } from "../tools/calendar.tools";

export function createCalendarAgent(llm: ChatOpenAI, tzOffset: number) {
  // 将当天日期写入提示是为了提升模型提取日期的准确性
  return createReactAgent({
    llm,
    tools: calendarTools,
    name: "calendar_agent",
    prompt: `你是日程安排专家。帮助用户查看日程和寻找空闲时间。\n今天：${getTodayDate(tzOffset)}`,
  });
}
