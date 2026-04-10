# LangChain 短期记忆（Short-Term Memory）

> 来源：https://docs.langchain.com/oss/javascript/langchain/short-term-memory  
> 整理时间：2026-04-06

---

## 一、概念与核心问题

### 1.1 什么是短期记忆

记忆系统让 AI Agent 能够**记住之前的交互信息**。官方定义："Memory is a system that remembers information about previous interactions."（记忆是一个记住此前交互信息的系统。）

**短期记忆**专指在**单次对话线程（thread）内**的信息保留。一个 thread 组织了一次会话中的多次交互，类似于邮件把多封往来信件归入同一个会话串。

> 如果你需要的是**跨对话**的信息保留（例如记住用户偏好、历史习惯），那属于**长期记忆（Long-term Memory）**，是另一个独立的话题。

### 1.2 对话历史：最常见的短期记忆实现

聊天模型的输入是一组**结构化消息**，由系统指令（system message）和用户输入（human message）组成。在对话应用中，消息在用户输入和模型回复之间交替产生，形成一个**随时间不断增长的消息列表**。

这个不断增长的消息列表，就是最朴素的"短期记忆"。

### 1.3 核心矛盾：上下文窗口限制

对话历史面临一个根本问题：**完整的历史可能超出 LLM 的上下文窗口**，导致信息丢失或报错。

但问题不只是"装不下"。官方文档特别指出了一个更隐蔽的问题：

> 即使模型的上下文窗口理论上装得下全部历史，模型也会被**过时的、跑题的内容"分散注意力"**，同时还伴随着更慢的响应速度和更高的成本。

这意味着，**短期记忆的设计目标不是"把所有历史都塞进去"，而是在"保留有用信息"和"控制上下文质量与长度"之间找到平衡。**

---

## 二、基本用法：checkpointer 与 thread

### 2.1 架构原理

LangChain 将短期记忆作为 **Agent 状态（state）的一部分**来管理。状态通过 **checkpointer** 持久化到数据库或内存中，这样对话线程可以在任意时刻恢复。

状态的更新时机是明确的：
- **写入**：在 Agent 被调用（invoke）或某个步骤（如工具调用）完成时
- **读取**：在每个步骤开始时

### 2.2 最小实现

要让 Agent 拥有短期记忆，只需在创建时传入 checkpointer：

```typescript
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [],
  checkpointer: new MemorySaver(),
});

await agent.invoke(
  { messages: [{ role: "user", content: "hi! i am Bob" }] },
  { configurable: { thread_id: "1" } }
);
```

**`thread_id` 是关键标识**：同一个 `thread_id` 的多次调用共享记忆；不同的 `thread_id` 则完全隔离，互不影响。这类似于不同的聊天窗口各有各的上下文。

### 2.3 开发 vs 生产

`MemorySaver` 把状态存在进程内存中，适合开发调试，但服务重启就丢失了。

**生产环境必须使用数据库持久化**，例如：

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  "postgresql://postgres:postgres@localhost:5442/postgres"
);
```

官方支持的持久化方案包括 SQLite、Postgres、Azure Cosmos DB 等，详见 Persistence 文档。

---

## 三、自定义 Agent 状态

### 3.1 为什么要扩展状态

默认情况下，Agent 的状态只有 `messages`（消息列表）。但实际应用中你可能还需要在状态中携带其他信息，比如当前用户 ID、用户偏好设置、待确认的操作等。

### 3.2 实现方式：StateSchema + Middleware

通过 `StateSchema` 类定义自定义状态结构，然后用 Middleware 注入到 Agent 中。官方推荐使用 `StateSchema` 类（也支持直接传 Zod 对象）。

```typescript
import { createAgent, createMiddleware } from "langchain";
import { StateSchema, MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

const CustomState = new StateSchema({
  userId: z.string(),
  preferences: z.record(z.string(), z.any()),
});

const stateExtensionMiddleware = createMiddleware({
  name: "StateExtension",
  stateSchema: CustomState,
});

const agent = createAgent({
  model: "gpt-4.1",
  tools: [],
  middleware: [stateExtensionMiddleware],
  checkpointer: new MemorySaver(),
});
```

调用时就可以传入自定义字段：

```typescript
await agent.invoke({
  messages: [{ role: "user", content: "Hello" }],
  userId: "user_123",
  preferences: { theme: "dark" },
});
```

扩展后的状态会和 `messages` 一起被 checkpointer 持久化，下一次同 `thread_id` 的调用可以读取到这些值。

---

## 四、管理长对话的三种策略

当对话超出上下文窗口时，需要主动管理消息列表。LangChain 提供三种策略，各有取舍。

### 4.1 Trim（修剪）—— 简单粗暴，丢弃中间部分

**做什么**：在调用 LLM 之前，移除早期的消息，只保留第一条（通常是系统指令）+ 最近几条。

**判断时机**：一种常见做法是统计消息历史的 token 数量，当接近上下文窗口限制时触发裁剪。

**实现位置**：`beforeModel` 钩子——在消息发给模型之前处理。

```typescript
const trimMessages = createMiddleware({
  name: "TrimMessages",
  beforeModel: (state) => {
    const messages = state.messages;
    if (messages.length <= 3) return;
    const firstMsg = messages[0];
    const recentMessages =
      messages.length % 2 === 0 ? messages.slice(-3) : messages.slice(-4);
    return {
      messages: [
        new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
        firstMsg,
        ...recentMessages,
      ],
    };
  },
});
```

**优点**：实现简单，效果立竿见影。  
**代价**：被丢弃的消息中的信息永久丢失，模型无法引用早期对话内容。

### 4.2 Delete（删除）—— 模型回复后清理

**做什么**：在模型回复之后，从状态中永久移除指定消息。

**实现位置**：`afterModel` 钩子——在模型回复之后处理。

```typescript
const deleteOldMessages = createMiddleware({
  name: "DeleteOldMessages",
  afterModel: (state) => {
    if (state.messages.length > 2) {
      return {
        messages: state.messages
          .slice(0, 2)
          .map((m) => new RemoveMessage({ id: m.id! })),
      };
    }
    return;
  },
});
```

**与 Trim 的关键区别**：Trim 是在发给模型前"临时过滤"（状态本身不变），Delete 是在模型回复后"真正从状态中移除"（checkpointer 中也会删掉）。

**重要注意事项**：删除消息时必须确保结果消息列表仍然合法。官方特别警告了两条规则：
- 某些 LLM provider 要求消息列表**以用户消息开头**
- 大多数 provider 要求**带有 tool_calls 的助手消息后面必须紧跟对应的 ToolMessage**

如果删除操作破坏了这些约束，会导致 API 报错。

### 4.3 Summarize（摘要）—— 压缩但保留语义

**做什么**：用一个更小的模型把早期消息压缩成一段摘要，替换原始消息。

**为什么需要它**：官方文档的解释很到位：

> Trim 和 Delete 的问题是你可能会在裁减消息队列时丢失信息。因此，某些应用适合用更精细的方式——**用模型来对消息历史做摘要**。

LangChain 提供了内置的 `summarizationMiddleware`：

```typescript
const agent = createAgent({
  model: "gpt-4.1",
  tools: [],
  middleware: [
    summarizationMiddleware({
      model: "gpt-4.1-mini",    // 用小模型做摘要，省成本
      trigger: { tokens: 4000 }, // 当 token 数超过 4000 时触发
      keep: { messages: 20 },    // 摘要后仍保留最近 20 条原始消息
    }),
  ],
  checkpointer: new MemorySaver(),
});
```

**优点**：信息不会丢失，只是被压缩了。  
**代价**：需要额外的 LLM 调用来生成摘要，增加延迟和成本；摘要质量取决于模型能力。

### 三种策略对比

| 策略 | 执行时机 | 信息是否保留 | 额外成本 | 适用场景 |
|------|---------|------------|---------|---------|
| Trim | beforeModel | 否，直接丢弃 | 无 | 只需最近上下文，历史价值低 |
| Delete | afterModel | 否，从状态移除 | 无 | 需要即时清理，精确控制保留哪些 |
| Summarize | 按 token 触发 | 是，压缩保留 | 需要额外 LLM 调用 | 历史信息有长期参考价值 |

---

## 五、在 Tool 中访问和修改记忆

Tool 不仅能执行操作，还可以**读取和写入 Agent 的短期记忆**。这使得 Tool 能够利用上下文信息，也能为后续步骤留下中间结果。

### 5.1 读取状态

Tool 的执行函数有一个隐藏的 `runtime` 参数（类型 `ToolRuntime`）。这个参数**对模型不可见**（模型不知道它的存在），但 Tool 可以通过它访问当前 Agent 状态。

```typescript
const getUserInfo = tool(
  async (_, config: ToolRuntime<typeof CustomState.State>) => {
    const userId = config.state.userId;  // 从 Agent 状态中读取
    return userId === "user_123" ? "John Doe" : "Unknown User";
  },
  { name: "get_user_info", description: "Get user info", schema: z.object({}) }
);
```

**为什么 runtime 对模型隐藏？** 因为这些状态信息（如 userId、preferences）是系统内部数据，不应作为 Tool 的参数让模型来填。模型只负责决定"要不要调用这个 Tool"，Tool 内部自己去获取需要的上下文。

### 5.2 写入状态

Tool 可以通过返回 `Command` 对象来直接修改 Agent 状态。这对于**持久化中间结果**非常有用——让某个 Tool 的执行结果可以被后续的其他 Tool 或 Prompt 访问到。

```typescript
const updateUserInfo = tool(
  async (_, config: ToolRuntime<...>) => {
    const name = "John Smith";
    return new Command({
      update: {
        userName: name,         // 写入新的状态字段
        messages: [
          new ToolMessage({
            content: "Successfully looked up user information",
            tool_call_id: config.toolCall?.id ?? "",
          }),
        ],
      },
    });
  },
  { name: "update_user_info", description: "Look up and update user info.", schema: z.object({}) }
);
```

**使用场景举例**：第一个 Tool 查到了用户姓名并写入状态 → 第二个 Tool 从状态读取姓名来生成个性化问候。两个 Tool 之间不需要通过消息传递中间结果，直接共享状态即可。

---

## 六、Middleware 与短期记忆的关系

Middleware 是短期记忆管理的**主要执行场所**。前面讲的 Trim、Delete、Summarize 三种策略，都是通过 Middleware 实现的。

### 6.1 beforeModel —— 模型调用前

在消息发给 LLM 之前拦截并修改。最常见用途是**消息裁剪**，确保发给模型的上下文不超限。

```typescript
const trimMessageHistory = createMiddleware({
  name: "TrimMessages",
  beforeModel: async (state) => {
    const trimmed = await trimMessages(state.messages, {
      maxTokens: 384,
      strategy: "last",
      startOn: "human",
      endOn: ["human", "tool"],
      tokenCounter: (msgs) => msgs.length,
    });
    return {
      messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...trimmed],
    };
  },
});
```

### 6.2 afterModel —— 模型调用后

在模型回复之后拦截并处理。常见用途是**校验和安全过滤**，例如检查模型回复是否包含不应泄露的敏感信息。

```typescript
const validateResponse = createMiddleware({
  name: "ValidateResponse",
  afterModel: (state) => {
    const lastMessage = state.messages.at(-1)?.content;
    if (typeof lastMessage === "string" && lastMessage.includes("confidential")) {
      return { messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES })] };
    }
    return;
  },
});
```

**两个钩子的分工**：`beforeModel` 负责"控制模型看到什么"，`afterModel` 负责"控制最终输出什么"。

---

## 七、基于记忆的动态 Prompt

短期记忆不只影响消息列表，还可以用来**动态生成 system prompt**。通过 `dynamicSystemPromptMiddleware`，每次调用时根据当前状态或上下文生成不同的系统提示。

```typescript
import { createAgent, dynamicSystemPromptMiddleware } from "langchain";
import * as z from "zod";

const contextSchema = z.object({ userName: z.string() });

const agent = createAgent({
  model: "gpt-5-nano",
  tools: [],
  contextSchema,
  middleware: [
    dynamicSystemPromptMiddleware((_, config) => {
      return `你是一个助手。请称呼用户为 ${config.context?.userName}。`;
    }),
  ],
});

await agent.invoke(
  { messages: [{ role: "user", content: "今天天气怎样？" }] },
  { context: { userName: "张三" } }
);
```

**为什么这很重要？** 传统做法是写一个固定的 system prompt。但在实际应用中，prompt 需要根据用户身份、当前状态、业务模式等因素动态变化。动态 Prompt 让 system prompt 从"静态字符串"变成了"感知上下文的函数"。

---

## 八、核心要点总结

1. **短期记忆 = thread 级别的状态保持**。同一 `thread_id` 的多次调用共享记忆，不同 thread 互相隔离
2. **checkpointer 是持久化的关键基础设施**。开发用 `MemorySaver`（内存），生产必须用数据库（Postgres 等）
3. **上下文窗口是硬约束**，但比"装不下"更危险的是"装得下但质量下降"——过时内容会分散模型注意力
4. **三种管理策略**各有适用场景：Trim 最简单，Delete 最精确，Summarize 保留信息最多但成本最高
5. **Tool 可以读写 Agent 状态**：通过隐藏的 `runtime` 参数读取，通过返回 `Command` 写入。这使得 Tool 之间可以共享中间结果
6. **Middleware 是短期记忆管理的主阵地**：`beforeModel` 控制输入质量，`afterModel` 控制输出安全
7. **动态 Prompt** 让 system prompt 能感知当前对话状态，是 Context Engineering 的重要组成部分
