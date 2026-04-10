# P1-02：确认交互闭环 — 前端按钮

- **status**: pending
- **改进项**: #7 确认交互闭环
- **前置任务**: P1-02-1
- **后续任务**: P1-03

## 目标

在 `ChatMessage.tsx` 的确认态消息下方增加"确认创建"和"取消"按钮。

## 当前代码

`packages/web/src/features/ai/ChatMessage.tsx` 行 78-97：
- 冲突卡片只展示冲突任务列表
- 无任何可交互元素
- 当前没有基于结构化交互状态区分“普通追问”和“确认态消息”

### 为什么不能直接用 `message.type === "question"` 显示按钮

当前后端里的 `question` 是一个**宽泛的消息类型**，不只表示“可确认交互”，还包括：

- 缺少结束时间时的普通追问
- 今天时间已过时的补充确认
- 冲突后是否继续创建
- 其他需要用户补充信息的提问

因此：

- `question` = “这是一条提问式消息”
- 不等于 = “这条消息一定适合显示确认/取消按钮”

如果前端直接按 `message.type === "question"` 显示按钮，就可能把：

- “请问几点结束？”
- “请提供新的时间段”

这类普通追问也错误地渲染成“确认/取消”交互。

## 具体改动

### 1. 扩展 ChatMessage props

```typescript
interface ChatMessageProps {
  message: ChatMessageType;
  onConfirm?: (message: string) => void; // 点击确认时触发，发送确认消息
  isLatest?: boolean; // 是否是最新的 AI 消息（只有最新的冲突消息才显示按钮）
}
```

### 2. 仅在结构化确认态消息下方增加按钮

```tsx
{/* 确认/取消按钮 — 仅最新的 confirmation 交互消息 */}
{!isUser &&
  message.payload?.interaction?.kind === "confirmation" &&
  isLatest &&
  onConfirm && (
  <div className="mt-2 flex gap-2">
    <button
      onClick={() => onConfirm("确认")}
      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
    >
      确认创建
    </button>
    <button
      onClick={() => onConfirm("取消")}
      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
    >
      取消
    </button>
  </div>
)}
```

### 3. 按钮状态

- 点击后按钮变为 disabled + loading 状态
- 需要新增一个 `confirming` 状态来控制
- 按钮文案可根据 `message.payload?.interaction?.action` 决定，例如：
  - `create_task_after_conflict` → “确认创建”
  - `delete_task` → “确认删除”

## 涉及文件

- `packages/web/src/features/ai/ChatMessage.tsx` — 增加按钮 UI 和 props

## 验收标准

- [ ] 带 `payload.interaction.kind === "confirmation"` 的最新 AI 消息显示确认/取消按钮
- [ ] 普通 `question` 消息（如补时间、补结束时间）不显示确认/取消按钮
- [ ] 历史 confirmation 消息不显示按钮
- [ ] 按钮样式与整体 UI 一致
- [ ] 点击后按钮变为 disabled 状态
