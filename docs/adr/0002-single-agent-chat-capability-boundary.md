# ADR-0002: Single-Agent Chat 能力边界（移除更新/删除执行）

## Context

在单 Agent 路径中，历史实现允许 AI Chat 直接执行任务更新与删除。实际使用中，这两类动作需要多轮确认、候选定位与二次确认，交互成本高，且容易与“聊天即执行”的预期产生偏差。

同时，产品侧已具备任务列表界面，更新与删除在 UI 中可更稳定地完成，且确认语义更明确。

## Decision

从本 ADR 生效起，单 Agent 的 AI Chat 执行能力收敛为：

1. 保留：`create_task`、`query_tasks`、`complete_task`。
2. 移除：`update_task`、`delete_task` 的聊天内执行路径。
3. 对“修改/删除”用户意图，Agent 不进入工具执行流程，直接返回“请到任务列表操作”的引导文本。
4. 设计文档、Prompt 规则、测试用例必须与该边界一致。

## Consequences

1. AI Chat 的职责更聚焦，减少高风险写操作分支与确认状态复杂度。
2. 任务修改/删除责任回归任务列表 UI，交互一致性更高。
3. `AgentLoop` 与 `HallucinationGuard` 的意图路由需维持该边界，防止误触发工具调用。
4. 若未来恢复聊天内更新/删除，需新增 ADR 明确回滚条件与安全策略。
