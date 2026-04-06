# LangGraph 学习笔记 —— 结合 HomeTask 项目实战

> 本笔记目标：从零理解 LangGraph 的核心概念，然后对照项目代码逐步拆解多 Agent 系统的实现。

---

## 第一章：LangGraph 是什么？解决什么问题？

### 1.1 一句话定义

LangGraph 是一个**把 AI Agent 工作流建模为"图"（Graph）的框架**。你用节点（Node）表示"做什么"，用边（Edge）表示"下一步去哪"，框架帮你管理执行顺序、状态传递和记忆持久化。

### 1.2 为什么需要它？

没有 LangGraph 时（比如我们的单 Agent），你需要**手写循环**：

```typescript
// 单 Agent 的手写循环（ai.service.ts 简化版）
for (let i = 0; i < 10; i++) {
  const response = await llm.invoke(messages, { tools });
  if (!response.tool_calls?.length) break;  // 没有工具调用 → 结束
  for (const call of response.tool_calls) {
    const result = await executeToolCall(call);
    messages.push(new ToolMessage(result));   // 结果塞回去继续
  }
}
```

这对单 Agent 够用。但如果你想要**多个 Agent 协作**——一个管任务、一个管天气、一个管日程——手写循环就会变成意大利面条代码：谁先执行？谁的结果传给谁？怎么记住上下文？

LangGraph 的价值：**用图结构把这些问题声明式地描述出来**，框架负责执行。

### 1.3 和 LangChain 的关系

```
LangChain 生态
├── @langchain/core          ← 消息类型、Tool 抽象（基础层）
├── @langchain/openai        ← ChatOpenAI（模型调用层）
├── @langchain/langgraph     ← 图编排框架（本笔记重点）
└── @langchain/langgraph-supervisor  ← 预构建的 Supervisor 模式
```

- **单 Agent** 只用了 `@langchain/core` + `@langchain/openai`，循环自己写
- **多 Agent** 在此基础上加了 `@langchain/langgraph` + `@langchain/langgraph-supervisor`

---

## 第二章：LangGraph 的 4 个核心概念

把 LangGraph 想象成**地铁线路图**，理解这 4 个概念就够了：

### 2.1 State（状态）= 乘客手里的行李

State 是在整个图中流转的**共享数据**。所有节点都能读取和修改它。

在本项目中，State 的核心就是 `messages` 数组——对话消息列表：

```typescript
// LangGraph 内置的 MessagesState（简化）
{
  messages: BaseMessage[]  // 所有对话消息在这里累积
}
```

每个节点执行后，可以往 `messages` 里追加新消息。LangGraph 自动帮你合并。

### 2.2 Node（节点）= 地铁站

Node 是**执行逻辑的地方**。在本项目中，每个 Agent 就是一个 Node：

```
[Supervisor Node] → [task_agent Node] → [calendar_agent Node] → ...
```

每个 Node 接收 State，做一些事情（比如调用 LLM + 执行工具），然后返回更新后的 State。

### 2.3 Edge（边）= 地铁线路

Edge 定义节点之间的**连接和走向**。有两种：

- **普通边**：A → B，无条件执行
- **条件边**：根据当前 State 决定下一步去哪（分支路由）

Supervisor 模式的核心就是**条件边**——Supervisor 根据用户意图决定把请求转给哪个 Agent。

### 2.4 Checkpointer（检查点）= 行李寄存处

Checkpointer 负责**保存图的执行状态**，实现跨请求的对话记忆。

```typescript
// supervisor.ts:43
return workflow.compile({ checkpointer: new MemorySaver() });
```

`MemorySaver` 是内存级别的检查点器——数据存在进程内存中。本项目每次请求都新建 graph，所以这个 MemorySaver **实际上不跨请求**（这是一个已知局限）。

---

## 第三章：从底向上——逐层拆解项目代码

### 3.1 第一层：Tool（工具）—— Agent 的手和脚

> 对应代码：`services/multi-agent/tools/*.tools.ts`

Tool 是 Agent 能执行的**具体操作**。LangGraph 用 `@langchain/core/tools` 的 `tool()` 函数定义。

#### 一个 Tool 长什么样？

以天气查询为例（最简单的一个）：

```typescript
// tools/weather.tools.ts（完整代码）
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 第一部分：用 Zod 定义参数的 schema
const getWeatherSchema = z.object({
  city: z.string().describe("城市名称"),
  date: z.string().describe("查询日期 YYYY-MM-DD"),
});

// 第二部分：用 tool() 创建工具
export const getWeatherTool = tool(
  // 参数 1：执行函数（接收 params 和 config）
  async (params) => {
    const { city, date } = params;
    // ... 执行逻辑 ...
    return JSON.stringify({ status: "success", message: "天气晴..." });
  },
  // 参数 2：元信息
  {
    name: "get_weather",                        // LLM 看到的工具名
    description: "查询指定城市和日期的天气信息。",  // LLM 用这个决定要不要调用
    schema: getWeatherSchema,                    // 参数结构（Zod → JSON Schema）
  },
);
```

**关键理解**：
- `schema`（Zod 定义）会被自动转换为 JSON Schema，发给 LLM 做 function calling
- `description` 非常重要——LLM 根据它决定是否调用这个工具
- 返回值是**字符串**，作为 ToolMessage 的 content 回传给 LLM

#### Tool 怎么拿到数据库连接？—— configurable 机制

天气 Tool 不需要数据库，但任务 Tool 需要。看 `create_task` 的第一行：

```typescript
// tools/task.tools.ts:107-108
export const createTaskTool = tool(
  async (params, config) => {
    //                  ↑↑↑↑↑↑ 第二个参数 config
    const { db, userId, timezoneOffsetMinutes } = 
      (config?.configurable || {}) as AgentConfigurable;
```

这个 `config.configurable` 从哪来？从最外层 `graph.invoke()` 传入：

```typescript
// index.ts:23-31
const result = await graph.invoke(
  { messages: [{ role: "user", content: message }] },
  {
    configurable: {        // ← 这里注入
      db: this.db,
      userId,
      timezoneOffsetMinutes: this.timezoneOffsetMinutes,
      thread_id: `user_${userId}`,
    },
  },
);
```

**数据流**：`graph.invoke({ configurable })` → 自动透传到每个 Node → 再透传到每个 Tool 的 `config` 参数。

这是 LangGraph 的"依赖注入"方式——不用全局变量，不用闭包，运行时上下文通过 configurable 一路传递。

#### 项目中的 4 组 Tools

| 文件 | 工具 | 作用 |
|------|------|------|
| `task.tools.ts` | create_task, query_tasks, modify_task, finish_task, remove_task | 任务 CRUD |
| `calendar.tools.ts` | get_day_schedule, find_free_slots | 日程查看、空闲时段查找 |
| `weather.tools.ts` | get_weather | 天气查询（Mock） |
| `notification.tools.ts` | schedule_reminder, list_reminders, cancel_reminder | 提醒管理 |

### 3.2 第二层：Agent（子 Agent）—— 领域专家

> 对应代码：`services/multi-agent/agents/*.agent.ts`

Agent = LLM + Tools + Prompt。LangGraph 提供 `createReactAgent` 一行搞定。

#### 什么是 ReAct Agent？

ReAct = **Re**asoning + **Act**ing。它的执行模式是：

```
LLM 思考 → 决定调用工具 → 执行工具 → 观察结果 → 继续思考 → ...（循环直到不需要工具）
```

这和单 Agent 手写的 for 循环做的事情一模一样，只是 LangGraph 帮你封装好了。

#### 代码解读

以 Task Agent 为例：

```typescript
// agents/task.agent.ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const TASK_AGENT_PROMPT = `你是任务管理专家...
## 当前上下文
- 今天：{today}（{weekday}）
- 当前时段：{currentSegment}
...`;

export function createTaskAgent(llm: ChatOpenAI, tzOffset: number) {
  // 动态替换 prompt 中的时间占位符
  const prompt = TASK_AGENT_PROMPT
    .replace("{today}", getTodayDate(tzOffset))
    .replace("{weekday}", getWeekdayLabel(getUserNow(tzOffset)))
    .replace("{currentSegment}", formatTimeSegmentLabel(getCurrentTimeSegment(tzOffset)));

  return createReactAgent({
    llm,       // 用哪个模型
    tools: taskTools,  // 这个 Agent 能用哪些工具
    name: "task_agent", // 名字（Supervisor 通过名字路由）
    prompt,    // 系统提示
  });
}
```

**`createReactAgent` 内部做了什么？**

它创建了一个小型的 StateGraph：

```
         ┌─────────────────────────┐
         │     agent（LLM 节点）    │
         │  接收消息 → 调用 LLM     │
         │  LLM 决定是否用工具      │
         └────────┬────────────────┘
                  │
          有 tool_calls?
         ┌───yes──┴──no───┐
         ▼                ▼
  ┌──────────────┐   ┌─────────┐
  │ tools（执行） │   │  结束    │
  │ 跑工具，返回  │   └─────────┘
  │ ToolMessage   │
  └──────┬───────┘
         │
         └──→ 回到 agent（把结果给 LLM 继续思考）
```

这就是 ReAct 循环，和手写 for 循环等价，但声明式地用图表达了。

#### 4 个 Agent 的对比

| Agent | Prompt 复杂度 | Tools 数量 | 特点 |
|-------|-------------|-----------|------|
| task_agent | 高（注入日期、时段、规则） | 5 个 | 最核心，处理所有任务操作 |
| calendar_agent | 低（只注入今日日期） | 2 个 | 查看日程和空闲时间 |
| weather_agent | 最低（一句话） | 1 个 | Mock 数据，最简化 |
| notification_agent | 中（提醒规则说明） | 3 个 | 提醒时间计算在 Tool 内 |

### 3.3 第三层：Supervisor（调度中心）—— 交通警察

> 对应代码：`services/multi-agent/supervisor.ts`

Supervisor 是**路由层**，决定用户的话该交给哪个 Agent 处理。

#### 代码解读

```typescript
// supervisor.ts
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { MemorySaver } from "@langchain/langgraph";

const SUPERVISOR_PROMPT = `你是一个智能助手的调度中心，负责将用户请求分发给合适的专家。

可用专家：
- task_agent：处理任务的创建、查询、修改、完成、删除
- calendar_agent：查看日程安排、查找空闲时间
- weather_agent：查询天气信息
- notification_agent：安排任务提醒

分发规则：
- 涉及任务操作 → task_agent
- 询问日程/时间安排 → calendar_agent
- 询问天气 → weather_agent
- 涉及提醒/通知 → notification_agent
- 复合请求 → 依次分发给相关专家
- 非以上范围 → 礼貌告知`;

export function buildSupervisorGraph(llm: ChatOpenAI, tzOffset: number) {
  // 1. 创建 4 个子 Agent
  const taskAgent = createTaskAgent(llm, tzOffset);
  const calendarAgent = createCalendarAgent(llm, tzOffset);
  const weatherAgent = createWeatherAgent(llm);
  const notificationAgent = createNotificationAgent(llm);

  // 2. 用 createSupervisor 组装
  const workflow = createSupervisor({
    agents: [taskAgent, calendarAgent, weatherAgent, notificationAgent],
    llm,                          // Supervisor 自己也用 LLM 做路由决策
    prompt: SUPERVISOR_PROMPT,    // 路由规则
    outputMode: "full_history",   // 保留完整消息历史（重要！）
  });

  // 3. 编译为可执行的图，附带内存检查点
  return workflow.compile({ checkpointer: new MemorySaver() });
}
```

#### `createSupervisor` 内部做了什么？

它创建了一个更大的 StateGraph：

```
                    ┌────────────────────┐
                    │    Supervisor      │
                    │  (LLM 路由决策)    │
                    └───────┬────────────┘
                            │
              LLM 判断：交给谁？
           ┌────┬────┬────┬────┬───┐
           ▼    ▼    ▼    ▼    ▼   ▼
        task  calendar weather noti  END
        agent  agent   agent  agent (结束)
           │    │       │     │
           └────┴───────┴─────┘
                    │
              返回 Supervisor
              (可能继续分发)
```

**路由机制（Handoff）**：Supervisor 通过 LLM 的 function calling 来决定路由。LangGraph 自动给 Supervisor 注入了 "handoff tools"——比如 `transfer_to_task_agent`、`transfer_to_calendar_agent` 等。Supervisor LLM 调用这些工具就等于"把任务交给对应 Agent"。

#### `outputMode: "full_history"` 为什么重要？

```typescript
outputMode: "full_history",  // vs 默认的 "last_message"
```

- `"last_message"`（默认）：只保留子 Agent 的最后一条回复消息
- `"full_history"`：保留所有消息，包括 ToolMessage

本项目必须用 `full_history`，因为前端需要从 ToolMessage 里提取任务数据（task payload）来渲染任务卡片。如果用 `last_message`，ToolMessage 就丢了，前端只能看到纯文本。

### 3.4 第四层：Service（入口）—— 售票大厅

> 对应代码：`services/multi-agent/index.ts`

这是前端请求进入多 Agent 系统的入口：

```typescript
// index.ts（简化）
export class MultiAgentService {
  async chat(userId: number, message: string) {
    // 1. 创建 LLM 实例
    const llm = createLLM(this.env);

    // 2. 构建 Supervisor 图
    const graph = buildSupervisorGraph(llm, this.timezoneOffsetMinutes);

    // 3. 调用图！
    const result = await graph.invoke(
      { messages: [{ role: "user", content: message }] },  // 输入
      { configurable: { db, userId, timezoneOffsetMinutes, thread_id } },
    );

    // 4. 从结果中提取最后一条消息和 payload
    const lastMessage = result.messages[result.messages.length - 1];
    const payload = this.extractPayloadFromMessages(result.messages);

    // 5. 保存到数据库，返回前端
    await this.saveMessages(userId, message, content, type, payload);
    return { content, type, payload };
  }
}
```

**注意**：每次请求都 `new` 一个 graph。这意味着 `MemorySaver` 的生命周期只在单次请求内——跨请求的对话记忆实际上靠的是 `saveMessages` 写数据库（和单 Agent 一样）。

---

## 第四章：一条消息的完整旅程

用户说："帮我创建一个明天下午开会的任务"，完整执行流程：

```
步骤 1: 前端
  POST /api/ai/chat { message: "帮我创建一个明天下午开会的任务" }
  Header: x-multi-agent: true

步骤 2: 路由层 (ai.routes.ts)
  检测到 multi-agent 标记 → 走 MultiAgentService.chat()

步骤 3: MultiAgentService (index.ts)
  创建 LLM → 构建 graph → graph.invoke()

步骤 4: Supervisor Node
  LLM 阅读用户消息 + SUPERVISOR_PROMPT
  LLM 决策："这是任务创建 → 调用 transfer_to_task_agent"
  → 控制流转到 task_agent Node

步骤 5: task_agent Node（ReAct 循环）
  第 1 轮：
    LLM 阅读消息 + TASK_AGENT_PROMPT
    LLM 决策："调用 create_task"
    参数：{ title: "开会", dueDate: "2026-04-07", timeSegment: "afternoon" }

  执行 create_task Tool：
    → 检查时间合理性 ✓
    → 检查语义冲突 → 无
    → 检查时间冲突 → 无
    → 调用 TaskService.createTask() 写入数据库
    → 返回 JSON: { status: "success", task: {...}, actionPerformed: "create" }

  第 2 轮：
    LLM 看到 ToolMessage（工具结果）
    LLM 生成最终回复："已为你创建任务「开会」，安排在明天下午。"
    无 tool_calls → ReAct 循环结束

步骤 6: 回到 Supervisor
  Supervisor 判断：任务完成，不需要再分发
  → 结束

步骤 7: MultiAgentService
  从 result.messages 中找到 ToolMessage
  解析出 { task: {...} } 作为 payload
  确定 type = "task_summary"
  保存到 messages 表

步骤 8: 前端
  收到 { content: "已为你创建...", type: "task_summary", payload: { task } }
  ChatMessage 组件根据 type 渲染任务卡片
```

---

## 第五章：单 Agent vs 多 Agent 设计取舍

| 维度 | 单 Agent（ai.service.ts） | 多 Agent（multi-agent/） |
|------|--------------------------|------------------------|
| **框架依赖** | 只用 ChatOpenAI + 消息类型 | LangGraph 全家桶 |
| **打包体积** | 更小 | 更大（多了 langgraph 依赖） |
| **扩展性** | 加新功能要改主文件 | 加新 Agent 只需新建文件 |
| **可控性** | 完全手动，每步都能拦截 | 框架管理，需通过 Hook 点介入 |
| **代码量** | 1300 行集中 | 分散在 14 个文件 |
| **幻觉防护** | 有（looksLikeActionSuccess） | 无（依赖框架的可靠性） |
| **确认流程** | 有完整的 affirmative 检测 | 由 Tool 返回 need_confirmation，Agent 转述 |
| **对话历史** | 自己从 DB 加载 20 条 | 依赖 MemorySaver（当前实际不跨请求） |
| **适用场景** | 单一领域、需要精细控制 | 多领域协作、快速扩展 |

### 面试金句

> "两套架构并存不是重复造轮子，而是刻意的设计对比。单 Agent 展示了我对 Agent 底层机制的理解——手写循环、幻觉检测、确认流程；多 Agent 展示了我使用 LangGraph 框架做多 Agent 编排的能力——Supervisor 路由、Tool 声明式定义、configurable 依赖注入。面试中我可以讲清楚每一层在做什么，以及为什么这样分层。"

---

## 第六章：LangGraph 关键 API 速查

### `tool(fn, options)` — 创建工具

```typescript
import { tool } from "@langchain/core/tools";
const myTool = tool(
  async (params, config) => { return "结果字符串"; },
  { name: "tool_name", description: "做什么", schema: zodSchema }
);
```

### `createReactAgent(options)` — 创建 ReAct Agent

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
const agent = createReactAgent({
  llm,            // ChatOpenAI 实例
  tools: [...],   // Tool 数组
  name: "agent_name",
  prompt: "系统提示",
});
```

### `createSupervisor(options)` — 创建 Supervisor

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";
const workflow = createSupervisor({
  agents: [agent1, agent2],     // 子 Agent 数组
  llm,                          // Supervisor 用的 LLM
  prompt: "路由规则",
  outputMode: "full_history",   // "last_message" | "full_history"
});
const graph = workflow.compile({ checkpointer: new MemorySaver() });
```

### `graph.invoke(input, config)` — 执行图

```typescript
const result = await graph.invoke(
  { messages: [{ role: "user", content: "用户输入" }] },
  { configurable: { db, userId, thread_id: "xxx" } }
);
// result.messages 包含完整的消息历史
```

---

## 附录：项目多 Agent 文件结构一览

```
services/multi-agent/
├── index.ts                    ← 入口：MultiAgentService
├── supervisor.ts               ← Supervisor 图构建
├── types.ts                    ← 共享类型（ToolResult 等）
├── agents/
│   ├── task.agent.ts           ← 任务 Agent
│   ├── calendar.agent.ts       ← 日程 Agent
│   ├── weather.agent.ts        ← 天气 Agent
│   └── notification.agent.ts   ← 提醒 Agent
├── tools/
│   ├── task.tools.ts           ← 5 个任务工具
│   ├── calendar.tools.ts       ← 2 个日程工具
│   ├── weather.tools.ts        ← 1 个天气工具（Mock）
│   └── notification.tools.ts   ← 3 个提醒工具
└── utils/
    ├── llm.factory.ts          ← LLM 创建工厂
    ├── time.helpers.ts         ← 时间处理纯函数
    └── conflict.helpers.ts     ← 冲突检测纯函数
```
