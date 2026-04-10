# P2-05：并发互斥

- **status**: pending
- **改进项**: #15 并发互斥
- **前置任务**: 无
- **后续任务**: 无

## 目标

同一用户同一时间只允许一个 AI 请求在处理，防止重复创建任务或历史消息错乱。

## 具体改动

### 1. 增加可替换的 per-user 锁抽象

V1 默认仍采用 `memory` 实现，但不要把锁逻辑直接写死在中间件里。

```typescript
interface UserLockStore {
  acquire(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

class MemoryUserLockStore implements UserLockStore {
  private activeRequests = new Map<string, number>();

  async acquire(key: string, ttlMs: number) {
    // V1 可用极简内存锁，后续可替换
  }

  async release(key: string) {
    // 释放锁
  }
}

export function userLock() {
  return async (c, next) => {
    const userId = getUserId(c.get("session"));
    const key = `ai:user:${userId}`;

    if (!(await lockStore.acquire(key, 30_000))) {
      return c.json({
        success: false,
        error: "你的上一个请求还在处理中，请稍等。",
      }, 429);
    }

    try {
      await next();
    } finally {
      await lockStore.release(key);
    }
  };
}
```

目标是：

- 当前先保留极简实现
- 将来传统 Node.js 单实例仍可继续用 `memory`
- 将来 Node.js 多实例或 Workers 更强一致性需求时，只替换底层 `UserLockStore`

### 2. 挂载到 AI chat 路由

```typescript
aiRoutes.use("/chat", userLock());
```

### 3. 前端配合

AIView.tsx 已有 `isLoading` 状态禁用输入框，但网络重试或浏览器刷新可能绕过。后端锁是最后一道防线。

### 4. 与限流 / 额度限制职责分离

本任务解决的是“**同一时刻只能有一个请求在跑**”，它与下面两类控制不同：

- `P0-07` 的请求频率限制：防刷接口
- `P1-07-1` 的请求幂等 / 去重：防止同一个请求被重复执行
- 未来的账户 AI 使用额度限制：防止线上试用超额消耗

因此并发锁不应和限流器、额度控制器写成一个耦合的大中间件，而应保持职责单一、可串联。

与 `P1-07-1` 组合时，推荐顺序为：

```typescript
idempotency hit short-circuit
-> userLock
-> ai handler
```

完整全局顺序以 `tasks/README.md` 为准；这里仅强调并发锁应晚于幂等短路，但早于真正的 AI handler。

也就是说：

- 已完成 / 处理中的重复请求，应优先由幂等层处理
- 只有真正的新请求，才需要占用并发锁

### 5. Cloudflare Workers 与传统 Node.js 的兼容方向

V1 默认：

- `MemoryUserLockStore`
- 开发环境可直接用
- 传统 Node.js 单实例可直接用

未来扩展：

- Cloudflare Workers：可切共享协调后端
- 传统 Node.js 多实例：可切共享协调后端

当前阶段不要求一次做到分布式锁，只要求中间件结构不要把未来升级路径堵死。

## 涉及文件

- 新建 `packages/server/src/middleware/user-lock.ts`
- 可选新建 `packages/server/src/services/ai-user-lock-store.ts`
- `packages/server/src/routes/ai.routes.ts` — 挂载中间件

## 验收标准

- [ ] 同一用户并发请求返回 429 + 友好提示
- [ ] 前一个请求完成后立即可发新请求
- [ ] 不同用户互不影响
- [ ] 异常情况下锁能正确释放（finally 块）
- [ ] 中间件不直接把 `Map` 逻辑写死在路由层，可替换底层 `UserLockStore`
- [ ] 与请求频率限制、未来账户 AI 使用额度限制职责分离，可串联使用
- [ ] 与 `P1-07-1` 组合时，重复请求可优先由幂等层短路，不必重复占用并发锁
