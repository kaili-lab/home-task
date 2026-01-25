import type { createAuth } from "../auth/auth";
import type { DbInstance } from "../db/db";

/*
这是 Variables 类型设计最佳实践，高级的模块化设计。
优点：
✅ 按功能分组（Auth、DB、Session 分离）
✅ 类型组合灵活（通过 & 组合不同场景）
✅ 使用 Module Augmentation 增强全局类型
*/

// 1️⃣ 按功能拆分接口（模块化）
export interface AuthVariables {
  // ReturnType：TS 内置的工具类型，作用：提取函数的返回值类型
  auth: ReturnType<typeof createAuth>;
  // typeof 返回的是函数的类型，比如 ()=>void，而这里我们需要的是函数的返回值类型，所以需要用 ReturnType 提取
}

export interface DbVariables {
  db: DbInstance;
}

// 2️⃣ 提取复杂类型（可维护性）
export type SessionPayload = NonNullable<
  // Awaited：TS 内置的工具类型，作用：提取 Promise 的返回值类型
  Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>
>;

export interface SessionVariables {
  session: SessionPayload;
}

// 3️⃣ 组合基础类型（灵活性）
export type AppVariables = AuthVariables & DbVariables;

// 4️⃣ 组合扩展类型（场景化）
export type AuthenticatedVariables = AppVariables & SessionVariables;

// 5️⃣ 模块增强（全局生效 + 便捷性）
// TS模块扩展：为第三方库添加类型定义
declare module "hono" {
  interface ContextVariableMap {
    auth: ReturnType<typeof createAuth>;
    db: DbInstance;
    session?: SessionPayload;
  }
}
/*
1. 为什么扩展 ContextVariableMap？
  因为他默认是空的，如果不扩展的话，那么在上下文中添加数据之后，获取的时候是没有类型的；
*/
