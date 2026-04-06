# HomeTask 项目全面理解文档

> 创建时间：2026-04-06
> 目的：记录对项目的深度理解，供后续会话压缩后快速恢复上下文

---

## 一、项目定位

全栈 AI 任务管理平台，面向家庭/小团队，核心卖点是**对话式 AI Agent 创建和管理任务**。
定位为 **AI Agent 工程能力展示项目**（面向求职/B2B），而非消费级产品。

---

## 二、技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + React Router 7 + TanStack Query + Radix UI + Tailwind CSS |
| 后端 | Hono，支持 Cloudflare Workers 与 Node.js 两种运行方式 |
| 数据库 | PostgreSQL (Neon Serverless) + Drizzle ORM |
| 认证 | Better Auth v1.4.18（邮箱密码 + 用户名登录，OAuth 账户表已预留但未接入） |
| AI | LangChain Core + @langchain/openai + LangGraph（多 Agent） |
| LLM | DeepSeek V3.2 (via AiHubMix 中转) 或 GPT-4o (OpenAI 直连) |
| 邮件 | Resend |
| 包管理 | pnpm workspace (monorepo) |
| 测试 | Vitest |

---

## 三、Monorepo 结构

```
home-task/
├── packages/
│   ├── server/     # Hono 后端 (Cloudflare Workers)
│   ├── web/        # React 前端 (Vite)
│   ├── shared/     # 共享类型和 API 定义
│   └── mobile/     # 空目录，预留 React Native
├── docs/           # 设计文档和笔记
└── .claude/        # Claude Code 配置 + 本文档
```

---

## 四、数据库表结构（Drizzle ORM，schema.ts）

| 表 | 用途 |
|----|------|
| users | 用户账户 |
| sessions | 会话管理 |
| accounts | OAuth 账户 |
| verifications | 邮箱验证 |
| groups | 组/家庭 |
| group_users | 组成员关系 (M:N) |
| tasks | 任务记录（含重复任务模板和实例） |
| task_assignments | 任务指派 (M:N) |
| devices | 设备绑定（个人或组） |
| messages | AI 聊天历史（含结构化 payload） |
| reminders | 任务提醒 |

**关键设计：**
- 时间双模式：精确时间 (startTime/endTime) 和模糊时段 (timeSegment 枚举)
- 重复任务：模板 + 实例分离，创建时全量生成（Serverless 友好，无 cron）
- 消息类型：text / task_summary / question，payload 为 JSONB

---

## 五、后端 API 路由

| 路由组 | 端点 | 功能 |
|--------|------|------|
| `/api/auth/*` | Better Auth 内置 | 注册/登录/验证 |
| `/api/tasks` | POST/GET/PATCH/DELETE | 任务 CRUD + 状态更新 + 过滤 |
| `/api/groups` | POST/GET/PATCH/DELETE + /join | 组管理 + 邀请码加入 |
| `/api/users/me` | GET/PATCH + /password + /groups | 用户信息 + 改密 + 组列表 |
| `/api/devices` | POST/GET/DELETE | 设备绑定管理 |
| `/api/ai/chat` | POST | AI 对话（环境变量 `ENABLE_MULTI_AGENT` 控制单/多 Agent） |
| `/api/ai/messages` | GET | 聊天历史（最近 20 条，最多 100） |

---

## 六、后端服务层

| 服务 | 文件 | 核心职责 |
|------|------|----------|
| TaskService | task.service.ts (31KB) | 任务 CRUD、校验、重复任务生成、权限控制 |
| GroupService | group.service.ts | 组 CRUD、邀请码、成员管理 |
| UserService | user.service.ts | 用户信息、组列表 |
| DeviceService | device.service.ts | 设备绑定管理 |
| EmailService | email.service.ts | 邮件发送 (Resend) |
| AIService | ai.service.ts (49KB) | 单 Agent AI 对话 |
| MultiAgentService | services/multi-agent/ | 多 Agent AI 对话 |

---

## 七、AI 实现详解（面试核心）

### 7.1 Single-Agent（ai.service.ts，~1300 行）

**架构决策：手写 Agent Loop，不用 AgentExecutor**
- 原因：减少依赖、控制打包体积（历史上曾超 CF Workers 免费 3MB 限制，当前已优化至约 4MB/1.2MB gzip）
- 实现：while 循环，最多 10 轮迭代，每轮检查 LLM 返回是否有 tool_calls

**System Prompt 构建（动态注入）：**
- 当前日期 + 星期几（用户时区）
- 当前时间段（凌晨/早上/上午/中午/下午/晚上）
- 用户所属组列表
- 详细的任务提取规则
- 时间处理指导（精确 vs 模糊）
- Tool 使用说明

**5 个 Tools（OpenAI JSON Schema 格式，非 Zod）：**
1. `create_task` - 创建任务，自动冲突检测
2. `query_tasks` - 按日期/状态/优先级查询
3. `update_task` - 修改任务
4. `complete_task` - 标记完成
5. `delete_task` - 删除（需确认）

**核心特性：**
- **语义冲突检测**：Dice 系数（bigram 重叠率 ≥ 0.75 触发警告）（在 AI 层实现，非 TaskService）
- **时间冲突检测**：精确时间范围重叠判断（在 AI 层实现，多 Agent 见 `conflict.helpers.ts`）
- **确认流程**：过去时间段需确认、冲突需确认
- **幻觉检测**：捕获 LLM 声称成功但未执行 tool 的情况
- **意图推理**：轻量 NLU 判断用户意图（create/query/update/complete/delete）

**时间处理双模式（互斥）：**
- 精确模式：startTime + endTime（都必须提供）
- 模糊模式：timeSegment 枚举（all_day, early_morning, morning, forenoon, noon, afternoon, evening）
- 时间归一化："3点" + "下午" → "15:00"

**响应类型：**
```typescript
type MessageType = "text" | "task_summary" | "question"
// task_summary: 创建成功，附带任务卡片
// question: 冲突警告，需要用户确认
```

### 7.2 Multi-Agent（services/multi-agent/，LangGraph）

**架构：Supervisor 模式**
- Supervisor Agent 作为路由层，分发请求到专家 Agent
- 基于 `@langchain/langgraph` + `@langchain/langgraph-supervisor`

**4 个专家 Agent：**

| Agent | 文件 | Tools | 状态 |
|-------|------|-------|------|
| Task Agent | task.agent.ts | create/modify/finish/remove_task, query_tasks | 已实现 |
| Calendar Agent | calendar.agent.ts | get_day_schedule, find_free_slots | 已实现 |
| Weather Agent | weather.agent.ts | get_weather | Mock 数据 |
| Notification Agent | notification.agent.ts | schedule/list/cancel_reminder | 已实现（写入 reminders 表） |

**Supervisor 路由规则：**
- 任务操作 → task_agent
- 日程/空闲时间 → calendar_agent
- 天气查询 → weather_agent
- 提醒设置 → notification_agent
- 复杂请求 → 多 Agent 协作
- 超出范围 → 礼貌引导回任务/日程管理

**Tool 定义用 Zod schema**（与单 Agent 不同，多 Agent 用 LangChain 的 tool 抽象）

**跨 Agent 协作示例：**
"周六早上去机场" → Supervisor 分发到 Task Agent（创建任务）+ Weather Agent（查天气）+ Notification Agent（设提醒）

### 7.3 LLM 工厂（llm.factory.ts）

**双 Provider 支持：**
- 优先：AiHubMix 中转服务 → DeepSeek V3.2
- 回退：OpenAI 官方 API → GPT-4o

**环境变量：**
```
OPENAI_API_KEY        # OpenAI 直连密钥
AIHUBMIX_API_KEY      # 中转服务密钥
AIHUBMIX_BASE_URL     # 中转服务地址
AIHUBMIX_MODEL_NAME   # 模型名（默认 deepseek-v3.2）
```

### 7.4 错误处理（ai-error-handler.ts）

- 错误分类：TIMEOUT / NETWORK / API_ERROR / PARSE_ERROR / VALIDATION_ERROR / UNKNOWN
- 指数退避重试：最多 2 次重试，初始 2s，最大 10s
- 可重试：网络错误、超时、5xx、429
- 60 秒超时兜底

### 7.5 AI 请求流程（端到端）

**共同入口：**
```
前端 ChatInput → ai.api.chat(message)
  ↓ POST /api/ai/chat
  Header: x-timezone-offset (时区偏移)
  ↓
后端 ai.routes.ts → 根据环境变量 ENABLE_MULTI_AGENT 选择 AIService 或 MultiAgentService
```

**Single-Agent 路径（AIService）：**
```
加载最近 20 条对话历史（排除 system 消息）
  ↓
构建动态 System Prompt（注入日期/时间段/组列表）
  ↓
Agent Loop（最多 10 轮）:
  LLM 返回 → 有 tool_calls? → 执行 tool → 结果返回 LLM → 继续
  LLM 返回 → 无 tool_calls? → 提取最终回复 → 退出循环
  ↓
保存 assistant 消息到 messages 表（含 type 和 payload）
  ↓
返回 { content, type, payload } → 前端根据 type 渲染不同 UI
```

**Multi-Agent 路径（MultiAgentService）：**
```
构建 LangGraph Supervisor（含 4 个专家 Agent）
  ↓
以当前用户消息调用 graph.invoke()（不加载历史对话，MemorySaver 仅请求内有效）
  ↓
Supervisor 路由到对应专家 Agent → Agent 执行 tool → 返回结果
  ↓
保存 assistant 消息到 messages 表
  ↓
返回 { content, type, payload }
```

### 7.6 面试高频问题预判

1. **为什么手写 Agent Loop 而不用 AgentExecutor？**
   → 减少依赖、控制打包体积（CF Workers 环境），提高可控性

2. **单 Agent 和多 Agent 各自的优劣？**
   → 单 Agent：简单直接，所有逻辑集中；多 Agent：职责分离，可扩展，适合复杂场景

3. **冲突检测怎么做的？**
   → 双重：语义（Dice 系数 bigram 匹配）+ 时间段重叠（范围交集判断）

4. **时间处理的设计考量？**
   → 双模式互斥设计，避免歧义；模糊时段适配自然语言习惯

5. **Supervisor 模式的优势？**
   → 单一入口路由，子 Agent 专注领域逻辑，支持跨 Agent 协作

6. **为什么 Tool 定义用两种方式？**
   → 单 Agent 用原生 JSON Schema 避免 Zod v3/v4 冲突和体积；多 Agent 用 Zod 因为 LangGraph 原生支持

7. **幻觉检测怎么实现？**
   → 对比 LLM 文本声明和实际 tool 执行记录，不一致则标记

8. **如何处理时区？**
   → 前端发 x-timezone-offset header，后端基于偏移计算用户本地日期/时间

---

## 八、前端架构

### 8.1 Feature 模块

| 模块 | 组件 | 功能 |
|------|------|------|
| ai/ | AIView, ChatInput, ChatMessage | AI 对话界面 |
| auth/ | LoginView, RegisterView, VerifyEmailView, ForgetPasswordView, ResetPasswordView | 认证流程 |
| task/ | CreateTaskModal, TaskFormAssignees, TaskFormRecurring | 任务创建表单 |
| today/ | TodayView, TodayHeader, GroupTasksList | 今日视图 |
| week/ | WeekView, DayGroup | 周视图 |
| group/ | GroupView, MyCreatedGroupsView, MyJoinedGroupsView, CreateGroupModal | 组管理 |
| profile/ | ProfileView | 用户设置 |
| landing/ | LandingPage, HeroSection, FeatureCards, TechStackSection | 落地页 |

### 8.2 状态管理

- **AuthContext**：全局认证状态（user, login, logout, session）
- **AppContext**：应用状态（modal 控制、组列表、用户设置）
- **TanStack Query**：服务端状态缓存和同步

### 8.3 前端 AI 交互

- `ai.api.ts`：chat(), getMessages(), transcribeAudio()（预留）, confirmTask()
- ChatMessage 根据 type 渲染：text（纯文本）、task_summary（任务卡片）、question（冲突提示卡片，确认按钮交互未实现）
- AIView 加载最近 20 条历史，滚动到底部

---

## 九、已实现 vs 预留功能

| 功能 | 状态 |
|------|------|
| 用户认证（注册/登录/验证/重置密码） | ✅ 已实现 |
| 组管理（创建/邀请码加入/成员管理） | ✅ 已实现 |
| 任务 CRUD + 过滤 | ✅ 已实现 |
| 重复任务（daily/weekly/monthly） | ✅ 已实现 |
| AI 单 Agent 对话式任务管理 | ✅ 已实现 |
| AI 多 Agent（Supervisor 模式） | ✅ 已实现 |
| Calendar Agent（日程查看/空闲时段） | ✅ 已实现 |
| Weather Agent | ⚠️ Mock 数据 |
| Notification Agent（提醒） | ⚠️ 部分实现（写入 DB，未发送） |
| 语音输入（Whisper） | ⚠️ 客户端 API 包装预留，后端路由未接通 |
| 任务确认交互 | ⚠️ 客户端 API 包装预留（confirmTask），前端 UI 和后端路由均未实现 |
| 流式对话 | ⚠️ 客户端有 stream 参数预留，后端未实现 |
| 设备绑定 | ⚠️ API 已有，公开端点默认关闭（`ENABLE_PUBLIC_DEVICE_TASKS_ENDPOINT = false`），无硬件对接 |
| Mobile App (React Native) | ❌ 空目录 |
| E-ink 显示屏 (ESP32) | ❌ 未实现 |
| Landing Page | ✅ 已实现 |

---

## 十、文档现状分析

### 根目录文件（需整理）

| 文件 | 内容 | 处理建议 |
|------|------|----------|
| README.md | 英文项目介绍 | 保留 |
| README_CN.md | 中文项目介绍 | 保留 |
| DEPLOY_CLOUDFLARE.md | 部署指南 | 保留（或移入 docs/） |
| CLAUDE.md | Claude Code 配置 | 保留 |
| AGENTS.md | = CLAUDE.md 副本 | 可删除 |
| TEST_SUMMARY.md | 测试框架总结 | 移入 docs/ |
| plan.md | 开发路线图 | 过时，需更新 |
| 开发流程.md | = plan.md 中文版 | 合并后删除 |
| showcase-home-task.md | 展示策略 | 移入 docs/ |
| task.service.issues.md | TaskService 问题清单 | 移入 docs/ |
| codex.md | 只有一行 | 删除 |

### docs/ 目录文件

| 文件 | 内容 | 处理建议 |
|------|------|----------|
| 原始PRD.md | 原始需求文档 | 保留，标注为历史文档 |
| AI-System-Prompt改进需求.md | Prompt 规范 v1.1 | 可整合到 Single-Agent 设计文档 |
| Single-Agent设计文档.md | 单 Agent 设计 | 保留，标注为 legacy |
| multi-agent-design.md | 多 Agent 架构设计 | 保留，核心文档 |
| multi-agent-implementation-plan.md | 多 Agent 实现计划 | 需更新完成状态 |
| agent-design-principle.md | Agent 设计原则 | 保留 |
| 推理型应用LLM模型选择对比.md | LLM 选型 | 保留 |
| 重复任务系统设计文档.md | 重复任务设计 | 需核对代码一致性 |
| timezone.md | 时区规范 | 保留 |
| monorepo-notes.md | Monorepo 笔记 | 保留，学习参考 |
| supabase-edge-functions-notes.md | Supabase 笔记 | 保留，对比参考 |
| 语音功能实现思路与问题复盘-2026-04-04.md | 语音功能复盘 | 保留，标注为参考 |

---

## 十一、关键架构决策总结（面试叙事用）

1. **Monorepo (pnpm workspace)**：编译期类型共享、原子提交、统一工具链
2. **Serverless (Cloudflare Workers)**：自动伸缩、全球边缘部署、零冷启动费用
3. **手写 Agent Loop**：减少依赖、控制打包体积、提高可控性
4. **Drizzle ORM**：类型安全、轻量、适合 Serverless
5. **双 LLM Provider**：成本优化（DeepSeek V3.2 $3-5/月 vs GPT-4o）
6. **Supervisor 多 Agent 模式**：职责分离、可扩展、支持复杂意图分解
7. **时间双模式设计**：兼容自然语言模糊表达和精确时间指定
8. **重复任务全量生成**：Serverless 友好，避免 cron 依赖
9. **Better Auth**：开箱即用认证，支持 OAuth 扩展
10. **Neon Serverless PostgreSQL**：HTTP 连接、按需计费、适配 Workers

