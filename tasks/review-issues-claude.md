# tasks 任务清单评估：Claude Review

> 目的：在 ChatGPT 第一轮 review 及任务更新之后，对整体任务清单做第二轮审查，找出残留问题和新发现的问题。
> 范围：仅针对任务设计的合理性（依赖关系、优先级、边界定义），不评价实现质量。

---

## 问题 A：P0-04 被 P1 任务阻塞，优先级倒挂

### 问题是什么

P0-04（删除确认）标记为 P0 优先级，但前置依赖是 P1-02-1（session state）。

### 为什么这是问题

1. P0 意味着"核心体验 + 安全止血"，应该最先落地。
2. 但实际执行时，P0-04 要等 P1-02-1 先完成才能开始。
3. 这意味着 P0 队列中有一个任务实质上被卡在了 P1 进度上，P0 的"最优先"语义被打破。

### 建议

把 P1-02-1 提升到 P0-04 之前执行。可以将其编号改为 P0-03.5 / P0-04-0，或者在执行计划中明确：P1-02-1 应在 P0-04 之前执行，不受 P1 整体排期约束。

### 关联任务

- `tasks/P0-04-delete-confirmation.md`
- `tasks/P1-02-1-session-state-approval.md`

---

## 问题 B：P1-07-1（幂等）的前置依赖 P1-07（消息事务化）不成立

### 问题是什么

P1-07-1 标注前置任务为 P1-07。

### 为什么这是问题

1. 幂等机制（基于 `clientRequestId` 的去重）和消息落库事务化是完全独立的两件事。
2. 幂等记录表是新表（`aiChatRequests`），和 `messages` 表的事务写入没有逻辑关系。
3. 这个假依赖会不必要地推迟幂等任务的启动时间。

### 建议

移除 P1-07-1 对 P1-07 的前置依赖。两者可以并行开发。

### 关联任务

- `tasks/P1-07-message-transaction.md`
- `tasks/P1-07-1-chat-idempotency.md`

---

## 问题 C：P0-08 和 P2-03 有重复的 token 估算逻辑，但互相不知道对方

### 问题是什么

- P0-08 在 Agent Loop 中累计 `response.response_metadata.tokenUsage`（LLM 返回的真实用量）。
- P2-03 在 `loadHistory()` 中用 `estimateTokens()` 做本地估算。
- 两个任务都涉及 token 计算，但没有提到对方，也没有说明是否共享工具函数。

### 为什么这是问题

1. 两者用了不同的 token 计算方式：P0-08 依赖 LLM 返回值（精确但滞后），P2-03 用本地估算（提前但不精确）。
2. `estimateTokens()` 是通用工具函数，应该提取到共享位置，而不是只在 P2-03 中定义。
3. 如果先做 P0-08 再做 P2-03，可能会出现两份独立的 token 相关工具代码。

### 建议

在 P2-03 中明确 `estimateTokens()` 应提取为共享工具函数（如 `utils/token-estimator.ts`）。P0-08 文档中也应提到，后续 P2-03 会引入本地估算函数，两者可以互补使用。

### 关联任务

- `tasks/P0-08-token-budget.md`
- `tasks/P2-03-token-counting.md`

---

## 问题 D：P1-01（Langfuse）缺少 Workers 兼容性风险说明

### 问题是什么

P1-01 计划安装 `langfuse-langchain` 并在 Cloudflare Workers 环境中使用，验收标准写了"Cloudflare Workers 部署后 flush 正常工作"，但任务文档没有列出兼容性风险和降级方案。

### 为什么这是问题

1. `langfuse-langchain` 底层依赖 `langfuse` SDK，它使用 Node.js 的 `fetch`、`setTimeout`、批量上报等机制。
2. Cloudflare Workers 对 Node.js API 的支持是有限的（`nodejs_compat` flag 可以开启部分，但不保证全部兼容）。
3. 如果验收时才发现不兼容，会浪费开发时间。

### 建议

在"具体改动"中增加一节"Workers 兼容性验证"：

1. 明确需要在 `wrangler dev` 下测试 `flushAsync()` 是否正常工作。
2. 如果不兼容，列出替代方案（如 Langfuse 的 REST API 直接调用、或仅在传统 Node.js 部署路径下启用）。
3. 将验收标准中"Cloudflare Workers 部署后 flush 正常工作"改为"已验证 Workers 兼容性，如不兼容则有降级方案"。

### 关联任务

- `tasks/P1-01-tracing-langfuse.md`

---

## 问题 E："-1"后缀编号的语义不清晰

### 问题是什么

P1-02-1 是 P1-02 和 P1-03 的**前置任务**，但编号看起来像 P1-02 的子任务。同样的问题存在于 P1-07-1 和 P2-03-1。

### 为什么这是问题

1. 按任务命名规则 `P{优先级}-{序号}-{简述}`，"P1-02-1"暗示"P1-02 的第一个子步骤"。
2. 但实际上 P1-02-1 是一个独立的基础设施任务，是 P1-02 的前置，不是子步骤。
3. 新加入的开发者（或 AI 审阅者）可能误以为 P1-02-1 可以在 P1-02 之后甚至同时做。

### 建议

两种解法任选其一：

1. 接受"-1"后缀就是"插入任务"的约定，在 `README.md` 的"任务命名规则"小节中明确说明。
2. 重新编号：给插入任务独立序号（如 P1-02-1 → P1-00-session-state-approval），但这可能涉及较多文件重命名。

建议采用方案 1，成本最低。

### 关联任务

- `tasks/P1-02-1-session-state-approval.md`
- `tasks/P1-07-1-chat-idempotency.md`
- `tasks/P2-03-1-lightweight-history-summary.md`
- `tasks/README.md`

---

## 问题 F：P2-03-1 对 P1-02-1 的前置依赖偏强

### 问题是什么

P2-03-1（历史摘要）标注前置任务为 P1-02-1（session state）。

### 为什么这是问题

1. 理由是"summary 不应承担流程状态，流程状态应由 session state 负责"。
2. 但这是一个设计约束，不是技术依赖——即使 session state 还没做，也完全可以先实现 summary。
3. 硬依赖会把 P2-03-1 推得更远，而 summary 对长对话的体验提升是实际的。

### 建议

改为软依赖。在 P2-03-1 中写明：

- "建议在 P1-02-1 之后执行，但不强制。"
- "如果 P1-02-1 未完成，summary prompt 中暂不需要特别排除确认态信息。"

### 关联任务

- `tasks/P2-03-1-lightweight-history-summary.md`
- `tasks/P1-02-1-session-state-approval.md`

---

## 问题 G：中间件挂载顺序分散在三个任务中，缺少统一定义

### 问题是什么

P0-07（限流）、P1-07-1（幂等）、P2-05（并发锁）各自在文档中描述了自己和其他中间件的组合顺序，但描述分散在三个文件里。

### 为什么这是问题

1. P0-07 写的顺序：`idempotency → quotaGuard → rateLimiter → handler`
2. P1-07-1 写的顺序：`validate → idempotency → quota → rateLimiter → userLock → handler`
3. P2-05 写的顺序：`idempotency → userLock → handler`
4. 三份文档各自只关注自己相邻的层级，没有一个统一的全局视图。
5. 如果后续执行时只看单个任务文档，容易对全局顺序产生不一致理解。

### 建议

在 `tasks/README.md` 中增加一个"中间件挂载顺序"小节，定义全局规范：

```
validate input
→ idempotency check / short-circuit
→ quotaGuard（未来）
→ rateLimiter
→ userLock
→ handler
```

然后各任务文件引用 README 的统一定义，而不是各自重复描述。

### 关联任务

- `tasks/P0-07-rate-limiter.md`
- `tasks/P1-07-1-chat-idempotency.md`
- `tasks/P2-05-concurrent-lock.md`
- `tasks/README.md`

---

## 次要问题（不影响执行，但值得注意）

### H1：行号引用会过时

多个任务引用了 `services/ai/index.ts` 的具体行号（如"行 1167-1298"）。随着其他任务的执行，这些行号会漂移。建议在执行时以函数名/方法名定位，不依赖行号。

### H2：P2-07 拆出 summary 后变得非常薄

拆出 summary 后 P2-07 只剩模型路由，内容约 60 行。其前置依赖 P2-03（token counting）也不太必要——按意图选模型的核心逻辑不需要 token 计数。建议移除 P2-07 对 P2-03 的前置依赖。

### H3：P1-08 验收标准里的测试命令格式

`pnpm -C packages/server test -- ai.unit` 需要确认在项目的 vitest 配置下是否生效。vitest 的文件名 pattern 匹配通常写法是 `pnpm -C packages/server test ai.unit` 或 `pnpm -C packages/server vitest run ai.unit`，中间的 `--` 可能不需要。

---

## 建议优先处理顺序

如果后面要逐条修改任务文件，建议按影响程度排序：

1. **问题 A**（优先级倒挂）— 影响 P0 执行节奏
2. **问题 B**（假依赖）— 影响 P1 并行度
3. **问题 G**（中间件顺序统一）— 影响多个任务的一致性
4. **问题 F**（硬依赖偏强）— 影响 P2 启动时间
5. **问题 C**（token 工具共享）— 影响代码复用
6. **问题 D**（Workers 兼容性）— 影响 P1-01 执行风险
7. **问题 E**（编号语义）— 影响沟通，不影响执行
8. **次要问题 H1-H3** — 执行时留意即可

