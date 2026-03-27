import { describe, it, expect } from "vitest";
import {
  consumeJoinRateLimit,
  recordInvalidInviteFailure,
  clearJoinFailureCounter,
  extractClientIp,
  type JoinRateLimitStore,
} from "../utils/join-rate-limit";

describe("join-rate-limit", () => {
  it("应允许窗口内前 10 次请求，第 11 次被限制", () => {
    const store: JoinRateLimitStore = new Map();
    const key = "1:127.0.0.1";
    const now = 1_000_000;

    for (let i = 0; i < 10; i++) {
      expect(consumeJoinRateLimit(store, key, now + i).allowed).toBe(true);
    }

    const blocked = consumeJoinRateLimit(store, key, now + 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("窗口过期后应恢复可请求", () => {
    const store: JoinRateLimitStore = new Map();
    const key = "1:127.0.0.1";
    const start = 2_000_000;

    for (let i = 0; i < 10; i++) {
      consumeJoinRateLimit(store, key, start + i);
    }

    const afterWindow = consumeJoinRateLimit(store, key, start + 61_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it("连续 5 次无效邀请码后应进入冷却", () => {
    const store: JoinRateLimitStore = new Map();
    const key = "1:127.0.0.1";
    const now = 3_000_000;

    for (let i = 0; i < 4; i++) {
      expect(recordInvalidInviteFailure(store, key, now + i).allowed).toBe(true);
    }

    const cooldown = recordInvalidInviteFailure(store, key, now + 4);
    expect(cooldown.allowed).toBe(false);
    expect(cooldown.retryAfterSeconds).toBeGreaterThanOrEqual(600);
  });

  it("成功后应清空无效邀请码计数", () => {
    const store: JoinRateLimitStore = new Map();
    const key = "1:127.0.0.1";
    const now = 4_000_000;

    recordInvalidInviteFailure(store, key, now);
    recordInvalidInviteFailure(store, key, now + 1);
    clearJoinFailureCounter(store, key);

    for (let i = 0; i < 4; i++) {
      expect(recordInvalidInviteFailure(store, key, now + 2 + i).allowed).toBe(true);
    }
  });

  it("应优先解析 cf-connecting-ip，其次 x-forwarded-for", () => {
    const headers1 = new Headers();
    headers1.set("cf-connecting-ip", "10.0.0.2");
    headers1.set("x-forwarded-for", "10.0.0.3, 10.0.0.4");
    expect(extractClientIp(headers1)).toBe("10.0.0.2");

    const headers2 = new Headers();
    headers2.set("x-forwarded-for", "10.0.0.5, 10.0.0.6");
    expect(extractClientIp(headers2)).toBe("10.0.0.5");
  });
});
