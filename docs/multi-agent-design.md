# 多 Agent 系统设计文档

## 1. 背景与目标

### 1.1 背景

当前项目的 AI 功能由单 Agent 实现（`ai.service.ts`，约 1400 行），所有逻辑集中在一个文件：LLM 调用、Tool 执行、时间校验、冲突检测、意图推断、对话历史管理。随着功能扩展（日历、天气、通知提醒），单 Agent 模式已到达复杂度天花板。

同时，项目计划从 Cloudflare Workers（Serverless）迁移到传统 Node.js 部署，解除了 bundle 体积和运行时兼容性的限制，可以使用 LangGraph 的完整能力。

### 1.2 目标

1. **功能目标**：在现有任务管理基础上，新增日历视图、天气查询、智能通知提醒功能
2. **架构目标**：使用 LangGraph 实现 Supervisor + SubAgent 多 Agent 架构
3. **学习目标**：关键代码逻辑需要用注释说明 LangGraph 概念，便于学习
4. **兼容目标**：现有单 Agent 代码（`ai.service.ts`）保留不动，新模块并列存在

### 1.3 不在范围内

- 现有 `ai.service.ts` 的修改或删除
- 移动端 / 显示屏端的适配
- 真实的短信/邮件通知发送（暂用控制台输出代替）
- 定时调度器（cron job）的实现（通知 Agent 只负责安排提醒，不负责触发）

---

## 2. 架构设计

### 2.1 总体架构

```
                    ┌──────────────────────────────────┐
                    │        Supervisor Agent           │
                    │  (createSupervisor)               │
                    │  理解意图 → 分发子 Agent → 汇总结果  │
                    └──────┬───────┬───────┬──────┬─────┘
                           │       │       │      │
                    ┌──────▼──┐ ┌──▼────┐ ┌▼────┐ ┌▼──────────┐
                    │  Task   │ │Calendar│ │Weather│ │Notification│
                    │  Agent  │ │ Agent  │ │Agent │ │  Agent     │
                    └────┬────┘ └───┬────┘ └──┬──┘ └─────┬──────┘
                         │         │         │           │
                    ┌────▼────┐ ┌──▼───┐ ┌───▼──┐ ┌─────▼─────┐
                    │TaskService│ │TaskService│ │Weather│ │reminders 表│
                    │(DB)     │ │(DB聚合) │ │ API  │ │ (DB)      │
                    └─────────┘ └───────┘ └──────┘ └───────────┘
```

### 2.2 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| Agent 框架 | `@langchain/langgraph` | 核心图引擎，StateGraph / createReactAgent |
| 多 Agent 编排 | `@langchain/langgraph-supervisor` | Supervisor 模式，createSupervisor |
| Tool Schema | `zod` + `@langchain/core/tools` | 类型安全的 Tool 定义 |
| LLM | `@langchain/openai` (ChatOpenAI) | 支持 OpenAI / AIHubMix 中转 |
| 状态持久化 | `MemorySaver`（开发阶段） | 后续可切 PostgresSaver |
| 部署 | 传统 Node.js | 不再受 Cloudflare Workers 限制 |

### 2.3 目录结构

```
packages/server/src/
├── services/
│   ├── ai.service.ts                 ← 保留，遗留单 Agent（不动）
│   ├── task.service.ts               ← 保留，多 Agent 复用
│   │
│   └── multi-agent/                  ← 全新模块
│       ├── index.ts                  ← 对外入口（MultiAgentService）
│       ├── supervisor.ts             ← Supervisor 编排层
│       ├── agents/
│       │   ├── task.agent.ts         ← 任务 Agent
│       │   ├── calendar.agent.ts     ← 日历 Agent
│       │   ├── weather.agent.ts      ← 天气 Agent
│       │   └── notification.agent.ts ← 通知 Agent
│       ├── tools/
│       │   ├── task.tools.ts         ← 任务相关 tools
│       │   ├── calendar.tools.ts     ← 日历相关 tools
│       │   ├── weather.tools.ts      ← 天气相关 tools
│       │   └── notification.tools.ts ← 通知相关 tools
│       ├── utils/
│       │   ├── time.helpers.ts       ← 时间处理函数
│       │   ├── conflict.helpers.ts   ← 冲突检测函数
│       │   └── llm.factory.ts        ← LLM 创建工厂
│       └── types.ts                  ← 多 Agent 内部类型
```

### 2.4 与现有系统的关系

- **复用**：`TaskService`（数据库操作）、`db/schema.ts`（表结构）、`shared` 包的类型定义
- **并列**：`ai.service.ts` 和 `multi-agent/` 并存，通过路由层开关切换
- **新增**：`reminders` 表（通知 Agent 的数据存储）

---

## 3. Agent 详细设计

### 3.1 Supervisor Agent

**职责**：理解用户意图，分发给对应子 Agent，汇总多个 Agent 的结果返回用户。

**框架**：`createSupervisor`（`@langchain/langgraph-supervisor`）

**Prompt 设计原则**：
- 只负责意图路由，不包含任何业务规则
- 描述每个子 Agent 的能力边界，让 LLM 决定分发

**Prompt 内容**（草案）：
```
你是一个智能助手的调度中心，负责将用户请求分发给合适的专家。

可用专家：
- task_agent：处理任务的创建、查询、修改、完成、删除
- calendar_agent：查看日程安排、查找空闲时间
- weather_agent：查询天气信息
- notification_agent：安排任务提醒

分发规则：
- 涉及任务操作 → task_agent
- 询问日程/时间安排/是否有空 → calendar_agent
- 询问天气 → weather_agent
- 涉及提醒/通知 → notification_agent
- 复合请求（如"周末去机场接人"）→ 依次分发给相关专家
- 非以上范围 → 礼貌告知只能处理任务和日程相关需求

回复规范：使用中文，简洁友好。
```

**跨 Agent 协作**：Supervisor 可以在一次请求中分发给多个 Agent，然后汇总结果。例如"周末早上去机场接人"同时触发 Task + Weather + Notification。

### 3.2 Task Agent

**职责**：处理任务的全生命周期管理。

**框架**：`createReactAgent`

**Prompt 设计原则**：
- 只负责从自然语言中提取 Tool 参数
- 不包含冲突检测规则、时间已过规则 — 这些全在 Tool 代码中
- 提供当前上下文（今天日期、当前时段、用户群组）

**Tools**（按用户意图封装）：

| Tool | 意图 | 参数 | 内部逻辑 |
|------|------|------|---------|
| `create_task` | 安排一件事 | title, dueDate?, startTime?, endTime?, timeSegment?, priority?, groupId?, description? | 时间校验 + 冲突检测（语义+时间） + 创建 |
| `query_tasks` | 查看安排 | status?, dueDate?, priority? | 查询并格式化返回 |
| `modify_task` | 改一下安排 | title?, taskId?, ...更新字段 | 按标题模糊查找或按ID → 更新 |
| `finish_task` | 事情做完了 | title?, taskId? | 按标题模糊查找或按ID → 标记完成 |
| `remove_task` | 不做了 | title?, taskId? | 按标题模糊查找或按ID → 删除 |

**模糊查找逻辑**（`modify_task`、`finish_task`、`remove_task` 共用）：
1. 优先使用 taskId（如果提供）
2. 否则按 title 模糊搜索当天 pending 任务
3. 匹配到唯一任务 → 直接执行
4. 匹配到多个 → 返回候选列表，让用户选择
5. 匹配到 0 个 → 返回"未找到匹配任务"

**返回类型**：统一的 `ToolResult` 结构化对象（status + message + task? + conflictingTasks?）

### 3.3 Calendar Agent

**职责**：提供时间维度的全局视图，与 Task Agent 的区别是"看全局"而非"操作单个"。

**框架**：`createReactAgent`

**Tools**：

| Tool | 意图 | 参数 | 内部逻辑 |
|------|------|------|---------|
| `get_day_schedule` | 看某天的安排 | date | 查询该日所有任务，按时间排序返回时间线 |
| `find_free_slots` | 找空闲时间 | date, startHour?(默认9), endHour?(默认18) | 查询已有任务，计算空闲区间 |

**数据源**：复用 `TaskService.getTasks()`，聚合时间数据。

### 3.4 Weather Agent

**职责**：查询天气信息。最简 Agent，独立外部数据源。

**框架**：`createReactAgent`

**Tools**：

| Tool | 意图 | 参数 | 内部逻辑 |
|------|------|------|---------|
| `get_weather` | 查天气 | city, date | 调用外部天气 API → 返回温度、天气状况、建议 |

**外部 API**：开发阶段使用 mock 数据，后续接入和风天气或 OpenWeatherMap。

**返回示例**：
```json
{
  "status": "success",
  "message": "北京 2026-02-14 天气：小雨，气温 2-8°C，建议携带雨具",
  "data": {
    "city": "北京",
    "date": "2026-02-14",
    "condition": "小雨",
    "tempMin": 2,
    "tempMax": 8,
    "suggestion": "建议携带雨具"
  }
}
```

### 3.5 Notification Agent

**职责**：跨 Agent 信息聚合，决定何时、如何通知用户。

**框架**：`createReactAgent`

**Tools**：

| Tool | 意图 | 参数 | 内部逻辑 |
|------|------|------|---------|
| `schedule_reminder` | 安排提醒 | taskId, taskTitle, taskDate, taskTime?, weatherInfo? | 计算提醒时间 + 生成提醒内容 + 写入 reminders 表 |
| `list_reminders` | 查看提醒 | userId, date? | 查询已有提醒 |
| `cancel_reminder` | 取消提醒 | reminderId | 标记提醒为已取消 |

**提醒时间计算规则**（Tool 内部，不由 LLM 决定）：
- 跨天任务（如后天的任务）→ 任务前一天 20:00 提醒
- 当天有具体时间的任务 → 提前 2 小时提醒
- 当天无具体时间的任务 → 当天 08:00 提醒

**提醒内容生成规则**：
- 基础内容：任务标题 + 时间
- 如果有天气信息且天气异常（雨/雪/极端温度）→ 附加天气建议
- 示例："明天早上去机场接人，天气预报有雨，记得带伞"

**数据存储**：新建 `reminders` 表

```sql
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id),
  taskId INTEGER REFERENCES tasks(id),
  remindAt TIMESTAMP WITH TIME ZONE NOT NULL,  -- 提醒触发时间
  content TEXT NOT NULL,                        -- 提醒内容
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / sent / cancelled
  channel VARCHAR(20) NOT NULL DEFAULT 'console', -- console / sms / email
  createdAt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**执行机制**：
- 本次实现：`schedule_reminder` 写入数据库 + 输出到控制台
- 将来扩展：外部调度器（cron）扫描 `reminders` 表，到达 `remindAt` 时间时调用通知接口

---

## 4. 跨 Agent 协作场景

### 4.1 场景：周末早上去机场接人

```
用户："周末早上去机场接人"

Supervisor 分析意图：
  1. 创建任务 → Task Agent
  2. 涉及出行+未来日期 → Weather Agent（查天气）
  3. 未来任务 → Notification Agent（安排提醒）

执行流程：
  Step 1: Task Agent
    → create_task({ title: "去机场接人", dueDate: "2026-02-14", timeSegment: "morning" })
    → 返回: { status: "success", task: { id: 100, ... } }

  Step 2: Weather Agent
    → get_weather({ city: "用户所在城市", date: "2026-02-14" })
    → 返回: { status: "success", data: { condition: "小雨", suggestion: "建议携带雨具" } }

  Step 3: Notification Agent
    → schedule_reminder({
        taskId: 100,
        taskTitle: "去机场接人",
        taskDate: "2026-02-14",
        taskTime: "morning",
        weatherInfo: "小雨，建议携带雨具"
      })
    → 返回: { status: "success", message: "已安排 2026-02-13 20:00 提醒" }

Supervisor 汇总回复：
  "已创建任务「去机场接人」（周六早上）。
   天气预报显示周六有小雨，我会在周五晚上提醒你，届时也会提醒你带伞。"
```

### 4.2 场景：明天下午有空吗

```
用户："明天下午有空吗"

Supervisor → Calendar Agent
  → find_free_slots({ date: "2026-02-12", startHour: 14, endHour: 18 })
  → 返回: { freeSlots: [{ start: "14:00", end: "15:30" }, { start: "16:00", end: "18:00" }] }

Supervisor 回复：
  "明天下午你有两个空闲时间段：14:00-15:30 和 16:00-18:00。"
```

### 4.3 场景：完成写周报

```
用户："完成写周报"

Supervisor → Task Agent
  → finish_task({ title: "写周报" })
  → Tool 内部：按标题搜索 → 找到唯一匹配 → 标记完成
  → 返回: { status: "success", task: { title: "写周报", status: "completed" } }

Supervisor 回复：
  "任务「写周报」已标记为完成。"
```

---

## 5. Tool 设计原则

遵循 `docs/agent-design-principle.md` 中的核心原则：

### 5.1 按用户意图封装

- 一个意图 = 一个 Tool
- Tool 内部可包含多个步骤（校验 → 查找 → 执行 → 返回）
- 不让 LLM 编排多个 Tool 来完成一个意图

### 5.2 System Prompt 与 Tool 的职责分离

| 层 | 职责 | 示例 |
|----|------|------|
| Supervisor Prompt | 意图路由 | "涉及任务操作 → task_agent" |
| Agent Prompt | 参数提取指导 | "title 是简洁的动作短语" |
| Tool 代码 | 精确校验 + 业务逻辑 | 时间已过检测、冲突检测、模糊匹配 |

**绝不在 Prompt 中写的内容**：
- 冲突检测流程
- 时间已过规则
- 模糊匹配逻辑
- 提醒时间计算规则

### 5.3 Tool Description 写作规范

每个 Tool 的 description 包含：
1. **适用意图**：用户可能的表达方式
2. **功能说明**：Tool 内部会自动处理的事情
3. **不适用于**：明确边界
4. **参数指导**：告诉 LLM 怎么填参数

### 5.4 结构化返回

所有 Tool 统一返回 `ToolResult`：

```typescript
interface ToolResult {
  status: "success" | "conflict" | "need_confirmation" | "error";
  message: string;
  task?: TaskInfo;
  conflictingTasks?: TaskInfo[];
  data?: Record<string, unknown>;  // 各 Agent 特有的数据
}
```

---

## 6. 测试策略

### 6.1 三层测试架构

```
┌─────────────────────────────────────────────┐
│ Layer 3: Eval 评测（真实 LLM，可选，分钟级）    │
│ 验证：端到端对话质量、Prompt 回归               │
├─────────────────────────────────────────────┤
│ Layer 2: Graph 级集成测试（Mock LLM，秒级）     │
│ 验证：Agent 图的节点路由、Supervisor 分发       │
├─────────────────────────────────────────────┤
│ Layer 1: Node 级单元测试（无 LLM，毫秒级）      │
│ 验证：Tool 逻辑、时间处理、冲突检测             │
└─────────────────────────────────────────────┘
```

### 6.2 Layer 1: Node 级单元测试

**特点**：不涉及 LLM，纯函数/纯逻辑测试，确定性，毫秒级。

#### 6.2.1 时间处理（time.helpers.ts）

**正常 Case：**
- `inferTimeSegmentFromText("下午")` → `afternoon`
- `parseTimeToMinutes("14:30")` → `870`
- `isTodayDate("2026-02-11")` 在今天 → `true`
- `getCurrentTimeSegment()` 在 14:00 → `afternoon`
- `getDefaultTimeSegmentForDate(today)` 晚上 → `evening`

**异常 Case：**
- `inferTimeSegmentFromText("")` → `all_day`（默认）
- `parseTimeToMinutes("25:00")` → `null`（无效时间）
- `parseTimeToMinutes(null)` → `null`
- `isTodayDate(null)` → `false`
- `isSegmentAllowedForToday(today, "morning")` 当前晚上 → `false`（边界）

#### 6.2.2 冲突检测（conflict.helpers.ts）

**正常 Case：**
- 14:00-15:00 vs 14:30-15:30 → 时间冲突
- 14:00-15:00 vs 15:00-16:00 → 无冲突（边界不重叠）
- "取快递" vs "拿快递" → 语义冲突（dice ≥ 0.75）
- "取快递" vs "开会" → 无语义冲突

**异常 Case：**
- 空任务列表 → 无冲突
- 标题为空 → 无冲突
- 单字标题 → bigram 退化处理，直接比较

#### 6.2.3 Task Tools（Mock DB）

**正常 Case：**
- `create_task` 完整参数 → `{ status: "success", task: {...} }`
- `create_task` 无时间信息 → 自动填充默认 timeSegment
- `finish_task({ title: "写周报" })` 匹配到 1 个 → 直接完成
- `query_tasks({ dueDate: "2026-02-11" })` → 返回任务列表
- `modify_task({ title: "开会", dueDate: "2026-02-13" })` 匹配到 1 个 → 直接更新

**异常 Case：**
- `create_task` 今天 + 时段已过 → `{ status: "need_confirmation" }`
- `create_task` 语义冲突 → `{ status: "conflict", conflictingTasks: [...] }`
- `create_task` 时间冲突 → `{ status: "conflict" }`
- `finish_task({ title: "写周报" })` 匹配到 0 个 → `{ status: "error", message: "未找到" }`
- `finish_task({ title: "开会" })` 匹配到 3 个 → `{ status: "need_confirmation", message: "找到多个候选..." }`
- `remove_task` 无 taskId 也无 title → `{ status: "error" }`

#### 6.2.4 Calendar Tools（Mock DB）

**正常 Case：**
- 某天有 3 个任务 → `get_day_schedule` 返回按时间排序的时间线
- 9-18 点有 2 个任务 → `find_free_slots` 返回 3 个空闲区间

**异常 Case：**
- 某天无任务 → 返回"当天没有安排"
- 全天排满 → 返回"当天没有空闲时间"
- 无效日期 → 返回错误

#### 6.2.5 Weather Tools（Mock API）

**正常 Case：**
- 查北京明天天气 → 返回温度、天气、建议

**异常 Case：**
- API 超时 → `{ status: "error", message: "天气服务暂时不可用" }`
- 城市无法识别 → `{ status: "error", message: "未识别的城市" }`

#### 6.2.6 Notification Tools（Mock DB）

**正常 Case：**
- 跨天任务 → 提醒时间 = 前一天 20:00
- 当天任务有具体时间 → 提醒时间 = 提前 2 小时
- 有雨天气 → 提醒内容包含"带伞"

**异常 Case：**
- 已过去的任务 → 不安排提醒，返回提示
- 天气信息缺失 → 只发任务提醒，不含天气建议
- 当天任务无具体时间 → 当天 08:00 提醒

### 6.3 Layer 2: Graph 级集成测试

**特点**：Mock LLM（注入固定的 tool call 响应），验证图的节点路由和状态传递。

**Supervisor 路由测试：**

| 输入 | 期望路由 |
|------|---------|
| "帮我创建一个任务，明天去买菜" | → Task Agent |
| "明天下午有空吗" | → Calendar Agent |
| "明天天气怎么样" | → Weather Agent |
| "讲个笑话" | → 直接拒绝，不路由到任何 Agent |
| "周末早上去机场接人" | → Task Agent + Weather Agent + Notification Agent |

**单 Agent 图执行测试：**
- Task Agent：Mock LLM 调用 `create_task` → 验证 Tool 执行 → 验证状态更新 → 验证最终输出
- Calendar Agent：Mock LLM 调用 `find_free_slots` → 验证返回空闲时间段
- Weather Agent：Mock LLM 调用 `get_weather` → 验证 Mock API 数据返回

**错误处理测试：**
- 子 Agent 抛出异常 → Supervisor 捕获并返回友好错误
- Tool 执行失败 → Agent 返回错误状态，不崩溃
- LLM 连续调用超过上限 → 兜底返回

### 6.4 Layer 3: Eval 评测

**特点**：真实 LLM，少量核心场景，验证端到端对话质量。CI 中作为可选步骤，失败不阻塞。

| 场景 | 验收标准 |
|------|---------|
| "帮我创建一个任务，明天去买菜" | type = task_summary，task 存在 |
| "完成写周报" | 调用了 finish_task 而非 create_task |
| "明天下午有空吗" | 路由到 Calendar Agent，返回空闲时间 |
| "明天天气怎么样" | 路由到 Weather Agent，返回天气信息 |
| "周末早上去机场接人" | Task + Notification + Weather 三者都被触发 |
| "给我讲个笑话" | 礼貌拒绝，不调用任何 Tool |

### 6.5 测试文件结构

```
packages/server/src/__tests__/multi-agent/
├── unit/
│   ├── time.helpers.test.ts
│   ├── conflict.helpers.test.ts
│   ├── task.tools.test.ts
│   ├── calendar.tools.test.ts
│   ├── weather.tools.test.ts
│   └── notification.tools.test.ts
├── integration/
│   ├── task.agent.test.ts
│   ├── calendar.agent.test.ts
│   ├── weather.agent.test.ts
│   ├── notification.agent.test.ts
│   └── supervisor.test.ts
└── eval/
    └── multi-agent.eval.test.ts
```

---

## 7. 实施计划

### Phase 1: 基础设施搭建

- 安装依赖：`@langchain/langgraph`、`@langchain/langgraph-supervisor`、`zod`
- 创建 `multi-agent/` 目录结构
- 从 `ai.service.ts` 提取 `time.helpers.ts` 和 `conflict.helpers.ts`（纯函数，不修改原文件）
- 创建 `llm.factory.ts`（LLM 创建工厂）
- 创建 `types.ts`（ToolResult 等共享类型）
- 编写 `time.helpers.test.ts` 和 `conflict.helpers.test.ts` 单元测试

### Phase 2: Task Agent

- 用 zod 定义 5 个 Tool（create_task、query_tasks、modify_task、finish_task、remove_task）
- 实现 Tool 内部逻辑（复用 TaskService）
- 实现 `modify_task`/`finish_task`/`remove_task` 的标题模糊查找
- 用 `createReactAgent` 创建 Task Agent
- 编写 `task.tools.test.ts`（Node 级）和 `task.agent.test.ts`（Graph 级）

### Phase 3: Weather Agent

- 用 zod 定义 `get_weather` Tool
- 实现 Mock 天气数据（预定义一组天气数据）
- 用 `createReactAgent` 创建 Weather Agent
- 编写 `weather.tools.test.ts` 和 `weather.agent.test.ts`

### Phase 4: Calendar Agent

- 用 zod 定义 `get_day_schedule` 和 `find_free_slots` Tool
- 实现聚合查询逻辑（复用 TaskService.getTasks）
- 用 `createReactAgent` 创建 Calendar Agent
- 编写 `calendar.tools.test.ts` 和 `calendar.agent.test.ts`

### Phase 5: Notification Agent

- 创建 `reminders` 表（Drizzle schema + migration）
- 用 zod 定义 3 个 Tool（schedule_reminder、list_reminders、cancel_reminder）
- 实现提醒时间计算和内容生成逻辑
- 用 `createReactAgent` 创建 Notification Agent
- 编写 `notification.tools.test.ts` 和 `notification.agent.test.ts`

### Phase 6: Supervisor 编排

- 用 `createSupervisor` 串联 4 个子 Agent
- 实现 `MultiAgentService.chat()` 对外入口
- 编写 `supervisor.test.ts`（路由测试 + 跨 Agent 协作测试）

### Phase 7: 接入与评测

- 创建新的 API 路由或在现有路由上添加切换逻辑
- 编写 `multi-agent.eval.test.ts`（真实 LLM 评测）
- 端到端验收

---

## 8. 新增依赖清单

```json
{
  "dependencies": {
    "@langchain/langgraph": "latest",
    "@langchain/langgraph-supervisor": "latest",
    "zod": "^3.x"
  }
}
```

注：`@langchain/core` 和 `@langchain/openai` 已有，无需新增。

---

## 9. 数据库变更

### 新增 reminders 表

```typescript
// packages/server/src/db/schema.ts 新增

export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent", "cancelled"]);
export const reminderChannelEnum = pgEnum("reminder_channel", ["console", "sms", "email"]);

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("taskId").references(() => tasks.id, { onDelete: "cascade" }),
  remindAt: timestamp("remindAt", { withTimezone: true }).notNull(),
  content: text("content").notNull(),
  status: reminderStatusEnum("status").notNull().default("pending"),
  channel: reminderChannelEnum("channel").notNull().default("console"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LangGraph.js API 不稳定 | 升级后可能 breaking change | 锁定版本，定期检查 changelog |
| Supervisor 路由不准确 | 用户意图分发错误 | Graph 级测试覆盖核心场景 + Eval 评测回归 |
| 跨 Agent 协作延迟 | 多次 LLM 调用导致响应慢 | Supervisor 并行分发（LangGraph 支持）|
| Weather API 不可用 | 通知无法包含天气建议 | Notification Tool 降级处理，只发任务提醒 |
