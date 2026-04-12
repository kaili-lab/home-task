import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../db/db";
import * as schema from "../db/schema";
import { type Bindings } from "../types/bindings";
import { getEnv } from "../utils/env";
import { EmailService } from "../services/email.service";

function parseOrigins(value?: string): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .flatMap((item) => {
      try {
        return [new URL(item).origin];
      } catch {
        return [];
      }
    });
}

function buildTrustedOrigins(config: Bindings): string[] {
  const origins = new Set<string>(["http://localhost:5173"]);

  parseOrigins(config.FRONTEND_URL).forEach((origin) => origins.add(origin));
  parseOrigins(config.BETTER_AUTH_URL).forEach((origin) => origins.add(origin));

  return Array.from(origins);
}

function resolveFrontendUrl(config: Bindings): string {
  const [frontendOrigin] = parseOrigins(config.FRONTEND_URL);
  if (frontendOrigin) return frontendOrigin;

  try {
    return new URL(config.BETTER_AUTH_URL).origin;
  } catch {
    return "http://localhost:5173";
  }
}

/**
 * 创建 Better Auth 实例
 *
 * 使用 Cloudflare Workers 环境变量
 * 在 authMiddleware 中为每个请求创建一次
 *
 * @param env - Cloudflare Workers 环境变量对象
 * @returns Better Auth 实例
 */
export const createAuth = (env: Bindings) => {
  const config = getEnv(env);
  // 生成 Better Auth 要用的 信任来源列表，Better Auth 自己也需要知道“哪些前端来源是可信的”
  const trustedOrigins = buildTrustedOrigins(config);
  // 解析出一个前端基础地址，用于邮件中的回调链接（确保指向正确的前端地址）
  const frontendUrl = resolveFrontendUrl(config);

  // 为 Better Auth 创建专用的 db 实例
  const db = createDb(config.DATABASE_URL);

  // 创建邮件服务实例，这是一个轻量级的对象，每次请求new一个问题不大
  const emailService = new EmailService(config.RESEND_API_KEY);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      // 因为better auth的表名称，和我们定义的表名不一致，所以需要进行映射
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
      usePlural: false,
    }),

    // 目的是使用自增id，但是它对插件不起作用，所以暂时注释掉
    // generateId: () => undefined as any,
    // 这种方式配置，可以确保自增id对所有表生效
    advanced: {
      database: {
        useNumberId: true, // 🎯 关键配置：使用数字自增 ID
      },
      // 🌐 IP 地址配置：用于速率限制和会话安全
      // Cloudflare Workers 使用 CF-Connecting-IP 头获取真实 IP
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"], // 优先使用 Cloudflare 的 IP 头
        ipv6Subnet: 64, // IPv6 子网限制（防止通过切换 IPv6 地址绕过限制）
      },
    },

    // 基础配置
    appName: "Home Task Assistant",
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,

    // 🆕 信任的前端源（允许跨域请求和邮件验证回调）
    trustedOrigins,

    // 🔑 字段映射：将数据库字段映射到 better-auth 的标准字段
    user: {
      fields: {
        // better-auth 默认使用 image 字段，映射到我们的 avatarUrl
        image: "avatarUrl",
      },
      // 用于声明 Better Auth 默认 user 表之外的自定义业务字段
      // 让框架知道数据库中有这些额外字段，在读写用户数据时能正确处理
      // 自动处理默认值
      additionalFields: {},
    },

    // 🔐 认证方式配置
    // 启用后自动提供的 API：
    // POST /api/auth/signup - 注册（邮箱+密码）
    // POST /api/auth/signin/email - 登录
    // POST /api/auth/signin/username - 用户名登录
    // POST /api/auth/request-password-reset - 请求密码重置（触发发送邮件）
    // POST /api/auth/reset-password - 重置密码
    emailAndPassword: {
      enabled: true, // 启用邮箱密码登录（用于注册时提供邮箱）
      requireEmailVerification: true, // 启用邮箱验证
      minPasswordLength: 8,
      maxPasswordLength: 20,
      // 🔑 密码重置邮件发送配置
      sendResetPassword: async (
        {
          user,
          url,
          token,
        }: { user: { email: string; name?: string | null }; url: string; token: string },
        request?: Request,
      ) => {
        await emailService.sendPasswordResetEmailForAuth({ user, url, token }, request);
      },
    },

    // 📧 邮箱验证配置
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }, request) => {
        // 解析 URL，确保 callbackURL 指向完整的前端 URL，并添加 success 参数
        const baseCallbackURL = `${frontendUrl}/verify-email`;

        // 解析传入的 URL
        const urlObj = new URL(url);
        const existingCallbackURL = urlObj.searchParams.get("callbackURL");

        // 构建目标 callbackURL：始终使用前端地址，并添加 success=true 参数
        const callbackUrlObj = new URL(baseCallbackURL);
        callbackUrlObj.searchParams.set("success", "true");
        const targetCallbackURL = callbackUrlObj.toString();

        // 如果 callbackURL 不存在或不是完整 URL（相对路径），则替换为完整的前端 URL
        // 如果存在且是完整 URL，也替换为我们的前端 URL（确保一致性）
        if (
          !existingCallbackURL ||
          (!existingCallbackURL.startsWith("http://") &&
            !existingCallbackURL.startsWith("https://"))
        ) {
          urlObj.searchParams.set("callbackURL", targetCallbackURL);
        } else {
          // 即使 existingCallbackURL 是完整 URL，也替换为我们的前端 URL（确保指向正确的前端地址）
          urlObj.searchParams.set("callbackURL", targetCallbackURL);
        }

        const verificationUrl = urlObj.toString();

        await emailService.sendVerificationEmailForAuth(
          { user, url: verificationUrl, token },
          request,
        );
      },
      sendOnSignUp: true, // 注册时自动发送验证邮件
    },

    // 🔑 用户名插件配置
    // 启用用户名登录功能
    plugins: [username()],

    // ⏱️ 会话配置
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 天
      updateAge: 60 * 60 * 24, // 每天更新一次
    },
  });
};
