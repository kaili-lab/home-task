import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * 创建数据库实例:提供统一的数据库实例创建接口，配合中间件实现依赖注入模式。
 * - 使用 HTTP 连接而非 TCP
 * - 兼容 Cloudflare Workers（不支持 TCP）
 * - 兼容 Node.js
 * - 创建实例成本低，适合 Serverless 环境
 *
 * @param databaseUrl - PostgreSQL 连接字符串
 * @returns Drizzle ORM 实例
 */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * 数据库实例类型
 * 用于 TypeScript 类型推导、中间件和 Service 层
 */
export type DbInstance = ReturnType<typeof createDb>;

