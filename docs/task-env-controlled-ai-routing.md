# AI 单/多 Agent 环境变量切换任务

## 1. 背景

当前后端 `POST /api/ai/chat` 同时支持单 Agent 与 LangGraph 多 Agent，两者的切换方式依赖请求级参数：

- query: `?multi=true`
- header: `x-multi-agent: true`

这不符合当前部署策略。项目已确认采用以下运行策略：

- Cloudflare，尤其是免费层：强制走单 Agent，优先保证稳定性与响应流畅度
- 本地开发或普通 Node.js 服务器：允许启用 LangGraph 多 Agent

因此，需要把“单 Agent / 多 Agent”的选择权从前端请求移到后端运行时环境变量。

## 2. 已确认决策

### 2.1 切换方式

仅使用环境变量控制是否启用多 Agent。

建议变量名：

- `ENABLE_MULTI_AGENT`

### 2.2 语义

- `ENABLE_MULTI_AGENT=true`
  - `POST /api/ai/chat` 走 `MultiAgentService`
- `ENABLE_MULTI_AGENT=false`、未配置、空字符串、其他非法值
  - `POST /api/ai/chat` 走 `AIService`

### 2.3 明确不做的事

以下内容不在本任务范围内：

- 不保留前端 query/header 传参切换逻辑
- 不新增第二套多 Agent 实现
- 不引入 OpenAI 原生 SDK 多 Agent 分支
- 不引入 LangChain Deep Agents
- 不修改前端接口形态

## 3. 目标

实现一个后端运行时开关，使 AI 路由在不同部署环境下自动选择单 Agent 或多 Agent：

- Cloudflare 部署时，通过环境变量显式关闭多 Agent
- 本地 / Node.js 部署时，通过环境变量显式开启多 Agent

要求：

- 路由逻辑清晰
- 配置语义单一且可预测
- 不允许前端绕过环境配置
- 不改变现有响应结构

## 3.1 前端现状确认

已确认当前仓库中的前端调用 **没有** 传递多 Agent 控制参数：

- `packages/web/src/services/ai.api.ts`
  - 非流式请求直接调用 `POST /api/ai/chat`
  - 流式请求调用 `POST /api/ai/chat?stream=true`
  - 未传 `multi=true`
  - 未传 `x-multi-agent` header

结论：

- 当前任务 **不需要** 修改前端来移除多 Agent 切换参数
- 前端仍可保持现有接口调用方式
- 本任务的修复重点在后端路由与环境变量控制

## 4. 受影响文件

### 4.1 必改

1. `packages/server/src/types/bindings.ts`
   - 在 `Bindings` 中新增 `ENABLE_MULTI_AGENT?: string`

2. `packages/server/src/utils/env.ts`
   - 新增一个统一的环境变量解析函数，例如：
     - `isMultiAgentEnabled(env: Bindings): boolean`
   - 负责把字符串环境变量转换为布尔值
   - 推荐仅当值严格等于 `"true"` 时返回 `true`

3. `packages/server/src/routes/ai.routes.ts`
   - 删除当前请求级切换逻辑：
     - `c.req.query("multi") === "true"`
     - `c.req.header("x-multi-agent") === "true"`
   - 改为只依据环境变量判断是否走 `MultiAgentService`
   - 保持现有输入校验、时区处理、响应结构不变

### 4.2 建议修改

4. `packages/server/src/__tests__/ai.routes.test.ts`
   - 补充针对环境开关的路由测试
   - 至少覆盖以下场景：
     - `ENABLE_MULTI_AGENT=true` 时走多 Agent
     - `ENABLE_MULTI_AGENT=false` 时走单 Agent
     - 未配置时默认走单 Agent

5. `DEPLOY_CLOUDFLARE.md`
   - 增加 Cloudflare 环境变量配置说明
   - 明确 Cloudflare 免费层建议使用：
     - `ENABLE_MULTI_AGENT=false`

6. `README_CN.md` 或 `packages/server/README.md`
   - 增加本地 / Node.js 运行说明
   - 明确多 Agent 启用方式：
     - `ENABLE_MULTI_AGENT=true`

### 4.3 明确无需修改

7. `packages/web/src/services/ai.api.ts`
   - 当前不传多 Agent 控制参数
   - 本任务无需修改该文件
   - 仅保留现有 `stream=true` 行为

## 5. 实现要求

### 5.1 环境变量解析要求

- 不要在路由内散落字符串比较
- 统一在 `env.ts` 中做解析
- 推荐规则：

```ts
ENABLE_MULTI_AGENT === "true" -> true
其他情况 -> false
```

这样可以避免：

- `"TRUE"`、`"1"`、`"yes"` 等非约定值带来的歧义
- 不同文件各自实现布尔转换逻辑

### 5.2 路由要求

目标逻辑应等价于：

```ts
if (isMultiAgentEnabled(c.env)) {
  // MultiAgentService
} else {
  // AIService
}
```

要求：

- 不再读取 query `multi`
- 不再读取 header `x-multi-agent`
- 不新增新的请求级覆盖逻辑

### 5.3 兼容性要求

- 不改变 `/api/ai/chat` 的请求体格式
- 不改变成功响应结构
- 不改变错误响应结构
- 不修改 `MultiAgentService` 与 `AIService` 的对外接口

## 6. 验收标准

满足以下条件视为完成：

1. 后端存在统一的 `ENABLE_MULTI_AGENT` 开关解析逻辑
2. `POST /api/ai/chat` 不再依赖前端 query/header 决定 Agent 模式
3. `ENABLE_MULTI_AGENT=true` 时，聊天请求走多 Agent
4. `ENABLE_MULTI_AGENT=false` 或未配置时，聊天请求走单 Agent
5. Cloudflare 部署文档明确说明免费层关闭多 Agent
6. 本地 / Node.js 运行文档明确说明如何开启多 Agent
7. 针对路由分支的测试可通过

## 7. 测试要求

使用 `pnpm` 运行测试，不直接调用 `vitest`。

建议最少执行：

```powershell
pnpm -C packages/server test -- --run src/__tests__/ai.routes.test.ts
```

如有需要，可补充执行：

```powershell
pnpm -C packages/server test -- --run src/__tests__/multi-agent/integration/supervisor.test.ts
```

## 8. 实施清单

1. 在 `Bindings` 中加入 `ENABLE_MULTI_AGENT`
2. 在 `env.ts` 中新增布尔解析函数
3. 修改 `ai.routes.ts`，删除前端传参切换逻辑
4. 更新 `ai.routes.test.ts`，覆盖开关开启 / 关闭 / 未配置
5. 更新部署文档与运行说明
6. 运行最小必要测试并记录结果

## 9. 备注

- 本任务的目标是“按部署环境切换单 Agent 与多 Agent”，不是重构整个 AI 模块
- 当前 LangGraph 多 Agent 保留，作为普通 Node.js / 本地环境的增强能力
- Cloudflare 免费层优先稳定性，因此本任务不尝试让多 Agent 在免费层成为默认路径
