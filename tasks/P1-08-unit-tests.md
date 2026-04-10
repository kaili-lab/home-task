# P1-08：恢复单 Agent 测试 — 纯函数单元测试

- **status**: pending
- **改进项**: #9 恢复单 Agent 测试
- **前置任务**: 无（不依赖 services/ai/index.ts 拆分，直接测试 private 方法可通过构造 AIService 实例实现）
- **后续任务**: P1-09

## 目标

为单 Agent 的纯函数逻辑编写单元测试，覆盖冲突检测、幻觉检测、时间校验等核心逻辑。

## 当前代码

三个测试文件均为 `describe.skip`：
- `packages/server/src/__tests__/ai.service.test.ts:34`
- `packages/server/src/__tests__/ai.complete-flow.integration.test.ts:42`
- `packages/server/src/__tests__/ai.agent-eval.test.ts:30`

## 具体改动

### 1. 新建纯函数单元测试文件

新建 `packages/server/src/__tests__/ai.unit.test.ts`，不复用被 skip 的旧文件（旧文件可能有过时的 mock 和结构）。

### 2. 测试覆盖范围

**语义冲突检测：**
```typescript
describe("语义冲突检测", () => {
  test("完全相同标题 → 重复", () => {});
  test("包含关系 → 重复", () => {});
  test("归一化后相似（快递/包裹）→ 重复", () => {});
  test("Dice 系数 ≥ 0.75 → 重复", () => {});
  test("Dice 系数 < 0.75 → 不重复", () => {});
  test("完全不同标题 → 不重复", () => {});
});
```

**时间冲突检测：**
```typescript
describe("时间冲突检测", () => {
  test("时间范围重叠 → 冲突", () => {});
  test("相邻时间不重叠 → 不冲突", () => {});
  test("无时间的任务 → 不冲突", () => {});
});
```

**幻觉检测：**
```typescript
describe("幻觉检测", () => {
  test("包含'已创建'但无 tool 执行 → 检测到", () => {});
  test("包含'已完成'但无 tool 执行 → 检测到", () => {});
  test("正常文本无操作声明 → 未检测到", () => {});
  test("有 tool 执行且声明成功 → 未检测到", () => {});
});
```

**时间校验：**
```typescript
describe("时间校验", () => {
  test("过期时段 → 不允许", () => {});
  test("当前时段 → 允许", () => {});
  test("未来时段 → 允许", () => {});
  test("时间段文本推理", () => {});
});
```

**确认跳过机制：**
```typescript
describe("确认跳过", () => {
  test("上条是冲突警告 + 用户说'确认' → 跳过", () => {});
  test("上条是冲突警告 + 用户说其他 → 不跳过", () => {});
  test("上条不是冲突警告 → 不跳过", () => {});
});
```

### 3. 测试策略

由于这些方法是 AIService 的 private 方法，有两种测试策略：
- **方案 A**：构造 AIService 实例，通过 `(service as any).methodName()` 访问 private 方法
- **方案 B**：等 P2-01 拆分后，直接测试导出的纯函数

V1 建议：

- 可以先用**少量**方案 A 作为过渡兜底
- 但不要在这一阶段大量铺设强依赖 private 方法名和类内部结构的测试
- 重点先覆盖最核心、最容易回归的行为

原因：

- `P2-01` / `P2-02` 后续会把这些逻辑拆成纯函数或独立模块
- 如果当前阶段大量测试都绑定在旧的 `AIService private method` 结构上，后续重构时会产生明显迁移成本

因此更稳妥的策略是：

- 先补少量关键回归测试，保证当前行为有兜底
- 等拆分完成后，再把更多测试迁移到导出的纯函数模块上

## 涉及文件

- 新建 `packages/server/src/__tests__/ai.unit.test.ts`

## 验收标准

- [ ] `pnpm -C packages/server test -- ai.unit` 全部通过
- [ ] 覆盖语义冲突、时间冲突、幻觉检测、时间校验、确认跳过 5 个维度
- [ ] 不依赖外部 LLM 调用（纯函数测试）
- [ ] 不依赖数据库连接
- [ ] 已加入 `pnpm test:ci` 范围
- [ ] 当前阶段不过度依赖 `AIService` private 方法结构，避免与 `P2-01` / `P2-02` 产生大面积返工

