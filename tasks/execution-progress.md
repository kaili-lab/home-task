# 执行进度检查点（可断点续跑）

> 最后更新：2026-04-10  
> 说明：此前历史实现已回滚，本文件按“回滚后重新执行”的真实状态重建。

## Batch 进度

- [ ] Batch 1（P1-02-1, P0-04, P1-02, P1-03）
- [ ] Batch 2（P1-07-1, P0-06, P0-07, P2-05, P2-04）
- [ ] Batch 3（P0-01, P0-02, P0-03）
- [ ] Batch 4（P0-05, P0-08, P1-04, P1-05, P1-06, P1-01, P2-07）
- [ ] Batch 5（P2-03, P2-03-1, P1-07, P1-08, P1-09, P2-06）
- [x] Batch 6（P2-01, P2-02）
- [ ] Batch 7（Hotfix：相对日期归一 + SSE 幂等收尾）

## Task 进度

### 已完成

- [x] P2-01 `AIService` 拆分 — 提取模块
- [x] P2-02 `AIService` 拆分 — 重组入口

### 待执行

- [ ] P0-01 流式响应 — 后端 SSE
- [ ] P0-02 流式响应 — 路由层 SSE
- [ ] P0-03 流式响应 — 前端消费
- [ ] P0-04 删除操作硬确认
- [ ] P0-05 主链路接入 withTimeout/withRetry
- [ ] P0-06 消息长度校验
- [ ] P0-07 用户级限流
- [ ] P0-08 Token 预算
- [ ] P1-01 Tracing + Token 统计
- [ ] P1-02-1 显式会话状态
- [ ] P1-02 确认交互闭环 — 前端
- [ ] P1-03 确认交互闭环 — 联调
- [ ] P1-04 Tool 参数 Runtime 校验
- [ ] P1-05 结构化日志 — Logger 工具
- [ ] P1-06 结构化日志 — 接入
- [ ] P1-07-1 请求幂等 / 去重
- [ ] P1-07 消息落库事务化
- [ ] P1-08 恢复单 Agent 测试 — 纯函数
- [ ] P1-09 恢复单 Agent 测试 — 集成
- [ ] P2-03 上下文窗口 Token 计数
- [ ] P2-03-1 极简历史摘要压缩
- [ ] P2-04 输入内容过滤
- [ ] P2-05 并发互斥
- [ ] P2-06 质量评测体系
- [ ] P2-07 模型分层路由

## 本轮完成记录（P2-01 / P2-02）

### 实施摘要

- 将单体 AI 服务拆分为 `packages/server/src/services/ai/` 下的模块化结构。
- 新增模块：`agent-loop.ts`、`tool-executor.ts`、`prompt-builder.ts`、`history-manager.ts`、`conflict-detector.ts`、`hallucination-guard.ts`、`tool-definitions.ts`、`types.ts`、`index.ts`。
- 删除旧单体入口文件，并将业务代码与测试导入统一切换到 `../services/ai`。

### 关键文件

- `packages/server/src/services/ai/index.ts`
- `packages/server/src/services/ai/agent-loop.ts`
- `packages/server/src/services/ai/tool-executor.ts`
- `packages/server/src/services/ai/prompt-builder.ts`
- `packages/server/src/services/ai/history-manager.ts`
- `packages/server/src/services/ai/conflict-detector.ts`
- `packages/server/src/services/ai/hallucination-guard.ts`
- `packages/server/src/services/ai/tool-definitions.ts`
- `packages/server/src/services/ai/types.ts`
- `packages/server/src/routes/ai.routes.ts`
- `packages/server/src/__tests__/ai.routes.test.ts`

### 验证记录

- `pnpm -C packages/server test:ci -- src/__tests__/ai.routes.test.ts`：通过（3 tests passed）
- `pnpm -C packages/server test:ci -- src/__tests__/ai.service.test.ts`：通过（测试文件为 skip）
