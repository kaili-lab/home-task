# P0-02：流式响应 — 路由层 SSE

- **status**: pending
- **改进项**: #1 流式响应
- **前置任务**: P0-01
- **后续任务**: P0-03

## 目标

`/api/ai/chat` 路由支持 SSE 流式响应，将 `chatStream()` 的回调事件转为 SSE 格式推送给前端。

## 范围边界

本任务的 **V1 仅支持单 Agent 流式响应**。

原因：

- 当前线上部署路径仅使用单 Agent
- 本任务的后端实现基于 `AIService.chatStream()`
- 当前不要求为 `MultiAgentService` 补齐流式能力

因此，文档范围应明确为：

- `ENABLE_MULTI_AGENT=false` 时，`/api/ai/chat?stream=true` 走单 Agent SSE
- 若将来启用多 Agent，本任务不要求同时支持多 Agent 流式
- 多 Agent 的流式能力若要支持，应单独立 task，不与本任务强耦合

## 当前代码

`packages/server/src/routes/ai.routes.ts`（行 22-49）：
- `POST /api/ai/chat` 返回 `c.json(successResponse(result))`
- 前端 `ai.api.ts` 已有 `stream` 参数和 fetch stream 骨架代码（行 71-93），但后端未实现

## 具体改动

### 1. 路由层增加流式分支

```typescript
aiRoutes.post("/chat", async (c) => {
  const streamMode = c.req.query("stream") === "true";

  if (streamMode && !useMultiAgent) {
    // SSE 流式响应
    return streamSSE(c, async (stream) => {
      await aiService.chatStream(userId, message.trim(), async (event) => {
        await stream.writeSSE({ event: event.event, data: JSON.stringify(event.data) });
      });
    });
  }

  // 其余情况保持原有非流式逻辑
  const result = await aiService.chat(userId, message.trim());
  return c.json(successResponse(result));
});
```

若请求带 `stream=true` 但当前启用了多 Agent，V1 建议直接降级为现有非流式响应，而不是在本任务内扩展多 Agent SSE。

### 2. Hono SSE 支持

Hono 内置 `hono/streaming` 的 `streamSSE` helper：
- 导入 `import { streamSSE } from "hono/streaming"`
- 自动设置 `Content-Type: text/event-stream`、`Cache-Control: no-cache`
- Cloudflare Workers 原生支持 ReadableStream

### 3. SSE 事件格式

```
event: token
data: "你"

event: token
data: "好"

event: tool_start
data: {"name":"create_task"}

event: tool_end
data: {"name":"create_task","status":"success"}

event: done
data: {"content":"已为你创建任务...","type":"task_summary","payload":{...}}
```

## 涉及文件

- `packages/server/src/routes/ai.routes.ts` — 增加 stream 分支

## 验收标准

- [ ] `POST /api/ai/chat?stream=true` 返回 SSE 格式响应
- [ ] 非 stream 请求行为不变
- [ ] SSE 事件按 `token` → `tool_start` → `tool_end` → `done` 顺序推送
- [ ] 错误时推送 `error` 事件并关闭连接
- [ ] Cloudflare Workers 部署后 SSE 正常工作
- [ ] V1 流式仅覆盖单 Agent；启用多 Agent 时不要求同步支持 SSE
