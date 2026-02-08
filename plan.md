# AI Agent 自动化评测 (Eval) 实施计划

## 一、目标

创建一套自动化 Agent 评测测试，验证 AI Agent 在各种用户输入场景下的行为是否正确：
- **工具是否被正确调用**（create_task / query_tasks / update_task / complete_task / delete_task）
- **参数是否被正确提取**（title、dueDate、startTime/endTime、timeSegment、priority、groupId）
- **追问逻辑是否正确**（AM/PM、缺少结束时间、冲突确认）
- **拒绝逻辑是否正确**（非任务请求）

## 二、与现有测试的关系（不重复）

| 现有测试文件 | 覆盖内容 | 评测是否重复 |
|---|---|---|
| `ai-error-handler.test.ts` | 错误类、分类、重试、超时 | 不重复 ✓ |
| `ai.service.test.ts` | LLM 初始化、今天+已过时段的规则兜底 | 不重复 ✓ |
| `ai.complete-flow.integration.test.ts` | DB CRUD、消息保存、冲突检测（数据库层面） | 不重复 ✓ |
| `ai.routes.test.ts` | HTTP 路由、输入校验 | 不重复 ✓ |
| `ai.integration.test.ts` | 占位符测试（无实际断言） | 被取代 |

**关键区别**：现有测试验证的是**代码逻辑正确性**（mock LLM），新 eval 验证的是 **Agent 行为正确性**（真实 LLM + 真实 DB）。

`ai.integration.test.ts` 中的测试全部是占位符（仅 `expect(aiService).toBeDefined()`），不包含任何真实断言。新 eval 测试将覆盖其所有意图场景并提供真实验证，因此将**替换** `ai.integration.test.ts`。

## 三、技术方案

### 3.1 文件

| 操作 | 文件 | 说明 |
|---|---|---|
| 新建 | `packages/server/src/__tests__/ai.agent-eval.test.ts` | Agent 评测主文件 |
| 删除 | `packages/server/src/__tests__/ai.integration.test.ts` | 占位符文件，被新 eval 替代 |

### 3.2 架构

- **真实 LLM 调用**：通过 `AIService.chat()` 端到端调用（AIHUBMIX 或 OpenAI）
- **真实数据库**：使用 `DATABASE_URL`（与 `ai.complete-flow.integration.test.ts` 一致）
- **柔性断言**：由于 LLM 输出非确定性，使用 `toContain` / `toBeTruthy` 等模糊匹配
- **自动清理**：`afterAll` 删除所有测试数据
- **优雅跳过**：DB 或 API Key 不可用时自动跳过整个套件

### 3.3 测试基础设施

```
beforeAll:
  1. 加载 .dev.vars 环境变量
  2. 初始化数据库连接
  3. 创建测试用户
  4. 创建测试群组 "工作"
  5. 将用户加入群组
  6. 初始化 AIService（timezoneOffset = -480，即东八区）
  7. 如果任何步骤失败 → skipSuite = true

beforeEach:
  清空测试用户的 messages 表（隔离对话上下文）

afterAll:
  1. 删除测试用户的所有 tasks
  2. 删除测试用户的所有 messages
  3. 删除测试用户的 taskAssignments
  4. 删除群组成员关系
  5. 删除测试群组
  6. 删除测试用户
```

### 3.4 超时配置

- 单个测试：60000ms（LLM 调用 + 数据库操作）
- 测试套件级别通过 vitest 配置自动管理

## 四、评测用例清单

### 4.1 创建任务 - 正常场景（6 个用例）

| ID | 用户输入 | 期望 type | 期望 payload 断言 |
|---|---|---|---|
| C01 | "帮我创建一个任务，明天去买菜" | task_summary | task.title 包含 "买菜"，task.dueDate = 明天 |
| C02 | "明天下午2点到3点开会" | task_summary | task.startTime = "14:00"，task.endTime = "15:00" |
| C03 | "明天晚上去跑步" | task_summary | task.timeSegment = "evening" |
| C04 | "创建一个高优先级任务：明天提交报告" | task_summary | task.priority = "high" |
| C05 | "后天下午去4S店取车" | task_summary | task.dueDate = 后天 |
| C06 | "在工作群里创建一个任务，明天开周会" | task_summary | task.groupId = testGroupId |

### 4.2 创建任务 - 冲突检测（3 个用例）

| ID | 前置条件 | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|---|
| CF01 | 已有任务 "取快递"（明天，全天） | "明天帮我拿快递" | question | content 包含 "类似任务" 或 "已有" |
| CF02 | 已有任务 14:00-15:00（明天） | "明天14:30到15:30开会" | text 或 question | content 包含 "时间冲突" 或 "冲突" 或 "重叠" |
| CF03 | CF01 后的第二轮对话 | "确认" | task_summary | task 被成功创建 |

### 4.3 创建任务 - 需追问场景（2 个用例）

| ID | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|
| Q01 | "明天4点到5点开会" | question 或 text | content 包含 "上午" 或 "下午" 或 "AM" 或 "PM"（追问确认） |
| Q02 | "明天3点开始开会" | question 或 text | content 包含 "结束" 或 "到几点"（追问结束时间） |

### 4.4 查询任务（2 个用例）

| ID | 前置条件 | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|---|
| QR01 | 已有 2 个明天的任务 | "查看明天的任务" | text | content 包含任务标题信息 |
| QR02 | - | "查看我的任务"（未指定日期） | text 或 question | content 包含 "日期" 或 "哪天" 或 "什么时候" |

### 4.5 更新任务（1 个用例）

| ID | 前置条件 | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|---|
| U01 | 已有任务 "团队会议"（明天） | "把团队会议改到后天" | task_summary | task.dueDate = 后天 |

### 4.6 完成任务（1 个用例）

| ID | 前置条件 | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|---|
| D01 | 已有任务 "写周报"（明天） | "完成写周报" | task_summary 或 text | content 包含 "完成" 或 "已完成" |

### 4.7 删除任务（1 个用例）

| ID | 前置条件 | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|---|
| DEL01 | 已有任务 "旧任务"（明天） | "删除旧任务" | question 或 text | content 包含 "确认" 或 "删除" 或 "确定"（删除前确认） |

### 4.8 非任务请求（2 个用例）

| ID | 用户输入 | 期望 type | 期望断言 |
|---|---|---|---|
| R01 | "给我讲个笑话" | text | content 包含 "任务" 或 "帮忙"（礼貌拒绝） |
| R02 | "今天天气怎么样" | text | content 包含 "任务" 或 "帮忙"（礼貌拒绝） |

### 总计：18 个评测用例

## 五、实施清单

```
IMPLEMENTATION CHECKLIST:
1. 删除 packages/server/src/__tests__/ai.integration.test.ts（占位符文件）
2. 创建 packages/server/src/__tests__/ai.agent-eval.test.ts，包含：
   2.1 导入依赖（vitest, drizzle, AIService, schema 等）
   2.2 测试基础设施（beforeAll/afterAll/beforeEach、测试用户/群组创建与清理）
   2.3 辅助函数：
       - getTomorrowDate(): string — 获取明天日期
       - getDayAfterTomorrowDate(): string — 获取后天日期
       - createTestTask(userId, overrides) — 直接通过 DB 创建前置条件任务
       - itIfReady(name, fn, timeout) — 条件执行（DB/API 不可用时跳过）
   2.4 测试用例组 1：创建任务 - 正常场景（C01~C06）
   2.5 测试用例组 2：创建任务 - 冲突检测（CF01~CF03）
   2.6 测试用例组 3：创建任务 - 需追问场景（Q01~Q02）
   2.7 测试用例组 4：查询任务（QR01~QR02）
   2.8 测试用例组 5：更新任务（U01）
   2.9 测试用例组 6：完成任务（D01）
   2.10 测试用例组 7：删除任务（DEL01）
   2.11 测试用例组 8：非任务请求拒绝（R01~R02）
3. 运行 pnpm test 验证所有测试通过（包括新 eval 和现有测试）
4. 如有测试失败，分析原因并修复（eval 失败可能指示 Agent 行为问题，需调整 prompt 或代码）
```

## 六、断言策略

由于 LLM 输出非确定性，断言采用以下策略：

| 断言维度 | 方法 | 示例 |
|---|---|---|
| 响应类型 | 精确匹配 | `expect(result.type).toBe("task_summary")` |
| 任务标题 | 包含关键词 | `expect(result.payload?.task?.title).toContain("买菜")` |
| 日期 | 精确匹配 | `expect(result.payload?.task?.dueDate).toBe(tomorrow)` |
| 时间 | 精确匹配 | `expect(result.payload?.task?.startTime).toBe("14:00")` |
| 时段 | 精确匹配 | `expect(result.payload?.task?.timeSegment).toBe("evening")` |
| 回复内容 | 包含关键词 | `expect(result.content).toMatch(/类似任务\|已有/)` |
| 冲突任务 | 存在性 | `expect(result.payload?.conflictingTasks?.length).toBeGreaterThan(0)` |

## 七、运行方式

```bash
# 运行所有测试（包括 eval）
cd packages/server && pnpm test

# 仅运行 eval 测试
cd packages/server && pnpm test ai.agent-eval

# 仅运行非 eval 测试（排除 eval）
cd packages/server && pnpm test --exclude '**/ai.agent-eval*'
```

eval 测试需要以下环境变量（从 `.dev.vars` 自动加载）：
- `DATABASE_URL` — 数据库连接
- `AIHUBMIX_API_KEY` 或 `OPENAI_API_KEY` — LLM API
- `AIHUBMIX_BASE_URL`（如使用中转服务）
