# P0-04：删除操作硬确认

- **status**: pending
- **改进项**: #2 删除操作硬确认
- **前置任务**: P1-02-1
- **后续任务**: 无

说明：虽然前置任务编号位于 P1，但本任务的执行顺序仍以前置依赖为准，应先完成 `P1-02-1` 再实现删除确认。

## 目标

`delete_task` 工具执行时增加代码层确认机制，首次调用返回 `need_confirmation`，用户确认后才真正执行删除。

## 当前代码

`packages/server/src/services/ai/index.ts` 行 1146-1154：

```typescript
case "delete_task": {
  const { taskId } = toolArgs as { taskId: number };
  await taskService.deleteTask(taskId, userId);
  return {
    status: "success",
    message: "任务已删除。",
    actionPerformed: "delete",
  };
}
```

直接执行删除，无确认机制。删除安全性完全依赖 prompt 约束。

## 具体改动

### 1. 删除确认不再复用“消息文本匹配确认”模式

本任务不再采用：

- 读取上一条 assistant 文本
- 判断文本里是否像删除确认
- 再根据用户回复 `"确认"` 推断是否继续执行删除

原因是：

- 删除属于高风险动作
- 文本匹配方案容易受提示文案变动影响
- 当前项目已新增 `P1-02-1`，删除确认应改为显式 `session state / approval state` 驱动

### 2. 修改 `delete_task` 分支

首次进入删除确认时，除了返回确认消息，还要写入显式挂起状态：

```typescript
case "delete_task": {
  const { taskId } = toolArgs as { taskId: number };

  const task = await taskService.getTaskById(taskId, userId);
  if (!task) {
    return { status: "error", message: `未找到 ID 为 ${taskId} 的任务。` };
  }

  await saveSessionState(userId, {
    flowStatus: "awaiting_confirmation",
    actionKind: "delete_task",
    actionPayload: {
      taskId: task.id,
      taskTitle: task.title,
    },
    expiresAt,
  });

  return {
    status: "need_confirmation",
    message: `确认要删除任务「${task.title}」吗？删除后不可恢复。`,
    responseType: "question",
    responsePayload: {
      interaction: {
        kind: "confirmation",
        action: "delete_task",
        confirmText: "确认",
        cancelText: "取消",
      },
    },
  };
}
```

### 3. `chat()` 入口优先处理删除确认态

当用户下一轮回复 `"确认"` / `"取消"` 时，优先读取显式状态：

- 若当前 `flowStatus === "awaiting_confirmation"` 且 `actionKind === "delete_task"`
  - `"确认"` → 真正执行 `taskService.deleteTask()`
  - `"取消"` → 清除状态并返回取消结果
- 不再依赖上一条 assistant 文本做推断

### 4. 返回结构化确认交互信号

删除确认消息应通过 `payload.interaction.kind === "confirmation"` 明确告诉前端：

- 这是一条可以显示确认/取消按钮的消息
- 它不是普通 `question`

## 涉及文件

- `packages/server/src/services/ai/index.ts`
  - `delete_task` 分支
  - 删除确认状态写入
  - `chat()` 入口确认态恢复执行
- `packages/server/src/db/schema.ts`（或等价状态存储结构）
  - 删除确认挂起状态持久化
- `packages/web/src/features/ai/ChatMessage.tsx`
  - 通过 `payload.interaction.kind === "confirmation"` 渲染删除确认按钮

## 验收标准

- [ ] 首次触发 delete_task 返回确认提示，不执行删除
- [ ] 用户回复"确认"后，第二次触发 delete_task 执行删除
- [ ] 确认提示包含任务标题，方便用户辨认
- [ ] 删除确认不再依赖上一条 assistant 文本匹配来恢复流程
- [ ] 删除确认消息带 `payload.interaction.kind === "confirmation"`，可被前端准确识别
- [ ] 非删除操作不受影响
- [ ] 连续删除不同任务时，每次都需要独立确认

