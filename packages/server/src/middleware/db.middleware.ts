import { createMiddleware } from "hono/factory";
import { createDb } from "../db/db";
import { type Bindings } from "../types/bindings";
import type { DbVariables } from "../types/variables";


export const dbMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: DbVariables;
}>(async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});
