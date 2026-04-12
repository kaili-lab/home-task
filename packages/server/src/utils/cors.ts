import type { Bindings } from "../types/bindings";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173"];

function appendAllowedOrigins(target: Set<string>, value?: string): void {
  if (!value) return;

  const candidates = value.split(",");
  for (const rawCandidate of candidates) {
    const candidate = rawCandidate.trim();
    if (!candidate) continue;

    try {
      target.add(new URL(candidate).origin);
    } catch {
      // 忽略非法 URL，避免因为配置错误导致服务启动失败
    }
  }
}

export function getAllowedOrigins(env: Bindings): string[] {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);
  appendAllowedOrigins(origins, env.FRONTEND_URL);
  appendAllowedOrigins(origins, env.BETTER_AUTH_URL);
  return Array.from(origins);
}
