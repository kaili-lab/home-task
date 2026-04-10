# P0-01：流式响应 — 后端 AIService 改造

- **status**: pending
- **改进项**: #1 流式响应
- **前置任务**: 无
- **后续任务**: P0-02, P0-03

## 目标

将 `AIService.chat()` 从一次性返回改为流式回调输出，使 Agent Loop 每轮产出都能实时推送。

## 当前代码

`packages/server/src/services/ai/index.ts` 的 `chat()` 方法（行 1167-1298）：
- 返回类型为 `Promise<AIServiceResult>`，整体返回
- Agent Loop 内 `llm.invoke()` 等待完整响应后再处理
- 最终一次性返回 `{ content, type, payload }`

## 具体改动

### 1. 新增流式回调类型

在 `services/ai/index.ts` 顶部（或单独文件）新增：

```typescript
export type StreamEvent =
  | { event: "token"; data: string }                           // LLM 文本 token
  | { event: "tool_start"; data: { name: string } }            // 开始执行 tool
  | { event: "tool_end"; data: { name: string; status: string } } // tool 执行完毕
  | { event: "done"; data: AIServiceResult }                   // 最终结果
  | { event: "error"; data: { message: string } };             // 错误
```

### 2. 新增 `chatStream()` 方法

保留原 `chat()` 不变（非流式兼容），新增 `chatStream()` 方法：

```typescript
async chatStream(
  userId: number,
  message: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void>
```

核心改动：
- `llm.invoke()` 改为 `llm.stream()`（LangChain ChatOpenAI 支持 `.stream()` 返回 AsyncIterable）
- 遍历 stream chunks，每个 chunk 调用 `onEvent({ event: "token", data: chunk.content })`
- tool_calls 检测逻辑不变，但在执行前/后分别推送 `tool_start` / `tool_end`
- 最终结果通过 `onEvent({ event: "done", data: result })` 推送
- need_confirmation / conflict 仍然直接结束并推送 done

### 3. 处理 stream 中的 tool_calls

LangChain `ChatOpenAI.stream()` 返回的 chunk 中，tool_calls 会分散在多个 chunk 里。需要：
- 累积 chunks 直到检测到完整的 tool_calls
- 或使用 `llm.invoke()` 仅在非 tool_call 路径时改用 stream
- **建议方案**：首轮仍用 `invoke()`（因为需要完整 tool_calls），只有最终文本回复阶段用 `stream()` 逐 token 输出

### 4. 保存消息不变

`saveMessage()` 在 stream 完成后调用，逻辑不变。

## 涉及文件

- `packages/server/src/services/ai/index.ts` — 新增 `StreamEvent` 类型 + `chatStream()` 方法

## 验收标准

- [ ] `chatStream()` 方法可正常调用，onEvent 回调按顺序触发
- [ ] tool 执行期间推送 tool_start / tool_end 事件
- [ ] 最终文本响应逐 token 推送
- [ ] 原 `chat()` 方法不受影响
- [ ] 幻觉检测、冲突检测逻辑在流式模式下仍正常工作

