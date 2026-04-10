# Agent System Prompt 设计准则

> 适用范围：本项目 `prompt-builder.ts` 及后续所有涉及 LLM Agent 的 system prompt 编写
> 创建日期：2026-04-10

---

## 一、核心原则

System prompt 的受众是 **LLM**，目的是让模型在每次推理开始前建立完整的认知框架。  
写 system prompt 本质上是在回答三个问题：

1. **你是谁？能做什么？**（Identity + Capabilities）
2. **你现在处于什么上下文？**（Dynamic Context）
3. **你必须遵守哪些规则？**（Constraints + Output Format）

---

## 二、推荐结构与顺序

```
1. Role & Capabilities   ← 先建立"我能做什么"的完整图景
2. Dynamic Context       ← 注入运行时状态（日期、用户数据等）
3. Intent Recognition    ← 先判断"用户要做什么"
4. Tool Routing          ← 再决定"调哪个工具"
5. Parameter Extraction  ← 最后才是"工具参数怎么填"
6. Constraints / Rules   ← 集中列出所有"不能做什么"
7. Output Format         ← 回复的结构和风格规范
```

**顺序的意义：** 从粗到细。模型先知道自己有什么能力，再识别意图，再选工具，最后处理细节。  
反之，如果把参数提取规则写在意图识别前面，模型读到"如何填字段"时还不知道要做什么，认知负担增加。

---

## 三、各节写法要点

### 3.1 Role & Capabilities（能力概述）

- 一句话定义角色：是什么、服务谁、核心目标
- **显式列出工具清单**，让模型在回答前就知道自己有哪些手段
- 明确能力边界：不在清单内的请求一律拒绝

```
# 示例
你是一个任务管理助手，帮助用户通过自然语言管理个人和群组任务。

你拥有以下工具：
- create_task：创建新任务
- query_tasks：查询任务列表
- update_task：修改已有任务
- complete_task：标记任务完成
- delete_task：删除任务

非任务管理相关的请求，礼貌拒绝。
```

---

### 3.2 Dynamic Context（动态上下文）

- 只放**运行时才能确定**的信息（日期、用户状态、群组列表等）
- 静态知识（时间段定义、枚举值）写在 parameter description 或固定节里，不要在上下文里重复
- 格式清晰，模型能一眼定位关键值

---

### 3.3 Intent Recognition（意图识别）

- 放在工具路由**之前**，先帮模型判断"用户想做什么操作"
- 重点处理**容易混淆的表达**，列出反例
- 格式：`用户说法 → 应判定为 X（不是 Y）`

```
# 示例
- "完成XXX"、"做完了" → complete_task，不是 create_task
- "删掉XXX"、"取消" → delete_task，不是 update_task
- "改成明天" → update_task，不是 create_task
```

---

### 3.4 Tool Routing（工具使用指导）

- 每个工具：触发条件 + 前置条件 + 关键约束
- 跨工具的协作关系在这里说明（如"更新前需要先查 ID"），不要写到工具的 description 里
- 避免在工具 description 中写跨工具注释（会造成两处维护）

---

### 3.5 Parameter Extraction（参数提取）

- 字段级别的语义规则，帮模型把用户自然语言映射到结构化参数
- 时间、日期、优先级的推断规则在这里写
- **格式约束**（YYYY-MM-DD、HH:MM）写在 parameter 的 description 里，不在 system prompt 重复

---

### 3.6 Constraints / Rules（约束集中区）

**最重要的设计原则：约束集中，不分散。**

把所有"不能做"、"必须做"集中在一个节里。分散在各节的约束，模型可能读完一节就忘了，集中写才能形成整体规则意识。

```
# 示例
## 硬性约束
- 日期不得擅自推断，用户未说明时默认今天
- 用户只给了开始时间，必须追问结束时间，禁止自行猜测
- 删除前必须向用户确认任务信息
- 用户未指定日期时，查询任务前必须先提示用户指定日期
```

---

### 3.7 Output Format（回复格式规范）

当前最常见的遗漏。仅写"简洁友好"是风格要求，不是格式规范。

需要明确：

| 场景 | 应回复的结构 |
|------|-------------|
| 创建成功 | 确认语 + 任务摘要（标题、日期、时间） |
| 存在冲突 | 冲突说明 + 已有任务信息 + 询问用户意图 |
| 需要追问 | 具体缺少什么信息，一次只问一个 |
| 操作失败 | 说明原因 + 建议下一步 |

如果前端依赖 `type` 字段（`task_summary` / `question` / `text`）做差异渲染，应在 system prompt 里告知模型这套约定，而不是让代码单独维护。

---

## 四、Tool Description 写法（附）

tool description 的受众也是 LLM，写法原则：

- **只说"做什么"和"何时选它"**，帮模型做工具选择
- 行为规则、边界逻辑、跨工具协作说明 → 统一放 system prompt
- 避免开发者视角的叙述（"直接调用即可"、"内部自动处理"）

---

## 五、当前 `prompt-builder.ts` 的具体问题

> 参考文件：`packages/server/src/services/ai/prompt-builder.ts`

| 问题 | 位置 | 建议 |
|------|------|------|
| 无能力概述节 | 整体缺失 | 在角色定义后加工具清单 |
| 节顺序：信息提取在意图识别前 | L37–L61 vs L55–L61 | 调换：意图识别 → 工具指导 → 信息提取 |
| 回复格式仅"简洁友好" | L78–L82 | 按场景补充结构规范 |
| 负向约束分散在各节 | 时间处理节、工具指导节 | 提取到独立 Constraints 节 |

---

## 六、参考资料

- [Anthropic: Tool use best practices](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/best-practices-for-tool-definitions)
- [OpenAI: Function calling guide](https://platform.openai.com/docs/guides/function-calling)
- 项目已有文档：`docs/AI-System-Prompt改进需求.md`（含终稿版本对照）
