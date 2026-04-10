# P1-05：结构化日志 — Logger 工具

- **status**: pending
- **改进项**: #10 结构化日志
- **前置任务**: 无
- **后续任务**: P1-06

## 目标

创建统一的结构化日志工具，支持 JSON 格式输出，requestId 贯穿全链路。

## 具体改动

### 1. 新建 logger 模块

新建 `packages/server/src/utils/logger.ts`：

```typescript
interface LogContext {
  requestId: string;
  userId?: number;
  [key: string]: unknown;
}

class Logger {
  constructor(private context: LogContext) {}

  info(action: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      ...this.context,
      action,
      ...data,
    }));
  }

  warn(action: string, data?: Record<string, unknown>) {
    console.warn(JSON.stringify({
      level: "warn",
      timestamp: new Date().toISOString(),
      ...this.context,
      action,
      ...data,
    }));
  }

  error(action: string, error: unknown, data?: Record<string, unknown>) {
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      ...this.context,
      action,
      error: error instanceof Error ? error.message : String(error),
      ...data,
    }));
  }
}

export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}
```

### 2. 设计日志 action 命名规范

```
ai.chat.start          — 对话开始
ai.chat.end            — 对话结束
ai.llm.invoke          — LLM 调用
ai.llm.invoke.error    — LLM 调用失败
ai.tool.execute        — tool 执行
ai.tool.execute.error  — tool 执行失败
ai.conflict.detected   — 冲突检测到
ai.hallucination.detected — 幻觉检测到
```

## 涉及文件

- 新建 `packages/server/src/utils/logger.ts`

## 验收标准

- [ ] Logger 输出 JSON 格式，包含 timestamp / level / requestId / action
- [ ] 支持 info / warn / error 三个级别
- [ ] context 在创建时注入，后续调用自动携带
- [ ] Cloudflare Workers 环境下正常工作（console.log → Workers 日志）
