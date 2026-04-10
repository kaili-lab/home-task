# tasks 任务清单评估：待讨论问题

> 目的：先把我认为当前 `tasks/` 里最值得讨论的问题列出来，只写“问题是什么”以及“为什么它是问题”，方便后续逐条讨论。
> 范围：仅针对 `tasks/` 这批单 Agent 改进任务的设计合理性，不评价实现质量。

---

## 问题 1：缺少显式 `session state` / `approval state` 任务

### 问题是什么

当前任务清单里没有一个独立任务，专门把“等待确认”“待删除目标”“候选任务列表”“当前流程阶段”等状态，从消息文本里剥离出来，变成显式状态。

### 为什么这是问题

1. 现在很多确认逻辑仍然依赖“读取上一条 assistant 消息 + 匹配用户确认词”，这本质上是把状态埋在自然语言里。
2. 这种做法短期能跑，但后续一旦接入前端按钮、流式返回、摘要压缩，就容易出现状态漂移。
3. 你在学习地图里已经明确指出：当前项目优先应该先补显式 `session state`，再补 `summary`；但任务清单没有把这件事单独前置。

### 关联任务

- `tasks/P0-04-delete-confirmation.md`
- `tasks/P1-02-confirm-button-ui.md`
- `tasks/P1-03-confirm-button-integration.md`
- `tasks/P2-07-model-routing-and-summarization.md`

---

## 问题 2：`summary` 的位置偏后，而且和模型路由绑在同一个任务里

### 问题是什么

`P2-07` 把“模型分层路由”和“会话摘要”放在同一个任务里，而且整体排在很后面。

### 为什么这是问题

1. 这两件事不是一个层面的问题：模型路由偏成本/能力策略，`summary` 偏上下文管理。
2. 当前项目更紧迫的不是“选哪个模型”，而是“上下文是否稳定可控”。
3. 如果没有先把 `session state` 和 `context builder` 做出来，直接上摘要，很容易把关键确认态和候选态压坏。
4. 从学习路线看，`summary` 应该属于较早补齐的上下文层，而不是拖到很后面的可选优化项。

### 关联任务

- `tasks/P2-03-token-counting.md`
- `tasks/P2-07-model-routing-and-summarization.md`

---

## 问题 3：确认按钮的显示条件过粗，`question` 不等于“确认态”

### 问题是什么

`P1-02` / `P1-03` 目前是按“最新的 `question` 类型消息”来显示“确认创建 / 取消”按钮。

### 为什么这是问题

1. 当前系统里的 `question` 不只代表“请确认”，也可能代表普通追问、补充信息、时间澄清。
2. 如果只按 `question` 渲染确认按钮，UI 可能在不该出现按钮的场景出现错误交互。
3. 这说明前端交互闭环缺少更明确的后端状态信号，例如 `confirmationKind`、`pendingAction` 或结构化 payload 标记。

### 关联任务

- `tasks/P1-02-confirm-button-ui.md`
- `tasks/P1-03-confirm-button-integration.md`

---

## 问题 4：删除确认方案仍然是“消息文本驱动”，不够稳

### 问题是什么

`P0-04` 计划新增 `shouldSkipDeleteConfirmation()`，但核心判断仍然是：

- 上一条 assistant 是否像删除确认文案
- 当前用户消息是否像“确认”

### 为什么这是问题

1. 这仍然不是显式状态，而是“从文本倒推状态”。
2. 一旦确认文案改写、前端按钮发送不同文本、后续做摘要压缩，判断逻辑就会变脆。
3. 删除属于高风险动作，理论上更适合绑定明确的 `approval state`，而不是继续复用文本匹配技巧。

### 关联任务

- `tasks/P0-04-delete-confirmation.md`

---

## 问题 5：限流和并发锁都采用内存级方案，与部署现实不完全匹配

### 问题是什么

`P0-07` 和 `P2-05` 都以进程内 `Map` 为核心，分别做 rate limit 和 per-user lock。

### 为什么这是问题

1. 项目当前仍保留 Cloudflare Workers 路径，而 Workers 天然不是共享内存模型。
2. 在这种环境里，内存级方案只能算“单实例内有效”，不能被误认为真正的生产级防护。
3. 如果任务标题是“用户级限流”“并发互斥”，但底层方案只在单 isolate 内生效，就需要在任务目标里把边界说得更明确。
4. 否则后面讨论“是否已经具备生产能力”时，会出现认知偏差。

### 关联任务

- `tasks/P0-07-rate-limiter.md`
- `tasks/P2-05-concurrent-lock.md`

---

## 问题 6：流式方案没有明确多 Agent 分支和降级策略

### 问题是什么

`P0-01` ~ `P0-03` 主要围绕单 Agent 的 `AIService.chatStream()` 设计，但当前 `/api/ai/chat` 路由已经支持按环境变量切换到 `MultiAgentService`。

### 为什么这是问题

1. 现在任务文档没有明确：当 `ENABLE_MULTI_AGENT=true` 且前端传 `stream=true` 时，系统应该怎么处理。
2. 如果只给单 Agent 加流式，而多 Agent 分支仍是一次性响应，就会出现接口行为不一致。
3. 这不一定必须现在就支持多 Agent 流式，但需要写清楚“单 Agent 支持、多 Agent 暂不支持并自动降级”还是“统一不开放”。

### 关联任务

- `tasks/P0-01-streaming-backend.md`
- `tasks/P0-02-streaming-route.md`
- `tasks/P0-03-streaming-frontend.md`

---

## 问题 7：缺少“请求幂等 / 去重”任务，但它比输入过滤更贴近真实风险

### 问题是什么

当前任务清单里有 `P2-04` 输入过滤，也有并发锁，但没有一个明确任务处理“用户重复点击 / 网络重试 / 前端重发导致重复创建任务”的幂等问题。

### 为什么这是问题

1. 对任务系统来说，重复创建、重复删除、重复完成，往往比 prompt injection 更常见。
2. 你自己的路线图里已经把“approval / error taxonomy / 幂等”列为可靠性层缺口，但 `tasks/` 里没有对应任务。
3. 只做并发锁并不能覆盖顺序重试、浏览器刷新后重发、弱网重复提交这些场景。

### 关联任务

- `tasks/P2-04-input-filter.md`
- `tasks/P2-05-concurrent-lock.md`

---

## 问题 8：测试任务与服务拆分任务的顺序，可能导致返工

### 问题是什么

`P1-08` 计划先通过访问 private 方法补测试，`P2-01` / `P2-02` 又计划很快拆分 `services/ai/index.ts`。

### 为什么这是问题

1. 如果测试大量绑定旧的 private 方法名和旧类结构，后面拆分时很容易整体迁移一遍。
2. 这样能短期补回测试数量，但不一定能积累“拆分后仍稳定复用”的测试资产。
3. 更理想的方式可能是：先补少量关键回归测试兜底，再把更多测试放到拆分出的纯函数模块上。

### 关联任务

- `tasks/P1-08-unit-tests.md`
- `tasks/P1-09-integration-tests.md`
- `tasks/P2-01-split-extract-modules.md`
- `tasks/P2-02-split-reassemble.md`

---

## 当前建议

如果后面要逐条讨论，我建议优先顺序是：

1. 问题 1：`session state` / `approval state`
2. 问题 3：确认按钮的状态定义
3. 问题 4：删除确认机制
4. 问题 6：流式与多 Agent 的边界
5. 问题 5：限流 / 并发锁的部署边界
6. 问题 7：幂等 / 去重
7. 问题 2：`summary` 与模型路由的拆分
8. 问题 8：测试与拆分顺序

