# AI Native 开发指南

> 本文档汇总 AI Native 开发的核心认知和实践经验，随讨论逐步完善。

## 什么是 AI Native

### 核心定义

"AI Native" 指**产品、流程或组织从一开始就以 AI 为核心组件设计，而不是后期把 AI 作为附加功能加上去**。它是一种结构性的重新设计，不是程度上的提升。

行业有两个相关概念，区分很重要：

| 概念 | 含义 |
|------|------|
| **AI-Assisted（AI 辅助）** | Copilot 接到现有流程上，加速个人开发；流程本身没变 |
| **AI-Native** | 围绕 AI 作为一等公民重新设计整个 operating model |

学术界把这叫 **SE 2.0（AI-Assisted）vs SE 3.0（AI-Native）**，已经有正式论文论述这是软件工程的代际转变。

### AI-Assisted 和 AI-Native 的结构性差异

| 维度 | AI-Assisted | AI-Native |
|------|------------|-----------|
| 定位 | Copilot 是个人工具 | AI agent 是 SDLC 一等公民 |
| 流程 | 流程不变，AI 让某些环节更快 | 每个 SDLC 阶段都重构：需求→可执行 spec、设计→约束、实现→审核、测试→验证策略 |
| 瓶颈 | 还是写代码（但更快了） | 瓶颈从"实现"转移到"评估"（evaluation） |
| Agent 地位 | 工具 | 有 scoped permissions、audit trails、governance |
| 收益 | 让快开发者更快 | 让整个团队/系统更一致 |
| 投入 | 几乎零（装个 Copilot 就行） | 重投入（基础设施、流程、组织变革） |

### 什么场景适合 AI-Native，什么场景不适合

**适合：**

- 大型组织 — 多团队、多代码库，需要一致性
- 规模化运营 — 一个团队管几十上百个服务，必须 agent 化
- 长期项目 — 前期重投资可以摊销
- AI 已经能可靠完成大部分任务的领域（如成熟的 CRUD、UI 调整）
- 已经有成熟 AI 基础设施投入的公司

**不适合：**

- 个人/小团队项目 — 建 governance、permissions、eval pipeline 的成本 > 收益
- 短期项目 — 前期投入摊销不开
- 探索性项目 — 需求变化快，spec-driven 反而拖累
- AI 还不擅长的领域 — 复杂业务规则、领域特定推理
- 强调创新的工作 — spec-driven 容易把思路固化

### 单人/小团队的最佳路径

**结论：不需要全面 AI-Native，disciplined AI-Assisted + 选择性吸收 AI-Native 实践 是最佳路径。**

具体来说：

| 做 | 不做 |
|----|------|
| 质量门禁（lint / typecheck / test）作为底线 | 全面 organizational governance |
| 上下文工程（CLAUDE.md、示例、约束、决策记录） | 跨团队 agent 权限编排 |
| Spec-driven / Intent-first 写法 | Audit log 合规审计 |
| 协议化协作（DISCUSS / PLAN / EXECUTE） | 跨组织 agent 知识库 |
| Eval gates（如果产品包含 AI 模块） | 复杂 prompt 版本管理系统 |
| Subagent + scoped permissions（Claude Code 内置就够） | 自建 agent 编排平台 |

### 本项目的具体选择

home-task 是**单人项目，目标是生产级 + 作品级**。结合上面的判断：

- **开发流程**：disciplined AI-Assisted（已在做，质量门禁、CLAUDE.md、协议化协作）
- **产品维度**：因为产品包含 AI 模块（multi-agent、AI chat），所以是 **AI Native 产品**，需要 eval gates、prompt 管理这些（路线图阶段 3 的内容）
- **基础设施**：跟随产品需要，最小可用为主
- **组织角色**：单人不适用，可以暂时不投入

也就是说：**作为开发者用 disciplined AI-Assisted，作为 AI 产品的工程师按 AI Native 标准要求自己**。

## 四个层面

AI Native 不是单一概念，至少包含四个层面：开发流程、产品形态、基础设施、工作方式与角色。这四个层面互相支撑——任何一个缺失，其他三个都会受影响。

对单人/小团队场景，四个层面的相关度不同：

| 层面 | 单人项目相关度 | 说明 |
|------|---------------|------|
| 1. 开发流程 | **高** | disciplined AI-Assisted 是核心实践 |
| 2. 产品 | **取决于产品** | 如果产品包含 AI 模块（如本项目），高；否则低 |
| 3. 基础设施 | **取决于产品** | 跟随产品需要 |
| 4. 工作方式与角色 | **低** | 组织级议题，单人项目可了解但不投入 |

## 层面 1：AI Native 开发流程

AI Native 开发流程的核心，是围绕"AI 是主要代码产出者"这个事实重新设计工作方式。具体分三件事。

### 1.1 流程围绕"AI 写得快、但不可靠"这个事实重新设计

传统流程假设"人写代码慢，但写出来的东西基本可控"，所以质量检查可以靠人 review 兜底。AI Native 流程的前提反过来：**AI 写得很快，但容易写出"看起来对其实不对"的代码**。

由此带来三个改变：

- **质量门禁从"锦上添花"变成"底线"。** 没有自动化拦截，等于让 AI 在没有刹车的车上踩油门。详见 [质量门禁总览](../质量门禁总览.md)。

- **Code review 的重点从"找语法问题"变成"找设计错误和业务理解偏差"。** 机器能查的让机器查，人只看人能查的东西。Review 时不需要把需求都记住，但必须对着需求详细审核实现。此外要警惕一类容易忽略的偏差：**AI 容易在你没要求的地方擅自加东西**——过度防御性编程、未必要的抽象、"将来可能用到"的功能。Review 也要看"有没有多写"，不只是"有没有写错"。

- **测试的优先级提前。** 不是"写完代码再补测试"，而是"先写测试定义行为，AI 围绕测试写实现"。强成功标准让 AI 能独立循环，弱标准（"让它能跑起来"）会强迫人不断中途澄清。

### 1.2 上下文工程变成一等公民

传统开发里，项目文档好不好不直接影响代码质量。AI Native 不同：**AI 的产出质量直接由上下文质量决定**。

上下文的组成至少包含四类：

| 类型     | 内容                     | 举例                                      |
| -------- | ------------------------ | ----------------------------------------- |
| 需求     | 这次要做什么             | 任务描述、验收标准                        |
| 示例     | 项目里是怎么做类似事情的 | 同类 service 的实现风格                   |
| 约束     | 什么不能做               | "不启用 typed linting"、"不引入新依赖"    |
| 决策记录 | 为什么这么做             | "选 recommended 而非 strict，因为...... " |

上下文也有"分层"：

- **项目级** — `CLAUDE.md` / `AGENTS.md` / 各种规范文档。这是 AI 每次启动都加载的全局指令源。
- **任务级** — 当前对话、PLAN 里的具体描述。这是单次任务的临时上下文。

两者不要混。项目通用规则（代码风格、技术栈边界、禁用工具）写进 CLAUDE.md，任务专属信息（这次要改哪个文件、要满足什么条件）放在对话里。

**写文档是高 ROI 投资。** 前期建文档成本高，但后期省下的纠正成本远超投入——"写一次文档换 AI 每次都遵守"。比如本项目"不启用 typed linting"的决定，如果不写进 CLAUDE.md，下次 AI 配置 ESLint 时大概率会给你加回来。

### 1.3 人的角色从"写"转向"决策、审核、验证"

传统开发里，写代码是主要劳动。AI Native 里，写代码不是瓶颈了，**判断写什么、判断 AI 写得对不对、判断什么时候应该停下来重新设计** 成了主要劳动。

具体职责包括：

- **决策需求方向。** AI 不会替你判断"这个功能该不该做"。
- **判断什么时候打断 AI。** AI 不会主动说"这个方向不对"，它会沿着错误方向继续狂奔。打断 AI 是人的责任。
- **审核 AI 产出。** AI 是概率工具，纵使有详细上下文和质量门禁，也需要人做最后一道审核。
- **拆分任务。** AI 一次能做的事有上限，怎么切片、怎么验证每片成功是新技能。
- **协议化协作。** 比如本项目 CLAUDE.md 里的 DISCUSS / PLAN / EXECUTE 流程，防止 AI 在错误方向上狂奔。

有经验的开发者的核心价值不是写代码快，而是**知道什么时候要停、什么时候要拒绝 AI 的方案、什么时候要重新设计**。这也意味着开发者的学习路径变了：以前是"先学语法再学架构"，现在更接近"先学判断力"。

不懂开发的人可以借助 AI 写出能跑的 Demo，但生产级代码依然需要有经验的开发者把控质量。

**反面警告：** 不要变成"AI 写什么我接受什么"的橡皮图章。**自己不理解的代码就是技术债**，不管是不是 AI 写的。

### 三件事互相支撑

没有质量门禁，AI 写得再快也不敢上；没有上下文工程，AI 写出来的东西不符合项目规范；没有人的判断力，前两个都白搭。任何一个缺失，AI Native 流程都会退化为"用了 AI 的传统开发"——形似而神不是。

### 相关专项文档

- [质量门禁总览](../质量门禁总览.md)
- [ESLint 质量门配置说明](./ESLint质量门配置说明.md)
- [TypeCheck 质量门配置说明](./TypeCheck质量门配置说明.md)

## 层面 2：AI Native 产品

### 核心区别

一句话：**AI Native 产品的核心价值如果没有 AI 就不存在**。"带 AI 功能"的产品没了 AI 还能用，只是少了点便利。

### 判断标准

| 维度 | "带 AI 功能"的产品 | AI Native 产品 |
|------|-------------------|----------------|
| **AI 的地位** | 锦上添花的功能（"AI 帮你总结一下"） | 核心价值（没有 AI 这个产品不成立） |
| **交互方式** | 表单/按钮为主，AI 是辅助入口 | 自然语言/Agent 为主，传统 UI 是辅助 |
| **智能分布** | 单点 AI 功能（一个 chatbot） | 多层渗透（推荐、生成、决策、个性化都用 AI） |
| **状态记忆** | 会话即用即弃 | 持久记忆用户偏好、历史、上下文 |
| **执行模式** | 用户给指令 AI 执行 | Agentic：AI 自主规划、用工具、自我纠错 |
| **学习能力** | 模型固定 | 从用户行为持续学习（数据飞轮） |

### 三个常见架构模式

1. **Agentic Workflow** — 不只是 prompt-response，AI 能规划、用工具、自我纠错。研究数据：agentic loop 比静态 prompt 任务完成率高 40%。
2. **Persistent Memory + Context** — Vector DB 存用户偏好/历史，跨会话保持上下文。
3. **Embedded Intelligence** — 智能不集中在某个聊天框，而是分散在每一层（推荐、提醒、内容生成都是 AI 驱动）。

### 一个容易混淆的点

**"用了大模型 API" ≠ "AI Native 产品"。** 2026 年这个标准已经提高了——把 LLM 套个聊天框接到传统界面上，不算 AI Native，业内叫 "AI-wrapped"。行业数据：AI Native 产品的用户留存率是 AI-wrapped 的 3 倍，因为用户已经"prompt fatigue"——不想再告诉 app 该做什么，希望 app 理解目标。

### 设计逻辑的根本不同

AI Native 产品的设计逻辑和传统产品不一样：

| | 传统产品 | AI Native 产品 |
|---|---------|---------------|
| 设计思维 | 确定性流程（用户点 A → 跳 B → 显示 C） | 概率性结果（同一 prompt 两次结果可能不同） |
| 失败处理 | 拦截在表单验证层 | 拦截在 eval + 高风险动作确认层 |
| 迭代驱动 | 用户调研 + 数据分析 | 失败样本 → eval → prompt 调优 |
| 护城河 | 功能差异 | 工作流编排 + 累积学习（很难复制） |

### 本项目的定位

> 待填充：home-task 在 AI Native 产品标尺上的位置、缺什么、阶段 3 应该补什么。

## 层面 3：AI Native 基础设施

> 待填充：支撑 AI Native 产品和开发流程的技术栈。
>
> 涵盖：Agent 编排（单 Agent vs 多 Agent）、上下文管理（RAG、长上下文、prompt caching）、可观测性（tracing、prompt 版本、失败样本沉淀）、成本/延迟治理（模型路由、token 预算）、安全边界（prompt injection 防护、tool 权限、高风险动作确认）。

## 层面 4：AI Native 工作方式与角色

> 待填充：人在 AI Native 中的定位和组织协作方式的变化。
>
> 涵盖：人作为 orchestrator、新角色出现（Prompt Engineer、AI PM、AI Reliability Engineer）、持续学习（模型版本迁移、retired model 替换）、数据飞轮思维。

## 与本项目其他文档的关系

> 待填充：本项目中哪些文档属于 AI Native 的哪个层面，如何配合使用。

## 参考资料

- [What Is AI Native? | IBM](https://www.ibm.com/think/topics/ai-native)
- [AI-Assisted vs AI-Native Development | HatchWorks](https://hatchworks.com/blog/gendd/ai-assisted-vs-ai-native-development/)
- [AI-Native Engineering Definition | Howdy](https://www.howdy.com/blog/ai-native-engineering-definition-roles-workflow-operating-model)
- [Four Patterns of AI Native Development | InfoQ](https://www.infoq.com/presentations/patterns-ai-native-development/)
- [Towards AI-Native Software Engineering (SE 3.0) | ArXiv](https://arxiv.org/pdf/2410.06107)
- [What Makes an App Truly AI Native in 2026 | Wix Studio](https://backlinksindiit.wixstudio.com/app-development-expe/post/what-makes-an-app-truly-ai-native-in-2026)
- [Addy Osmani: My LLM coding workflow](https://addyosmani.com/blog/ai-coding-workflow/)
