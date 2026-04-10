# P1-06：结构化日志 — 接入 services/ai/index.ts

- **status**: pending
- **改进项**: #10 结构化日志
- **前置任务**: P1-05
- **后续任务**: 无

## 目标

将 `services/ai/index.ts` 中散落的 `console.log` 替换为结构化 Logger，关键节点增加日志。

## 具体改动

### 1. AIService 构造函数中创建 Logger

```typescript
import { createLogger } from "../utils/logger";

export class AIService {
  private logger;

  constructor(db, env, tzOffset, requestId) {
    // ...
    this.logger = createLogger({ requestId, userId: undefined }); // userId 在 chat() 中设置
  }
}
```

### 2. 关键日志注入点

```typescript
// chat() 方法入口
this.logger.info("ai.chat.start", { messageLength: message.length, inferredIntent });

// Agent Loop 每轮
this.logger.info("ai.llm.invoke", { iteration: i, toolChoice, messageCount: messages.length });

// tool 执行
this.logger.info("ai.tool.execute", { toolName, duration: endTime - startTime, status: toolResult.status });

// 冲突检测
this.logger.info("ai.conflict.detected", { type: "semantic" | "time", count: conflicts.length });

// 幻觉检测
this.logger.warn("ai.hallucination.detected", { content: content.substring(0, 100), inferredIntent });

// chat() 方法结束
this.logger.info("ai.chat.end", { totalIterations: i + 1, responseType: type });

// 错误
this.logger.error("ai.llm.invoke.error", error, { iteration: i });
```

### 3. tool 执行增加耗时统计

```typescript
const startTime = Date.now();
const toolResult = await this.executeToolCall(...);
const duration = Date.now() - startTime;
this.logger.info("ai.tool.execute", { toolName: toolCall.name, duration, status: toolResult.status });
```

### 4. 移除散落的 console.log

搜索并替换 `services/ai/index.ts` 中所有 `console.log` / `console.warn` / `console.error`。

## 涉及文件

- `packages/server/src/services/ai/index.ts` — 替换 console.log + 新增日志点

## 验收标准

- [ ] 每次 AI 对话在日志中有完整 start → tool → end 链路
- [ ] 所有日志包含 requestId，可按 requestId 过滤
- [ ] tool 执行有耗时统计
- [ ] 无残留 console.log（services/ai/index.ts 内）
- [ ] 冲突和幻觉事件有 warn 级别日志

