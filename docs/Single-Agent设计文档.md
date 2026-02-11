# AI Agent 设计文档

## 1. 概述

AI Agent 用于通过自然语言完成任务管理（创建、查询、修改、删除、完成）。系统运行在 Cloudflare Workers（Serverless），每次请求独立，上下文由数据库 `messages` 表串联。

核心原则：

- 快乐路径极简：指令清晰且无冲突时直接执行，不额外确认。
- 需要时才追问：信息不完整或存在冲突时才追问。
- 分层可替换：模型与工具可替换，History 与路由保持稳定。

---

## 2. 关键取舍

1. 保留 LangChain 模型适配，不使用 AgentExecutor  
   仅使用 `@langchain/openai` 的 `ChatOpenAI` 与 `@langchain/core` 的消息类型，不引入 `langchain` 主包。

2. 使用 OpenAI 原生 tool schema  
   工具以 OpenAI JSON Schema 定义，手动管理 tool-call 循环。

---

## 3. 架构分层

```
Layer 1: Model
  - ChatOpenAI（OpenAI 或 AIHubMix 中转）

Layer 2: Tools
  - OpenAI JSON Schema 工具（create_task / query_tasks / update_task / delete_task / complete_task）

Layer 3: Agent 调度
  - 手动 loop：invoke -> 执行 tool -> ToolMessage 回传 -> 再 invoke
  - 最大 10 轮

Layer 4: History
  - 直接读写 messages 表（system 消息不落库）
```

---

## 4. 时间表达逻辑（重点）

任务时间有两种模式，二选一：

1. **具体时间段**：`startTime + endTime`
2. **模糊时间段**：`timeSegment`（`all_day / early_morning / morning / forenoon / noon / afternoon / evening`）

规则：

- **用户未给出具体时间段**时，不再追问，直接根据语义选择 `timeSegment`。
  - “凌晨/早上/上午/中午/下午/晚上/全天” -> 对应 timeSegment
- **用户给出具体时间但不完整**（例如“下午4点”），需要追问结束时间。
- **startTime / endTime 与 timeSegment 互斥**。
- 仅在“具体时间段”模式下执行时间冲突检测。

时间段边界（方案 A）：

- 全天：00:00–23:59
- 凌晨：00:00–05:59
- 早上：06:00–08:59
- 上午：09:00–11:59
- 中午：12:00–13:59
- 下午：14:00–17:59
- 晚上：18:00–23:59

仅对“今天”的限制与默认：

- 未提及日期时，强制默认今天，不允许自动推断为其他日期。
- 今天已过的模糊时段或具体时间范围必须追问确认，不允许自动纠正。
- 若今天已是晚上，不能选择全天或更早的时间段。
- 若今天且未提及时间段，默认全天；若当前已是晚上，默认晚上。

---

## 5. Tool 定义（摘要）

| Tool          | 用途     | 关键参数                                                                              |
| ------------- | -------- | ------------------------------------------------------------------------------------- |
| create_task   | 创建任务 | title, dueDate, startTime?, endTime?, timeSegment?, priority?, groupId?, description? |
| query_tasks   | 查询任务 | status?, dueDate?, dueDateFrom?, dueDateTo?, priority?                                |
| update_task   | 修改任务 | taskId, title?, dueDate?, startTime?, endTime?, timeSegment?, priority?, description? |
| delete_task   | 删除任务 | taskId                                                                                |
| complete_task | 完成任务 | taskId                                                                                |

---

## 6. System Prompt 规则（摘要）

- 未给日期强制默认今天
- 今天已过的时间段/具体时间范围必须追问确认，禁止自动纠正
- **有“凌晨/早上/上午/中午/下午/晚上/全天”且无具体时间段时，不追问，直接创建**
- 给出具体时间但不完整时追问补全
- 删除前必须确认
- 修改/删除不确定 ID 先 `query_tasks`
- 仅中文回复，非任务请求礼貌拒绝

---

## 7. 冲突检测

仅在具体时间段模式下检测：

```
existingStart < newEnd AND existingEnd > newStart
```

---

## 8. 路由

- `POST /api/ai/chat`
- `GET /api/ai/messages`

---

## 9. 交互示例（以 2026-02-05 为“今天”）

### 1) 模糊时间段（不追问）

用户：今天下午去买东西  
Agent -> create_task(dueDate="2026-02-05", timeSegment="afternoon")

### 2) 具体时间段（直接创建）

用户：明天下午4点到5点去买东西  
Agent -> create_task(dueDate="2026-02-06", startTime="16:00", endTime="17:00")

### 3) 时间不完整（追问）

用户：明天下午4点去买东西  
Agent：请问结束时间是几点？
