import { describe, it, expect } from "vitest";
import { getWeatherTool } from "../../../services/multi-agent/tools/weather.tools";

// 通过直接调用工具验证 mock 天气逻辑是否稳定

describe("weather.tools", () => {
  it("查北京明天天气 -> 返回温度、天气、建议", async () => {
    const result = await getWeatherTool.invoke({ city: "北京", date: "2026-02-11" }, {});
    const json = JSON.parse(result as string);
    expect(json.status).toBe("success");
    expect(json.message).toContain("北京");
  });

  it("城市为空 -> error", async () => {
    const result = await getWeatherTool.invoke({ city: "", date: "2026-02-11" }, {});
    const json = JSON.parse(result as string);
    expect(json.status).toBe("error");
  });

  it("日期无效 -> error", async () => {
    const result = await getWeatherTool.invoke({ city: "北京", date: "2026-02-XX" }, {});
    const json = JSON.parse(result as string);
    expect(json.status).toBe("error");
  });
});
