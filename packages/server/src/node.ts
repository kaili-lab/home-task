import { serve } from "@hono/node-server";
import { config } from "dotenv";
import app from "./index";
import type { Bindings } from "./types/bindings";

// 生产模式优先加载 .env.production，本地调试可继续使用 .env
config({ path: ".env.production" });
config();

const processEnv = ((globalThis as any).process?.env ??
  {}) as Record<string, string | undefined>;
const env = processEnv as unknown as Bindings;
const parsedPort = Number.parseInt(processEnv.PORT || "3000", 10);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

// 复用 Hono 的 fetch 入口，把 Node 环境变量按 Bindings 传入 c.env
serve({
  port,
  fetch: (req) => app.fetch(req, env),
});

console.log(`[server] listening on :${port}`);
