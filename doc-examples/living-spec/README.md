# Living Spec（活文档 / 活规格）

## 是什么 / 解决什么问题

Living Spec 的核心思想：**让行为规格和代码一起住在仓库里、一起被 review、一起演化，成为代码之外最可信的设计锚点。**

传统做法是需求写完就归档，代码改了文档不改，最终两者漂移。Living Spec 反过来：**spec 和代码住在同一个仓库，PR 改代码时同步更新 spec，review 时一起 review。**

**适合的场景：**
- 模块有复杂的业务规则，光看代码很难还原意图
- 规则经常变化（如 AI prompt 的行为约束）
- 希望文档永远反映代码的当前状态，而不是某个历史快照

**解决的问题：**
- 文档写了就过期，开发者不信任文档
- 新需求进来，不知道现有规则在哪、是否还有效
- AI agent 行为难以测试，需要一个"行为规格"作为对照基准

---

## Spec 里面应该写什么

Spec 的核心是**行为规则和决策理由**，不是数据结构或接口契约。

| 应该写 | 不应该写（放到别处）|
|--------|-------------------|
| 前置条件：什么情况下才能执行 | 函数签名、参数类型（→ TypeScript 类型定义）|
| 主流程：决策树和分支 | 字段的完整枚举值列表（→ Reference 文档）|
| 行为约束：边界和规则（为什么这样） | 实现细节：用哪个库、SQL 怎么写（→ 代码注释）|
| 已知边界情况：系统选择不处理的情况 | 通用错误处理（→ 代码本身）|
| 版本和同步状态：spec 是否还和代码对齐 | 部署配置（→ DevOps 文档）|

**最常见的混淆**：返回值结构写得像 API 文档，列出每个字段的类型。Spec 里的返回值只需说明**每种 status 代表什么语义**，不需要列出所有字段。

类比：Spec 是交通规则手册（右转要让行人，红灯不能走），API 文档是地图（这条路怎么走）。两者都需要，但内容完全不同。

---

## 配合 Sequence Diagram 使用

对于复杂模块（多个参与者、多个分支、状态变化），**Sequence Diagram 和 Living Spec 分工明确，组合使用效果最好**：

- **Sequence Diagram**：骨架——谁调用谁、调用顺序、每个分支走哪条路
- **Living Spec**：血肉——每个决策点的规则是什么、为什么这样、边界情况怎么处理

```
Sequence Diagram 中的一个 alt 分支：
    alt 语义冲突检测
        agent-loop ->> tool-executor: create_task
        tool-executor ->> conflict-detector: findSemanticConflicts()
        conflict-detector -->> tool-executor: 有冲突
        tool-executor -->> agent-loop: { status: "conflict" }
    end

↓ 对应 Living Spec 中的规则：
    - 相似度阈值：Dice coefficient ≥ 0.75
    - 检测范围：同一天的所有 pending 任务
    - 触发条件：skipSemanticConflictCheck 为 false 时
    - 为什么不自动合并：决策权交还给用户，而非 AI 自动处理
```

本项目 AI Chat 模块的 Sequence Diagram 见：[docs/Single-Agent设计文档.md → 第 4.2 节](../../docs/Single-Agent设计文档.md)

---

## 示例：create_task 流程的 Living Spec

> **说明**：以下是**建议新增**的 spec 示例，当前仓库中并不存在 `docs/spec/create-task-flow.md`。  
> 建议新增路径：`docs/spec/create-task-flow.md`  
> 原则：每次修改 `tool-executor.ts` 或 `agent-loop.ts` 中的 create 逻辑时，同步更新此文件。

---

### 功能：创建任务（create_task）

**版本**：v1.2  
**当前实现位置**：`packages/server/src/services/ai/tool-executor.ts` → `executeToolCall()` 中的 `case "create_task"` 分支  
**最后同步**：2026-04-11

---

#### 前置条件

| 条件 | 说明 |
|------|------|
| 用户已认证 | 由路由层保证，tool 内不重复校验 |
| `title` 已提供 | required 字段，LLM 必须传 |
| `dueDate` 格式正确 | YYYY-MM-DD，由参数校验层拦截 |

---

#### 主流程

```
1. 查询当天所有已有任务（query by dueDate）
2. 语义冲突检测
   - 将新任务 title 与已有任务 title 做语义相似度比较
   - 相似 → 返回 { status: "conflict", conflictingTasks }，不创建
3. 时间冲突检测（仅当新任务有 startTime + endTime 时）
   - 检查时间段是否与已有任务重叠
   - 重叠 → 返回 { status: "conflict", conflictingTasks }，不创建
4. 时间合理性校验（仅当任务日期为今天）
   - 时间段已过 → 返回 { status: "need_confirmation" }
5. 无冲突 → 写库 → 返回 { status: "success", task }
```

---

#### 返回值规格

| status | 含义 | payload |
|--------|------|---------|
| `success` | 任务已创建 | `task: TaskInfo` |
| `conflict` | 语义或时间冲突，未创建 | `conflictingTasks: TaskInfo[]` |
| `need_confirmation` | 时间已过，待用户确认 | `message: string` |
| `error` | 未预期错误 | `message: string` |

---

#### 行为约束（Constraints）

- 冲突时**不创建**任务，将决策权交还给用户（通过 LLM 追问）
- 语义冲突检测范围：同一天的所有 pending 任务
- 时间冲突检测仅限**具体时间模式**（有 startTime + endTime）；timeSegment 模式不做时间冲突检测
- 用户通过 AI 对话确认后，下次调用时 `skipSemanticConflictCheck: true` 传入，跳过语义检测

---

#### 已知边界情况

| 情况 | 当前行为 | 备注 |
|------|---------|------|
| 用户给出过去的时间段 | 返回 need_confirmation | 不自动纠正 |
| groupId 不合法 | 返回 error | 权限校验在 executor 内 |
| 同名任务不同日期 | 不视为冲突 | 语义检测范围限当天 |

---

## 使用建议

- Living Spec 不是所有模块都需要，**优先用在行为规则复杂、经常变化的模块**（AI prompt、支付流程、权限系统）
- 文件头写清楚"实现位置"和"最后同步日期"，方便判断是否过期
- 可以用 GitHub Actions 检测 spec 文件和对应代码文件的最后修改日期，差距太大时发出提醒
- **复杂模块必须配 Sequence Diagram**：在 spec 文件顶部直接贴链接，让读者先看流程骨架再读规则
- **写 spec 时的自我检查**：如果一句话可以从函数签名或 TypeScript 类型里直接读到，就不需要写进 spec——spec 说的是代码本身无法表达的**意图和约束**
