# P1-09：恢复单 Agent 测试 — 集成测试

- **status**: pending
- **改进项**: #9 恢复单 Agent 测试
- **前置任务**: P1-08
- **后续任务**: 无

## 目标

用 mock LLM 编写 Agent Loop 集成测试，覆盖完整的对话流程（含 tool 调用链）。

## 具体改动

### 1. 新建集成测试文件

新建 `packages/server/src/__tests__/ai.integration.test.ts`

### 2. Mock LLM 策略

使用 LangChain 的 `FakeListChatModel`（项目多 Agent 测试中已用过）：

```typescript
import { FakeListChatModel } from "@langchain/core/utils/testing";
```

构造预设的 LLM 响应序列，模拟：
- 直接文本回复（无 tool call）
- 单次 tool call → 文本回复
- 冲突检测 → 确认 → 创建
- 幻觉检测触发

### 3. Mock 数据库

用 Vitest mock `db.insert` / `db.select` 等 Drizzle 操作，或使用内存数据库。

### 4. 测试场景

```typescript
describe("AI Agent Loop 集成测试", () => {
  test("简单查询 → LLM 调用 query_tasks → 返回结果", () => {});
  test("创建任务 → LLM 调用 create_task → 返回 task_summary", () => {});
  test("创建任务有冲突 → 返回 question → 用户确认 → 创建成功", () => {});
  test("删除任务 → 首次返回确认提示 → 用户确认 → 删除成功", () => {});
  test("LLM 声称成功但未调用 tool → 幻觉检测触发", () => {});
  test("Agent Loop 超过 10 轮 → 返回兜底消息", () => {});
  test("LLM 调用失败 → 返回友好错误信息", () => {});
});
```

## 涉及文件

- 新建 `packages/server/src/__tests__/ai.integration.test.ts`

## 验收标准

- [ ] `pnpm -C packages/server test -- ai.integration` 全部通过
- [ ] 不依赖外部 LLM（使用 FakeListChatModel）
- [ ] 覆盖正常流程 + 冲突 + 删除确认 + 幻觉 + 超时兜底
- [ ] 已加入 `pnpm test:ci` 范围
