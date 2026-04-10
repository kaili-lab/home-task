# P2-02：AIService 拆分 — 重组入口

- **status**: done
- **改进项**: #12 AIService 拆分
- **前置任务**: P2-01
- **后续任务**: 无

## 目标

基于已提取模块重组新的 `AIService` 入口，并完成业务代码导入切换。

## 具体改动

### 1. 新入口组装

- 新建并实现 `packages/server/src/services/ai/index.ts`
- 由入口统一组装 `AgentLoop`、`HistoryManager`、`PromptBuilder`、`ToolExecutor`、`ConflictDetector`、`HallucinationGuard`
- 保持对外 `AIService.chat()` 接口不变

### 2. 主循环与执行链路

- 新建 `packages/server/src/services/ai/agent-loop.ts`
- 新建 `packages/server/src/services/ai/tool-executor.ts`

### 3. import 路径更新

- 路由与测试统一改为 `from "../services/ai"`（或同级 `from "./ai"`）

## 涉及文件

- `packages/server/src/services/ai/index.ts`
- `packages/server/src/services/ai/agent-loop.ts`
- `packages/server/src/services/ai/tool-executor.ts`
- `packages/server/src/routes/ai.routes.ts`
- `packages/server/src/__tests__/ai.routes.test.ts`
- `packages/server/src/__tests__/ai.service.test.ts`
- `packages/server/src/__tests__/ai.complete-flow.integration.test.ts`
- `packages/server/src/__tests__/ai.agent-eval.test.ts`

## 验收标准

- [x] `AIService` 对外接口保持兼容
- [x] 路由与测试导入路径完成切换
- [x] 关键链路测试通过（`ai.routes.test.ts`）
