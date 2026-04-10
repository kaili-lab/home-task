# P0-06：消息长度校验

- **status**: pending
- **改进项**: #3 用户级限流 + Token 预算（子任务 1/3）
- **前置任务**: 无
- **后续任务**: 无

## 目标

在 `/api/ai/chat` 入口增加消息长度上限校验，防止超长消息浪费 token。

## 当前代码

`packages/server/src/routes/ai.routes.ts` 行 29-31：

```typescript
if (!message || typeof message !== "string" || !message.trim()) {
  return c.json({ success: false, error: "消息不能为空" }, 400);
}
```

仅校验非空，无长度限制。

## 具体改动

在现有非空校验后增加长度校验：

```typescript
const MAX_MESSAGE_LENGTH = 2000;
if (message.length > MAX_MESSAGE_LENGTH) {
  return c.json({
    success: false,
    error: `消息长度不能超过 ${MAX_MESSAGE_LENGTH} 字符`,
  }, 400);
}
```

## 涉及文件

- `packages/server/src/routes/ai.routes.ts` — 增加长度校验

## 验收标准

- [ ] 超过 2000 字符的消息返回 400
- [ ] 正常长度消息不受影响
- [ ] 错误提示明确告知长度限制
