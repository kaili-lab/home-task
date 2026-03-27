/**
 * 入群接口轻量限流参数
 *
 * 设计目标：
 * 1. 对单用户+IP做基础限速，拦截短时间高频请求
 * 2. 对连续无效邀请码触发冷却，降低暴力试码成本
 */
const JOIN_WINDOW_MS = 60_000;
const JOIN_MAX_REQUESTS_PER_WINDOW = 10;
const JOIN_INVALID_CODE_THRESHOLD = 5;
const JOIN_COOLDOWN_MS = 10 * 60_000;

type JoinRateLimitState = {
  windowStartAt: number;
  requestCount: number;
  invalidCodeCount: number;
  cooldownUntil: number;
};

export type JoinRateLimitStore = Map<string, JoinRateLimitState>;

export type JoinRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function getOrCreateState(
  store: JoinRateLimitStore,
  key: string,
  now: number,
): JoinRateLimitState {
  const state = store.get(key);
  if (state) return state;

  const next: JoinRateLimitState = {
    windowStartAt: now,
    requestCount: 0,
    invalidCodeCount: 0,
    cooldownUntil: 0,
  };
  store.set(key, next);
  return next;
}

export function consumeJoinRateLimit(
  store: JoinRateLimitStore,
  key: string,
  now: number = Date.now(),
): JoinRateLimitResult {
  const state = getOrCreateState(store, key, now);

  if (state.cooldownUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil((state.cooldownUntil - now) / 1000), 1),
    };
  }

  if (now - state.windowStartAt >= JOIN_WINDOW_MS) {
    state.windowStartAt = now;
    state.requestCount = 0;
  }

  if (state.requestCount >= JOIN_MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = state.windowStartAt + JOIN_WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
    };
  }

  state.requestCount += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordInvalidInviteFailure(
  store: JoinRateLimitStore,
  key: string,
  now: number = Date.now(),
): JoinRateLimitResult {
  const state = getOrCreateState(store, key, now);
  state.invalidCodeCount += 1;

  if (state.invalidCodeCount >= JOIN_INVALID_CODE_THRESHOLD) {
    state.invalidCodeCount = 0;
    state.cooldownUntil = now + JOIN_COOLDOWN_MS;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil(JOIN_COOLDOWN_MS / 1000), 1),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearJoinFailureCounter(store: JoinRateLimitStore, key: string): void {
  const state = store.get(key);
  if (!state) return;
  state.invalidCodeCount = 0;
}

export function extractClientIp(rawHeaders: Headers): string {
  const cfConnectingIp = rawHeaders.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim();
  }

  const xForwardedFor = rawHeaders.get("x-forwarded-for");
  if (xForwardedFor?.trim()) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "unknown";
}
