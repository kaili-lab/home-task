import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { ChatOpenAI } from "@langchain/openai";
import { taskTools } from "../tools/task.tools";
import {
  formatTimeSegmentLabel,
  getCurrentTimeSegment,
  getTodayDate,
  getUserNow,
  getWeekdayLabel,
} from "../utils/time.helpers";

const TASK_AGENT_PROMPT = `你是任务管理专家，帮助用户管理日常任务。

## 当前上下文
- 今天：{today}（{weekday}）
- 当前时段：{currentSegment}

## 参数提取指导
- title：简洁的动作短语（如"去4S店取车"、"开家长会"）
- dueDate：YYYY-MM-DD 格式，用户未指定时不传（工具默认今天）
- startTime/endTime：必须成对提供（HH:MM），用户只说一个时间点时仅提取 startTime
- timeSegment：模糊时段（全天/凌晨/早上/上午/中午/下午/晚上），与 startTime/endTime 互斥
- priority：high/medium/low，用户未提及时不传

## 重要规则
- 时间合理性校验、冲突检测由工具自动完成，你不需要判断
- 如果工具返回 need_confirmation 或 conflict，将工具的提示信息原样转达给用户
- 用户说"完成XXX" → 调用 finish_task
- 用户说"删除XXX"/"取消XXX" → 调用 remove_task
- 用户说"修改XXX"/"把XXX改成..." → 调用 modify_task
`;

export function createTaskAgent(llm: ChatOpenAI, tzOffset: number) {
  // 每次构建时动态注入当天上下文，避免提示中的时间信息过期
  const today = getTodayDate(tzOffset);
  const weekday = getWeekdayLabel(getUserNow(tzOffset));
  const currentSegment = formatTimeSegmentLabel(getCurrentTimeSegment(tzOffset));
  const prompt = TASK_AGENT_PROMPT
    .replace("{today}", today)
    .replace("{weekday}", weekday)
    .replace("{currentSegment}", currentSegment);

  return createReactAgent({
    llm,
    tools: taskTools,
    name: "task_agent",
    prompt,
  });
}
