import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ToolResult } from "../types";

const getWeatherSchema = z.object({
  city: z.string().describe("城市名称"),
  date: z.string().describe("查询日期 YYYY-MM-DD"),
});

const MOCK_WEATHER: Record<
  string,
  { condition: string; tempMin: number; tempMax: number; suggestion: string }
> = {
  default_clear: { condition: "晴", tempMin: 5, tempMax: 15, suggestion: "天气晴好，适合出行" },
  default_rain: { condition: "小雨", tempMin: 2, tempMax: 8, suggestion: "建议携带雨具" },
};

function toJsonResult(result: ToolResult): string {
  // 统一结构输出，便于后续替换真实天气 API
  return JSON.stringify(result);
}

export const getWeatherTool = tool(
  async (params) => {
    const { city, date } = params;
    if (!city || city.trim().length === 0) {
      return toJsonResult({ status: "error", message: "请提供城市名称" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return toJsonResult({ status: "error", message: "日期格式无效" });
    }

    // 当前阶段使用 Mock 数据，避免引入外部依赖
    const weather = MOCK_WEATHER.default_clear;
    const message = `${city} ${date} 天气${weather.condition}，${weather.tempMin}~${weather.tempMax}°C。${weather.suggestion}`;
    return toJsonResult({
      status: "success",
      message,
      data: { ...weather, city, date },
    });
  },
  {
    name: "get_weather",
    description: "查询指定城市和日期的天气信息。",
    schema: getWeatherSchema,
  },
);

export const weatherTools = [getWeatherTool];
