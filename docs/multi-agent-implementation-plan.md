# 多 Agent 系统实施计划

> 基于 `docs/multi-agent-design.md` 的详细实施方案

## 关键决策与约束

### D1: 使用 createReactAgent（非 createAgent）

`createReactAgent` 在 LangGraph v1 中已标记 deprecated（v2.0 移除），新推荐 `createAgent` from `langchain`。但 `createSupervisor` 与 `createAgent` 存在已知兼容性问题（[langgraphjs#1739](https://github.com/langchain-ai/langgraphjs/issues/1739)）。

**决策**：使用 `createReactAgent` from `@langchain/langgraph/prebuilt`，在代码中注释说明迁移路径。待 #1739 修复后迁移。

### D2: Zod 4 兼容性策略

项目已使用 Zod 4.3.5。LangGraph 的 Tool schema 支持 Zod 4，但 StateGraph schema 有已知问题。

**决策**：
- Tool schema 使用 `zod`（v4）定义 ✅
- StateGraph 状态使用 `Annotation` API（`@langchain/langgraph`），不使用 raw Zod schema，绕开兼容性问题 ✅

### D3: Tool 上下文注入方式

LangGraph 的 `tool()` 函数 handler 签名为 `(params, config) => Promise<string>`。运行时上下文通过 `config.configurable` 传递。

**决策**：
- Tools 定义为模块级常量（不是每次请求创建新实例）
- 运行时上下文（`db`, `userId`, `timezoneOffsetMinutes`）通过 `config.configurable` 在 graph invoke 时注入
- 每个 tool handler 内部从 `config.configurable` 取出所需依赖

```typescript
// 示例：tool 定义
export const createTaskTool = tool(
  async (params, config) => {
    const { db, userId, timezoneOffsetMinutes } = config.configurable;
    // ... 使用 db, userId 执行逻辑
  },
  { name: "create_task", description: "...", schema: z.object({...}) }
);

// 示例：graph invoke
await graph.invoke(
  { messages: [...] },
  { configurable: { db, userId, timezoneOffsetMinutes: 480 } }
);
```

### D4: Tool 不再依赖原始用户消息

现有 `ai.service.ts` 的 tool 执行依赖 `userMessage` 做启发式检查（如 `hasExplicitTimePoint(userMessage)`）。在多 Agent 架构中，tool 只接收 LLM 提取的结构化参数。

**决策**：
- `create_task` 不再检查 `userMessage`，改为纯参数校验
- 如 `startTime` 有值但 `endTime` 为空 → 返回 `need_confirmation`
- 如 `dueDate` 为空 → 默认今天
- 如 `timeSegment` 和 `startTime/endTime` 都为空 → 使用默认时段
- Agent Prompt 负责指导 LLM 正确提取参数

### D5: Tool 返回值格式

LangGraph tool handler 返回 `string`，内容作为 ToolMessage 传给 LLM。

**决策**：
- Tool handler 内部构建 `ToolResult` 对象，序列化为 JSON 字符串返回
- `MultiAgentService.chat()` 从 graph 执行结果的 ToolMessage 中解析 `ToolResult`，提取 `task`/`conflictingTasks` 作为前端 payload
- `need_confirmation` / `conflict` 状态不再短路返回，而是由 Agent LLM 看到后生成用户友好的确认请求

### D6: 版本锁定

**决策**：安装时锁定到当前最新稳定版，不使用 `latest` tag。

---

## Phase 1: 基础设施搭建

### 1.1 安装依赖

在 `packages/server/` 安装：
```
pnpm -C packages/server add @langchain/langgraph @langchain/langgraph-supervisor
```

注：`@langchain/core`（^1.1.18）、`@langchain/openai`（^1.2.4）、`zod`（^4.3.5）已存在。

### 1.2 创建目录结构

```
packages/server/src/services/multi-agent/
├── index.ts                  ← MultiAgentService 对外入口
├── supervisor.ts             ← Supervisor 编排层
├── agents/
│   ├── task.agent.ts
│   ├── calendar.agent.ts
│   ├── weather.agent.ts
│   └── notification.agent.ts
├── tools/
│   ├── task.tools.ts
│   ├── calendar.tools.ts
│   ├── weather.tools.ts
│   └── notification.tools.ts
├── utils/
│   ├── time.helpers.ts       ← 从 ai.service.ts 提取的纯函数
│   ├── conflict.helpers.ts   ← 从 ai.service.ts 提取的纯函数
│   └── llm.factory.ts        ← LLM 创建工厂
└── types.ts                  ← 共享类型

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

### 1.3 创建 types.ts

文件：`packages/server/src/services/multi-agent/types.ts`

```typescript
import type { TaskInfo } from "shared";

// Tool 执行状态枚举
export type ToolResultStatus = "success" | "conflict" | "need_confirmation" | "error";

// Tool 操作类型
export type ToolActionType = "create" | "update" | "complete" | "delete";

// 统一的 Tool 返回结构
export interface ToolResult {
  status: ToolResultStatus;
  message: string;                     // 给 LLM 阅读的文本摘要
  task?: TaskInfo;                     // 创建/更新/完成后的任务实体
  conflictingTasks?: TaskInfo[];       // 冲突的任务列表
  actionPerformed?: ToolActionType;    // 实际执行了什么操作
  data?: Record<string, unknown>;      // 各 Agent 特有的额外数据
}

// 多 Agent 服务对外返回类型（兼容现有 AIServiceResult / AIChatResponse）
export interface MultiAgentServiceResult {
  content: string;
  type: "text" | "task_summary" | "question";
  payload?: {
    task?: TaskInfo;
    conflictingTasks?: TaskInfo[];
  };
}

// graph invoke 时注入的运行时上下文
export interface AgentConfigurable {
  db: import("../../db/db").DbInstance;
  userId: number;
  timezoneOffsetMinutes: number;
}
```

### 1.4 创建 llm.factory.ts

文件：`packages/server/src/services/multi-agent/utils/llm.factory.ts`

逻辑来源：`ai.service.ts` 第 242-263 行 `createLLM()`

```typescript
import { ChatOpenAI } from "@langchain/openai";
import type { Bindings } from "../../../types/bindings";

/**
 * LLM 创建工厂
 * 支持中转服务（AIHUBMIX）或官方 OpenAI API
 * 提取自 ai.service.ts，多 Agent 各节点共用同一 LLM 实例
 */
export function createLLM(env: Bindings): ChatOpenAI {
  if (env.AIHUBMIX_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.AIHUBMIX_API_KEY,
      model: env.AIHUBMIX_MODEL_NAME || "deepseek-v3.2",
      temperature: 0,
      configuration: { baseURL: env.AIHUBMIX_BASE_URL },
    } as any);
  }
  return new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: "gpt-4o",
    temperature: 0,
  });
}
```

### 1.5 提取 time.helpers.ts

文件：`packages/server/src/services/multi-agent/utils/time.helpers.ts`

**关键变化**：所有函数从 `AIService` 私有方法改为导出纯函数，`this.timezoneOffsetMinutes` 改为参数 `tzOffset`。

提取函数清单（每个注明来源行号）：

| 函数名 | 来源行 | 变化 |
|--------|--------|------|
| `getUserNow(tzOffset)` | 717-719 | `this.timezoneOffsetMinutes` → 参数 |
| `getTodayDate(tzOffset)` | 797-803 | 同上 |
| `getWeekdayLabel(date)` | 733-736 | 无变化 |
| `parseTimeToMinutes(time)` | 722-731 | 无变化 |
| `isTodayDate(dateStr, tzOffset)` | 739-746 | 参数化 |
| `formatTimeSegmentLabel(segment)` | 664-682 | 无变化 |
| `getTimeSegmentOrder(segment)` | 684-702 | 无变化 |
| `getCurrentTimeSegment(tzOffset)` | 705-714 | 参数化 |
| `inferTimeSegmentFromText(text)` | 645-661 | 无变化 |
| `isSegmentAllowedForToday(dateStr, segment, tzOffset)` | 761-768 | 参数化 |
| `isTimeRangePassedForToday(dateStr, startTime, endTime, tzOffset)` | 771-785 | 参数化 |
| `getDefaultTimeSegmentForDate(dateStr, tzOffset)` | 753-758 | 参数化 |
| `buildSegmentNotAllowedMessage(target, tzOffset)` | 787-794 | 参数化 |
| `hasTimeSegmentHint(text)` | 407-423 | 无变化 |
| `hasExplicitTimeRange(text)` | 426-432 | 无变化 |
| `hasExplicitTimePoint(text)` | 435-437 | 无变化 |
| `hasDateHint(text)` | 440-473 | 无变化 |

### 1.6 提取 conflict.helpers.ts

文件：`packages/server/src/services/multi-agent/utils/conflict.helpers.ts`

提取函数清单：

| 函数名 | 来源行 | 变化 |
|--------|--------|------|
| `normalizeTaskTitle(title)` | 806-825 | 无变化 |
| `buildBigrams(text)` | 828-835 | 无变化 |
| `diceCoefficient(a, b)` | 838-848 | 无变化 |
| `isSemanticDuplicate(newTitle, existingTitle)` | 851-856 | 无变化 |
| `findSemanticConflicts(tasks, title)` | 859-866 | 无变化 |
| `filterTimeConflicts(tasks, startTime, endTime)` | 869-874 | 无变化 |
| `mergeConflictingTasks(timeConflicts, semanticConflicts)` | 877-885 | 无变化 |

### 1.7 编写 time.helpers.test.ts

文件：`packages/server/src/__tests__/multi-agent/unit/time.helpers.test.ts`

**正常 Case（设计文档 6.2.1）：**
- `inferTimeSegmentFromText("下午")` → `"afternoon"`
- `parseTimeToMinutes("14:30")` → `870`
- `isTodayDate(todayStr, 0)` → `true`
- `getCurrentTimeSegment(tzOffset)` 在指定时间 → 正确时段
- `getDefaultTimeSegmentForDate(todayStr, tzOffset)` 晚上 → `"evening"`
- `formatTimeSegmentLabel("morning")` → `"早上"`
- `hasTimeSegmentHint("下午开会")` → `true`
- `hasExplicitTimeRange("3点到5点")` → `true`
- `hasDateHint("明天")` → `true`

**异常 Case：**
- `inferTimeSegmentFromText("")` → `"all_day"`（默认）
- `parseTimeToMinutes("25:00")` → `null`
- `parseTimeToMinutes(null)` → `null`
- `parseTimeToMinutes("abc")` → `null`
- `isTodayDate(null, 0)` → `false`
- `isTodayDate("", 0)` → `false`
- `isSegmentAllowedForToday(todayStr, "morning", tzOffset)` 当前晚上 → `false`
- `hasTimeSegmentHint("")` → `false`
- `hasExplicitTimeRange("开会")` → `false`

### 1.8 编写 conflict.helpers.test.ts

文件：`packages/server/src/__tests__/multi-agent/unit/conflict.helpers.test.ts`

**正常 Case（设计文档 6.2.2）：**
- 14:00-15:00 vs 14:30-15:30 → 时间冲突
- 14:00-15:00 vs 15:00-16:00 → 无冲突（边界不重叠）
- "取快递" vs "拿快递" → 语义冲突（dice ≥ 0.75）
- "取快递" vs "开会" → 无语义冲突

**异常 Case：**
- 空任务列表 → 无冲突
- 标题为空 → 无冲突（`findSemanticConflicts` 返回 `[]`）
- 单字标题 → bigram 退化，直接字符串比较
- `normalizeTaskTitle("")` → `""`
- `diceCoefficient("", "abc")` → `0`

---

## Phase 2: Task Agent

### 2.1 创建 task.tools.ts

文件：`packages/server/src/services/multi-agent/tools/task.tools.ts`

定义 5 个 tool，每个使用 Zod schema：

#### create_task

```typescript
const createTaskSchema = z.object({
  title: z.string().describe("任务标题，简洁的动作短语"),
  description: z.string().optional().describe("任务描述，补充信息"),
  dueDate: z.string().optional().describe("执行日期 YYYY-MM-DD。未提供则默认今天"),
  startTime: z.string().optional().describe("开始时间 HH:MM，需与 endTime 同时提供"),
  endTime: z.string().optional().describe("结束时间 HH:MM，需与 startTime 同时提供"),
  timeSegment: z.enum(["all_day", "early_morning", "morning", "forenoon", "noon", "afternoon", "evening"]).optional().describe("模糊时段，与 startTime/endTime 互斥"),
  priority: z.enum(["high", "medium", "low"]).optional().describe("优先级，默认 medium"),
  groupId: z.number().optional().describe("群组ID，个人任务不传"),
});
```

**Handler 内部逻辑**（按顺序）：
1. 从 `config.configurable` 取 `db`, `userId`, `tzOffset`
2. 参数校验：`startTime` 有但 `endTime` 无 → `need_confirmation`
3. `dueDate` 为空 → 默认 `getTodayDate(tzOffset)`
4. 确定时间模式（具体时间 / 时段 / 默认）
5. 时段已过校验（`isSegmentAllowedForToday` / `isTimeRangePassedForToday`）
6. 冲突检测（语义 + 时间）
7. 创建任务
8. 返回 `ToolResult` JSON 字符串

#### query_tasks

```typescript
const queryTasksSchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  dueDate: z.string().optional().describe("查询日期 YYYY-MM-DD"),
  priority: z.enum(["high", "medium", "low"]).optional(),
});
```

#### modify_task（原 update_task，新增模糊查找）

```typescript
const modifyTaskSchema = z.object({
  title: z.string().optional().describe("要修改的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
  // 以下为更新字段
  newTitle: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeSegment: z.enum([...]).optional(),
  priority: z.enum([...]).optional(),
});
```

**Handler 内部逻辑**：
1. 调用 `findTaskByTitleOrId()` 定位任务
2. 唯一匹配 → 执行更新
3. 多个匹配 → 返回候选列表
4. 无匹配 → 返回未找到

#### finish_task（原 complete_task，新增模糊查找）

```typescript
const finishTaskSchema = z.object({
  title: z.string().optional().describe("要完成的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
});
```

#### remove_task（原 delete_task，新增模糊查找）

```typescript
const removeTaskSchema = z.object({
  title: z.string().optional().describe("要删除的任务标题（模糊匹配）"),
  taskId: z.number().optional().describe("任务ID（精确匹配，优先于 title）"),
});
```

#### 共用模糊查找函数

```typescript
/**
 * 按标题模糊查找或按 ID 精确查找任务
 * 优先 taskId → 否则按 title 在当天 pending 任务中模糊搜索
 */
async function findTaskByTitleOrId(
  db: DbInstance,
  userId: number,
  tzOffset: number,
  title?: string,
  taskId?: number,
): Promise<
  | { type: "found"; task: TaskInfo }
  | { type: "multiple"; candidates: TaskInfo[] }
  | { type: "not_found"; message: string }
>
```

查找逻辑：
1. 有 `taskId` → `taskService.getTaskById(taskId, userId)` → 返回 `found`
2. 有 `title` → `taskService.getTasks(userId, { status: "pending", dueDate: getTodayDate(tzOffset) })` → 用 `findSemanticConflicts` 做模糊匹配
3. 匹配到 1 个 → `found`
4. 匹配到多个 → `multiple`
5. 匹配到 0 个 → `not_found`
6. 都没提供 → `not_found` "请提供任务名称或ID"

### 2.2 创建 task.agent.ts

文件：`packages/server/src/services/multi-agent/agents/task.agent.ts`

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const TASK_AGENT_PROMPT = `你是任务管理专家，帮助用户管理日常任务。

## 当前上下文
- 今天：{today}（{weekday}）
- 当前时段：{currentSegment}

## 参数提取指导
- title：简洁的动作短语（如"去4S店取车"、"开家长会"）
- dueDate：YYYY-MM-DD 格式，用户未指定时不传（工具默认今天）
- startTime/endTime：必须成对提供（HH:MM），用户只说一个时间点时仅提取 startTime
- timeSegment：模糊时段（全天/凌晨/早上/上午/中午/下午/晚上），与 startTime/endTime 互斥
- priority：high/medium/low，用户未提及时不传

## 重要规则
- 时间合理性校验、冲突检测由工具自动完成，你不需要判断
- 如果工具返回 need_confirmation 或 conflict，将工具的提示信息原样转达给用户
- 用户说"完成XXX" → 调用 finish_task
- 用户说"删除XXX"/"取消XXX" → 调用 remove_task
- 用户说"修改XXX"/"把XXX改成..." → 调用 modify_task
`;

export function createTaskAgent(llm: ChatOpenAI) {
  return createReactAgent({
    llm,
    tools: taskTools,
    name: "task_agent",
    prompt: TASK_AGENT_PROMPT,
  });
}
```

注意：`{today}`, `{weekday}`, `{currentSegment}` 需在创建时动态替换。具体方案：agent 创建时传入替换后的 prompt 字符串，或使用 LangGraph 的 prompt 函数形式。

**决策**：使用函数形式，每次请求动态生成 prompt：
```typescript
export function createTaskAgent(llm: ChatOpenAI, tzOffset: number) {
  const today = getTodayDate(tzOffset);
  const weekday = getWeekdayLabel(getUserNow(tzOffset));
  const currentSegment = formatTimeSegmentLabel(getCurrentTimeSegment(tzOffset));
  const prompt = TASK_AGENT_PROMPT
    .replace("{today}", today)
    .replace("{weekday}", weekday)
    .replace("{currentSegment}", currentSegment);

  return createReactAgent({ llm, tools: taskTools, name: "task_agent", prompt });
}
```

### 2.3 编写 task.tools.test.ts（Node 级）

文件：`packages/server/src/__tests__/multi-agent/unit/task.tools.test.ts`

Mock `TaskService`（vi.mock），不需要真实数据库。

**正常 Case（设计文档 6.2.3）：**
- `create_task` 完整参数 → `{ status: "success", task: {...} }`
- `create_task` 无时间信息 → 自动填充默认 timeSegment
- `finish_task({ title: "写周报" })` 匹配到 1 个 → 直接完成
- `query_tasks({ dueDate: "2026-02-11" })` → 返回任务列表
- `modify_task({ title: "开会", dueDate: "2026-02-13" })` 匹配到 1 个 → 直接更新

**异常 Case：**
- `create_task` 今天 + 时段已过 → `{ status: "need_confirmation" }`
- `create_task` 语义冲突 → `{ status: "conflict", conflictingTasks: [...] }`
- `create_task` 时间冲突 → `{ status: "conflict" }`
- `create_task` 有 startTime 无 endTime → `{ status: "need_confirmation" }`
- `finish_task({ title: "写周报" })` 匹配 0 个 → `{ status: "error", message: "未找到" }`
- `finish_task({ title: "开会" })` 匹配 3 个 → `{ status: "need_confirmation", message: "找到多个..." }`
- `remove_task` 无 taskId 也无 title → `{ status: "error" }`

### 2.4 编写 task.agent.test.ts（Graph 级）

文件：`packages/server/src/__tests__/multi-agent/integration/task.agent.test.ts`

Mock LLM（使用 `FakeListChatModel` from `@langchain/core/utils/testing` 或自定义 mock），验证：
- Mock LLM 输出 create_task tool call → 验证 Tool 被执行 → 验证返回的消息包含创建结果
- Mock LLM 输出 finish_task tool call → 验证 Tool 被执行 → 验证任务被标记完成
- Tool 执行失败（DB 抛异常）→ Agent 不崩溃，返回错误信息

---

## Phase 3: Weather Agent

### 3.1 创建 weather.tools.ts

文件：`packages/server/src/services/multi-agent/tools/weather.tools.ts`

```typescript
const getWeatherSchema = z.object({
  city: z.string().describe("城市名称"),
  date: z.string().describe("查询日期 YYYY-MM-DD"),
});
```

**Handler**：开发阶段使用 Mock 数据（预定义 JSON），返回温度、天气状况、建议。

Mock 数据结构：
```typescript
const MOCK_WEATHER: Record<string, { condition: string; tempMin: number; tempMax: number; suggestion: string }> = {
  "default_clear": { condition: "晴", tempMin: 5, tempMax: 15, suggestion: "天气晴好，适合出行" },
  "default_rain": { condition: "小雨", tempMin: 2, tempMax: 8, suggestion: "建议携带雨具" },
  // ...
};
```

后续接入真实 API 时只需替换 handler 内部实现，不影响 tool 定义和 agent。

### 3.2 创建 weather.agent.ts

文件：`packages/server/src/services/multi-agent/agents/weather.agent.ts`

最简 Agent：
```typescript
export function createWeatherAgent(llm: ChatOpenAI) {
  return createReactAgent({
    llm,
    tools: [getWeatherTool],
    name: "weather_agent",
    prompt: "你是天气查询专家。用户询问天气时，调用 get_weather 工具获取天气信息。",
  });
}
```

### 3.3 编写 weather.tools.test.ts

**正常 Case：**
- 查北京明天天气 → 返回温度、天气、建议

**异常 Case：**
- 城市为空 → `{ status: "error", message: "请提供城市名称" }`
- 日期无效 → `{ status: "error", message: "日期格式无效" }`

### 3.4 编写 weather.agent.test.ts

Mock LLM 调用 get_weather → 验证 Mock 数据正确返回。

---

## Phase 4: Calendar Agent

### 4.1 创建 calendar.tools.ts

文件：`packages/server/src/services/multi-agent/tools/calendar.tools.ts`

#### get_day_schedule

```typescript
const getDayScheduleSchema = z.object({
  date: z.string().describe("查看日期 YYYY-MM-DD"),
});
```

**Handler**：查询该日所有任务 → 按时间排序 → 格式化为时间线。

#### find_free_slots

```typescript
const findFreeSlotsSchema = z.object({
  date: z.string().describe("查找日期 YYYY-MM-DD"),
  startHour: z.number().optional().describe("搜索起始小时，默认 9"),
  endHour: z.number().optional().describe("搜索结束小时，默认 18"),
});
```

**Handler**：查询已有任务 → 计算空闲区间 → 返回。

空闲区间算法：
1. 获取该日所有有具体时间的任务，按 startTime 排序
2. 从 startHour 开始扫描，找出没有被任务占用的时间段
3. 返回 `[{ start: "09:00", end: "10:30" }, ...]` 格式

### 4.2 创建 calendar.agent.ts

```typescript
export function createCalendarAgent(llm: ChatOpenAI, tzOffset: number) {
  return createReactAgent({
    llm,
    tools: [getDayScheduleTool, findFreeSlotsTool],
    name: "calendar_agent",
    prompt: `你是日程安排专家。帮助用户查看日程和寻找空闲时间。
今天：${getTodayDate(tzOffset)}`,
  });
}
```

### 4.3 编写 calendar.tools.test.ts

**正常 Case：**
- 某天有 3 个任务 → `get_day_schedule` 返回按时间排序的时间线
- 9-18 点有 2 个任务 → `find_free_slots` 返回 3 个空闲区间

**异常 Case：**
- 某天无任务 → 返回"当天没有安排"
- 全天排满 → 返回"当天没有空闲时间"

### 4.4 编写 calendar.agent.test.ts

Mock LLM 调用 find_free_slots → 验证空闲时间段正确返回。

---

## Phase 5: Notification Agent

### 5.1 数据库变更

文件：`packages/server/src/db/schema.ts`

新增枚举和表定义：

```typescript
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

新增关系定义：

```typescript
export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
  task: one(tasks, { fields: [reminders.taskId], references: [tasks.id] }),
}));
```

### 5.2 运行数据库迁移

```
pnpm -C packages/server db-push
```

### 5.3 创建 notification.tools.ts

文件：`packages/server/src/services/multi-agent/tools/notification.tools.ts`

#### schedule_reminder

```typescript
const scheduleReminderSchema = z.object({
  taskId: z.number().optional().describe("关联的任务ID"),
  taskTitle: z.string().describe("任务标题，用于生成提醒内容"),
  taskDate: z.string().describe("任务日期 YYYY-MM-DD"),
  taskTime: z.string().optional().describe("任务时间 HH:MM 或时段名称"),
  weatherInfo: z.string().optional().describe("天气信息，如有则附加到提醒内容"),
});
```

**Handler 内部逻辑**：
1. 计算提醒时间（Tool 代码决定，不由 LLM 决定）：
   - 跨天任务 → 前一天 20:00
   - 当天有具体时间 → 提前 2 小时
   - 当天无具体时间 → 当天 08:00
2. 任务时间已过 → 不安排提醒，返回提示
3. 生成提醒内容：
   - 基础：任务标题 + 时间
   - 有异常天气 → 附加天气建议
4. 写入 reminders 表
5. 控制台输出提醒信息（模拟发送）
6. 返回 ToolResult

#### list_reminders

```typescript
const listRemindersSchema = z.object({
  date: z.string().optional().describe("查询日期 YYYY-MM-DD"),
});
```

#### cancel_reminder

```typescript
const cancelReminderSchema = z.object({
  reminderId: z.number().describe("提醒ID"),
});
```

### 5.4 创建 notification.agent.ts

```typescript
export function createNotificationAgent(llm: ChatOpenAI) {
  return createReactAgent({
    llm,
    tools: [scheduleReminderTool, listRemindersTool, cancelReminderTool],
    name: "notification_agent",
    prompt: `你是通知提醒专家。帮助用户安排和管理任务提醒。
提醒时间由工具自动计算，你只需提供任务信息即可。
如果有天气信息，请一并传递给工具，以便在提醒中附加天气建议。`,
  });
}
```

### 5.5 编写 notification.tools.test.ts

**正常 Case：**
- 跨天任务 → 提醒时间 = 前一天 20:00
- 当天任务有具体时间 → 提醒时间 = 提前 2 小时
- 有雨天气 → 提醒内容包含"带伞"

**异常 Case：**
- 已过去的任务 → 不安排提醒，返回提示
- 天气信息缺失 → 只发任务提醒，不含天气建议
- 当天任务无具体时间 → 当天 08:00 提醒

### 5.6 编写 notification.agent.test.ts

Mock LLM 调用 schedule_reminder → 验证提醒记录写入。

---

## Phase 6: Supervisor 编排

### 6.1 创建 supervisor.ts

文件：`packages/server/src/services/multi-agent/supervisor.ts`

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";

const SUPERVISOR_PROMPT = `你是一个智能助手的调度中心，负责将用户请求分发给合适的专家。

可用专家：
- task_agent：处理任务的创建、查询、修改、完成、删除
- calendar_agent：查看日程安排、查找空闲时间
- weather_agent：查询天气信息
- notification_agent：安排任务提醒

分发规则：
- 涉及任务操作（创建/完成/修改/删除/查询任务）→ task_agent
- 询问日程/时间安排/是否有空 → calendar_agent
- 询问天气 → weather_agent
- 涉及提醒/通知 → notification_agent
- 复合请求（如"周末去机场接人"）→ 依次分发给相关专家
- 非以上范围 → 礼貌告知只能处理任务和日程相关需求

回复规范：使用中文，简洁友好。`;

export function buildSupervisorGraph(llm: ChatOpenAI, tzOffset: number) {
  const taskAgent = createTaskAgent(llm, tzOffset);
  const calendarAgent = createCalendarAgent(llm, tzOffset);
  const weatherAgent = createWeatherAgent(llm);
  const notificationAgent = createNotificationAgent(llm);

  const workflow = createSupervisor({
    agents: [taskAgent, calendarAgent, weatherAgent, notificationAgent],
    llm,
    prompt: SUPERVISOR_PROMPT,
  });

  return workflow.compile({ checkpointer: new MemorySaver() });
}
```

### 6.2 创建 index.ts（MultiAgentService）

文件：`packages/server/src/services/multi-agent/index.ts`

```typescript
export class MultiAgentService {
  constructor(
    private db: DbInstance,
    private env: Bindings,
    private timezoneOffsetMinutes: number = 0,
  ) {}

  async chat(userId: number, message: string): Promise<MultiAgentServiceResult> {
    // 1. 创建 LLM
    const llm = createLLM(this.env);

    // 2. 构建 Supervisor Graph
    const graph = buildSupervisorGraph(llm, this.timezoneOffsetMinutes);

    // 3. 执行 graph
    const result = await graph.invoke(
      { messages: [{ role: "user", content: message }] },
      {
        configurable: {
          db: this.db,
          userId,
          timezoneOffsetMinutes: this.timezoneOffsetMinutes,
          thread_id: `user_${userId}`,  // MemorySaver 需要的 thread_id
        },
      },
    );

    // 4. 从结果中提取最终回复和结构化数据
    const lastMessage = result.messages[result.messages.length - 1];
    const content = typeof lastMessage.content === "string" ? lastMessage.content : "";

    // 5. 从 ToolMessage 中提取 payload（task / conflictingTasks）
    const payload = this.extractPayloadFromMessages(result.messages);

    // 6. 确定渲染类型
    const type = payload.task ? "task_summary"
               : payload.conflictingTasks?.length ? "question"
               : "text";

    // 7. 保存消息到数据库（复用现有 messages 表）
    await this.saveMessages(userId, message, content, type, payload);

    return { content, type, payload };
  }

  /**
   * 从 graph 执行结果的消息列表中提取最后一个 ToolResult 的 payload
   */
  private extractPayloadFromMessages(messages: BaseMessage[]) {
    // 倒序遍历找最后一个 ToolMessage，解析其中的 ToolResult JSON
    // 提取 task 和 conflictingTasks
  }

  private async saveMessages(...) {
    // 复用 messages 表保存对话
  }
}
```

### 6.3 编写 supervisor.test.ts（Graph 级）

文件：`packages/server/src/__tests__/multi-agent/integration/supervisor.test.ts`

**路由测试（Mock LLM）：**

| 输入 | 期望路由 |
|------|---------|
| "帮我创建一个任务，明天去买菜" | → task_agent |
| "明天下午有空吗" | → calendar_agent |
| "明天天气怎么样" | → weather_agent |
| "讲个笑话" | → 直接拒绝，不路由到任何 Agent |
| "周末早上去机场接人" | → task_agent + weather_agent + notification_agent |

**错误处理测试：**
- 子 Agent 抛出异常 → Supervisor 捕获并返回友好错误
- LLM 连续调用超过上限 → 兜底返回

---

## Phase 7: 接入与评测

### 7.1 路由层切换

文件：`packages/server/src/routes/ai.routes.ts`

新增一个路由或查询参数控制使用哪个 Agent：

```typescript
// 在 /api/ai/chat 路由中添加切换逻辑
const useMultiAgent = c.req.query("multi") === "true" || c.req.header("x-multi-agent") === "true";

if (useMultiAgent) {
  const multiService = new MultiAgentService(db, c.env, timezoneOffsetMinutes);
  const result = await multiService.chat(userId, message.trim());
  return c.json(successResponse(result));
} else {
  // 现有逻辑不变
  const aiService = new AIService(db, c.env, timezoneOffsetMinutes, requestId);
  const result = await aiService.chat(userId, message.trim());
  return c.json(successResponse(result));
}
```

### 7.2 编写 eval 测试

文件：`packages/server/src/__tests__/multi-agent/eval/multi-agent.eval.test.ts`

真实 LLM，少量核心场景：

| 场景 | 验收标准 |
|------|---------|
| "帮我创建一个任务，明天去买菜" | type = task_summary，task 存在 |
| "完成写周报" | 调用了 finish_task 而非 create_task |
| "明天下午有空吗" | 路由到 Calendar Agent，返回空闲时间 |
| "明天天气怎么样" | 路由到 Weather Agent，返回天气信息 |
| "周末早上去机场接人" | Task + Notification + Weather 三者都被触发 |
| "给我讲个笑话" | 礼貌拒绝，不调用任何 Tool |

### 7.3 端到端验收

手动测试 + eval 测试全部通过。

---

## IMPLEMENTATION CHECKLIST

### Phase 1: 基础设施搭建
1. [ ] 安装依赖：`pnpm -C packages/server add @langchain/langgraph @langchain/langgraph-supervisor`
2. [ ] 创建目录结构：`multi-agent/` 下的所有子目录和空文件
3. [ ] 编写 `types.ts`：ToolResult、MultiAgentServiceResult、AgentConfigurable 类型定义
4. [ ] 编写 `llm.factory.ts`：从 ai.service.ts 第 242-263 行提取 createLLM 函数
5. [ ] 编写 `time.helpers.ts`：从 ai.service.ts 提取 17 个时间处理纯函数
6. [ ] 编写 `conflict.helpers.ts`：从 ai.service.ts 提取 7 个冲突检测纯函数
7. [ ] 编写 `time.helpers.test.ts`：9 个正常 case + 9 个异常 case
8. [ ] 编写 `conflict.helpers.test.ts`：4 个正常 case + 5 个异常 case
9. [ ] 运行测试验证 Phase 1：`pnpm -C packages/server test -- --testPathPattern="multi-agent/unit/(time|conflict)"`

### Phase 2: Task Agent
10. [ ] 编写 `task.tools.ts`：5 个 Tool 定义 + 共用模糊查找函数 findTaskByTitleOrId
11. [ ] 编写 `task.agent.ts`：createTaskAgent 函数 + TASK_AGENT_PROMPT
12. [ ] 编写 `task.tools.test.ts`：5 个正常 case + 7 个异常 case
13. [ ] 编写 `task.agent.test.ts`：3 个 Graph 级集成测试
14. [ ] 运行测试验证 Phase 2：`pnpm -C packages/server test -- --testPathPattern="multi-agent/(unit/task|integration/task)"`

### Phase 3: Weather Agent
15. [ ] 编写 `weather.tools.ts`：1 个 Tool（get_weather）+ Mock 天气数据
16. [ ] 编写 `weather.agent.ts`：createWeatherAgent 函数
17. [ ] 编写 `weather.tools.test.ts`：1 个正常 case + 2 个异常 case
18. [ ] 编写 `weather.agent.test.ts`：1 个 Graph 级集成测试
19. [ ] 运行测试验证 Phase 3

### Phase 4: Calendar Agent
20. [ ] 编写 `calendar.tools.ts`：2 个 Tool（get_day_schedule、find_free_slots）+ 空闲区间算法
21. [ ] 编写 `calendar.agent.ts`：createCalendarAgent 函数
22. [ ] 编写 `calendar.tools.test.ts`：2 个正常 case + 3 个异常 case
23. [ ] 编写 `calendar.agent.test.ts`：1 个 Graph 级集成测试
24. [ ] 运行测试验证 Phase 4

### Phase 5: Notification Agent
25. [ ] 修改 `schema.ts`：新增 reminderStatusEnum、reminderChannelEnum、reminders 表、remindersRelations
26. [ ] 运行数据库迁移：`pnpm -C packages/server db-push`
27. [ ] 编写 `notification.tools.ts`：3 个 Tool + 提醒时间计算逻辑 + 提醒内容生成逻辑
28. [ ] 编写 `notification.agent.ts`：createNotificationAgent 函数
29. [ ] 编写 `notification.tools.test.ts`：3 个正常 case + 3 个异常 case
30. [ ] 编写 `notification.agent.test.ts`：1 个 Graph 级集成测试
31. [ ] 运行测试验证 Phase 5

### Phase 6: Supervisor 编排
32. [ ] 编写 `supervisor.ts`：buildSupervisorGraph 函数 + SUPERVISOR_PROMPT
33. [ ] 编写 `index.ts`：MultiAgentService 类 + chat() 方法 + extractPayloadFromMessages + saveMessages
34. [ ] 编写 `supervisor.test.ts`：5 个路由测试 + 2 个错误处理测试
35. [ ] 运行测试验证 Phase 6

### Phase 7: 接入与评测
36. [ ] 修改 `ai.routes.ts`：添加 multi-agent 切换逻辑
37. [ ] 编写 `multi-agent.eval.test.ts`：6 个端到端 eval 测试
38. [ ] 运行全量测试：`pnpm -C packages/server test`
39. [ ] 手动端到端验收测试
