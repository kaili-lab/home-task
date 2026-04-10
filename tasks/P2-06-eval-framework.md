# P2-06：质量评测体系

- **status**: pending
- **改进项**: #16 质量评测体系
- **前置任务**: P1-09（需要集成测试基础设施）
- **后续任务**: 无

## 目标

建立 AI Agent 的质量评测基线，定义指标和基准测试集。

## 具体改动

### 1. 定义评测指标

```typescript
interface EvalMetrics {
  taskCreationSuccessRate: number;  // 任务创建成功率（正确调用 create_task 并成功）
  falsePositiveRate: number;        // 误操作率（用户未要求但执行了操作）
  conflictDetectionRate: number;    // 冲突检出率（有冲突时正确检出）
  hallucinationRate: number;        // 幻觉率（声称成功但未执行）
  intentAccuracy: number;           // 意图识别准确率
  avgToolCalls: number;             // 平均 tool 调用次数
  avgResponseTime: number;          // 平均响应时间
}
```

### 2. 创建基准测试集

新建 `packages/server/src/__tests__/eval/test-cases.ts`：

```typescript
const TEST_CASES = [
  // 创建任务
  { input: "帮我创建一个明天下午开会的任务", expectedTool: "create_task", expectedFields: { title: /开会/ } },
  { input: "提醒我今天晚上买菜", expectedTool: "create_task", expectedFields: { timeSegment: "evening" } },

  // 查询任务
  { input: "我今天有什么任务", expectedTool: "query_tasks" },
  { input: "看看这周的安排", expectedTool: "query_tasks" },

  // 冲突检测
  { input: "帮我创建明天下午两点到三点开会", setup: [existingTask("14:00-15:00")], expectedStatus: "conflict" },

  // 非任务请求
  { input: "你好", expectedTool: null, expectedNoAction: true },
  { input: "今天天气怎么样", expectedTool: null, expectedNoAction: true },

  // ... 共 20-50 条
];
```

### 3. 评测执行器

新建 `packages/server/src/__tests__/eval/eval-runner.ts`：
- 使用 FakeListChatModel 或真实 LLM（通过环境变量切换）
- 运行全部测试用例，统计各项指标
- 输出评测报告

### 4. 可选：CI 门禁

在 `pnpm test:external` 中加入 eval 测试，失败时阻断（需要真实 LLM 密钥）。

## 涉及文件

- 新建 `packages/server/src/__tests__/eval/test-cases.ts`
- 新建 `packages/server/src/__tests__/eval/eval-runner.ts`
- 更新现有 `packages/server/src/__tests__/ai.agent-eval.test.ts`（解除 skip 或重写）

## 验收标准

- [ ] 20+ 条基准测试用例覆盖主要场景
- [ ] 评测报告输出各项指标
- [ ] mock LLM 模式下可本地运行
- [ ] 真实 LLM 模式下可选运行（`pnpm test:external`）
