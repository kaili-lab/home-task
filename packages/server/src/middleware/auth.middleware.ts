import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth/auth";
import { type Bindings } from "../types/bindings";
import type { AuthVariables } from "../types/variables";


export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AuthVariables;
}>(async (c, next) => {
  c.set("auth", createAuth(c.env));
  await next();
});

