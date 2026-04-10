# P1-07-1：AI 对话请求幂等 / 去重

- **status**: pending
- **改进项**: 新增：可靠性层补强（请求幂等 / 去重）
- **前置任务**: 无
- **后续任务**: P1-08, P1-09

## 目标

为 `POST /api/ai/chat` 增加基于 `clientRequestId` 的幂等机制，避免因重复点击、网络抖动、前端重试或响应丢失导致同一个 AI 请求被重复执行。

本任务主要防止：

- 重复创建任务
- 重复删除任务
- 重复完成任务
- 重复写入消息
- 重复消耗未来的账户 AI 使用额度

## 当前代码

当前 `/api/ai/chat` 只接收：

```typescript
interface AIChatInput {
  message: string;
  audioUrl?: string;
}
```

后端当前没有任何“同一请求只执行一次”的机制：

- 同样的提交如果被前端重发
- 或服务端已成功但响应未回到前端
- 再次请求时会被当作全新请求执行

现有的：

- `P0-07` 请求频率限制
- `P2-05` 并发锁

都**不能替代幂等**，因为它们解决的不是“同一个请求不要执行两次”。

## 方案概述

采用**显式客户端请求 ID** 方案：

- 前端每次发送 AI 请求时生成一个 `clientRequestId`
- 后端按 `userId + clientRequestId` 识别同一请求
- 若该请求已完成，则直接返回上次结果
- 若该请求正在处理中，则直接返回“处理中”
- 若该请求不存在，则创建一条 `processing` 记录并继续执行

本任务**不使用“按消息内容猜重复”**的方案，避免误伤用户正常的重复输入。

## 具体改动

### 1. 扩展共享请求类型

在 `packages/shared/src/api/ai.ts` 中为 `AIChatInput` 增加：

```typescript
clientRequestId?: string;
```

V1 建议采用：

- 字段先做可选，避免破坏兼容性
- 第一方前端必须传
- 若缺失，则后端回退为当前非幂等行为

### 2. 前端发送请求时生成 `clientRequestId`

在 `packages/web/src/features/ai/AIView.tsx` / `packages/web/src/services/ai.api.ts` 中：

- 每次用户主动点击发送时生成一个新的 `clientRequestId`
- 流式与非流式请求统一透传
- 若未来前端实现自动重试，应复用同一个 `clientRequestId`

### 3. 新增幂等记录表

在 `packages/server/src/db/schema.ts` 中新增一张幂等表，例如：

```typescript
aiChatRequests
```

建议最小字段：

```typescript
userId: integer;
clientRequestId: text;
status: "processing" | "completed";
responseContent: text | null;
responseType: "text" | "task_summary" | "question" | null;
responsePayload: jsonb | null;
createdAt: timestamp;
updatedAt: timestamp;
```

并为：

- `userId + clientRequestId`

建立唯一约束。

### 4. 封装幂等服务

新建独立服务，例如：

```typescript
packages/server/src/services/ai-idempotency.service.ts
```

最小职责：

- `findRequest(userId, clientRequestId)`
- `createProcessingRequest(userId, clientRequestId)`
- `markRequestCompleted(userId, clientRequestId, response)`
- `deleteProcessingRequest(userId, clientRequestId)`（下游拒绝或异常时清理）

### 5. 在 `/api/ai/chat` 路由接入幂等逻辑

推荐流程：

```typescript
1. 解析并校验 clientRequestId
2. 若存在 completed 记录 -> 直接返回缓存结果
3. 若存在 processing 记录 -> 返回“请求处理中”
4. 若不存在 -> 创建 processing 记录
5. 再进入后续 guard / AI 执行
6. 成功后写回 completed + 最终响应快照
7. 若后续 guard 拒绝或执行异常 -> 清理 processing 记录
```

### 6. 与现有任务的组合顺序

为避免和现有 task 冲突，本任务明确以下组合原则：

- **幂等命中**（completed / processing）应优先短路返回
- **只有真正的新请求**，才继续进入：
  - 未来额度限制
  - 请求频率限制
  - 并发锁
  - AI 主流程

推荐顺序：

```typescript
validate input
-> idempotency check / create processing
-> quota guard（未来）
-> rate limiter
-> user lock
-> AI handler
```

完整全局顺序以 `tasks/README.md` 为准；这里强调的是幂等层在整条链路中的位置，以及它需要早于额度、限流和并发锁生效。

如果某个后续 guard 拒绝请求，必须清理当前的 `processing` 记录，避免同一个 `clientRequestId` 永久卡住。

### 7. 与未来“账户 AI 使用额度限制”的关系

本任务与未来额度限制**不冲突，且应该优先于额度计数**。

原因：

- 同一个请求因网络问题重试时，不应重复扣额度
- 命中已完成幂等记录时，应直接返回历史结果，不再重复计数

也就是说，未来额度限制应只针对：

- **第一次成功受理的新请求**

生效，而不应对同一个 `clientRequestId` 的重复提交重复计数。

## 涉及文件

- `packages/shared/src/api/ai.ts` — 扩展 `AIChatInput`
- `packages/web/src/services/ai.api.ts` — 透传 `clientRequestId`
- `packages/web/src/features/ai/AIView.tsx` — 生成 `clientRequestId`
- `packages/server/src/db/schema.ts` — 新增幂等记录表
- 新建 `packages/server/src/services/ai-idempotency.service.ts`
- `packages/server/src/routes/ai.routes.ts` — 接入幂等检查与结果复用
- `packages/server/src/__tests__/ai.routes.test.ts` — 增加幂等覆盖

## 验收标准

- [ ] 同一 `userId + clientRequestId` 的已完成请求会直接复用上次结果
- [ ] 同一 `userId + clientRequestId` 的处理中请求返回“请求处理中”，不重复执行 AI
- [ ] 不同 `clientRequestId` 视为不同请求
- [ ] 幂等机制不依赖“消息内容相同”来猜重复
- [ ] 命中已完成幂等记录时，不应重复进入未来的额度计数逻辑
- [ ] 与 `P0-07` / `P2-05` 可组合，不产生职责冲突
