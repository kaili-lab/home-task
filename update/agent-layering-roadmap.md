# Agent 分层与项目演进路线图

## 1. 文档目的

这份文档回答三个问题：

1. 我认为可以怎样给 Agent 系统做工程分层
2. 当前项目在单 Agent 与多 Agent 两条线上，分别已经做到哪一层
3. 如果继续演进，每一层还缺什么、应该怎么做、优先级怎么排

说明：

- 这套分层是工程归纳，不是 LangChain / OpenAI / Anthropic 中任何一家官方原封不动的标准命名
- 但它与主流一手资料的共识方向一致，适合作为本项目后续学习和设计的统一坐标系
- 单 Agent 和多 Agent 需要分开看，不能共用一套演进建议

---

## 2. 我采用的 6 层分层模型

### 第 1 层：运行核心层

目标：先把 Agent 跑起来。

包含：

- model
- messages
- tools
- agent loop / graph runtime

判断标准：

- 能稳定接收用户输入
- 能调用模型
- 能使用工具
- 能在工具执行后继续推进流程

### 第 2 层：上下文层

目标：决定“每一轮到底给模型看什么”。

包含：

- dynamic system prompt
- history 管理
- short-term memory
- session state
- summary
- context builder

判断标准：

- 长对话不明显退化
- 当前状态不依赖模型硬记
- 上下文组成可解释

### 第 3 层：编排层

目标：让流程从“自由循环”升级为“可控工作流”。

包含：

- routing
- stage-based workflow
- multi-step orchestration
- handoff
- planner / worker
- graph coordination

判断标准：

- 常见流程有固定路径
- agent 轮数受控
- 复合请求的处理链路清晰

### 第 4 层：知识层

目标：让系统拥有当前会话之外还能复用的信息。

包含：

- long-term memory
- user profile
- retrieval / RAG
- external knowledge store

判断标准：

- 跨会话偏好可复用
- 业务知识与用户知识边界清晰
- 不必每次都从原始历史重新猜

### 第 5 层：可靠性层

目标：即使模型判断出错，也不要让系统失控。

包含：

- guardrails
- approvals
- tool validation
- stop conditions
- idempotency
- eval baselines

判断标准：

- 高风险动作有确定性约束
- 错误路径清楚
- 改动后可验证回归风险

### 第 6 层：生产层

目标：让系统能被上线、追踪、复盘和持续优化。

包含：

- tracing
- logging
- metrics
- token / latency / cost 监控
- prompt / policy versioning
- deployment / rollback

判断标准：

- 出问题时能定位
- 行为变化可追踪
- 成本与性能可治理

---

## 3. 当前项目的两条路线

### 3.1 单 Agent 路线

主要代码：

- `packages/server/src/services/ai/index.ts`
- `docs/Single-Agent设计文档.md`

特点：

- 手写 tool loop
- 只使用 `@langchain/openai` + `@langchain/core/messages`
- 用 OpenAI 原生 tool schema
- 业务规则、上下文、循环控制高度集中在一个 service

### 3.2 多 Agent 路线

主要代码：

- `packages/server/src/services/multi-agent/`
- `docs/multi-agent-design.md`
- `docs/multi-agent-implementation-plan.md`

特点：

- 使用 `@langchain/langgraph` + `@langchain/langgraph-supervisor`
- 由 Supervisor + 4 个子 Agent 组成
- 工具通过 `tool()` + `zod` 定义
- 已有集成测试、单元测试与 eval 用例

---

## 4. 单 Agent 分层评估与演进建议

## 4.1 第 1 层：运行核心层

### 已做什么

当前单 Agent 已经具备完整的最小运行核心：

- 使用 `ChatOpenAI` 作为模型适配层
- 使用 `SystemMessage / HumanMessage / AIMessage / ToolMessage`
- 使用 OpenAI 原生 tool schema 定义 `create_task / query_tasks / update_task / complete_task / delete_task`
- 手写 `invoke -> executeToolCall -> ToolMessage -> 再 invoke` 循环
- 有最大 10 轮的停止条件

### 还缺什么

运行核心虽然齐了，但边界还不够干净：

- LLM 创建、上下文组装、工具执行、业务规则、历史持久化都集中在一个文件
- loop 控制和业务决策耦合较重
- tool registry 与 tool executor 还不是可复用 runtime 组件

### 应该怎么做

建议把 `services/ai/index.ts` 内部逐步拆出 5 个边界：

1. `llm factory`
2. `tool definitions`
3. `tool executor`
4. `loop controller`
5. `response adapter`

同时保留当前“OpenAI 原生 tool schema + 手写 loop”的总体路线，不必为了追求框架统一而强行切回高层 Agent API。

### 这一层的完成标准

- 换模型不需要改 loop
- 增删 tool 不需要动历史管理逻辑
- 运行核心可以独立测试

---

## 4.2 第 2 层：上下文层

### 已做什么

当前单 Agent 已经做了基础上下文管理：

- 动态 system prompt
- 从数据库读取最近消息历史
- 不把历史 system message 混入新一轮上下文
- 根据用户时区注入日期、星期、当前时段
- 读取最近一条 assistant 消息辅助确认逻辑

### 还缺什么

当前上下文层仍然比较“消息驱动”，而不是“状态驱动”：

- 没有显式 `session state`
- 没有 summary
- message trimming 仍偏固定窗口
- “等待确认”“上一轮候选任务”等状态还主要埋在消息文本里
- 没有统一的 `context builder`

### 应该怎么做

建议分三步补齐：

1. 引入显式 `session_state`
   - `awaiting_confirmation`
   - `pending_action`
   - `pending_task_id`
   - `candidate_task_ids`

2. 引入 `context builder`
   - 动态 system prompt
   - recent messages
   - session state
   - summary
   - runtime facts
   分开构造，再统一喂给模型

3. 引入 summary
   - 长度超阈值时，把较早历史压缩为当前任务摘要
   - 保留任务阶段、候选项、待确认事项、用户短期偏好

### 这一层的完成标准

- 当前流程状态不靠模型自己记
- 对话变长时质量不明显退化
- context 组成可解释且可测试

---

## 4.3 第 3 层：编排层

### 已做什么

单 Agent 现在已经有一些“轻编排”迹象：

- 意图推断
- 首轮在必要时强制 tool call
- 冲突和确认状态下提前返回
- 对“今天已过时间”“删除前确认”等场景做流程拦截

### 还缺什么

这些能力更多是散落在 service 中的局部流程控制，不是显式工作流：

- 没有阶段化流程定义
- 没有显式状态机
- “先查再改”“先定位再删”“先澄清再执行”仍依赖大量分支判断
- 复杂请求容易继续把逻辑压进 `services/ai/index.ts`

### 应该怎么做

建议先做“半显式工作流”，不必一开始就 LangGraph 化：

1. 抽出稳定阶段
   - 意图识别
   - 目标定位
   - 参数补全
   - 风险确认
   - 执行动作
   - 回复收口

2. 对高频路径做确定化
   - `delete / update / complete` 一律先定位目标
   - 多候选时先澄清
   - 无 taskId 时由系统主导查找，而不是完全依赖模型试错

3. 必要时再升级为显式状态机或 LangGraph workflow

### 这一层的完成标准

- 常见操作路径固定下来
- loop 次数下降
- 复杂条件分支不再全部挤在一个 service 中

---

## 4.4 第 4 层：知识层

### 已做什么

单 Agent 当前主要还是依赖业务数据库和会话历史：

- 用户群组信息会进入 system prompt
- 任务数据来自业务表
- 历史消息保存在 `messages` 表中

### 还缺什么

当前没有清晰的“知识层”抽象：

- 没有 long-term memory
- 没有 user profile
- 没有稳定偏好提炼
- 没有 retrieval 设计

### 应该怎么做

单 Agent 的知识层不要一开始做太重。

建议优先只做两类信息：

1. 用户长期偏好
   - 回复风格
   - 详细/简洁模式
   - 常用群组别名
   - 常用时间表达偏好

2. 任务相关的可复用配置
   - 某些默认规则
   - 用户级开关

不建议当前阶段先为单 Agent 引入大而全的 RAG。

### 这一层的完成标准

- 跨会话偏好可以复用
- 不必每次从历史里重新猜用户习惯

---

## 4.5 第 5 层：可靠性层

### 已做什么

单 Agent 当前已经有相当多的可靠性基础：

- 时间合法性检查
- 时间冲突检测
- 语义冲突检测
- 删除前确认
- 超过最大循环次数时兜底
- 对“模型声称已执行但其实没执行”做了幻觉检测
- 已有单测、集成测试、eval 相关测试文件

### 还缺什么

当前可靠性还偏“规则集合”，没有完全系统化：

- 缺少显式 approval state
- 缺少幂等设计
- 缺少统一错误分类
- 高风险路径的 guardrails 还没有单独成层
- prompt / policy / tool schema 缺少版本视角

### 应该怎么做

建议优先补这几项：

1. 显式 approval state
   - 删除、修改高风险动作必须绑定确认状态

2. 统一错误分类
   - 模型理解失败
   - tool 参数失败
   - tool 执行失败
   - 外部依赖失败
   - 需要用户确认

3. request 幂等或去重策略
   - 防止短时间重复创建

4. 固定行为基线
   - 删除确认
   - 多候选澄清
   - 今天已过时间追问
   - 未指定日期不全查

### 这一层的完成标准

- 高风险动作不会只靠 prompt 约束
- 错误路径统一可控
- 关键行为有稳定测试基线

---

## 4.6 第 6 层：生产层

### 已做什么

单 Agent 在生产层目前只具备基础能力：

- 有测试
- 有基础错误处理
- 有最大轮数兜底

### 还缺什么

缺少对 Agent 运行过程的真正可观测性：

- 没有 step-level tracing
- 没有 token / latency / cost 统计
- 没有 prompt / tool schema / policy 版本化
- 没有线上行为回放视图

### 应该怎么做

建议按从轻到重的顺序补：

1. 记录每轮调用元数据
   - requestId
   - loop 次数
   - tool call 序列
   - 终止原因

2. 记录成本与时延

3. 建立回放与对比机制
   - 典型用户输入
   - 输出结果
   - 所用 prompt / policy 版本

4. 视需要接入 tracing 平台

### 这一层的完成标准

- 出问题时能知道是哪个步骤坏了
- 行为变化可追踪
- 成本和时延有数据支撑

---

## 4.7 单 Agent 建议实施顺序

建议顺序不是 `1 -> 2 -> 3 -> 4 -> 5 -> 6`，而是：

1. 继续整理第 1 层
2. 先补第 2 层
3. 紧接着补第 5 层
4. 再做第 3 层
5. 第 4 层只先做轻量 profile
6. 最后补第 6 层

原因：

- 单 Agent 当前的主要矛盾，不是“能力太少”，而是“状态和规则都堆在一个大 service 里”
- 所以优先级应是“把上下文和风险控制做实”，不是先把编排做复杂

---

## 5. 多 Agent 分层评估与演进建议

## 5.1 第 1 层：运行核心层

### 已做什么

多 Agent 当前在运行核心层已经明显强于单 Agent：

- 有 `createLLM()` 工厂
- 有 `createReactAgent()` 创建 4 个子 Agent
- 有 `createSupervisor()` 做总调度
- tool 使用 `tool()` + `zod` 定义
- 运行时上下文通过 `configurable` 注入
- 统一 `ToolResult` 结构
- 有 `MultiAgentService` 作为对外入口

### 还缺什么

运行核心整体已经成立，但仍有一些可继续收敛的点：

- 各 Agent 的 prompt / context 组装方式还不完全统一
- 共享 runtime contract 还可以再抽象
- Supervisor 与子 Agent 的 handoff 语义还主要靠 prompt 约定

### 应该怎么做

建议继续统一 3 件事：

1. 共享 context contract
2. 共享 tool result contract
3. 共享 agent factory 约定

这一层不需要大改，重点是“收口一致性”，而不是推倒重来。

### 这一层的完成标准

- 新增子 Agent 时接入模式一致
- handoff 输入输出边界清楚
- 共享运行时能力可复用

---

## 5.2 第 2 层：上下文层

### 已做什么

多 Agent 当前已经具备上下文层的雏形：

- 使用 `thread_id` 驱动图执行线程
- 使用 `MemorySaver` 作为 checkpointer
- 通过 `configurable` 注入 `db / userId / timezoneOffsetMinutes`
- Task Agent 会动态注入当天日期与当前时段

### 还缺什么

这是多 Agent 当前最值得优先补的一层：

- `MemorySaver` 只适合开发，不适合生产
- 没有持久化 checkpointer
- 没有 summary
- 没有共享 `context builder`
- 没有显式跨 Agent `session state`
- 用户偏好、长期 profile 没有进入上下文系统

### 应该怎么做

建议按这个顺序补：

1. 从 `MemorySaver` 升级到持久化 checkpointer
   - 例如 Postgres checkpointer

2. 设计共享上下文模型
   - thread state
   - user profile
   - session state
   - summary

3. 让 Supervisor 和子 Agent 使用统一的 context builder

4. 为跨 Agent 协作增加显式状态
   - 当前已查询出的任务候选
   - 待确认动作
   - 已完成的子任务结果

### 这一层的完成标准

- 服务重启后 thread 状态不丢
- 跨 Agent 协作不靠纯消息历史硬拼
- 长对话仍能稳定运行

---

## 5.3 第 3 层：编排层

### 已做什么

多 Agent 当前最成熟的层，就是编排层：

- 已有 Supervisor + SubAgent 结构
- 已划分 Task / Calendar / Weather / Notification 四类职责
- 可以处理复合请求
- 已有集成测试与 eval 覆盖多 Agent 流程

### 还缺什么

虽然已经进入多 Agent 编排，但当前编排仍偏“LLM 路由 + Agent 自由协作”：

- 路由主要靠 prompt
- 跨 Agent 的顺序与依赖关系不够显式
- 复合流程缺少结构化 handoff 协议
- 没有 planner / worker / aggregator 这类更细编排角色

### 应该怎么做

建议在“最常见的跨 Agent 场景”上，先从自由编排升级为显式工作流：

1. 任务 + 通知
   - 先创建任务，再安排提醒

2. 任务 + 天气 + 通知
   - 先确定任务，再查天气，再生成提醒

3. 日历 + 任务
   - 先看空闲时间，再创建任务

可以先把这些高频场景抽成显式 graph path，而不是完全交给 Supervisor 自己决定。

### 这一层的完成标准

- 典型跨 Agent 场景链路固定
- handoff 更可解释
- 复合请求结果更稳定

---

## 5.4 第 4 层：知识层

### 已做什么

多 Agent 已经开始接触知识层，但还比较轻：

- Task / Calendar / Notification 依赖数据库业务数据
- Weather Agent 已有天气 tool 接口
- 提醒文案会聚合天气信息

### 还缺什么

当前知识层仍很初级：

- 天气仍是 Mock 数据
- 没有 long-term memory
- 没有 user profile
- 没有跨 Agent 共享知识视图
- 没有 retrieval / RAG 设计

### 应该怎么做

建议分两步走：

1. 先把“真实外部知识”接通
   - 把天气从 Mock 升级为真实 API

2. 再做“用户长期知识”
   - 用户偏好
   - 常用城市
   - 常用提醒方式
   - 常见群组或别名

在当前项目范围内，不建议为了“多 Agent 看起来更高级”而过早引入大规模 RAG。

### 这一层的完成标准

- 子 Agent 可以访问真实而稳定的外部知识源
- 用户偏好开始跨会话复用

---

## 5.5 第 5 层：可靠性层

### 已做什么

多 Agent 当前已经具备不少可靠性基础：

- tool 使用 `zod` 做参数校验
- 统一 `ToolResult` 结构
- task tool 中已做冲突检测与确认返回
- 有单元测试、集成测试和 eval 测试
- Supervisor 输出使用 `full_history`，保证 payload 可提取

### 还缺什么

多 Agent 的可靠性问题和单 Agent 不完全一样，重点在“跨 Agent 风险”：

- 没有持久化 approval state
- 没有跨 Agent 的幂等与去重约束
- 没有显式的 handoff guardrails
- 没有统一的错误恢复策略
- Supervisor 层的路由决策缺少独立安全检查

### 应该怎么做

建议优先补：

1. 持久化 approval / pending action state

2. 跨 Agent 幂等控制
   - 防止“创建任务后重复安排提醒”

3. handoff guardrails
   - 哪些 Agent 可以调用哪些下游能力
   - 哪些动作必须先经过确认节点

4. 明确错误恢复路径
   - 某个子 Agent 失败时，整体如何回复
   - 是否允许部分成功

5. 为复合请求建立行为基线 eval

### 这一层的完成标准

- 跨 Agent 副作用不容易重复触发
- 复合流程遇错时行为可预测
- 高风险动作在图层和工具层都有保护

---

## 5.6 第 6 层：生产层

### 已做什么

多 Agent 在生产层起点比单 Agent 好一些：

- 已有更完整的测试矩阵
- 已有 eval 用例
- 模块化结构更适合接入 tracing

### 还缺什么

仍缺少真正面向生产的运行观测能力：

- 没有 graph step tracing
- 没有 per-agent 成本/时延统计
- 没有 prompt / graph / tool schema 版本管理
- 没有运行态 dashboard

### 应该怎么做

建议按从轻到重的顺序推进：

1. 记录每次图执行的基础元数据
   - thread_id
   - 触发的 Agent 序列
   - tool call 序列
   - 终止原因

2. 统计 per-agent 成本、时延、错误率

3. 为 Supervisor prompt、子 Agent prompt、tool schema 做版本化

4. 视需要接入 tracing / observability 平台

### 这一层的完成标准

- 一次跨 Agent 请求的链路可以回放
- 哪个 Agent 最贵、最慢、最不稳定可以量化
- 升级前后行为变化可比较

---

## 5.7 多 Agent 建议实施顺序

多 Agent 的优先级和单 Agent 不同，建议顺序是：

1. 先补第 2 层
2. 再补第 5 层
3. 再补第 6 层
4. 然后增强第 3 层
5. 第 4 层分阶段推进
6. 第 1 层只做收口，不做大改

原因：

- 多 Agent 当前最大的短板，不是“没有编排”，而是“状态持久化、上下文共享、跨 Agent 风险控制”还不够强
- 所以不应优先继续加更多 Agent，而应先把 thread state、guardrails 和 observability 补齐

---

## 6. 单 Agent 和多 Agent 的关键差异

### 单 Agent 的核心矛盾

- 逻辑过于集中
- 状态隐含在消息里
- 业务规则和 runtime 耦合

所以单 Agent 的重点是：

- 把大 service 拆出边界
- 把隐式状态变成显式状态
- 把自由循环升级成轻工作流

### 多 Agent 的核心矛盾

- Agent 数量增多后，上下文共享与风险控制变复杂
- 跨 Agent handoff 容易只靠 prompt 维持
- 运行链路更长，更需要可观测性

所以多 Agent 的重点是：

- 做好 thread state 和持久化 checkpointer
- 做好 handoff 协议和 guardrails
- 做好 tracing、eval 和版本化

---

## 7. 面向当前项目的建议结论

### 单 Agent

当前最值得做的不是继续往 `services/ai/index.ts` 里塞规则，而是：

1. 拆 runtime 边界
2. 补 `session state`
3. 补 summary
4. 强化 approval / error taxonomy / 幂等
5. 再考虑把高频流程工作流化

### 多 Agent

当前最值得做的不是继续扩 Agent 数量，而是：

1. 把 `MemorySaver` 升级为持久化 checkpointer
2. 设计共享上下文模型
3. 明确跨 Agent approval / handoff / idempotency
4. 建立 graph tracing 与 per-agent metrics
5. 再把高频复合请求改成显式 graph path

---

## 8. 一句话总结

同样是 Agent 系统，单 Agent 和多 Agent 的“下一步”完全不同：

- 单 Agent 要先解决“一个大脑里塞太多东西”的问题
- 多 Agent 要先解决“多个大脑之间怎么共享状态、怎么安全协作”的问题

这也是为什么两条路线必须分开设计、分开评估、分开演进。

