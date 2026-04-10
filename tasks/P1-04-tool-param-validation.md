# P1-04：Tool 参数 Runtime 校验

- **status**: pending
- **改进项**: #8 Tool 参数 Runtime 校验
- **前置任务**: 无
- **后续任务**: 无

## 目标

用 Zod 为每个 tool 定义输入 schema，在 `executeToolCall()` 入口统一校验，替代 `as` 类型断言。

## 当前代码

`packages/server/src/services/ai/index.ts` 中多处类型断言：

```typescript
// 行 ~930
const { title, description, ... } = toolArgs as { title: string; ... };
// 行 ~1100
const { taskId, ...updates } = toolArgs as { taskId: number; ... };
// 行 ~1135
const { taskId } = toolArgs as { taskId: number };
// 行 ~1147
const { taskId } = toolArgs as { taskId: number };
```

LLM 返回畸形参数时，错误在 `taskService` 深层业务才暴露。

## 具体改动

### 1. 定义 Zod schemas

```typescript
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeSegment: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  groupId: z.number().optional(),
});

const queryTasksSchema = z.object({
  status: z.string().optional(),
  dueDate: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  priority: z.string().optional(),
});

const taskIdSchema = z.object({
  taskId: z.number(),
});

const updateTaskSchema = taskIdSchema.extend({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeSegment: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
});

const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  create_task: createTaskSchema,
  query_tasks: queryTasksSchema,
  update_task: updateTaskSchema,
  complete_task: taskIdSchema,
  delete_task: taskIdSchema,
};
```

### 2. 在 executeToolCall 入口统一校验

```typescript
private async executeToolCall(userId, toolName, toolArgs, message, options) {
  const schema = TOOL_SCHEMAS[toolName];
  if (schema) {
    const result = schema.safeParse(toolArgs);
    if (!result.success) {
      return {
        status: "error" as const,
        message: `参数不合法：${result.error.issues.map(i => i.message).join("，")}`,
      };
    }
    toolArgs = result.data; // 使用校验后的数据
  }
  // ... 原有 switch 逻辑
}
```

### 3. 移除 as 类型断言

每个 case 分支中的 `toolArgs as {...}` 改为直接使用（Zod 已校验和推导类型）。

## 注意事项

- 项目已有 `@hono/zod-validator` 依赖，`zod` 已可用
- 校验失败返回 `status: "error"`，LLM 会收到错误信息并尝试修正参数

## 涉及文件

- `packages/server/src/services/ai/index.ts`
  - 新增 Zod schemas
  - `executeToolCall()` 入口增加校验
  - 各 case 分支移除 `as` 断言

## 验收标准

- [ ] 所有 5 个 tool 的参数有 Zod schema 定义
- [ ] LLM 返回缺失必填字段时，返回明确错误信息
- [ ] LLM 返回错误类型时（如 taskId 为字符串），返回明确错误信息
- [ ] 正常参数不受影响
- [ ] 无 `as` 类型断言残留

