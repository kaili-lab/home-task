# P0-08：Token 预算控制

- **status**: pending
- **改进项**: #3 用户级限流 + Token 预算（子任务 3/3）
- **前置任务**: P0-05（需要先接入错误处理，才能优雅中断）
- **后续任务**: 无

## 目标

限制单次 AI 请求的 token 消耗上限，防止异常对话（如无限 tool 循环）导致成本失控。

## 具体改动

### 1. 单次请求 token 上限

在 Agent Loop 中累计 token 使用量：

```typescript
let totalTokens = 0;
const MAX_TOKENS_PER_REQUEST = 8000; // 可通过环境变量配置

for (let i = 0; i < 10; i++) {
  const response = await llm.invoke(messages, { ... });

  // LangChain ChatOpenAI 的响应 metadata 中包含 token usage
  const usage = response.response_metadata?.tokenUsage;
  if (usage) {
    totalTokens += (usage.promptTokens || 0) + (usage.completionTokens || 0);
  }

  if (totalTokens > MAX_TOKENS_PER_REQUEST) {
    // 超出预算，优雅终止
    const content = "本次对话消耗较多，请简化描述后重试。";
    await this.saveMessage(userId, "user", message);
    await this.saveMessage(userId, "assistant", content);
    return { content, type: "text" as const };
  }

  // ... 原有逻辑
}
```

### 2. LLM 层 max_tokens 限制

创建 LLM 实例时设置 `maxTokens`，限制单次 LLM 调用的输出长度：

```typescript
private createLLM() {
  return new ChatOpenAI({
    // ... 现有配置
    maxTokens: 2000, // 单次 LLM 调用的最大输出 token
  });
}
```

## 涉及文件

- `packages/server/src/services/ai/index.ts`
  - `chat()` 方法内 Agent Loop
  - `createLLM()` 方法

## 验收标准

- [ ] 单次请求 token 超过阈值时优雅终止，返回友好提示
- [ ] token 累计包括所有 Agent Loop 迭代
- [ ] LLM 单次输出不超过 maxTokens
- [ ] 阈值可通过环境变量配置

