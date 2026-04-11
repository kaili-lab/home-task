# GPT Advice · 对 `doc-examples` 的补充审核意见

> 目的：这份文档不是重写 `doc-examples`，也不是逐句挑刺。
> 它只记录我认为**可能造成概念误解或实践误导**的地方，方便再交给 Claude 做二次审核。
>
> 总体评价：`doc-examples` 整体是有价值的，尤其适合让没有文档工程经验的人快速建立基本概念。真正需要修的主要集中在 **C4 Model** 和 **Living Spec** 两块；`Sequence Diagram` 和 `Diátaxis` 的方向基本稳。

---

## 0. 总结版结论

我对 `doc-examples` 的总体判断：

- **可以保留大部分内容**；
- `sequence-diagram` 示例基本没有方向性问题；
- `diataxis` 示例也比较稳，尤其是“保持内容纯粹，但通过链接导航”这个点讲得好；
- 需要重点修正的是：
  1. C4 的最小实践建议里，过早跳过 L2；
  2. C4 示例里有几个架构边界画错；
  3. Mermaid C4 的平台支持说得太满；
  4. Living Spec 的定义把 spec 的地位说得过于绝对；
  5. Living Spec 示例把“建议新增的文件/函数”写得像仓库里已经存在。

---

## 1. 问题一：C4 的“最小产出 = L1 + L3，跳过 L2”这个建议不够稳

### 我认为有问题的地方

在 `doc-examples/README.md` 里，C4 的最小产出写成：

- `L1 + L3 两张图`

并且后面建议：

- “先画 L1 和 L3，跳过 L2”

这个建议对当前项目的 AI chat 模块可能有局部合理性，因为 `packages/server/src/services/ai/` 确实已经复杂到值得画 L3。

但如果作为通用入门建议，我认为它不够稳。

### 为什么这是问题

C4 的四层里：

- **L1 Context**：系统和外部世界的关系
- **L2 Container**：系统内部有哪些可运行/可部署单元
- **L3 Component**：某个 container 内部由哪些组件构成
- **L4 Code**：代码级结构，通常不手画

对大多数 Web 项目来说，新人首先容易迷路的不是某个模块内部的 8 个文件怎么依赖，而是：

- 前端在哪里
- 后端在哪里
- 数据库在哪里
- 认证在哪里
- 哪些东西是外部服务
- 哪些东西是进程内库
- 哪些东西是部署单元

这些问题主要由 **L2 Container 图**回答。

如果直接从 L1 跳到 L3，新手可能会知道 `AgentLoop` 依赖 `ToolExecutor`，但还没有建立“Web App / API Server / Database / External Services”的边界意识。

### 更稳的改法

建议把通用建议改成：

- **通用最小组合：L1 + L2**
- **当某个模块已经复杂到难以靠目录结构理解时，再补 L3**

对当前项目可以补一句：

> 对 `home-task` 来说，AI chat 模块已经足够复杂，所以额外补一张 L3 是合理的。但这不代表所有中小项目都应该优先画 L3。

这样既不否定原文对 L3 的重视，也避免把“本项目局部经验”写成“通用规则”。

---

## 2. 问题二：C4 示例里有几个真实的架构边界错误

### 2.1 `Better Auth` 不应画成外部系统

在 `doc-examples/c4-model/README.md` 的 L1 示例里，`Better Auth` 被画成了：

```mermaid
System_Ext(auth, "Better Auth", "认证服务")
```

但结合当前仓库，`Better Auth` 是服务端应用内使用的认证库/认证模块，而不是外部 SaaS。

仓库里可以看到：

- `packages/server/src/auth/auth.ts` 里直接 `import { betterAuth } from "better-auth"`
- `packages/server/src/middleware/auth.middleware.ts` 在请求中创建 auth 实例
- `packages/server/src/db/schema.ts` 里定义 Better Auth 相关表

这说明它更像是 **API Server 内部能力**，不是外部系统。

### 为什么这是问题

C4 图里的边界非常重要。

如果把一个进程内库画成外部系统，会误导读者和 AI：

- 以为认证需要调用外部网络服务
- 以为认证服务有独立部署边界
- 以为认证模块和 API Server 是两个系统

这会影响后续架构判断，比如错误地设计网络调用、错误地考虑失败模式、错误地拆分部署单元。

### 更稳的改法

建议：

- L1 不画 `Better Auth` 这个外部系统；
- 如果要表达认证能力，可以在 L2 的 `API Server` 描述里写：
  - `Hono + Cloudflare Workers + Better Auth`
- 或者在更细的 L3 图里画：
  - `Auth Module`
  - `Auth Middleware`

---

### 2.2 `Drizzle ORM` 不应写进 Database container

在 `doc-examples/c4-model/README.md` 的 L2 示例里，Database 写成：

```mermaid
ContainerDb(db, "Database", "Neon PostgreSQL + Drizzle ORM", "tasks / users / messages")
```

这里也不准确。

`Neon PostgreSQL` 是数据库；`Drizzle ORM` 是 API Server 侧的数据访问库。

### 为什么这是问题

这会混淆：

- 运行时部署边界
- 技术栈归属
- 谁依赖谁

数据库 container 应该描述数据库本身，而不是把应用层 ORM 混进去。

### 更稳的改法

建议改成：

```mermaid
Container(server, "API Server", "Hono + Cloudflare Workers + Drizzle ORM", "业务逻辑、AI Agent、认证、数据访问")
ContainerDb(db, "Database", "Neon PostgreSQL", "tasks / users / messages")
```

这样边界更清楚。

---

## 3. 问题三：Mermaid C4 的平台支持说得太满

### 我认为有问题的地方

`doc-examples/c4-model/README.md` 里写：

> Mermaid C4 语法已内置于 GitHub / GitLab 渲染，零成本发布

这个说法我认为不够准确。

截至 **2026-04-11**：

- Mermaid 官方文档仍把 C4 标为 experimental；
- GitHub 官方文档明确支持 Mermaid 图，但并没有等价承诺“所有 Mermaid 实验语法都稳定可用”；
- GitLab 官方文档说明 GitLab.com 支持 Mermaid v10，但具体语法能力仍取决于平台版本。

所以，“平台支持 Mermaid”不能直接推出“平台稳定支持 Mermaid C4”。

### 为什么这是问题

这会让读者以为 C4 Mermaid 可以无脑使用。

但实际情况可能是：

- 本地预览能渲染，GitHub 不能渲染；
- GitHub 能渲染，自建 GitLab 不行；
- Mermaid 普通 sequence diagram 能渲染，C4 语法失败；
- 后续 Mermaid 升级导致 experimental 语法行为变化。

这类问题一旦出现，会直接打击文档可信度。

### 更稳的改法

建议把那句话改成：

> Mermaid 适合把架构图以文本形式放进仓库；但 C4 语法仍需注意平台和 Mermaid 版本兼容性。如果目标平台不稳定支持 Mermaid C4，可以使用 PlantUML、Structurizr，或导出静态图片。

这样既保留“docs-as-code”的价值，也不会过度承诺。

---

## 4. 问题四：Living Spec 的定义太绝对

### 我认为有问题的地方

`doc-examples/living-spec/README.md` 开头写：

> Living Spec 的核心思想：让规格说明（spec）成为唯一的真相来源，实现是它的“编译输出”。

这个说法太强了。

除非项目真的采用：

- formal specification
- executable specification
- code generation
- model-driven engineering
- 或严格的 spec-as-source 流程

否则大多数普通软件项目里，spec 并不是实现的“编译源代码”。

### 为什么这是问题

这个表达会把 Living Spec 的地位抬得过高。

现实工程里通常有几种不同层面的真相：

1. **设计意图 / 期望行为**
   - PRD
   - Rule Book
   - ADR
   - Living Spec

2. **实现真相**
   - 代码
   - 测试
   - 类型约束

3. **运行真相**
   - 线上行为
   - 日志
   - 用户实际遇到的结果

Living Spec 最适合承担的是：

- 行为意图的权威说明
- 规则和边界条件的设计锚点
- code review 时判断“代码是否偏离意图”的依据

但它不天然是“唯一真相”，更不天然让实现变成“编译输出”。

### 更稳的改法

建议改成：

> Living Spec 的核心思想，是让行为规格和代码一起住在仓库里、一起被 review、一起演化，成为代码之外最可信的设计锚点。

或者：

> Living Spec 不是把文档神圣化，而是降低规格与实现之间的漂移成本，让规格长期保持可被信任。

这两个说法更贴近普通工程实践。

---

## 5. 问题五：Living Spec 示例把“建议新增的文件/函数”写得像仓库既有事实

### 我认为有问题的地方

`doc-examples/living-spec/README.md` 的示例里写：

- 文件：`docs/spec/create-task-flow.md`
- 实现位置：`packages/server/src/services/ai/tool-executor.ts` → `executeCreateTask()`

但当前仓库里：

- 没有 `docs/spec/create-task-flow.md`
- 也没有独立的 `executeCreateTask()` 函数
- `create_task` 逻辑目前在 `ToolExecutor.executeToolCall()` 的 `case "create_task"` 分支里

### 为什么这是问题

如果这是“假设性示例”，没有问题。

但现在它写得像“本项目已经存在的 Living Spec 实例”，这会误导两类读者：

1. 人类读者会以为仓库里已经有 `docs/spec/create-task-flow.md`
2. AI 工具也可能在后续修改时引用不存在的 spec 文件或函数名

这类不准确的“项目实例”比普通概念错误更危险，因为它会直接污染 AI context。

### 更稳的改法

两种改法都可以：

#### 方案 A：明确标成“建议新增”

把示例开头改成：

> 以下是建议新增的 Living Spec 示例文件，并非当前仓库已经存在的文件。

并把实现位置写成：

> 当前实现位置：`packages/server/src/services/ai/tool-executor.ts` 的 `case "create_task"` 分支。

#### 方案 B：真的创建对应 spec 文件

如果你准备把这个方向落地，那就真的新增：

- `docs/spec/create-task-flow.md`

并且后续再考虑是否把 `create_task` 分支抽成独立函数，例如：

- `executeCreateTask()`

但如果只是文档示例，不建议暗示它已经存在。

---

## 6. 补充问题：AI 收益相关表述略满，需要收一点

### 我认为有问题的地方

`doc-examples/README.md` 里有几类表达偏满：

- “信息密度高，歧义为零”
- “错误依赖的概率大幅降低”
- “spec 的维护成本几乎为零”
- “投入一小时，AI 辅助编码的准确率和质量会有可见提升”

这些方向我同意，但措辞过于确定。

### 为什么这是问题

AI context 的质量确实重要，但它不是线性收益。

文档是否能提升 AI 输出质量，取决于：

- 文档是否准确；
- 文档是否足够短；
- 文档是否和当前任务相关；
- 文档是否和代码同步；
- 文档是否包含清晰的约束，而不是泛泛的解释；
- 是否把太多内容塞进 `CLAUDE.md` 导致噪音变多。

所以不能让读者形成“多写文档 = AI 一定更可靠”的预期。

### 更稳的改法

建议把语气改成：

- “通常能减少歧义”
- “可以降低错误依赖的概率”
- “维护成本会显著下降，但不会归零”
- “在文档准确且任务匹配时，通常能提升 AI 修改代码的稳定性”

这样更实践，也更不容易造成误解。

---

## 7. 我认为可以保留的部分

为了避免这份 review 看起来像全盘否定，这里明确写一下我认为原文里值得保留的内容。

### 7.1 Sequence Diagram 部分基本稳

`sequence-diagram` 对时序图价值的解释是对的：

- 它适合表达跨模块调用顺序；
- 适合表达 LLM → tool → LLM 这种循环；
- 不应该试图覆盖所有边界情况；
- Mermaid 形式对 AI 和人类都比较友好。

我唯一会收一点的是：

- 不要说“几乎唯一合适”
- 可以说“非常适合”

这样更稳。

### 7.2 Diátaxis 部分方向正确

`diataxis` 的核心是对的：

- Tutorial / How-to / Reference / Explanation 四类文档要区分；
- 文档不是互相隔离，而是通过链接导航；
- 不要把解释性内容混进操作步骤里打断读者；
- 新文档先分类，比立刻重构所有旧文档更现实。

这部分基本可以保留。

### 7.3 “最小组合”的方向是好的

`doc-examples/README.md` 最后提到的最小组合：

- 一张架构图
- 一张关键流程时序图
- 一个 living spec 文件

这个方向实用。

我只建议把“一张 C4 L3 图”改成更泛化的说法：

- 一张系统/模块架构图
- 对小项目优先 L1/L2
- 对复杂模块再补 L3

---

## 8. 建议 Claude 审核时重点看的问题

如果要让 Claude 再审核，我建议重点看这几个问题：

1. **C4 入门建议里，是否应该默认跳过 L2，还是更应该先画 L1 + L2？**
2. **当前项目里，`Better Auth` 是否应该画成外部系统？**
3. **`Drizzle ORM` 是否应该写进 Database container，还是应该归到 API Server 技术栈？**
4. **Mermaid C4 的 GitHub/GitLab 支持是否能被描述成“零成本发布”？**
5. **Living Spec 是否应该被定义成“唯一真相来源 / 实现是编译输出”？**
6. **`docs/spec/create-task-flow.md` 和 `executeCreateTask()` 这种示例是否应该明确标注为“建议新增”，而不是当前事实？**

---

## 9. 最后一句话总结

这组 `doc-examples` 的主要问题不是“方法论错了”，而是：

> **C4 部分要更尊重部署/运行边界，Living Spec 部分要避免把 spec 神圣化，AI 收益部分要把语气从“保证有效”收成“在条件满足时通常有效”。**

这样改完之后，这组文档会更可靠，也更适合作为后续给 AI 或人类读的工程方法示例。
