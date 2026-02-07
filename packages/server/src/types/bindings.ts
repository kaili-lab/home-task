/**
 * 环境变量类型定义
 * 支持 Cloudflare Workers 和 Node.js 两种环境
 */
export type Bindings = {
  // Better Auth 配置
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // OpenAI 配置（兼容 OpenAI API 的服务）
  OPENAI_API_KEY?: string;
  AIHUBMIX_API_KEY?: string;
  AIHUBMIX_BASE_URL?: string;
  AIHUBMIX_MODEL_NAME?: string;

  // Google OAuth 配置（可选）
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;

  // 前端地址
  FRONTEND_URL?: string;

  // Resend API 配置
  RESEND_API_KEY: string;

  // 服务器配置（可选）
  PORT?: string;
  NODE_ENV?: string;
};
