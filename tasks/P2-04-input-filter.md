# P2-04：输入内容过滤

- **status**: pending
- **改进项**: #14 输入内容过滤
- **前置任务**: 无
- **后续任务**: 无

## 目标

在 AI 请求入口增加基础的 prompt injection 检测，拦截恶意输入。

## 具体改动

### 1. 新建过滤模块

新建 `packages/server/src/utils/input-filter.ts`：

```typescript
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /忽略(之前|以上|所有)(的)?(指令|规则|要求)/,
  /你现在是/,
];

export function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(message));
}
```

### 2. 在路由层调用

```typescript
// ai.routes.ts
import { detectInjection } from "../utils/input-filter";

if (detectInjection(message)) {
  return c.json({
    success: true,
    data: {
      content: "抱歉，我只能帮你管理任务和日程，请告诉我你想创建、查询或修改什么任务。",
      type: "text",
    },
  });
}
```

不返回 400（避免信息泄露），而是以正常 AI 回复的形式礼貌拒绝。

## 涉及文件

- 新建 `packages/server/src/utils/input-filter.ts`
- `packages/server/src/routes/ai.routes.ts` — 调用检测

## 验收标准

- [ ] 包含注入模式的消息被拦截，返回礼貌拒绝
- [ ] 正常任务相关消息不受影响
- [ ] 不返回 4xx 状态码（防止攻击者探测规则）
- [ ] 中英文注入模式都能检测
