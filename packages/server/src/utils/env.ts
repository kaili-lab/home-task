import { type Bindings } from "../types/bindings";

/**
 * 获取并验证环境变量
 *
 * @param env - Cloudflare Workers 环境变量对象
 * @returns 验证后的环境变量
 * @throws 如果必需的环境变量缺失
 */
export const getEnv = (env: Bindings): Bindings => {
  // 必需的环境变量
  const required: Array<keyof Bindings> = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "RESEND_API_KEY",
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  // 验证至少有一个 API key 存在
  if (!env.AIHUBMIX_API_KEY && !env.OPENAI_API_KEY) {
    missing.push("AIHUBMIX_API_KEY 或 OPENAI_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `缺少必需的环境变量: ${missing.join(", ")}\n请检查 .env 文件或 Cloudflare Workers 环境变量配置。`,
    );
  }

  return env;
};
