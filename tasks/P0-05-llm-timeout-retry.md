# P0-05：主链路接入 withTimeout / withRetry

- **status**: pending
- **改进项**: #4 主链路接入 withTimeout/withRetry
- **前置任务**: 无
- **后续任务**: 无

## 目标

将已实现的 `withTimeout` 和 `withRetry` 包裹到 `services/ai/index.ts` 的 LLM 调用点，实现超时控制和自动重试。

## 当前代码

### 已有工具（ai-error-handler.ts）
- `withTimeout(promise, 60000)` — 60s 超时
- `withRetry(fn, config)` — 指数退避重试（最多 2 次，2s → 4s → 10s）
- `classifyAIError(error)` — 错误分类
- `getUserFriendlyMessage(error)` — 用户友好提示

### 未接入（services/ai/index.ts 行 1211-1214）
```typescript
const response = await llm.invoke(messages, {
  tools: TOOL_DEFINITIONS,
  tool_choice: toolChoice,
});
```
裸调用，无超时，无重试，异常直接抛出。

## 具体改动

### 1. 包裹 LLM 调用

```typescript
import { withTimeout, withRetry, classifyAIError, getUserFriendlyMessage } from "../utils/ai-error-handler";

// Agent Loop 内
const response = await withRetry(
  () => withTimeout(
    llm.invoke(messages, { tools: TOOL_DEFINITIONS, tool_choice: toolChoice }),
    60000,
  ),
);
```

### 2. 错误处理优化

当前 `chat()` 方法的 catch 块（如果有的话）直接 throw。改为：

```typescript
try {
  // Agent Loop ...
} catch (error) {
  const aiError = classifyAIError(error);
  const friendlyMessage = getUserFriendlyMessage(aiError);
  await this.saveMessage(userId, "user", message);
  await this.saveMessage(userId, "assistant", friendlyMessage);
  return { content: friendlyMessage, type: "text" as const };
}
```

### 3. Tool 执行也加超时

`executeToolCall()` 内的数据库操作加独立超时（如 30s），防止单个 tool 卡住拖垮整轮：

```typescript
const result = await withTimeout(
  taskService.createTask(taskData),
  30000,
);
```

## 涉及文件

- `packages/server/src/services/ai/index.ts`
  - Agent Loop 中的 `llm.invoke()` 调用
  - `chat()` 方法 catch 块
  - `executeToolCall()` 中的关键数据库操作

## 验收标准

- [ ] LLM 调用超过 60s 自动超时，返回友好提示
- [ ] 可重试错误（网络、5xx、429）自动重试最多 2 次
- [ ] 不可重试错误（4xx、参数错误）直接返回友好提示
- [ ] 超时/重试失败后消息仍正常保存到数据库
- [ ] 单个 tool 执行超时不影响其他 tool

