# P1-03：确认交互闭环 — 联调

- **status**: pending
- **改进项**: #7 确认交互闭环
- **前置任务**: P1-02-1, P1-02
- **后续任务**: 无

## 目标

将确认按钮的点击事件连接到 AI 对话流程：点击"确认创建"自动发送"确认"消息，触发后端显式 `session state / approval state` 恢复执行挂起动作。

## 当前约束

本任务建立在一个前提上：

- 前端**不能**把 `message.type === "question"` 当成确认态判断条件
- 只有带 `payload.interaction.kind === "confirmation"` 的消息，才属于按钮驱动的确认交互

也就是说，本任务联调的对象不是“所有 question 消息”，而是“结构化确认态消息”。

## 具体改动

### 1. AIView.tsx — 传递 onConfirm 回调

```tsx
{messages.map((message, idx) => (
  <ChatMessage
    key={message.id}
    message={message}
    isLatest={idx === messages.length - 1}
    onConfirm={(confirmMessage) => handleSend(confirmMessage)}
  />
))}
```

点击"确认创建"→ 调用 `handleSend("确认")` → 后端读取当前挂起状态 → 恢复待确认动作 → 执行删除 / 创建等流程。

点击"取消"→ 调用 `handleSend("取消")` → 后端清理当前挂起状态并返回取消结果。

这里的关键点是：

- 按钮只是发送 `"确认"` / `"取消"` 文本
- 真正决定这句文本含义的，不是前端，不是 `question` 类型本身
- 而是后端当前显式保存的 `session state / approval state`

### 2. 无需新增后端路由

复用现有机制，无需实现 `/api/ai/tasks/:id/confirm`。可以删除或保留前端 `confirmTask()` stub。

## 涉及文件

- `packages/web/src/features/ai/AIView.tsx` — 传递 onConfirm + isLatest

## 验收标准

- [ ] 点击"确认创建"后自动发送"确认"消息
- [ ] "确认"消息显示在对话列表中
- [ ] 后端收到"确认"后可基于显式挂起状态恢复执行动作
- [ ] 点击"取消"后发送"取消"消息，后端清理挂起状态
- [ ] 不属于 `payload.interaction.kind === "confirmation"` 的 `question` 消息不会接入按钮联调流程
- [ ] 按钮点击后进入 loading 状态，响应返回后恢复
