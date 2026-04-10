# P1-07：消息落库事务化

- **status**: pending
- **改进项**: #11 消息落库事务化
- **前置任务**: 无
- **后续任务**: 无

## 目标

将 `chat()` 方法中 user + assistant 消息的两次独立 insert 改为事务写入。

## 当前代码

`packages/server/src/services/ai/index.ts` 中多处成对的 saveMessage 调用：

```typescript
// 行 1236-1237（正常结束）
await this.saveMessage(userId, "user", message);
await this.saveMessage(userId, "assistant", content, type, { ... });

// 行 1276-1277（need_confirmation / conflict）
await this.saveMessage(userId, "user", message);
await this.saveMessage(userId, "assistant", content, type, { ... });

// 行 1191-1192（时间段校验拦截）
await this.saveMessage(userId, "user", message);
await this.saveMessage(userId, "assistant", content, "question");

// 行 1295-1296（兜底超时）
await this.saveMessage(userId, "user", message);
await this.saveMessage(userId, "assistant", fallback);
```

每一处都是两次独立 insert，如果第二次失败会导致只有用户消息没有 AI 回复。

## 具体改动

### 1. 新增事务版 saveMessages 方法

```typescript
private async saveMessages(
  userId: number,
  userContent: string,
  assistantContent: string,
  type: "text" | "task_summary" | "question" = "text",
  payload?: Record<string, unknown>,
) {
  await this.db.transaction(async (tx) => {
    await tx.insert(messagesTable).values({
      userId, role: "user", content: userContent, type: "text", payload: null,
    });
    await tx.insert(messagesTable).values({
      userId, role: "assistant", content: assistantContent, type, payload: payload || null,
    });
  });
}
```

### 2. 替换所有成对调用

将上述 4 处成对的 `saveMessage` 调用替换为单次 `saveMessages` 调用。

### 3. 保留原 saveMessage

`saveMessage()` 方法保留，可能有单独保存的场景。

## 涉及文件

- `packages/server/src/services/ai/index.ts`
  - 新增 `saveMessages()` 方法
  - `chat()` 方法中 4 处替换

## 验收标准

- [ ] 所有成对的消息保存使用事务
- [ ] 事务失败时两条消息都不写入
- [ ] 消息顺序和内容与之前一致
- [ ] Neon Serverless PostgreSQL 事务正常工作

