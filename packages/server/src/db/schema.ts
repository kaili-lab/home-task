import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  time,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { RecurringRule } from "shared";
import { relations } from "drizzle-orm";

// ==================== 枚举定义 ====================
// 注意：所有枚举必须在表定义之前声明

// 任务状态枚举
export const taskStatusEnum = pgEnum("task_status", ["pending", "completed", "cancelled"]);

// 任务来源枚举
export const taskSourceEnum = pgEnum("task_source", ["ai", "human"]);

// 任务优先级枚举
export const priorityEnum = pgEnum("priority", ["high", "medium", "low"]);

// 消息类型枚举
export const messageTypeEnum = pgEnum("message_type", ["text", "task_summary", "question"]);

// 消息角色枚举
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

// ==================== Better Auth 表 ====================
// Better Auth 需要的表结构，使用数字自增ID

export const users = pgTable("user", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  name: varchar("name", { length: 255 }), // 用户昵称（显示名称）
  image: varchar("image", { length: 500 }), // Better Auth映射为avatarUrl
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),

  // 业务字段
  phone: varchar("phone", { length: 20 }),
  username: varchar("username", { length: 50 }),
  displayUsername: varchar("displayUsername", { length: 50 }), // Better Auth username插件需要
  avatar: text("avatar"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // admin / user
  defaultGroupId: integer("defaultGroupId"), // [FK] 外键 -> groups.id，语音创建任务时的默认归属
});

export const sessions = pgTable("session", {
  id: serial("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ipAddress: varchar("ipAddress", { length: 45 }), // Better Auth 1.4+ 必需字段：用于速率限制和会话安全（IPv4最多15字符，IPv6最多45字符）
  userAgent: text("userAgent"), // Better Auth 1.4+ 必需字段：存储请求的 User-Agent 头信息
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const accounts = pgTable("account", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 255 }).notNull(),
  providerId: varchar("providerId", { length: 255 }).notNull(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: timestamp("expiresAt"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// ==================== 业务表 ====================

// 群组表
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  inviteCode: varchar("inviteCode", { length: 20 }).notNull().unique(), // 全局唯一邀请码 (如 "8859")
  avatar: text("avatar"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// 群组成员关联表
export const groupUsers = pgTable(
  "group_users",
  {
    id: serial("id").primaryKey(),
    groupId: integer("groupId")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"), // owner (群主) / member (成员)
    status: varchar("status", { length: 20 }).notNull().default("active"), // active (已加入) / pending (邀请中)
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  },
  (table) => ({
    // 唯一约束：(groupId, userId) 必须唯一，防止重复加群
    uniqueGroupUser: unique("unique_group_user").on(table.groupId, table.userId),
  }),
);

// 任务表
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),

  // 基本信息
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"), // pending/completed/cancelled
  priority: priorityEnum("priority").notNull().default("medium"),

  // 时间字段（startTime/endTime 为 NULL = 全天任务）
  dueDate: date("dueDate"), // 模板任务可以为 NULL
  startTime: time("startTime"), // NULL = 全天任务
  endTime: time("endTime"), // 时间跨度不超过1年

  // 归属逻辑
  groupId: integer("groupId").references(() => groups.id, { onDelete: "cascade" }),
  createdBy: integer("createdBy")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source: taskSourceEnum("source").notNull().default("human"),

  // 完成逻辑
  completedBy: integer("completedBy").references(() => users.id, { onDelete: "set null" }),
  completedAt: timestamp("completedAt"),

  // 重复任务逻辑
  isRecurring: boolean("isRecurring").notNull().default(false),
  recurringRule: jsonb("recurringRule").$type<RecurringRule>(),
  recurringParentId: integer("recurringParentId").references((): any => tasks.id, {
    onDelete: "cascade", // 模板删除时，级联删除所有实例
  }),

  // 时间戳
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// 任务分配表（支持多用户分配）
export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: serial("id").primaryKey(),
    taskId: integer("taskId")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    // 唯一约束：同一任务不能重复分配给同一用户
    uniqueTaskUser: unique("unique_task_user").on(table.taskId, table.userId),
  }),
);

// 设备表
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceId: varchar("deviceId", { length: 100 }).notNull().unique(), // 硬件唯一标识
  name: varchar("name", { length: 50 }).notNull(),

  // 互斥绑定逻辑 (业务层控制二选一)
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }), // [FK] 绑定个人 -> 显示: 个人私有 + 该人所在所有群组
  groupId: integer("groupId").references(() => groups.id, { onDelete: "cascade" }), // [FK] 绑定群组 -> 显示: 仅该群组公开任务

  status: varchar("status", { length: 20 }).notNull().default("active"), // active / inactive
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// 消息表
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // [FK] 属于哪个用户

  role: messageRoleEnum("role").notNull(), // user / assistant / system
  content: text("content").notNull(), // 文本内容 (用于搜索和降级展示)

  // UI 渲染核心
  type: messageTypeEnum("type").notNull().default("text"), // text (普通对话) / task_summary (任务卡片) / question (追问)
  payload: jsonb("payload"), // 结构化数据，用于 RN 渲染组件 (如任务详情、确认按钮等)

  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// ==================== 关系定义 ====================

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  groups: many(groupUsers),
  createdTasks: many(tasks, { relationName: "createdBy" }),
  completedTasks: many(tasks, { relationName: "completedBy" }),
  taskAssignments: many(taskAssignments),
  devices: many(devices),
  messages: many(messages),
  defaultGroup: one(groups, {
    fields: [users.defaultGroupId],
    references: [groups.id],
  }),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupUsers),
  tasks: many(tasks),
  devices: many(devices),
  defaultUsers: many(users),
}));

export const groupUsersRelations = relations(groupUsers, ({ one }) => ({
  group: one(groups, {
    fields: [groupUsers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupUsers.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  group: one(groups, {
    fields: [tasks.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
  completer: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
    relationName: "completedBy",
  }),
  recurringParent: one(tasks, {
    fields: [tasks.recurringParentId],
    references: [tasks.id],
    relationName: "recurringParent",
  }),
  recurringChildren: many(tasks, {
    relationName: "recurringParent",
  }),
  assignments: many(taskAssignments),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [devices.groupId],
    references: [groups.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignments.userId],
    references: [users.id],
  }),
}));
