# P1-01：Tracing + Token 统计（Langfuse）

- **status**: pending
- **改进项**: #5 Tracing 接入 + #6 Token 用量统计
- **前置任务**: 无
- **后续任务**: 无

## 目标

接入 Langfuse 实现 LLM 调用链追踪和 token 用量自动采集。

## 具体改动

### 1. 安装依赖

```bash
pnpm -C packages/server add langfuse-langchain
```

Langfuse 提供 `CallbackHandler` 可直接作为 LangChain callback 使用。

### 2. 新增环境变量

在 `packages/server/src/types/bindings.ts` 中新增：

```typescript
LANGFUSE_PUBLIC_KEY?: string;
LANGFUSE_SECRET_KEY?: string;
LANGFUSE_BASE_URL?: string; // 自部署时使用
```

### 3. 创建 Langfuse callback

在 `services/ai/index.ts` 的 `chat()` 方法中，创建 per-request 的 callback handler：

```typescript
import { CallbackHandler } from "langfuse-langchain";

// 在 chat() 方法开头
const langfuseHandler = this.env.LANGFUSE_PUBLIC_KEY
  ? new CallbackHandler({
      publicKey: this.env.LANGFUSE_PUBLIC_KEY,
      secretKey: this.env.LANGFUSE_SECRET_KEY!,
      baseUrl: this.env.LANGFUSE_BASE_URL,
      metadata: { userId, requestId: this.requestId },
    })
  : undefined;

// llm.invoke 时传入 callbacks
const response = await llm.invoke(messages, {
  tools: TOOL_DEFINITIONS,
  tool_choice: toolChoice,
  callbacks: langfuseHandler ? [langfuseHandler] : undefined,
});

// 请求结束时 flush
await langfuseHandler?.flushAsync();
```

### 3.1 Workers 兼容性验证与降级

本任务不能直接假设 `langfuse-langchain` 在 Cloudflare Workers 下天然稳定可用，实施时需要单独验证：

- 在 `wrangler dev` / 实际 Workers 环境下验证 callback 创建、上报和 `flushAsync()` 的行为
- 重点确认请求结束前 trace 是否能稳定送达，而不是只在本地 Node 环境可用

如果验证结果显示 Workers 路径下不稳定或不兼容，则采用降级方案之一：

- 仅在传统 Node.js 部署路径启用 Langfuse callback
- 或改为直接调用 Langfuse REST API，而不是继续强依赖 `langfuse-langchain`

V1 的目标是先把 tracing 能力安全接入，而不是为了统一实现方式强行要求 Workers 与 Node.js 完全同构。

### 4. 自动采集的数据

Langfuse callback 会自动记录：
- 每次 LLM 调用的 input messages / output / latency
- token usage（prompt_tokens / completion_tokens / total_tokens）
- tool calls 的名称和参数
- 错误信息

### 5. 无 Langfuse 时的降级

如果未配置 `LANGFUSE_PUBLIC_KEY`，不创建 callback，行为与当前一致。不影响核心功能。

## 涉及文件

- `packages/server/package.json` — 新增 `langfuse-langchain` 依赖
- `packages/server/src/types/bindings.ts` — 新增环境变量类型
- `packages/server/src/services/ai/index.ts` — 创建 callback + 传入 llm.invoke

## 验收标准

- [ ] 配置 Langfuse 密钥后，每次 AI 对话在 Langfuse 控制台可见完整 trace
- [ ] trace 包含 LLM 输入/输出、tool 调用、token 用量、耗时
- [ ] 未配置密钥时不影响正常功能
- [ ] 按 requestId 可查询完整调用链
- [ ] 已验证 Cloudflare Workers 路径的兼容性；若不兼容，已有明确降级方案

