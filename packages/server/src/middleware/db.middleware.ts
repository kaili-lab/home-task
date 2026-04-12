import { createMiddleware } from "hono/factory";
import { createDb } from "../db/db";
import { type Bindings } from "../types/bindings";
import type { DbVariables } from "../types/variables";

// createMiddleware只在模块加载时执行一次，得到中间件
// 每次请求都会执行的是里面的async函数；
export const dbMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: DbVariables;
}>(async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});
// 这里createDb确实是每次请求都会创建一个连接，因为走的是Neon数据库，它是一个通过http方式访问的serverless数据库，可以看成是一次http请求，不会很重；
// 如果是传统的数据库，确实应该在模块加载时创建一个连接池，然后每次请求从连接池中获取一个连接；
