import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../db/db";
import * as schema from "../db/schema";
import { type Bindings } from "../types/bindings";
import { getEnv } from "../utils/env";

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

  // 为 Better Auth 创建专用的 db 实例
  const db = createDb(config.DATABASE_URL);

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
    },

    // 基础配置
    appName: "Home Task Assistant",
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,

    // 🆕 信任的前端源（允许跨域请求和邮件验证回调）
    trustedOrigins: [
      "http://localhost:5173", // 本地开发
      // 生产环境：部署时在 Cloudflare 环境变量中添加前端域名
      // 或者直接在这里硬编码你的前端域名（部署后取消注释）
      // "https://yourdomain.com",
      // "https://vocab-master.pages.dev",
    ],

    // 🔑 字段映射：将数据库字段映射到 better-auth 的标准字段
    user: {
      fields: {
        // better-auth 默认使用 image 字段，映射到我们的 avatarUrl
        image: "avatarUrl",
      },
      // 用于声明 Better Auth 默认 user 表之外的自定义业务字段
      // 让框架知道数据库中有这些额外字段，在读写用户数据时能正确处理
      // 配置后，TypeScript 会知道 user.status、user.locale 等字段的类型
      // 自动处理默认值
      additionalFields: {
        phoneNumber: {
          type: "string",
          required: false, // false表示创建时是可选的，true表示必填
        },
        phoneNumberVerified: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        status: {
          type: "string",
          required: true,
          defaultValue: "active",
        },
        locale: {
          type: "string",
          required: true,
          defaultValue: "zh-CN",
        },
        vocabularyLevel: {
          type: "string",
          required: false, // 🔧 修正：词汇等级是可选字段，用户注册时可以为空
        },
        lastLoginAt: {
          type: "date",
          required: false,
        },
      },
    },

    // 🔐 认证方式配置
    // 启用后自动提供的 API：
    // POST /api/auth/signup - 注册（邮箱+密码）
    // POST /api/auth/signin/email - 登录
    // POST /api/auth/forget-password - 忘记密码（触发发送邮件）
    // POST /api/auth/reset-password - 重置密码
    emailAndPassword: {
      enabled: true, // 启用邮箱密码登录
      requireEmailVerification: true, // 要求邮箱验证（注册后需验证才能登录）
      minPasswordLength: 6,
      maxPasswordLength: 20,
    },

    // Google OAuth 配置
    google: {
      enabled: !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET,
      clientId: config.GOOGLE_CLIENT_ID || "",
      clientSecret: config.GOOGLE_CLIENT_SECRET || "",
    },

    // ⏱️ 会话配置
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 天
      updateAge: 60 * 60 * 24, // 每天更新一次
    },

  });
};
