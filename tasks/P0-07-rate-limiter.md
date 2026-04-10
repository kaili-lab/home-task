# P0-07：用户级限流

- **status**: pending
- **改进项**: #3 用户级限流 + Token 预算（子任务 2/3）
- **前置任务**: 无
- **后续任务**: 无

## 目标

为 `/api/ai/chat` 增加 per-user 请求频率限制，防止单用户大量消耗 LLM 资源。

## 与未来“账户 AI 使用额度限制”的关系

本任务**不替代**未来的“账户级 AI 使用次数 / 配额限制”，两者解决的是不同问题：

- **请求频率限制（本任务）**：防止短时间内高频刷接口
- **账户使用额度限制（未来功能）**：限制用户在日 / 周 / 月维度的总调用次数或总 token 消耗

两者不冲突，而且应设计为**可串联**：

```typescript
quotaGuard -> rateLimiter -> aiRouteHandler
```

也就是说，本任务要避免把“频率限制”写死成唯一资源控制手段，给未来的线上试用额度控制留出扩展空间。

## 当前代码

无任何限流逻辑。

## 具体改动

### 1. 新建限流中间件与可替换 Store 抽象

新建 `packages/server/src/middleware/rate-limiter.ts`：

```typescript
interface RateLimitConfig {
  windowMs: number;    // 窗口大小（毫秒）
  maxRequests: number; // 窗口内最大请求数
}

interface RateLimitStore {
  hit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; retryAfterSec?: number }>;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,   // 1 分钟
  maxRequests: 10,     // 最多 10 次
};
```

核心逻辑：

- 中间件语义只关心“是否允许本次请求通过”
- 默认提供一个 `memory` 版 `RateLimitStore`
- `memory` 实现内部仍可用 `Map`
- 超限时返回 429 + `Retry-After` header

这样做的目的不是现在就做复杂分布式限流，而是：

- 当前先用极简方案落地
- 将来无论是 Cloudflare 共享存储，还是传统 Node.js 多实例部署，都可以只替换 Store 实现，不必重写中间件语义

### 2. 在 AI 路由挂载

```typescript
// ai.routes.ts
import { rateLimiter } from "../middleware/rate-limiter";

aiRoutes.use("/chat", rateLimiter({ windowMs: 60_000, maxRequests: 10 }));
```

建议在文档中补充：未来若接入“账户 AI 使用额度限制”，可作为独立 guard 挂在限流器之前或之后，但不应和本任务耦死在一个中间件里。

当后续接入 `P1-07-1` 的幂等机制时，推荐组合顺序为：

```typescript
idempotency hit short-circuit
-> quotaGuard（未来）
-> rateLimiter
-> aiRouteHandler
```

完整全局顺序以 `tasks/README.md` 为准；这里仅强调限流器前面应保留幂等短路和未来额度控制的位置。

也就是说：

- 已完成 / 处理中的重复请求，应优先由幂等层短路
- 只有真正的新请求才进入频率限制

### 3. 默认实现采用 `memory`，但中间件不绑死平台

V1 默认实现：

- `MemoryRateLimitStore`
- 开发环境可直接使用
- 传统 Node.js 单实例部署可直接使用

未来扩展：

- Cloudflare Workers：未来可接共享存储或平台能力
- 传统 Node.js 多实例部署：未来可切共享后端（如 Redis 类存储）

重点是：

- 当前阶段先用 `memory`，保持简单
- 但接口层先抽象出来，避免后续迁移时推倒重写

## 涉及文件

- 新建 `packages/server/src/middleware/rate-limiter.ts`
- 可选新建 `packages/server/src/services/ai-rate-limit-store.ts`
- `packages/server/src/routes/ai.routes.ts` — 挂载中间件

## 验收标准

- [ ] 同一用户 1 分钟内超过 10 次请求返回 429
- [ ] 429 响应包含 `Retry-After` header
- [ ] 不同用户互不影响
- [ ] 窗口过期后自动恢复
- [ ] 非 AI 路由不受影响
- [ ] 中间件不直接把 `Map` 逻辑写死在路由层，可替换底层 Store
- [ ] 当前方案与未来“账户 AI 使用额度限制”可共存，不互相覆盖职责
- [ ] 与 `P1-07-1` 组合时，重复请求可优先由幂等层短路，不必重复进入频率限制
