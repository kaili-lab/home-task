# ADR-0001: 单 / 多 Agent 的部署主线与维护策略

## Context

当前仓库同时存在两套 AI Chat 实现：

- 单 Agent：`packages/server/src/services/ai/`
- 多 Agent：`packages/server/src/services/multi-agent/`

两套实现并存不是临时过渡，而是由部署约束驱动：

- Cloudflare（尤其免费层）更强调稳定性和资源可控，单 Agent 路径更稳
- 本地开发或传统 Node.js 部署可启用多 Agent，以获得更强的编排能力

同时，AI 测试已在 2026-04-11（commit `8e3978e`）完成重组，单 Agent 路径已有可支撑重构的测试基线。

## Decision

从本 ADR 生效起，明确采用以下主线：

1. 单 Agent 是 Cloudflare 部署的主线路径，持续维护，不视为待退役遗留代码。
2. 多 Agent 是 Node / 本地部署的增强路径，通过环境变量 `ENABLE_MULTI_AGENT=true` 启用。
3. 运行时路由继续由后端环境变量控制，不恢复前端请求级切换参数。
4. 本轮重构仅覆盖单 Agent 模块（`services/ai`），不改动多 Agent 业务实现。

## Consequences

1. 与单 Agent 相关的复杂度治理（如 `AgentLoop` 与 `HallucinationGuard` 收敛）属于有效投资。
2. 多 Agent 相关优化不并入本轮任务，避免跨路径耦合与评审范围膨胀。
3. 单 / 多 Agent 的职责边界以部署类型为准，而非“新旧替换”关系。
4. 若未来调整主线策略，新增 ADR 覆盖本决策，不回改本文件。
