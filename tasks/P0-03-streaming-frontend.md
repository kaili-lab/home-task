# P0-03：流式响应 — 前端消费

- **status**: pending
- **改进项**: #1 流式响应
- **前置任务**: P0-02
- **后续任务**: 无

## 目标

前端从等待完整响应改为实时消费 SSE 流，逐 token 渲染 AI 回复，tool 执行期间显示状态提示。

## 范围边界

本任务的 **V1 前端流式消费只面向单 Agent 后端流式通道**。

也就是说：

- 当前前端 `chatStream()` 对接的是单 Agent SSE 协议
- 不要求在本任务内兼容多 Agent 流式事件格式
- 如果后端当前启用了多 Agent，前端可继续走现有非流式 `chat()`，不在本任务内扩展

## 当前代码

### ai.api.ts（行 61-98）
- `chat()` 函数已有 `stream` 参数和 fetch stream 骨架
- stream 分支返回 `response.body as unknown as EventSource`（类型不对，需重写）
- 非 stream 分支调用 `apiPost` 获取完整响应

### AIView.tsx（行 45-76）
- `handleSend()` 调用 `chat(content)` 等待完整响应
- 响应到达后一次性添加 `aiMessage` 到 messages 列表
- `isLoading` 控制 loading 动画（三个弹跳圆点）

### ChatMessage.tsx
- 静态渲染消息内容，无流式状态支持

## 具体改动

### 1. ai.api.ts — 重写 stream 消费

```typescript
export async function chatStream(
  message: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/api/ai/chat?stream=true`
    : "/api/ai/chat?stream=true";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-timezone-offset": String(new Date().getTimezoneOffset()),
    },
    body: JSON.stringify({ message }),
    credentials: "include",
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 解析 SSE 格式，按 \n\n 分割事件
    // 提取 event: 和 data: 字段，调用 onEvent
  }
}
```

保留原 `chat()` 函数不变，新增 `chatStream()`。

V1 应假定：

- `chatStream()` 仅在单 Agent SSE 可用时调用
- 若后端未开放 SSE（例如未来切多 Agent 且未实现流式），前端应继续保留非流式回退能力

### 2. AIView.tsx — 流式渲染

- `handleSend()` 改为调用 `chatStream()`
- 收到 `token` 事件时，追加到当前 AI 消息的 content
- 收到 `tool_start` 时，显示"正在创建任务..."等状态文案
- 收到 `tool_end` 时，清除状态文案
- 收到 `done` 时，用最终结果替换消息（含 type 和 payload）
- loading 状态细化：从三个圆点改为显示实际进度文案

### 3. ChatMessage.tsx — 支持流式状态

- 新增 `isStreaming` prop（可选）
- streaming 中时显示闪烁光标
- streaming 结束后正常渲染（含任务卡片、冲突卡片）

## 涉及文件

- `packages/web/src/services/ai.api.ts` — 新增 `chatStream()`
- `packages/web/src/features/ai/AIView.tsx` — `handleSend()` 改用流式
- `packages/web/src/features/ai/ChatMessage.tsx` — 支持 `isStreaming` 状态

## 验收标准

- [ ] AI 回复逐字符出现，而非等待数秒后一次性显示
- [ ] tool 执行期间显示"正在创建任务..."等提示
- [ ] 最终结果到达后正确渲染任务卡片 / 冲突卡片
- [ ] 网络错误时显示 toast 提示
- [ ] 非流式 `chat()` 函数保持可用
- [ ] V1 不要求兼容多 Agent 流式协议；单 Agent SSE 不可用时前端可继续保留非流式回退
