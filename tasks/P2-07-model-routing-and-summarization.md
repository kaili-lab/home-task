# P2-07：模型分层路由

- **status**: pending
- **改进项**: #17 模型分层路由
- **前置任务**: 无
- **后续任务**: 无

## 目标

按任务复杂度动态选择 LLM 模型。

本任务当前只负责“按意图 / 消息复杂度选模”，不强依赖 `P2-03` 的 token 计数能力。后续如果要把 token 预算、上下文长度等因素纳入路由，可以在此基础上继续增强，而不是把 `P2-03` 作为硬前置。

## 具体改动

### 模型分层路由

#### 1. 定义路由策略

```typescript
interface ModelTier {
  name: string;       // 如 "deepseek-v3.2", "gpt-4o-mini", "gpt-4o"
  maxTokens: number;
  costPerMToken: number;
}

function selectModel(intent: string, messageLength: number): ModelTier {
  // 简单查询 → 轻量模型（成本低、速度快）
  if (intent === "query") return LIGHT_MODEL;

  // 创建/更新/删除（含冲突判断）→ 强模型
  return STRONG_MODEL;
}
```

#### 2. 集成到 createLLM

```typescript
private createLLM(tier?: ModelTier) {
  const model = tier?.name || this.env.AIHUBMIX_MODEL_NAME || "gpt-4o";
  return new ChatOpenAI({
    apiKey: this.env.AIHUBMIX_API_KEY || this.env.OPENAI_API_KEY,
    model,
    maxTokens: tier?.maxTokens || 2000,
    // ...
  });
}
```

#### 3. 在 chat() 中使用

```typescript
const inferredIntent = this.inferTaskIntent(message);
const modelTier = selectModel(inferredIntent, message.length);
const llm = this.createLLM(modelTier);
```

## 涉及文件

- `packages/server/src/services/ai/index.ts`（或拆分后的相应模块）
  - `createLLM()` — 支持 tier 参数
  - `chat()` — 集成模型选择

## 验收标准

- [ ] 简单查询使用轻量模型（可通过日志/Tracing 验证）
- [ ] 复杂操作使用强模型
- [ ] 模型选择可通过环境变量配置

