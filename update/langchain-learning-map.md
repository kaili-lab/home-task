# LangChain 学习地图（结合当前项目）

## 1. 这份文档的目的

这不是对 LangChain 文档的逐页翻译，而是把下面三部分收束到一张可长期复用的学习地图里：

- LangChain JavaScript 最新官方文档的主线概念
- 当前项目单 agent 模块已经在使用的能力与取舍
- 围绕 Tool、Agent Loop、Context Engineering、Memory、动态 prompt、summary、guardrails、context 思维的追问与补充

建议把这份文档当作后续继续研究 LangChain / LangGraph 的索引入口，而不是一次性笔记。

---

## 2. 先建立总地图

如果脑中只保留一句话，应当是：

> LangChain 更适合被理解为“LLM 应用运行时与组织方式”，主线是 `Model + Messages + Tools + Agent Loop + Context Engineering`，不是单纯的 prompt 库。

### 2.1 最重要的 12 个概念

1. `Model`
   - 统一不同模型提供方的调用接口。
   - 作用是”让应用逻辑不被 provider API 绑死”。
   - 当前项目主要使用 `ChatOpenAI`。

2. `Messages`
   - 上下文不是一大段字符串，而是一组消息对象。
   - 常见类型：`SystemMessage`、`HumanMessage`、`AIMessage`、`ToolMessage`。
   - Agent 本质上就是围绕这些消息做循环。

3. `Tools`
   - Tool 是”给模型可调用的外部能力”。
   - 核心有两部分：给模型看的 schema / description，和真正执行逻辑的实现。
   - Tool 的**返回值**同样重要——它决定了 LLM 下一步的判断质量和上层代码的 payload 提取能力（详见第 15 节）。

4. `Agent Loop`
   - 核心流程是：模型决策 -> tool call -> 执行 tool -> tool result 回填 -> 模型继续决策。
   - 重点不是”让模型自由发挥”，而是”给它一个可控的决策回路”。

5. `Structured Output`
   - 如果结果要被程序消费，优先让模型直接输出结构化数据，而不是返回自然语言再解析。

6. `Context Engineering`
   - 比 prompt engineering 更高一层。
   - 关注点是：模型这一轮到底看见了什么、能做什么、必须遵守什么、输出什么。

7. `Memory`
   - 不是简单”保存聊天记录”。
   - 真正的问题是：哪些历史信息要进入下一轮上下文，哪些只适合长期存储。

8. `Middleware`
   - LangChain 官方概念：在 Agent 执行的每一步（模型调用、工具选择与执行、循环终止）前后插入控制逻辑。
   - 四大用途：监控与可观测性、转换与处理（改 prompt / 调工具选择 / 格式化输出）、弹性模式（重试 / fallback / 提前终止）、安全与治理（限流 / guardrails / PII 检测）。
   - 通过 `createAgent` 接受 middleware 数组注入，分为 built-in 和 custom 两种。

9. `Streaming`
   - 不只是流式文本输出，也可以流 tool step、agent progress、事件。

10. `Human-in-the-loop`
    - 在 Agent 执行关键步骤前暂停，等待人类审批或确认后再继续。
    - 常见场景：删除确认、高风险操作审批、多候选项让用户选择。

11. `Observability`
    - 追踪 Agent 每一步的输入/输出、延迟、token 消耗、错误。
    - LangSmith 是官方推荐的可观测性平台。
    - 在调试 Agent 行为（如”为什么选了错误的 tool”）时尤其关键。

12. `LangGraph`
    - 更底层的图编排与状态运行时。
    - 当流程复杂、多 agent、可恢复、有人审节点时，通常要下沉到 LangGraph。

---

## 3. Tool：到底由什么组成

## 3.1 Tool 的两部分

无论是 LangChain 的 `tool()` 还是项目里的自定义 tool，本质都包含两部分：

1. `Definition`
   - `name`
   - `description`
   - `schema`
   - 作用：给模型看，让模型知道什么时候用、如何传参

2. `Implementation`
   - 真正执行代码的函数
   - 作用：查库、发请求、写数据、调服务、返回结构化结果

这里的 `implementation` 不是 LangChain 固定字段名，而是工程语义上的说法。

### 4.4 学习 Tool 时应该关注什么

不要只关注“怎么定义一个 tool”，而要关注：

1. 模型何时会选择它
2. 参数 schema 是否足够清晰
3. 错误返回是否有助于下一步决策
4. 返回值是自然语言还是结构化数据
5. 是否包含副作用
6. 是否需要人工确认

### 4.5 Tool 设计原则

1. 一个 tool 做一件清晰的事
2. 参数名尽量贴近业务语义
3. `description` 不解释实现细节，要解释调用时机和边界
4. 返回值要服务于下一步决策，而不是只返回人类可读文案
5. 高风险副作用要在应用层再做一次 guard

---

## 5. Agent Loop：它到底在循环什么

### 5.1 Agent Loop 的核心流程

可以把一个 agent loop 看成下面这条链：

1. 组装当前上下文消息
2. 调用模型
3. 模型决定：
   - 直接回复
   - 或发起一个/多个 tool call
4. 执行 tool
5. 把 tool result 作为 `ToolMessage` 回填
6. 再次调用模型
7. 直到：
   - 模型输出最终答案
   - 或达到最大迭代次数

### 5.2 当前项目中的 loop

当前项目在 `AIService` 中手写了最大 10 轮循环。

这说明项目把“最大迭代次数”当成防失控保护阀，而不是能力上限。

### 5.3 最大循环次数该怎么判断

不是看 tool 数量，而是看任务复杂度和系统设计质量。

主要看：

1. 单个请求平均需要几步才能完成
2. tool 描述是否清晰，是否会让模型反复试错
3. tool 返回是否足够支撑下一步判断
4. 是否有链式依赖流程
5. 成本与时延预算

### 5.4 tool 越多，循环上限就该越大吗

不成立。

原因：

- tool 多，只代表可选动作空间更大
- 不代表一次请求一定要走更多步
- 反而如果 tool 粒度清晰、边界明确，步数可能更少

真正导致循环步数增大的，通常是：

1. tool 职责过于模糊
2. schema 不清晰
3. 返回值无法支撑下一步决策
4. agent 没有明确阶段控制
5. 系统把复杂工作流强塞给自由循环 agent

### 5.5 工程判断建议

可以用下面的经验来估算：

1. 纯查询型 agent
   - 1 到 3 步

2. 查询 + 更新 + 校验
   - 3 到 6 步

3. 多阶段任务
   - 6 到 10 步

如果经常超过 10 步仍然不够，先不要急着无限调大上限，优先检查：

1. 是否该拆 tool
2. 是否该增加中间状态
3. 是否该改成 workflow / LangGraph

### 5.6 终止条件通常有哪些

1. 模型返回最终答案且没有 tool call
2. 达到 `max iterations`
3. 进入需要人工确认的状态
4. 触发 guardrails 拦截
5. 出现明确不可恢复错误

---

## 6. Context Engineering：现在最值得重点学的部分

### 6.1 它和 Prompt Engineering 的区别

`Prompt Engineering` 更像是在想：

- 这句话怎么写更好
- 语气怎么调
- 提示词顺序怎么排

`Context Engineering` 更像是在想：

- 模型这一轮到底看见了什么
- 哪些信息必须进入上下文
- 哪些信息是噪音
- 模型能调用哪些工具
- 当前处于哪个状态
- 输出必须满足什么约束

所以它是“设计决策环境”，不是“润色一段提示词”。

### 6.2 建议用 6 个控制面来理解

1. `Instructions`
   - 角色、规则、边界、成功标准

2. `State`
   - 当前会话阶段、开关、待确认状态、候选对象

3. `Memory`
   - 与当前问题相关的历史信息

4. `Tools`
   - 模型能做什么、何时该做、如何做

5. `Retrieved Knowledge`
   - 当前检索到的文档、业务数据、用户资料

6. `Output Constraints`
   - 输出格式、字段、风格、必须包含的信息

### 6.3 什么情况下你该怀疑是 context 问题

如果你反复遇到这些现象，通常不是单纯“prompt 文案不够好”：

1. 模型总是忘记前一轮结论
2. 模型乱选 tool
3. 模型明明拿到了结果却不会进入下一步
4. 模型总是问不该问的问题
5. 模型经常越权执行
6. 历史越长效果越差

### 6.4 做 context engineering 时常见的错误

1. 把所有历史原封不动塞进去
2. 规则太多但重点不分层
3. tool 描述只写“是什么”，没写“什么时候用”
4. 没有显式状态，指望模型自己记住阶段
5. 输出约束不明确
6. 把确定性逻辑交给模型自由发挥

### 6.5 在当前项目里的体现

当前项目已经有一部分 context engineering：

1. 动态 system prompt
   - 注入今天日期、当前时段、群组信息

2. 历史裁剪
   - 只取最近一部分历史消息

3. 明确业务规则
   - 删除前确认
   - 未给日期不直接查全部任务
   - 已过时段要追问

4. 工具边界清晰
   - `create_task / query_tasks / update_task / complete_task / delete_task`

说明当前项目已经不只是“写 prompt”，而是在做有限度的上下文设计。

---

## 6. 什么是 context 思维

可以把它理解为：你不再问“提示词怎么写”，而是问“我应该如何布置模型工作的现场”。

### 7.1 Prompt 思维

典型问题：

- 再加一句“请认真思考”会不会更好？
- 语气更严格一点会不会更准？

### 7.2 Context 思维

典型问题：

1. 模型这一轮能看到哪些必要信息
2. 哪些历史消息其实是噪音
3. 当前是否已有待确认状态
4. 是否必须先查再改
5. 删除操作是否必须走确认门
6. 返回给模型的是自然语言摘要还是结构化结果
7. 最终输出要给人看还是给程序消费

### 7.3 一个例子

用户说：

> 把明天下午那个会取消掉

用 context 思维会先拆：

1. 上下文里有没有可唯一定位的任务
2. 如果没有，是不是先 `query_tasks`
3. 删除前是不是必须确认
4. 如果存在多个候选，候选列表如何进入上下文
5. 当前轮应返回澄清问题，还是应执行 tool
6. 本轮结束后要不要写入“等待确认删除”的状态

所以 context 思维不是让模型“更聪明”，而是让系统“更可控”。

---

## 7. Memory / State / Store：不要混成一层

### 8.1 为什么“把每一轮对话存库”不等于 memory 做好了

存储只是把数据保留下来。

真正的 memory 问题是：

- 下次需要时，能否高效取到
- 取到后，哪些应该进 prompt
- 哪些应该做摘要
- 哪些应提炼成长期事实

所以存储不是记忆，能被下一轮正确利用才是记忆系统。

### 8.1.1 `Short-term memory` 和广义 `memory` 的关系

LangChain 文档里的 `Short-term memory`，可以理解为广义 `memory` 中最贴近当前 agent 运行的一层。

关系上更接近：

1. `Memory`
   - 总概念
   - 指系统如何保留、提炼、取用过去的信息

2. `Short-term memory`
   - `Memory` 的子集
   - 特指当前会话 / 当前线程 / 当前任务继续推进时仍然要用的信息

3. `Long-term memory`
   - 也是 `Memory` 的子集
   - 特指跨会话、跨任务仍值得复用的信息

所以不是：

- `memory = short-term memory`

而是：

- `short-term memory` 是 `memory` 的一个核心类别

### 8.1.2 一张快速对照表

| 概念 | 关注时间范围 | 典型内容 | 是否直接进入下一轮上下文 | 主要作用 |
| --- | --- | --- | --- | --- |
| `history` | 已发生的会话原始记录 | user / assistant / tool 原文消息 | 不一定 | 审计、回放、debug、基础数据源 |
| `short-term memory` | 当前会话内 | 最近消息、当前摘要、待确认状态 | 通常会 | 支撑当前任务继续推进 |
| `summary` | 当前会话中期到近期 | 对较长历史的压缩结论 | 常常会 | 降低 token 与噪音 |
| `session state` | 当前会话实时状态 | 当前模式、等待确认、候选 ID | 通常会 | 让流程更确定，不靠模型硬记 |
| `long-term memory` | 跨会话 | 稳定偏好、长期事实、用户画像 | 按需进入 | 未来复用、个性化 |
| `store` | 存储层 | DB / Redis / KV / 对象存储中的数据 | 不是直接概念 | 承载 history、state、memory |

### 8.1.3 这几个词最容易混淆的地方

1. `history` 不等于 `short-term memory`
   - `history` 是原始记录
   - `short-term memory` 是“当前还值得带入下一轮”的那部分信息

2. `summary` 不等于 `memory` 全部
   - `summary` 只是 short-term memory 的常见压缩形式之一
   - 它不能代替显式状态，也不能代替长期记忆

3. `session state` 不等于“聊天记录”
   - 它更像工作流状态
   - 例如“正在等待删除确认”这类信息，最好显式存，不要只埋在历史文本里

4. `store` 不等于 `memory`
   - `store` 解决“放在哪里”
   - `memory` 解决“什么值得保留、何时取用、如何进入上下文”

### 8.1.4 一个任务系统中的对应例子

假设用户连续几轮说：

1. 帮我看看明天的任务
2. 删除第二个
3. 确认删除

可以这样拆：

1. `history`
   - 原样保存这三轮消息和系统回复

2. `short-term memory`
   - 当前轮还需要知道：
     - 上一轮查到了哪些任务
     - “第二个”对应哪个 taskId
     - 当前是否正处于删除确认流程

3. `summary`
   - 如果历史很长，可以压成：
     - 用户刚查询了明天任务
     - 当前候选删除项为 taskId=15
     - 正在等待确认删除

4. `session state`
   - 可以显式存：
     - `pending_action = delete_task`
     - `pending_task_id = 15`
     - `awaiting_confirmation = true`

5. `long-term memory`
   - 如果用户长期偏好“先查再删时总希望看到编号列表”
   - 这个偏好才有可能进入长期记忆

6. `store`
   - DB 保存 transcript 和长期资料
   - Redis 保存当前确认态、候选 ID、最近摘要

### 8.1.5 放到当前项目里怎么对应

当前项目更接近下面这个层次：

1. 已有 `history`
   - 消息表保存 user / assistant 消息

2. 已有基础版 `short-term memory`
   - 每轮取最近历史消息参与推理

3. 还没有显式的 `summary`
   - 目前更多是截取最近消息，而不是做摘要压缩

4. `session state` 还比较弱
   - 当前有部分通过“读取最近一条 assistant 消息”来判断是否在等待确认
   - 这说明状态还主要隐含在消息文本里

5. 还没有明确的 `long-term memory` 机制
   - 例如用户稳定偏好、长期行为模式的提炼与复用

这也说明后续如果要继续演进，优先级通常是：

1. 先补显式 `session state`
2. 再补 `summary`
3. 最后再考虑 `long-term memory`

### 8.2 建议拆成 4 层

1. `Transcript`
   - 原始消息记录
   - 用于审计、回放、debug、追责

2. `Session State`
   - 当前会话的明确状态
   - 例如：
     - 是否在等待删除确认
     - 最近查询结果中的候选 taskId
     - 当前模式开关

3. `Working Memory`
   - 当前任务需要进入上下文的短期记忆
   - 例如：
     - 最近 N 轮
     - 当前摘要
     - 当前用户偏好

4. `Long-term Memory`
   - 跨会话复用的稳定信息
   - 例如：
     - 用户偏好
     - 常见习惯
     - 稳定事实资料

### 8.3 你提出的 Redis + DB 方案，如何完善

你的思路是正确的，可以进一步细化为：

1. `DB 作为长期真相源`
   - 保存完整 transcript
   - 保存关键业务事件
   - 保存长期 memory facts

2. `Redis 作为热态层`
   - 保存当前 session state
   - 保存最近对话片段
   - 保存会话摘要
   - 保存短期缓存

3. `不要做“机械压缩”`
   - 不建议把所有历史周期性压成一段泛化摘要然后完事
   - 更好的做法是“分层提炼”

### 8.4 推荐的分层提炼策略

1. `最近消息`
   - 保留原文
   - 因为它最强相关

2. `中期历史`
   - 转为 summary
   - 只保留当前任务还依赖的信息

3. `长期可复用信息`
   - 提炼为 memory facts / user profile
   - 例如：
     - 用户喜欢详细解释
     - 用户常用中文
     - 用户默认把“下午”理解为 14:00-18:00

4. `无长期价值内容`
   - 可以只存 transcript，不进入工作上下文

### 8.5 适合高用户量场景的架构建议

1. 数据库存完整 transcript 与事件日志
2. Redis 保存最近会话窗口和临时状态
3. summary 异步生成，不阻塞主链路
4. 长期记忆提取单独建任务流，不和在线回复强耦合
5. 为不同数据设置不同 TTL

### 8.6 什么信息适合进入长期记忆

适合长期保留：

1. 稳定偏好
2. 长期角色信息
3. 重复出现的业务事实
4. 用户明确声明的配置

不适合直接进长期记忆：

1. 一次性闲聊
2. 临时确认状态
3. 过期任务现场信息
4. 容易变化的上下文碎片

### 8.7 当前项目下一步可研究的方向

如果后续要增强当前项目的 memory，可以考虑：

1. 把“等待确认”从纯消息判断升级为显式 `session_state`
2. 引入“最近消息 + summary + 用户偏好”的 context builder
3. 把高复用偏好提炼成 profile，而不是总从 transcript 现算

---

## 8. 动态 System Prompt：不仅是可变字符串

### 9.1 你的理解是对的

例如英语学习产品中：

- 用户开启详细解释
- system prompt 增加“用户需要详细解释”

这就是典型动态 system prompt。

### 9.2 更准确的理解

动态 system prompt 不是“把 prompt 拼起来”这么简单，而是：

> 根据当前会话状态、用户偏好、业务模式、权限边界，动态装配本轮必须成立的高优先级规则。

### 9.3 常见来源

1. 用户偏好
   - 详细解释 / 简洁模式 / 回复语言

2. 产品模式
   - 学习模式 / 考试模式 / 批改模式

3. 当前状态
   - 正在等待确认
   - 当前只能澄清不能执行

4. 权限与角色
   - 普通用户 / 管理员 / 老师 / 审核员

5. 环境信息
   - 日期、时区、组织、群组、可用工具

### 9.4 当前项目的对应实现

当前项目会把这些动态信息放进 system prompt：

1. 今天日期
2. 当前时段
3. 用户群组信息
4. 业务规则

这已经是动态 system prompt 的典型工程实践。

### 9.5 动态 system prompt 的注意点

1. 放“高优先级规则”，不要塞杂项
2. 可变内容要稳定、可验证
3. 不要把瞬时结果和大量历史都堆进 system prompt
4. 用户偏好适合在此注入，临时工具结果通常不适合

---

## 9. Summary：它是什么，作用是什么

### 10.1 Summary 的本质

Summary 不是为了“缩短文本”本身，而是为了：

1. 控制上下文长度
2. 保留关键事实
3. 降低噪音
4. 稳定长会话表现

### 10.2 好 summary 应保留什么

1. 当前任务阶段
2. 已确认的关键信息
3. 后续仍会被引用的候选对象
4. 用户稳定偏好
5. 未完成动作

### 10.3 不该保留什么

1. 寒暄
2. 重复表述
3. 已过期的临时细节
4. 对后续推理无影响的修辞内容

### 10.4 一个任务系统场景示例

原始多轮对话可能很长，但 summary 可以变成：

- 用户当前正在处理 2026-04-06 的任务安排
- 已查询出 2 条待办，ID 为 12 和 15
- 用户倾向使用模糊时段
- 当前等待确认是否删除 ID=15

这样的 summary 更适合放进后续上下文。

### 10.5 什么时候应该引入 summary

1. 会话长度明显增长
2. 模型开始忘记前文
3. 成本和时延上升
4. 历史里大量内容对当前轮已无意义

### 10.6 Summary 的实现位置

可以放在：

1. 上下文构建阶段
2. middleware
3. 异步后台任务

根据产品目标不同，summary 可以是：

1. 面向模型的工作摘要
2. 面向用户的会话纪要
3. 面向系统的长期记忆候选

---

## 10. Guardrails：它是什么，作用是什么

### 11.1 Guardrails 的本质

Guardrails 是给 agent 加“护栏”，避免它：

1. 越权
2. 误操作
3. 违规输出
4. 跳过关键流程
5. 在高风险场景下擅自执行

### 11.2 常见作用

1. 安全控制
2. 合规控制
3. 输出格式控制
4. 业务流程控制
5. 工具调用前置检查

### 11.3 一个任务系统里的 guardrails 示例

1. 删除前必须确认
2. 用户未指定日期时不能直接查全部任务
3. 今天已过时间段必须追问
4. 没有 taskId 不允许直接 update / delete / complete

### 11.4 Guardrails 可以落在哪几层

1. `Prompt 层`
   - 告诉模型不要这么做
   - 强度最弱

2. `Middleware 层`
   - 在模型调用前后做检查、重写、拦截

3. `Tool 层`
   - 参数不合法、前置条件不满足时，拒绝执行

4. `应用状态机 / 业务层`
   - 没有确认态就绝不允许 delete
   - 这是最强的一层

### 11.5 为什么 guardrails 不能只靠 prompt

因为 prompt 只是“希望模型遵守”，不是“系统强制保证”。

高风险动作必须在确定性代码层再拦一次。

一句话：

- `summary` 解决“上下文太长太乱”
- `guardrails` 解决“模型可能做错事或做不该做的事”

---

## 11. Middleware：为什么它重要

### 12.1 LangChain 官方定义

LangChain 将 Middleware 定义为**在 Agent 执行的每一步控制和定制行为的机制**。

Agent Loop 有三个基本步骤：模型调用 → 工具选择与执行 → 循环终止判断。Middleware 提供 **before / after 钩子**，在每个步骤前后执行自定义逻辑。

通过 `createAgent` 函数的 middleware 数组参数注入。分为：

- **Built-in middleware**：官方预置的常用中间件
- **Custom middleware**：用 hooks 和 decorators 自定义实现

### 12.2 官方归纳的四大用途

1. **监控与可观测性**
   - 日志、分析、调试，跟踪 Agent 运行过程

2. **转换与处理**
   - 修改 prompt、调整工具选择逻辑、格式化输出

3. **弹性模式**
   - 重试、fallback、提前终止控制

4. **安全与治理**
   - 限流、guardrails、PII（个人信息）检测

### 12.3 为什么它很关键

因为很多横切需求都不属于某个单独 tool，也不属于模型本身。

如果没有 middleware，这些逻辑容易散落在：

- route
- service
- prompt builder
- tool executor

最终变得难维护。

### 12.4 对当前项目的启发

即使不立刻引入 LangChain middleware，也可以在工程上模仿它的分层思想：

1. context builder
2. state loader
3. tool executor
4. output validator
5. response saver

---

## 12. 学 LangChain 时应该带着哪些判断标准

每次看官方文档或示例，建议都问自己下面 8 个问题：

1. 这个能力属于哪一层
   - model / messages / tools / memory / middleware / graph

2. 这里让模型自由发挥的部分是什么

3. 这里由确定性代码控制的部分是什么

4. 这里在塑造哪些上下文

5. 失败时应该改 prompt，还是改 context builder，还是改 tool

6. 这里的状态是否显式表达出来了

7. 这个场景真的需要 agent 吗

8. 如果用户量很大，哪些东西该放热态缓存，哪些该长期存储

---

## 13. 针对当前项目的学习建议

### 14.1 第一阶段：吃透单 agent 现状

重点研究：

1. `ChatOpenAI` 的职责是什么
2. `BaseMessage` 体系如何组织上下文
3. 手写 tool loop 的每一步在解决什么问题
4. 为什么项目故意没有直接使用高层 agent API

### 14.2 第二阶段：补全 LangChain 官方抽象

重点学习：

1. `tool()`
2. `structured output`
3. `middleware`
4. `short-term memory`
5. `streaming`

### 14.3 第三阶段：衔接到 LangGraph

重点理解：

1. 什么时候单 agent 的自由循环已经不够
2. 什么时候该用显式图编排
3. 多 agent / supervisor 的状态是如何组织的

---

## 14. Structured Tool Output：Tool 返回结构化数据给 LLM

### 15.1 为什么 Tool 的返回值也需要设计

大多数教程只关注 Tool 的输入（schema），但**Tool 返回什么给 LLM 同样重要**。

Tool 的返回值会变成 `ToolMessage.content`，直接进入下一轮 LLM 上下文。LLM 会基于这个内容决定下一步动作或生成最终回复。

如果返回值：

- 太简略 → LLM 缺乏信息，可能瞎编
- 太冗长 → 浪费 token，干扰判断
- 纯自然语言 → 上层代码无法从中提取结构化 payload
- 没有状态标记 → 上层无法区分成功/失败/需确认

### 15.2 推荐的返回结构

```typescript
interface ToolResult {
  status: “success” | “conflict” | “need_confirmation” | “error”;
  message: string;             // 给 LLM 阅读的文本摘要
  task?: TaskInfo;             // 结构化实体（给上层代码提取）
  conflictingTasks?: TaskInfo[];
  actionPerformed?: string;    // 明确标记实际执行了什么
}
```

**关键设计**：`message` 是给 LLM 看的，`task` / `conflictingTasks` 是给程序用的。两者并存，各取所需。

### 15.3 为什么要 JSON.stringify 返回

LangChain 的 `tool()` 要求返回字符串。所以结构化数据需要序列化：

```typescript
function toJsonResult(result: ToolResult): string {
  return JSON.stringify(result);
}
```

上层代码再从 ToolMessage 中 `JSON.parse` 提取 payload。这样做的好处是：

1. LLM 能读懂 JSON 中的 `message` 字段来生成回复
2. 应用层能解析出 `task` 字段来渲染 UI 卡片
3. 流程控制层能根据 `status` 决定是否短路返回

### 15.4 设计 Tool 返回值时应该问的问题

1. 这个返回值是**只给 LLM 看**，还是**也要被程序消费**？
2. 下游是否需要区分”成功执行”和”执行了但有冲突”？
3. 返回的实体数据是否足够让前端渲染？
4. 如果 Tool 失败了，返回的错误信息是否能帮 LLM 做出正确的下一步决策？

---

## 15. Hallucination Detection：幻觉检测

### 16.1 什么是 Agent 幻觉

在普通对话场景，幻觉是指 LLM 编造事实。但在 **Agent + Tool** 场景，有一种更危险的幻觉：

> LLM 声称”已经完成了操作”，但实际上**根本没有调用工具**。

例如用户说”帮我创建一个明天开会的任务”，LLM 直接回复”好的，已为你创建了任务「开会」”——但实际上 `create_task` 工具从未被调用，数据库里什么都没写入。

**这比事实幻觉更危险**：用户以为操作成功了，但系统状态没有变化。

### 16.2 为什么会发生

1. **模型过度自信**：LLM 在训练数据中见过大量”助手确认完成”的对话，容易模仿这种模式
2. **Tool 描述不够强**：模型没有充分理解必须调用工具才能执行操作
3. **上下文误导**：历史消息中有成功执行的记录，模型”照葫芦画瓢”直接生成类似回复
4. **首轮未强制 tool_choice**：模型有”跳过工具直接回答”的选项

### 16.3 检测策略

核心思路：**对比 LLM 的文本声明和实际工具执行记录**。

```
如果 LLM 说”已创建/已完成/已删除”
  但 Agent Loop 中没有任何 Tool 返回 actionPerformed
→ 这是幻觉，需要拦截
```

具体实现步骤：

1. **维护一个”实际执行”标记**：在 Agent Loop 中，每次 Tool 执行成功时记录 `actionPerformed`
2. **定义”成功话术”模式**：收集 LLM 常用的成功声明关键词（”已创建”、”创建成功”、”已更新”等）
3. **在最终回复时交叉校验**：如果最终回复匹配成功话术，但没有实际执行记录 → 替换为澄清消息

### 16.4 检测到幻觉后怎么办

不能直接忽略或静默失败。两种策略：

1. **替换回复**：用预设的澄清消息替换 LLM 输出
   - 例如：”我还没有实际创建任务。请确认任务内容后我再创建。”

2. **根据意图分类回复**：根据推断的用户意图给出不同提示
   - create 意图 → “我还没有实际创建任务...”
   - delete 意图 → “我还没有删除任务...”
   - query 意图 → “我还没有查询任务...”

### 16.5 预防策略（减少幻觉发生）

1. **首轮强制 tool_choice = “required”**：当检测到明确的操作意图时，强制模型必须调用工具
2. **System Prompt 中明确声明**：”你不能声称已执行操作，所有操作必须通过工具完成”
3. **Tool 描述中强调副作用**：让模型理解这些工具会改变真实数据
4. **温度设为 0**：减少随机性，降低”创造性回答”的概率

### 16.6 什么场景最需要幻觉检测

1. **有副作用的操作**（写入、删除、发送）—— 用户会基于回复做后续决策
2. **用户信任度高的场景**（助手、自动化）—— 用户不会去手动核实每个操作
3. **操作不可逆的场景**（删除、支付）—— 虚假确认可能导致用户错过真正执行的时机

纯查询场景可以不做幻觉检测——最多是信息不准确，用户会自己核实。

### 16.7 和 Guardrails 的关系

幻觉检测是 Guardrails 的子类，属于**输出层护栏**。可以这样分类：

- **输入层护栏**：过滤危险输入、注入攻击
- **执行层护栏**：工具前置条件检查、确认门控
- **输出层护栏**：幻觉检测、格式校验、敏感信息过滤

---

## 16. 可继续补充的研究问题

后续可以沿这些问题继续扩展这份文档：

1. `tool()` 和 OpenAI 原生 tool schema 的具体差异是什么
2. `structured output` 与 tool calling 的边界怎么判断
3. LangChain middleware 的 built-in 和 custom 写法分别是什么
4. 单 agent 什么时候升级为 LangGraph workflow
5. 当前项目的”等待确认”是否值得抽象成显式状态机
6. summary 该同步生成还是异步生成
7. 长期记忆提炼应走规则法、模型抽取，还是混合策略
8. Structured Tool Output 的返回格式如何在多 Agent 间保持一致
9. 幻觉检测的误判率如何控制（合法的”已完成”回复不被误杀）

---

## 17. 官方文档入口

- Overview  
  https://docs.langchain.com/oss/javascript/langchain/overview

- Agents  
  https://docs.langchain.com/oss/javascript/langchain/agents

- Tools  
  https://docs.langchain.com/oss/javascript/langchain/tools

- Models  
  https://docs.langchain.com/oss/javascript/langchain/models

- Messages  
  https://docs.langchain.com/oss/javascript/langchain/messages

- Context Engineering  
  https://docs.langchain.com/oss/javascript/langchain/context-engineering

- Short-term Memory  
  https://docs.langchain.com/oss/javascript/langchain/short-term-memory

- Structured Output  
  https://docs.langchain.com/oss/javascript/langchain/structured-output

- Middleware  
  https://docs.langchain.com/oss/javascript/langchain/middleware

- Streaming  
  https://docs.langchain.com/oss/javascript/langchain/streaming

---

## 18. 一句话回顾

学习 LangChain 时，最应该形成的不是”API 记忆”，而是下面这个工作模型：

1. 用 `messages` 组织上下文
2. 用 `tools` 暴露能力，**用结构化返回值**服务 LLM 和程序双方
3. 用 `agent loop` 驱动决策
4. 用 `context engineering` 提高成功率
5. 用 `memory / state / store` 管好信息生命周期
6. 用 `summary / guardrails / middleware` 控制复杂度与风险
7. 用 `hallucination detection` 防止模型声称执行了未实际发生的操作

当这张地图稳了，再去看具体 API，会快很多。
