# 单 Agent 生产级改进方案

> 基于 ChatGPT 与 Claude 两份独立评审交叉验证后的统一结论。
> 评审时间：2026-04-06 | 主文件：`packages/server/src/services/ai/index.ts`（约 1300 行）

---

## 一、当前实现水平

### 已具备的能力

| 能力 | 实现方式 | 代码位置 |
|------|----------|----------|
| Agent Loop | 手写 while 循环 + 10 轮上限，ToolResult 状态驱动控制流（success/conflict/need_confirmation/error） | services/ai/index.ts `chat()` |
| 语义冲突检测 | 标题归一化 + Dice 系数（bigram 重叠率 ≥ 0.75 触发警告） | services/ai/index.ts `isSemanticDuplicate()` |
| 时间冲突检测 | 精确时间范围重叠判断 | services/ai/index.ts `filterTimeConflicts()` |
| 幻觉检测 | 对比 LLM 文本声明和实际 tool 执行记录，不一致时替换为纠正文案 | services/ai/index.ts `looksLikeActionSuccess()` |
| 时间校验 | 过期时段拦截、精确/模糊互斥、默认值推导 | services/ai/index.ts `executeToolCall()` create_task 分支 |
| System Prompt 动态注入 | 每次请求重建：日期 + 星期 + 时段 + 组列表 | services/ai/index.ts `buildSystemPrompt()` |
| 5 个 Tools | create_task / query_tasks / update_task / complete_task / delete_task | services/ai/index.ts `TOOL_DEFINITIONS` + `executeToolCall()` |

### 需要校准的认知

| 原认知 | 实际情况 |
|--------|----------|
| "错误处理链路完整" | `withTimeout` / `withRetry` 已在 `ai-error-handler.ts` 实现，但 `services/ai/index.ts` 主链路**未接入** |
| "单 Agent 测试已删除" | `ai.routes.test.ts` 文件仍存在；真实风险是 `ai.service.test.ts` / `ai.complete-flow.integration.test.ts` / `ai.agent-eval.test.ts` 均为 `describe.skip` |
| "消息持久化可靠" | user / assistant 消息是两次独立 insert，无事务包裹，存在半写风险 |

---

## 二、改进清单

### P0：必须补齐

> 直接影响线上安全与核心体验。

#### 1. 流式响应

**现状**：等全部生成完才返回。Agent Loop 多轮 tool 调用时延迟可达 10s+，用户无反馈。

**目标**：
- 后端：改为 SSE（Server-Sent Events）或 ReadableStream，Agent Loop 每轮产出即推送
- 前端：逐 token / 逐 chunk 渲染，显示 typing indicator
- Tool 执行期间推送状态提示（如"正在创建任务..."）

**涉及文件**：
- `packages/server/src/routes/ai.routes.ts` — 响应改为流式
- `packages/server/src/services/ai/index.ts` — `chat()` 改为 yield / callback 模式
- `packages/web/src/services/ai.api.ts` — 改用 EventSource 或 fetch stream
- `packages/web/src/features/ai/AIView.tsx` — 逐步渲染消息
- `packages/web/src/features/ai/ChatMessage.tsx` — 支持 streaming 状态

#### 2. 删除操作硬确认

**现状**：`delete_task`（services/ai/index.ts:1146-1154）直接执行 `taskService.deleteTask()`，无代码层确认机制，完全依赖 prompt 约束。

**目标**：
- 首次调用 `delete_task` 时返回 `{ status: "need_confirmation", message: "确认删除 XXX？" }`
- 用户确认后携带确认标记，第二次调用才真正执行删除
- 与现有的 `skipSemanticConflictCheck` 确认机制复用相同模式

**涉及文件**：
- `packages/server/src/services/ai/index.ts` — `delete_task` 分支 + 确认状态判断

#### 3. 用户级限流 + Token 预算

**现状**：`/api/ai/chat` 仅做"非空字符串"校验，无限流、无配额。

**目标**：
- 请求频率限制：per-user 10 req/min（可配置）
- 单次请求消息长度上限：如 2000 字符
- 可选：用户日/月 token 配额，超额降级或拒绝

**涉及文件**：
- `packages/server/src/routes/ai.routes.ts` — 入口校验
- 新建 `packages/server/src/middleware/rate-limiter.ts`（或复用 CF Workers 的 Rate Limiting API）

#### 4. 主链路接入 withTimeout / withRetry

**现状**：`ai-error-handler.ts` 已实现 `withTimeout`（60s）和 `withRetry`（指数退避，最多 2 次），但 `services/ai/index.ts` 中的 `llm.invoke()` 未包裹。

**目标**：
- `llm.invoke()` 统一包裹为 `withTimeout(withRetry(llm.invoke(...)))`
- 错误分类后返回用户友好提示，而非原始异常

**涉及文件**：
- `packages/server/src/services/ai/index.ts` — Agent Loop 中的 LLM 调用点

---

### P1：短期补齐

> 影响可维护性与运维效率。

#### 5. Tracing 接入

**现状**：无法回溯某次对话的 LLM 输入输出、tool 调用链、各环节耗时。

**目标**：
- 接入 Langfuse（开源，可自部署）或 LangSmith
- 记录：每次 LLM 调用的 messages / response / latency / token usage
- 支持按 requestId 查询完整调用链

**选型建议**：Langfuse 对 LangChain 有原生 callback 支持，接入成本低。

#### 6. Token 用量统计

**现状**：不知道每次请求消耗多少 token，无法做成本核算。

**目标**：
- 从 LLM 响应中提取 `usage` 字段（prompt_tokens / completion_tokens）
- 写入日志或数据库
- 可选：接入 Tracing 后作为其中一个维度自动采集

**说明**：可与 #5 合并实现——Langfuse 自动采集 token usage。

#### 7. 确认交互闭环

**现状**：`question` 类型只展示冲突卡片文本，无确认按钮。`confirmTask()` 仅前端 stub（ai.api.ts:113），后端无对应路由。

**目标**：
- 前端 `ChatMessage.tsx`：`question` 类型增加"确认创建"/"取消"按钮
- 点击确认后发送特定消息（如自动发送"确认"）或调用独立确认接口
- 建议优先采用"自动发送确认消息"方案，复用现有的 `skipSemanticConflictCheck` 机制，无需新增后端路由

**涉及文件**：
- `packages/web/src/features/ai/ChatMessage.tsx` — 增加按钮 UI
- `packages/web/src/features/ai/AIView.tsx` — 按钮点击触发发送消息

#### 8. Tool 参数 Runtime 校验

**现状**：多处 `toolArgs as { taskId: number }` 等类型断言，LLM 返回畸形参数时错误在深层业务才暴露。

**目标**：
- 用 Zod 为每个 tool 定义输入 schema
- 在 `executeToolCall()` 入口统一 `safeParse`
- 校验失败返回 `{ status: "error", message: "参数不合法：缺少 taskId" }`，由 LLM 自行修正

**涉及文件**：
- `packages/server/src/services/ai/index.ts` — tool 参数校验层

#### 9. 恢复单 Agent 测试

**现状**：三个关键测试套件均为 `describe.skip`：
- `ai.service.test.ts:34`
- `ai.complete-flow.integration.test.ts:42`
- `ai.agent-eval.test.ts:30`

**目标**：
- 解除 skip，用 mock LLM 恢复可运行状态
- 至少覆盖：冲突检测（语义 + 时间）、幻觉检测、时间校验、delete 确认流程
- 加入 CI（`pnpm test:ci`）

**建议**：先拆分 services/ai/index.ts（#12）再补测试会更高效，但如果拆分排期靠后，可先针对 private 方法写独立单元测试。

#### 10. 结构化日志

**现状**：有 `requestId` 字段但 console.log 散落各处，requestId 没有贯穿完整调用链。

**目标**：
- 统一日志格式：`{ requestId, userId, action, toolName, duration, status }`
- 每次 tool 调用记录：名称 / 耗时 / 结果状态
- Agent Loop 每轮记录：iteration / hasToolCalls / toolCount

**涉及文件**：
- `packages/server/src/services/ai/index.ts` — 日志注入点
- 可选新建 `packages/server/src/utils/logger.ts` — 统一日志工具

#### 11. 消息落库事务化

**现状**：user 和 assistant 消息分两次独立 `db.insert()`（services/ai/index.ts:1236-1237 等多处），无事务包裹。

**目标**：
- 将同一轮对话的 user + assistant 消息包裹在 `db.transaction()` 中
- 失败时整体回滚，避免"用户消息写入成功但助手消息丢失"的半写状态

**涉及文件**：
- `packages/server/src/services/ai/index.ts` — `chat()` 方法中所有 `saveMessage` 调用点

---

### P2：持续迭代

> 拉高上限，非阻塞项。

#### 12. services/ai/index.ts 拆分

**现状**：1300 行，包含 prompt 构建 + tool 定义 + tool 执行 + 冲突检测 + 历史管理 + 幻觉检测。

**建议拆分方案**：
```
services/ai/
├── agent-loop.ts          # chat() 主循环
├── prompt-builder.ts      # buildSystemPrompt()
├── tool-definitions.ts    # TOOL_DEFINITIONS 常量
├── tool-executor.ts       # executeToolCall() 分发逻辑
├── conflict-detector.ts   # 语义 + 时间冲突检测
├── hallucination-guard.ts # 幻觉检测
├── history-manager.ts     # loadHistory() + saveMessage()
└── index.ts               # 导出 AIService
```

#### 13. 上下文窗口 Token 计数

**现状**：固定加载 20 条历史，不计算 token 总量。

**目标**：
- `loadHistory()` 时用 tiktoken（或近似计算）累计 token
- 超过阈值（如 model context 的 70%）时从最早消息开始截断
- 预留 system prompt + 当前消息 + tool 定义的 token 空间

#### 14. 输入内容过滤

**目标**：
- 基础 prompt injection 检测（如检测"ignore previous instructions"等模式）
- 消息长度上限（与 #3 合并）
- 可选：接入内容安全 API

#### 15. 并发互斥

**目标**：
- 同一用户同一时间只允许一个 AI 请求在处理
- 实现方式：请求入口加 per-user 锁（内存锁或 KV 锁）
- 后续请求返回 429 + 友好提示

#### 16. 质量评测体系

**目标**：
- 定义 eval 指标：任务创建成功率、误删率、追问准确率、冲突检出率
- 建立基准测试集（20-50 条典型对话）
- 可选：CI 门禁，eval 分数低于阈值阻断合并

#### 17. 模型分层路由

**目标**：
- 简单查询（query_tasks）用轻量/低成本模型
- 复杂操作（创建 + 冲突判断）用强模型
- 基于意图推理结果 `inferIntent()` 动态选模

#### 18. 会话摘要与记忆压缩

**目标**：
- 对话超过 N 轮后，对早期消息做摘要压缩
- 摘要作为 system message 注入，替代原始消息
- 减少 token 消耗，延长有效对话长度

---

## 三、建议执行顺序

```
第一批（核心体验 + 安全止血）
  ├── #1 流式响应
  ├── #2 删除操作硬确认
  ├── #3 用户级限流 + Token 预算
  └── #4 主链路接入 withTimeout/withRetry

第二批（可维护性 + 运维能力）
  ├── #5 Tracing 接入（含 #6 Token 统计）
  ├── #7 确认交互闭环
  ├── #8 Tool 参数 Runtime 校验
  ├── #9 恢复单 Agent 测试
  ├── #10 结构化日志
  └── #11 消息落库事务化

第三批（持续优化）
  ├── #12 services/ai/index.ts 拆分
  ├── #13 上下文窗口 Token 计数
  └── #14-18 按需迭代
```

---

## 四、总结

当前单 Agent 核心功能完整：Agent Loop、冲突检测、幻觉防护、时间校验均有代码落地，不是纯靠 prompt。

距离生产级差在三个维度：

- **体验层**：流式响应是最大短板，确认闭环次之
- **防护层**：限流 / Token 预算 / 删除硬确认 / 主链路错误处理未接入
- **运维层**：Tracing / Token 统计 / 结构化日志 / 测试回归

这些改进不涉及架构重写，均为现有骨架上的增量补全。第一批完成后即可达到"可自信展示的生产级"水准。

