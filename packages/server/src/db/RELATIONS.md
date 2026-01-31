# Drizzle 关系定义说明

## 什么是关系定义？

关系定义（Relations）告诉 Drizzle ORM 表之间的关联关系，让 ORM 能够自动处理关联数据的查询。

## 为什么需要它？

### 1. 启用关系查询 API

定义关系后，可以使用 `db.query` API 简化关联数据查询：

```typescript
// ❌ 没有关系定义：需要手动 JOIN 和多次查询
const task = await db.select().from(tasks).where(eq(tasks.id, 1));
const creator = await db.select().from(users).where(eq(users.id, task.createdBy));
const group = await db.select().from(groups).where(eq(groups.id, task.groupId));

// ✅ 有关系定义：一次查询获取所有关联数据
const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, 1),
  with: {
    creator: { columns: { name: true } },
    group: { columns: { name: true } },
  },
});
// task.creator.name 和 task.group.name 都有了
```

### 2. 类型安全

TypeScript 会自动推导关联数据的类型，提供完整的类型提示和检查。

### 3. 代码更简洁

减少手动 JOIN、数据映射和多次查询的代码。

### 4. 自动优化

ORM 可以自动优化查询，减少 N+1 问题，批量加载关联数据。

## 如何使用？

### 定义关系

在 `schema.ts` 中使用 `relations()` 函数：

```typescript
import { relations } from "drizzle-orm";

// 一对多关系
export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks), // 一个用户有多个任务
  defaultGroup: one(groups, {
    // 一个用户有一个默认群组
    fields: [users.defaultGroupId],
    references: [groups.id],
  }),
}));

// 多对一关系
export const tasksRelations = relations(tasks, ({ one }) => ({
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdBy", // 用于区分多个关系
  }),
}));
```

### 使用关系查询

```typescript
// 查询任务及其创建者信息
const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, 1),
  with: {
    creator: {
      columns: { name: true, email: true },
    },
    group: {
      columns: { name: true },
    },
  },
});

// 查询用户及其所有任务
const user = await db.query.users.findFirst({
  where: eq(users.id, 1),
  with: {
    createdTasks: true, // 获取所有创建的任务
  },
});
```

## 关系类型

- **`one()`**: 一对一或多对一关系
- **`many()`**: 一对多关系
- **`relationName`**: 当同一表之间有多个关系时，用于区分（如 tasks 和 users 有 3 个关系）

## 注意事项

- 关系定义是**声明式的元数据**，不会影响数据库结构
- 即使定义了关系，仍然可以使用传统的 `db.select().join()` 方式查询
- 关系定义主要用于启用 `db.query` API 和类型推导

## 版本说明

- **Relations v1**（当前使用）: `drizzle-orm@^0.45.1` 支持
- **Relations v2**: 需要 `drizzle-orm@^1.0.0-beta.1+`，语法更简洁

## 参考

- [Drizzle Relations 文档](https://orm.drizzle.team/docs/relations)
- [关系查询 API](https://orm.drizzle.team/docs/rqb)
