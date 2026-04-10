# 单 Agent 生产级改进 — 任务清单

> 来源：`update/single-agent-improvement-plan.md`
> 创建时间：2026-04-06

## 任务命名规则

`P{优先级}-{序号}-{简述}.md`，如 `P0-01-streaming-backend.md`

## 执行顺序

任务按文件名排序即为默认建议执行顺序；如果任务文件中声明了显式前置任务，则以前置任务为准。

当前已知的插入式基础设施任务中，`P1-02-1` 虽然编号位于 P1，但应先于 `P0-04` 执行，因为它为删除确认提供显式状态基础设施。

## 状态标记

每个任务文件头部有 `status` 字段：
- `pending` — 未开始
- `in-progress` — 进行中
- `done` — 已完成
- `blocked` — 被阻塞（注明原因）

## AI Chat 路由中间件顺序

`/api/ai/chat` 的全局挂载顺序统一定义为：

```typescript
validate input
-> idempotency check / short-circuit
-> quotaGuard（未来）
-> rateLimiter
-> userLock
-> handler
```

说明：

- `idempotency` 命中已完成 / 处理中请求时，应直接短路返回
- `quotaGuard` 是未来账户级 AI 使用额度控制的预留位置
- `rateLimiter` 负责限制短时间频率
- `userLock` 负责同一用户同一时刻只能有一个新请求在执行
- 各子任务文件中的顺序描述如果只覆盖局部层次，应以这里的全局顺序为准

## 总览

### P0：核心体验 + 安全止血（8 个任务）

| 文件 | 改进项 | 说明 |
|------|--------|------|
| P0-01 | 流式响应 — 后端 SSE | services/ai/index.ts chat() 改为流式输出 |
| P0-02 | 流式响应 — 路由层 SSE | ai.routes.ts 改为 SSE 响应 |
| P0-03 | 流式响应 — 前端消费 | ai.api.ts + AIView + ChatMessage 适配流式 |
| P0-04 | 删除操作硬确认 | delete_task 增加确认令牌机制 |
| P0-05 | 主链路接入 withTimeout/withRetry | llm.invoke() 包裹错误处理 |
| P0-06 | 消息长度校验 | 入口增加消息长度上限 |
| P0-07 | 用户级限流 | 中间件实现 per-user rate limiting |
| P0-08 | Token 预算 | 单次请求 token 上限控制 |

### P1：可维护性 + 运维能力（11 个任务）

| 文件 | 改进项 | 说明 |
|------|--------|------|
| P1-01 | Tracing + Token 统计 | 接入 Langfuse callback |
| P1-02-1 | 显式会话状态 | 将确认态 / 候选态从消息文本提升为 session state |
| P1-02 | 确认交互闭环 — 前端 | ChatMessage 增加确认/取消按钮 |
| P1-03 | 确认交互闭环 — 联调 | AIView 按钮点击发送确认消息 |
| P1-04 | Tool 参数 Runtime 校验 | Zod schema + safeParse |
| P1-05 | 结构化日志 — Logger 工具 | 新建统一日志模块 |
| P1-06 | 结构化日志 — 接入 | services/ai/index.ts 替换 console.log |
| P1-07 | 消息落库事务化 | saveMessage 改为事务写入 |
| P1-07-1 | 请求幂等 / 去重 | 基于 `clientRequestId` 防止重复执行 AI 请求 |
| P1-08 | 恢复单 Agent 测试 — 纯函数 | 冲突检测、幻觉检测、时间校验单元测试 |
| P1-09 | 恢复单 Agent 测试 — 集成 | mock LLM 的 Agent Loop 集成测试 |

### P2：持续优化（8 个任务）

| 文件 | 改进项 | 说明 |
|------|--------|------|
| P2-01 | services/ai/index.ts 拆分 — 提取模块 | 拆为 7 个独立文件 |
| P2-02 | services/ai/index.ts 拆分 — 重组入口 | 新 AIService 组装各模块 |
| P2-03 | 上下文窗口 Token 计数 | loadHistory() 增加 token 截断 |
| P2-03-1 | 极简历史摘要压缩 | 旧历史临时压缩为 summary，最近少量消息保留原文 |
| P2-04 | 输入内容过滤 | prompt injection 基础检测 |
| P2-05 | 并发互斥 | per-user 请求锁 |
| P2-06 | 质量评测体系 | eval 基准测试集 + 指标 |
| P2-07 | 模型分层路由 | 按意图选模 |

