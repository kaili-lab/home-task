# Diátaxis（文档四象限框架）

## 是什么 / 解决什么问题

[Diátaxis](https://diataxis.fr/) 的核心论点：**文档只有四种，混在一起就会让读者（和作者）都感到混乱。**

| 类型 | 核心问题 | 写法特征 |
|------|---------|---------|
| **Tutorial** | 我怎么从零开始？ | 手把手带着做，有明确终点 |
| **How-to Guide** | 我怎么完成 X 任务？ | 假设读者已有基础，直接给步骤 |
| **Reference** | 这个参数/接口具体是什么？ | 准确、完整、干燥，不解释背景 |
| **Explanation** | 为什么是这样设计的？ | 讲背景、权衡、上下文，不给操作步骤 |

**适合的场景：**
- 项目文档越写越多，找东西越来越难
- 同一个文档里既有操作步骤又有概念解释，读者不知道从哪看起
- 团队写文档时没有统一标准

**解决的问题：**
- "文档爆炸"——不是文档太多，是没有按类型分区
- 读者目的不同（学习 vs 查资料 vs 理解设计）但读的是同一份文档
- 作者不知道该在哪里写什么

---

## 示例：AI Chat 模块文档重组

> 当前 `docs/` 目录混合了多种类型，按 Diátaxis 重组后：

### 现状（混合型，难以导航）

```
docs/
  AI-System-Prompt改进需求.md     ← 混合了 Explanation + Reference + How-to
  Single-Agent设计文档.md          ← 混合了 Explanation + Reference
  agent-design-principle.md        ← Explanation（相对纯）
  agent-system-prompt-design-guide.md  ← Explanation（相对纯）
```

### 按 Diátaxis 重组后（建议结构）

```
docs/
  explanation/                     ← 理解类：为什么这样设计
    ai-chat-module-overview.md         为什么选 single-agent + manual loop
    agent-prompt-design-rationale.md   为什么 system prompt 这样组织
    tool-description-principles.md     为什么 tool description 这样写

  reference/                       ← 查阅类：准确完整的事实
    tool-definitions.md                5 个 tool 的完整定义和参数表
    system-prompt-spec.md              system prompt 终稿（权威版本）
    ai-module-file-structure.md        各文件职责一览

  how-to/                          ← 操作类：怎么做具体的事
    add-new-tool.md                    如何新增一个 tool
    update-system-prompt.md            如何修改 system prompt

  tutorial/                        ← 学习类：从零跑通
    run-ai-chat-locally.md             本地跑通 AI 对话的完整步骤
```

### 关键识别方法

写文档时先问自己：
- 读者是在**学东西**还是在**查东西**？→ Tutorial/How-to vs Reference
- 读者是在**做事**还是在**理解**？→ Tutorial/Reference vs Explanation

如果一篇文档里两种都有，**拆开写**。

---

---

## 四种类型之间的关系

一个常见误解：Diátaxis 要求四种类型完全隔离，互不相关。实际上，它们需要**保持内容纯粹，但通过链接相互导航**。

类比：就像一个城市的地铁系统——各条线路有各自的功能，但换乘站让你能从一条线跳到另一条线。文档的四种类型是四条不同的"阅读线路"，链接是换乘出口。

### 读者的模式切换

读者的阅读目标会随时间变化：
- 初学阶段：Tutorial 模式（被引导着做）
- 上手后遇到具体问题：How-to 模式（找步骤）
- 想查准确参数：Reference 模式（查事实）
- 遇到设计困惑：Explanation 模式（理解背景）

好的文档帮助读者**在正确的时机切换到正确的类型**，而不是让他在一篇文章里猜"这段是说明还是步骤"。

### 跨类型链接规则

| 当前文档类型 | 应该链接到 | 示例 |
|------------|-----------|------|
| Tutorial | Reference（详细参数） + Explanation（背景） | "完整参数列表见 API Reference；了解设计原因见架构解析" |
| How-to | Reference（选项清单） + Tutorial（前置知识） | "所有可用选项见配置参考；如果你是第一次配置，先看入门教程" |
| Explanation | How-to（实践） + Reference（具体数据） | "要实现这个模式，参考 How-to/添加新 tool；相关枚举值见 Reference" |
| Reference | 几乎不主动链接 | Reference 是目的地，读者从别处找到它 |

### 最重要的反模式：内容混入而非链接

❌ **错误做法**：在 How-to 中插入一段解释"为什么这样设计"  
✅ **正确做法**：在 How-to 中写一行"*了解这个设计的背景，见 Explanation/架构决策*"，然后在 Explanation 文件里详细说

这个区别看起来很细，但对读者的影响很大：混入内容打断了任务流，而链接让读者自己决定"我现在需要这个背景知识吗"。

### 在本项目中的应用

```
如果读者在看 how-to/add-new-tool.md，遇到一个概念不理解：
  → 链接到 explanation/ai-chat-module-overview.md（理解设计）
  → 链接到 reference/tool-definitions.md（查具体格式）

如果读者在看 reference/system-prompt-spec.md，想知道为什么这样设计：
  → 链接到 explanation/agent-prompt-design-rationale.md
```

---

## 使用建议

- 不需要立刻重构现有所有文档，**新文档先按类型放对位置**就够了
- 最高价值的通常是补 **Explanation** 类——这类文档最容易被忽略，但最能帮助新人建立心智模型
- Reference 类文档一定要保持**准确**，宁可简短也不要有过期内容
- 每篇文档在结尾加一个"**相关文档**"节，按类型标注链接：`[Reference] xxx` / `[How-to] xxx`

---

## 常见问题

### PRD 放在 Diátaxis 的哪里？

PRD（产品需求文档）是混合型的，不完全适合任何一个象限：

- PRD 中的"背景和目标"→ **Explanation**
- PRD 中的"功能验收条件"→ **Reference**（决策完成后）
- PRD 中的"开发指南/步骤"→ **How-to**

**实际做法**：PRD 在决策阶段独立存在，一旦实现完成，把有价值的内容"蒸馏"到对应的 Diátaxis 象限里，PRD 本身归档。不需要强行归类，它是过程产物，不是最终文档形态。

---

### Diátaxis 更适合哪类项目？

Diátaxis 最初是为**开源工具和框架文档**设计的（如 Django、Gatsby 的文档重组），对这类场景价值最高——读者群体多样，目的差异大（初学者 vs 有经验的查阅者 vs 想理解设计的架构师）。

**对于项目内部文档**（团队协作、业务逻辑、架构决策），它的价值要打折扣：
- 读者少，目的单一，分类的维护成本 > 收益
- 工程师更倾向于直接读代码，而不是导航文档目录

内部文档更实用的组合是 **Living Spec + Sequence Diagram + ADR**（记录架构决策）。

Diátaxis 在内部文档场景里最有用的是那个核心原则：**一篇文档不要既有操作步骤又有概念解释**。把这个原则用在 CLAUDE.md 的结构上，比严格按四个目录分文件夹更有收益。
