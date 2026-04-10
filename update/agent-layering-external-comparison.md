# 外部复杂 Agent 对照：按 6 层分层看实现思路

## 1. 文档目的

这份文档不是在做“谁更强”的横向评测，而是回答一个更实用的问题：

> 如果把复杂 Agent 系统放进我们已经定义的 6 层分层模型里，它们通常在每一层是怎么实现的？

本文件用于帮助后续学习这三类对象：

1. `OpenClaw 官方实现`
2. `OpenClaw 类简化版实现`
3. `Claude Code`

重点不是复述所有功能，而是抓住每一层的**实现思路、复杂度来源、适合借鉴的点**。

---

## 2. 证据边界

为了避免把传闻、镜像和二手解读混在一起，这里明确证据边界：

### 2.1 OpenClaw 官方实现

使用来源：

- OpenClaw 官方 GitHub 仓库
- OpenClaw 官方 README / 公开文档入口

### 2.2 OpenClaw 类简化版实现

这里不绑定某一个具体社区仓库，而是用两个具有代表性的公开社区材料来抽象“简化版 OpenClaw 的典型做法”：

- `mini-openclaw.py` 这类极简克隆实现
- “You Could’ve Invented OpenClaw” 这类从第一性原理推导架构的教程

所以这一部分讨论的是**社区简化实现的共性**，不是某个官方标准。

### 2.3 Claude Code

截至 **2026-04-06**，公开报道显示 **2026-03-31** 确有 Claude Code 源码意外暴露事件。  
但本文**不依赖泄露镜像仓库或非官方转载代码**，只使用：

- Claude Code 官方文档
- 可确认的公开报道，作为“为什么外界会把它视为复杂 Agent”的背景说明

因此，Claude Code 部分更多是：

- 基于公开文档可确认的实现能力
- 基于这些能力对其分层设计做工程推断

不是对泄露代码逐文件拆解。

---

## 3. 对照对象的一句话画像

### 3.1 OpenClaw 官方实现

更像一个：

> `面向个人/自托管场景的常驻型 Agent 平台`

核心不是“单次对话”，而是：

- 常驻 Gateway
- 多消息渠道接入
- skills 平台
- 设备节点
- browser / cron / webhook / voice / canvas 等外设能力
- 强调 local-first、长期运行和自动化

### 3.2 OpenClaw 类简化版实现

更像一个：

> `把 OpenClaw 的核心心智模型压缩成最小可运行系统`

典型特征：

- 一个主 agent
- 少量工具
- JSONL / 文件系统 session
- 简单 long-term memory
- 一个 scheduler 或循环线程
- 手写 permissions

它的价值不是产品完整度，而是帮助你看清：

- OpenClaw 复杂性的骨架到底是什么

### 3.3 Claude Code

更像一个：

> `面向开发工作流的终端型 Agent 操作系统`

核心不是多渠道接入，而是：

- 代码仓库上下文
- 终端工具链
- 子 agent / subagent
- hooks
- MCP
- memory files
- 权限策略
- 会话恢复与压缩

OpenClaw 偏“个人常驻助理平台”，Claude Code 偏“开发者本地 agent runtime”。

---

## 4. 我们采用的 6 层分层模型

为了统一对照，这里沿用前一份文档的 6 层模型：

1. `运行核心层`
2. `上下文层`
3. `编排层`
4. `知识层`
5. `可靠性层`
6. `生产层`

---

## 5. 第 1 层：运行核心层

## 5.1 这一层在回答什么

它回答的是：

- 这个 Agent 到底怎么跑起来
- 核心执行回路是什么
- tool / session / runtime 是如何接到一起的

### OpenClaw 官方实现

实现思路：

1. 用 `Gateway` 作为统一控制平面
2. 所有渠道、客户端、工具、事件都通过一个中心 runtime 接入
3. Agent 不是“只存在于一个聊天窗口里”，而是一个持续运行的控制系统

从公开仓库与 README 可见，OpenClaw 的运行核心不是“一个简单 CLI loop”，而是：

- Gateway WebSocket control plane
- session model
- Pi agent runtime
- multi-channel inbox
- browser / nodes / cron / webhooks / canvas 等工具面

这说明它的第 1 层一开始就不是极简单体，而是：

> `消息入口 + 会话模型 + agent runtime + 工具执行总线`

复杂度来源：

- 入口太多
- 工具太多
- 会话不是只存在于一个终端窗口
- 设备和远端节点也是 runtime 的一部分

### OpenClaw 类简化版

实现思路：

1. 一个主模型实例
2. 一个手写 tool loop
3. 一个简单 session 文件
4. 一个简化 scheduler / 后台线程

以 `mini-openclaw.py` 这类实现为例，运行核心通常是：

- `Anthropic()` 客户端
- 一组 JSON tool definitions
- `execute_tool()`
- `load_session / append_message / save_session`
- 一个 agent loop

也就是说，简化版会故意把 OpenClaw 的运行核心压缩成：

> `LLM + tools + session + loop + minimal scheduler`

它保留了骨架，但去掉了大部分平台级外设。

### Claude Code

实现思路：

根据官方文档，Claude Code 的运行核心更偏：

1. terminal-first
2. repo-aware
3. tool-driven
4. session-based

公开文档可确认它的核心工具包括：

- Bash
- Read / Write / Edit / MultiEdit
- Glob / Grep / LS
- WebFetch / WebSearch
- Task（子 agent）

这说明 Claude Code 的第 1 层不是消息网关式平台，而是：

> `终端工作区 + 工具调用 runtime + 会话驱动 agent`

它的运行核心和 OpenClaw 的主要差别在于：

- OpenClaw 面向“持续在线的个人助理”
- Claude Code 面向“当前工作区中的开发任务执行”

### 对当前项目的启发

1. 你的单 Agent 更接近“简化版 OpenClaw”的第 1 层
2. 你的多 Agent 还没到 OpenClaw 的平台级 runtime 宽度
3. 如果你不做多渠道 / 常驻 / 设备节点，就没必要照搬 OpenClaw 的 Gateway 复杂度
4. Claude Code 更值得借鉴的是“终端工具 runtime”抽象，而不是它的产品外壳

---

## 6. 第 2 层：上下文层

## 6.1 这一层在回答什么

它回答的是：

- 每一轮到底给模型看什么
- 会话状态怎么保存
- 历史怎么裁剪
- summary / memory / state 怎么进入上下文

### OpenClaw 官方实现

实现思路：

OpenClaw 公开资料显示它有：

- session model
- session pruning
- skills / AGENTS
- channel routing
- long-running session

这说明它的上下文层不是“简单地把最近几轮消息拼进去”，而是更像：

1. 每个 channel / group / sender 都对应自己的 session 语义
2. session 既要保留连续性，又要做 pruning
3. skills 与 AGENTS 文件会成为上下文的一部分
4. 多入口消息会改变上下文装配方式

换句话说，OpenClaw 的上下文层本质是：

> `会话线程 + 角色/技能配置 + 多渠道上下文拼装 + 长会话裁剪`

它之所以复杂，不是因为“模型更聪明”，而是因为：

- 同一个 agent 面对的上下文来源太多
- 一部分来自用户消息
- 一部分来自技能系统
- 一部分来自会话状态
- 一部分来自节点/设备/渠道信息

### OpenClaw 类简化版

实现思路：

简化版通常会把上下文层压缩成：

1. session 文件
2. 简单 compaction
3. 文件系统 memory
4. prompt 里的 “soul”

`mini-openclaw.py` 里很典型：

- session 存成 JSONL
- token 超阈值后做 compact
- 用 `memory_search` 从本地 memory 目录回忆信息
- system prompt 里直接写 personality / memory usage guidance

这表明简化版的上下文层常见思路是：

> `原始消息历史 + 压缩摘要 + 本地 memory 检索 + 一段人格化 prompt`

这种做法足够让你看到核心机制，但通常没有：

- 复杂 session state
- 多层 memory hierarchy
- 统一 context builder

### Claude Code

实现思路：

Claude Code 官方文档把上下文层拆得很明确：

1. `CLAUDE.md` memory files
   - enterprise / project / user / local 多层次记忆

2. conversation resume / continue
   - 恢复会话与历史上下文

3. `/compact`
   - 手动 compact

4. auto-compact hooks
   - 上下文满了时触发压缩

5. subagents 独立 context window
   - 子 agent 有自己的上下文窗口

这说明 Claude Code 的上下文层是：

> `会话消息 + 层级 memory 文件 + compact 机制 + 子 agent 上下文隔离`

这套设计很关键，因为它解决的是开发工作流里两个典型问题：

1. 主线程上下文容易膨胀
2. 子任务会污染主上下文

所以 Claude Code 用：

- `memory files` 处理长期偏好 / 项目约束
- `compact` 处理主线程长度
- `subagents` 处理上下文隔离

### 对当前项目的启发

1. 你项目现在最缺的，仍然是显式 `session state`
2. Claude Code 值得借鉴的是“层级 memory + compact + 子任务隔离”这套思路
3. OpenClaw 值得借鉴的是“不同入口有不同 session 语义”
4. 简化版 OpenClaw 值得借鉴的是“先把 summary / compact 做出来，不要等到系统很复杂才补”

---

## 7. 第 3 层：编排层

## 7.1 这一层在回答什么

它回答的是：

- 单步 loop 之外，系统如何组织复杂任务
- 多 agent / 子 agent / routing / handoff 怎么发生

### OpenClaw 官方实现

实现思路：

OpenClaw 官方公开资料显示它有：

- group routing
- channel routing
- skills platform
- cron + wakeups
- webhooks
- nodes

这说明 OpenClaw 的编排层不是狭义的“LLM 调 LLM”，而是：

> `渠道路由 + 技能装配 + 外部触发 + 后台唤醒 + 设备节点协作`

也就是说，OpenClaw 的编排层更像平台 orchestration，而不是单纯 prompt orchestration。

它的编排复杂度来自：

1. 不是只有“用户发一句话 -> 模型回一句话”
2. 还有计划任务、外部触发、设备执行、消息回流
3. 会话和动作可能在不同时间点继续发生

### OpenClaw 类简化版

实现思路：

简化版通常会把编排层退化成：

1. 一个主 agent
2. 偶尔有一个 researcher / helper agent
3. 一个 scheduler thread
4. 简单 approval gating

`mini-openclaw.py` 里已经出现了：

- main / researcher 两个 agent 配置
- background schedule
- tool approvals

这说明简化版会告诉你：

> 复杂 Agent 的编排，不一定先从 LangGraph 开始，而是先从“主线程 + 少量专职子线程/子 agent + 定时任务”开始

### Claude Code

实现思路：

Claude Code 的编排层，官方公开可确认的关键构件有：

1. `Task` 工具
   - 用来调用子 agent

2. `Subagents`
   - 可配置专职子 agent
   - 有独立 system prompt、工具权限、context window

3. `Hooks`
   - 可以在 tool 前后、session start/end、compact 前后插入控制逻辑

4. `MCP`
   - 把外部系统工具和 prompts 接进来

这说明 Claude Code 的编排层更像：

> `主 agent + specialized subagents + tool lifecycle hooks + external MCP capabilities`

和 OpenClaw 的差别在于：

- Claude Code 编排的是“开发任务子问题”
- OpenClaw 编排的是“长期存在的个人助理动作流”

### 对当前项目的启发

1. 单 Agent 项目先做“半显式 workflow”，这更像简化版 OpenClaw 的路线
2. 多 Agent 项目更适合借鉴 Claude Code 的“子 agent 上下文隔离 + 工具权限隔离”
3. 如果未来要做外部事件触发，再借鉴 OpenClaw 的 cron / webhook / channel 路由
4. 你的项目当前不需要照搬 OpenClaw 那种平台级 orchestration 宽度

---

## 8. 第 4 层：知识层

## 8.1 这一层在回答什么

它回答的是：

- 哪些知识来自会话外部
- 哪些是长期记忆
- 哪些是技能、文档、配置、用户偏好

### OpenClaw 官方实现

实现思路：

OpenClaw 的知识层公开上最突出的不是传统 RAG，而是：

1. `skills platform`
2. `AGENTS / workspace skills`
3. `bundled / managed / workspace skills`

也就是说，OpenClaw 把“知识”很大一部分做成了：

> `可安装、可管理、可门控的能力包`

这和“把一堆文档塞进向量库”是两种思路。

OpenClaw 的知识层更偏：

- 技能化知识
- 工具化知识
- 平台配置知识
- 工作区级指导文件

### OpenClaw 类简化版

实现思路：

简化版通常只保留最轻量的知识层：

1. `save_memory`
2. `memory_search`
3. 本地 markdown / text 文件

这表明简化版在知识层上的哲学是：

> 先有“能记住和找回”的能力，再谈复杂知识系统

它不会优先上：

- 向量数据库
- 大规模 RAG
- 复杂知识图谱

而是先让 agent 具备“写一点、找一点、跨会话复用一点”的基本记忆能力。

### Claude Code

实现思路：

Claude Code 的知识层最重要的不是传统文档检索，而是：

1. `CLAUDE.md` memory hierarchy
2. `MCP resources`
3. `MCP tools`
4. `@文件 / @目录 / @资源` 的直接上下文引入

这意味着 Claude Code 的知识层更偏：

> `工程上下文知识 + 工作区记忆 + 外部系统资源接入`

它解决的不是“问答机器人查资料”，而是：

- 当前项目有哪些约束
- 当前团队有哪些规范
- 当前外部系统有哪些实时数据

### 对当前项目的启发

1. 如果你后面要做知识层，优先学 Claude Code 的“项目记忆文件 + 外部资源接入”思路
2. OpenClaw 值得借鉴的是“把知识组织成技能/能力包”
3. 简化版值得借鉴的是“先从最朴素的可写入记忆开始”
4. 当前项目不必过早把知识层等同于 RAG

---

## 9. 第 5 层：可靠性层

## 9.1 这一层在回答什么

它回答的是：

- agent 乱来怎么办
- 高风险动作如何控制
- 权限、审批、策略、错误恢复放在哪里

### OpenClaw 官方实现

实现思路：

OpenClaw 公开材料里，可靠性层很显眼，因为它要处理的是：

- 常驻 Agent
- 多渠道暴露
- 远程访问
- 本地设备能力
- system.run 这类高风险动作

公开资料可见它强调：

- security
- gateway auth
- loopback bind
- Tailscale / SSH 隧道
- install gating
- doctor / audit / troubleshooting

这说明 OpenClaw 的可靠性层不是“顺手加几个 if”，而是：

> `网络暴露边界 + 工具权限边界 + 安装门禁 + 运行审计`

这是平台型 Agent 必然的结果，因为它的攻击面远大于普通单 Agent。

### OpenClaw 类简化版

实现思路：

简化版一般只保留最核心的护栏：

1. safe commands allowlist
2. 人工 approval
3. 持久化 approvals

`mini-openclaw.py` 就是很典型的：

- SAFE_COMMANDS 集合
- `needs_approval`
- `exec-approvals.json`

这说明简化版在可靠性层上的思路很朴素：

> 先把最危险的外壳命令挡住，先做人类确认，再谈高级策略

### Claude Code

实现思路：

Claude Code 官方文档公开得非常明确：

1. `permissions`
   - allow / ask / deny

2. `managed settings`
   - enterprise 级强制策略

3. `hooks`
   - 在 tool use 前后插入控制逻辑

4. `tool-specific permissions`
   - 例如 Bash、Write、WebFetch、MCP tools

5. `subagent tool scoping`
   - 子 agent 可限定工具访问范围

Claude Code 在可靠性层上的核心思路可以概括为：

> `权限系统 + 生命周期钩子 + 子 agent 权限隔离 + 企业级策略层`

这也是它和很多社区 agent 的分水岭：  
不是只有“会不会调用工具”，而是“每个工具在什么条件下才允许被调用”。

### 对当前项目的启发

1. 单 Agent 最适合直接借鉴简化版 OpenClaw 的“approval 先行”思路
2. 多 Agent 最适合借鉴 Claude Code 的“子 agent 权限范围 + 生命周期钩子”思路
3. 如果未来真的走平台化路线，再考虑 OpenClaw 那种网络边界与接入安全体系
4. 你当前项目最值得补的，不是更复杂的模型路由，而是更显式的 approval state 和 tool policy

---

## 10. 第 6 层：生产层

## 10.1 这一层在回答什么

它回答的是：

- 怎么上线
- 怎么观测
- 怎么回滚
- 怎么知道成本和时延失控了

### OpenClaw 官方实现

实现思路：

OpenClaw 从公开资料看，生产层已经是平台级：

- logging
- doctor
- runbook
- update / rollback
- docker / nix / onboarding
- usage tracking
- health checks

这说明它的生产层不是“开发时顺便打个 log”，而是：

> `可部署、可诊断、可升级、可远程运维的平台系统`

这种厚度来自它的产品形态：  
用户把它当作长期常驻基础设施来运行。

### OpenClaw 类简化版

实现思路：

简化版往往几乎没有成熟生产层，只会有：

1. 本地日志打印
2. 少量状态文件
3. 手工调试

这也正好说明：

> 大多数“几十行/几百行 Agent”能帮你理解运行原理，但并不等于你已经有了可用产品

### Claude Code

实现思路：

Claude Code 官方公开资料在生产层上的可见部分包括：

1. `/cost`
2. transcripts local retention
3. settings hierarchy
4. session resume / continue
5. hooks
6. enterprise settings / managed policies

虽然它不是像 OpenClaw 那样的“常驻服务器平台”，但它的生产层已经明显是：

> `可治理的开发工具产品`

重点体现在：

- 会话保留
- 成本可见
- 配置层级
- 组织级策略
- 可恢复性

### 对当前项目的启发

1. OpenClaw 值得借鉴的是“runbook / logging / health / update”这套平台思维
2. Claude Code 值得借鉴的是“成本、会话保留、配置分层、组织策略”
3. 你的项目现在最欠缺的生产层能力，是 tracing 和运行元数据，而不是 UI
4. 简化版 OpenClaw 在这一层几乎不值得模仿，因为它通常故意省略了生产治理

---

## 11. 三类复杂 Agent 的分层风格总结

### 11.1 OpenClaw 官方实现

最厚的层通常是：

1. 第 1 层运行核心层
2. 第 2 层上下文层
3. 第 3 层编排层
4. 第 5-6 层可靠性 / 生产层

原因：

- 它是平台
- 它是常驻的
- 它要处理多入口、多设备、多触发器

### 11.2 OpenClaw 类简化版

最厚的层通常是：

1. 第 1 层运行核心层
2. 第 2 层最小上下文层
3. 第 5 层最朴素可靠性层

原因：

- 它的目标不是产品完备，而是把骨架讲明白

### 11.3 Claude Code

最厚的层通常是：

1. 第 2 层上下文层
2. 第 3 层编排层
3. 第 5 层可靠性层

原因：

- 它的主场景是复杂开发工作流
- 关键难点不在多渠道，而在“上下文治理 + 子任务治理 + 权限治理”

---

## 12. 哪些值得你项目借鉴

## 12.1 对单 Agent

最值得借鉴：

1. 简化版 OpenClaw
   - 手写 loop
   - summary / compact
   - approval
   - 简单 memory

2. Claude Code
   - memory hierarchy
   - compact
   - hooks 思维
   - 工具权限分层

不建议直接照搬：

- OpenClaw 官方的 Gateway / 多渠道 / 设备节点体系

原因：

- 你的单 Agent 当前并不是平台产品

## 12.2 对多 Agent

最值得借鉴：

1. Claude Code
   - subagent
   - 独立 context window
   - 子 agent 工具权限
   - lifecycle hooks

2. OpenClaw 官方
   - 外部触发
   - 长会话管理
   - skills / capability package
   - 平台级可靠性思维

不建议直接照搬：

- 社区简化版的“所有状态都写文件 + 一把梭 loop”

原因：

- 你的多 Agent 已经进入了需要显式状态与编排的阶段

---

## 13. 最后一个判断：复杂 Agent 真正复杂在哪里

很多人会把复杂 Agent 的复杂度归因于：

- 模型更强
- prompt 更长
- tool 更多

但把 OpenClaw、OpenClaw 类简化版、Claude Code 放到同一张分层图里看，会更清楚：

> 真正让 Agent 变复杂的，通常不是模型本身，而是第 2、3、5、6 层。

也就是：

1. 上下文怎么治理
2. 任务怎么编排
3. 风险怎么控制
4. 系统怎么运维

这也是为什么：

- 简化版 Agent 往往几百行就能跑
- 平台级 Agent 却会迅速膨胀到非常大的系统

---

## 14. 对当前项目的最终结论

如果把外部复杂 Agent 的经验映射回你的项目：

### 单 Agent

最该学的是：

1. 简化版 OpenClaw 的骨架
2. Claude Code 的上下文治理与权限治理

### 多 Agent

最该学的是：

1. Claude Code 的子 agent 与工具边界
2. OpenClaw 的平台级状态 / 触发 / 可靠性思维

### 不该误学的点

不要因为看到复杂 Agent 很大，就误以为：

- “高级”一定意味着更多 Agent
- “高级”一定意味着更大 prompt
- “高级”一定意味着先上 RAG

更常见的事实是：

- 真正的复杂度来自状态、上下文、权限、运维

---

## 15. 参考来源

### OpenClaw

- GitHub 仓库  
  https://github.com/openclaw/openclaw

- 仓库 README / 公开导航（用于确认 Gateway、skills、session、runtime、security、ops 等公开能力）

- “How to Build a Custom Agent Framework with PI: The Agent Stack Powering OpenClaw”  
  https://gist.github.com/dabit3/e97dbfe71298b1df4d36542aceb5f158

### OpenClaw 类简化版

- `mini-openclaw.py`（代表性社区极简实现）  
  https://gist.github.com/dabit3/86ee04a1c02c839409a02b20fe99a492

- “You Could’ve Invented OpenClaw”  
  https://gist.github.com/dabit3/bc60d3bea0b02927995cd9bf53c3db32

### Claude Code

- Claude Code Overview  
  https://docs.anthropic.com/en/docs/claude-code/overview

- Manage Claude’s Memory  
  https://docs.anthropic.com/en/docs/claude-code/memory

- Settings  
  https://docs.anthropic.com/en/docs/claude-code/settings

- Hooks  
  https://docs.anthropic.com/en/docs/claude-code/hooks

- MCP  
  https://docs.anthropic.com/en/docs/claude-code/mcp

- Subagents  
  https://docs.anthropic.com/en/docs/claude-code/sub-agents

- Slash Commands  
  https://docs.anthropic.com/en/docs/claude-code/slash-commands

### Claude Code 源码暴露事件（仅作背景，不作为架构分析依据）

- Axios，2026-03-31  
  https://www.axios.com/2026/03/31/anthropic-leaked-source-code-ai

- TechCrunch，2026-04-01  
  https://techcrunch.com/2026/04/01/anthropic-took-down-thousands-of-github-repos-trying-to-yank-its-leaked-source-code-a-move-the-company-says-was-an-accident/
