# P2-03：上下文窗口 Token 计数

- **status**: pending
- **改进项**: #13 上下文窗口 Token 计数
- **前置任务**: 无
- **后续任务**: 无

## 目标

`loadHistory()` 加载历史消息时计算 token 总量，超限时从最早消息开始截断。

## 具体改动

### 1. Token 估算

Cloudflare Workers 环境下不适合引入完整的 tiktoken（WASM 体积大）。使用近似公式：

```typescript
function estimateTokens(text: string): number {
  // 中文约 1 字 ≈ 1.5 token，英文约 4 字符 ≈ 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}
```

### 2. 修改 loadHistory

```typescript
async loadHistory(userId: number, limit = 20, maxTokens = 6000): Promise<BaseMessage[]> {
  const rows = await db.select().from(messagesTable)
    .where(eq(messagesTable.userId, userId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  rows.reverse();

  // 从最新消息开始累计，超过 maxTokens 时截断最早的
  let totalTokens = 0;
  const filtered = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(rows[i].content);
    if (totalTokens + tokens > maxTokens) break;
    totalTokens += tokens;
    filtered.unshift(rows[i]);
  }

  return filtered
    .filter((row) => row.role !== "system")
    .map((row) => row.role === "user" ? new HumanMessage(row.content) : new AIMessage(row.content));
}
```

### 3. maxTokens 计算

预留空间：model context (如 128k) - system prompt (~2k) - 当前消息 (~0.5k) - tool 定义 (~2k) - 安全余量 (~3k) = 可用于历史的约 120k。但实际建议保守设为 6000-8000 token，避免过长上下文影响回复质量和成本。

## 涉及文件

- `packages/server/src/services/ai/index.ts`（或拆分后的 `history-manager.ts`）
  - `loadHistory()` 方法
  - 新增 `estimateTokens()` 辅助函数

## 验收标准

- [ ] 历史消息加载有 token 上限控制
- [ ] 超限时从最早消息截断，保留最近的
- [ ] 短对话不受影响（20 条内通常不超限）
- [ ] 中文和英文混合内容估算合理

