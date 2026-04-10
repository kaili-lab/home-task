# P1-02-1：显式 Session State / Approval State

- **status**: pending
- **改进项**: 新增：上下文层基础设施（确认态 / 候选态）
- **前置任务**: 无
- **后续任务**: P1-02, P1-03, P2-07

## 目标

将当前依赖“上一条 assistant 文本 + 用户确认词”判断的确认流程，升级为显式的短时会话状态：

- 系统明确记录当前是否在等待确认
- 系统明确记录当前待执行动作和目标对象
- 后续 `"确认"` / `"取消"` 优先由状态驱动处理，而不是再次依赖 LLM 猜测

## V1 拍板范围

本任务的 **V1 仅实现方案 A**，范围明确收敛为：

- 只实现 `awaiting_confirmation` 确认态
- 不实现 `awaiting_selection` 候选选择态
- `actionKind` 只支持：
  - `delete_task`
  - `create_task_after_conflict`
- `actionPayload` 只保留恢复执行所需的最小字段：
  - 删除确认：`taskId`、`taskTitle`
  - 冲突后确认创建：`toolArgs`

这意味着本任务先解决两个最核心的问题：

1. 删除确认不再依赖 assistant 文本匹配
2. 冲突后 `"确认"` 可以直接继续原创建动作，而不是再次让 LLM 重新生成参数

## 当前代码

### `services/ai/index.ts`

当前确认相关逻辑主要基于消息文本推断：

- `loadLastAssistantMessage()` 读取上一条 assistant 消息
- `shouldSkipSemanticConflictCheck()` 通过上一条消息内容 + 用户回复 `"确认"` 判断是否跳过冲突检测
- `delete_task` 当前在 P0-04 中计划新增 `shouldSkipDeleteConfirmation()`，但仍会沿用同类文本匹配思路

这说明当前“流程状态”仍主要埋在消息文本里，而不是显式建模。

### `schema.ts`

当前数据库已有 `messages` 表，`payload` 主要用于 UI 渲染，但没有单独承载“当前会话状态”的存储结构。

## 具体改动

### 1. 新增 AI 会话状态存储

在 `packages/server/src/db/schema.ts` 中新增一张轻量状态表（或等价存储结构），用于保存每个用户当前的短时状态。

建议最小字段（V1 定版）：

```typescript
flowStatus: "awaiting_confirmation";
actionKind: "delete_task" | "create_task_after_conflict";
actionPayload: jsonb; // 当前待确认动作的恢复执行数据
expiresAt: timestamp;
updatedAt: timestamp;
```

`actionPayload` 的 V1 结构定为：

```typescript
type ActionPayload =
  | {
      taskId: number;
      taskTitle: string;
    }
  | {
      toolArgs: {
        title: string;
        description?: string;
        dueDate?: string;
        startTime?: string;
        endTime?: string;
        timeSegment?: string;
        priority?: string;
        groupId?: number;
      };
    };
```

V1 不额外引入：

- `version`
- `candidateTaskIds`
- `conflictingTaskIds`
- `lastAssistantMessage`

原因：这些字段对后续增强有帮助，但不是当前“确认态恢复执行”的最小闭环必需项。

### 2. 封装状态读写接口

在 `services/ai/index.ts` 内部，或拆出独立状态模块，增加最小接口：

```typescript
loadSessionState(userId: number)
saveSessionState(userId: number, state: SessionState)
clearSessionState(userId: number)
```

目标是把“读最近一条 assistant 消息推断状态”改为“读取显式状态对象”。

### 3. `chat()` 入口优先处理状态态输入

在 `chat()` 方法开头增加一层状态分流：

```typescript
const state = await this.loadSessionState(userId);

if (state?.flowStatus === "awaiting_confirmation") {
  // 优先处理 确认 / 取消
}
```

只有当当前没有挂起状态，或用户输入不属于当前确认流程时，才继续进入现有 Agent Loop。

### 4. 在高风险 / 多步流程中写入状态

V1 只覆盖两个最值得显式化的流程：

#### 删除确认

当 `delete_task` 首次命中确认分支时，不仅返回 `need_confirmation`，还写入：

```typescript
{
  flowStatus: "awaiting_confirmation",
  actionKind: "delete_task",
  actionPayload: {
    taskId,
    taskTitle,
  },
}
```

#### 冲突后确认创建

当创建任务因为语义冲突或时间冲突进入确认态时，记录：

```typescript
{
  flowStatus: "awaiting_confirmation",
  actionKind: "create_task_after_conflict",
  actionPayload: {
    toolArgs,
  },
}
```

这样用户下一句 `"确认"` 时，可以直接继续执行原动作，而不是重新让 LLM 生成一次参数。

### 4.1 V1 暂不处理候选选择态

多候选任务选择（例如“找到 3 个任务，请回复第几个”）不纳入本次 V1 范围。

原因：

- 候选选择态除了状态本身，还会引入候选集映射和更新草稿参数恢复
- 实现复杂度明显高于确认态
- 当前更紧急的是先把删除确认和冲突确认创建这两个高频高风险路径做稳

### 5. 返回结构化交互信号

在 assistant 消息的 `payload` 中增加明确的交互元信息，供前端区分“普通追问”和“确认态消息”：

```typescript
payload: {
  interaction: {
    kind: "confirmation",
    action: "delete_task" | "create_task_after_conflict",
    confirmText: "确认",
    cancelText: "取消",
  }
}
```

这样后续的 `P1-02` / `P1-03` 不需要再用 `message.type === "question"` 粗略判断。

这里要明确：

- `question` 仍然只是消息渲染类型
- `payload.interaction.kind === "confirmation"` 才是“可显示确认按钮”的最小交互信号

因此像“请补结束时间”“请提供新的时间段”这类普通追问，依然可以是 `question`，但**不应**带 `interaction`。

### 6. 过期与清理策略

V1 只需要实现最小可用的生命周期：

- 新状态写入时覆盖同用户旧状态
- 成功确认 / 取消后清理状态
- 超过有效期后视为失效，不再继续执行挂起动作

## 涉及文件

- `packages/server/src/db/schema.ts` — 新增 AI 会话状态表（或等价结构）
- `packages/server/src/services/ai/index.ts` — 增加状态读写、入口状态分流、确认态处理
- 可选新建 `packages/server/src/services/ai-session-state.ts` — 抽离状态存储与解析逻辑

## 验收标准

- [ ] 删除确认不再依赖“上一条 assistant 文本匹配”来恢复流程
- [ ] 冲突后确认创建可基于已保存的 `toolArgs` 继续执行
- [ ] `"确认"` / `"取消"` 只有在显式挂起状态下才触发对应动作
- [ ] assistant 消息可通过结构化 `payload.interaction` 区分“确认态”与“普通追问”
- [ ] 状态在完成、取消、过期后可被正确清理
- [ ] V1 不引入候选选择态，范围聚焦在 `delete_task` 和 `create_task_after_conflict`

