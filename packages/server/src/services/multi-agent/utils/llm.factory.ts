import { ChatOpenAI } from "@langchain/openai";
import type { Bindings } from "../../../types/bindings";

/**
 * LLM 创建工厂
 * 选择中转或官方 API 是为了在不同模型提供方间切换时不侵入业务逻辑
 */
export function createLLM(env: Bindings): ChatOpenAI {
  // 使用中转服务可统一出口，避免业务代码感知不同供应商
  if (env.AIHUBMIX_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.AIHUBMIX_API_KEY,
      model: env.AIHUBMIX_MODEL_NAME || "deepseek-v3.2",
      temperature: 0,
      // 通过 baseURL 指向中转端点，确保请求正确落到中转服务
      configuration: { baseURL: env.AIHUBMIX_BASE_URL },
    } as any);
  }
  // 使用官方 OpenAI API 作为默认兜底，保证无需中转也可运行
  return new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: "gpt-4o",
    temperature: 0,
  });
}
