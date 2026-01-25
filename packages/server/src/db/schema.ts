import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==================== Better Auth 表 ====================
// Better Auth 需要的表结构，使用数字自增ID

export const users = pgTable("user", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  name: varchar("name", { length: 255 }),
  image: varchar("image", { length: 500 }), // Better Auth映射为avatarUrl
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  
  // 业务字段
  phone: varchar("phone", { length: 20 }),
  nickname: varchar("nickname", { length: 50 }),
  avatar: text("avatar"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // admin / user
  defaultGroupId: integer("defaultGroupId"), // [FK] 外键 -> groups.id，语音创建任务时的默认归属
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  phoneNumberVerified: boolean("phoneNumberVerified").default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  locale: varchar("locale", { length: 10 }).notNull().default("zh-CN"),
  vocabularyLevel: varchar("vocabularyLevel", { length: 50 }),
  lastLoginAt: timestamp("lastLoginAt"),
});

export const sessions = pgTable("session", {
  id: serial("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
export const groupUsers = pgTable("group_users", {
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
}, (table) => ({
  // 唯一约束：(groupId, userId) 必须唯一，防止重复加群
  uniqueGroupUser: {
    columns: [table.groupId, table.userId],
  },
}));

// 任务状态枚举
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "cancelled"]);

// 任务来源枚举
export const taskSourceEnum = pgEnum("task_source", ["ai", "human"]);

// 任务表
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(), // 任务内容
  description: text("description"), // 任务详情
  status: taskStatusEnum("status").notNull().default("pending"), // pending / completed / cancelled
  
  // 归属逻辑
  groupId: integer("groupId").references(() => groups.id, { onDelete: "cascade" }), // NULL = 个人私有任务; 有值 = 群组公开任务
  createdBy: integer("createdBy")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // [FK] 创建人
  source: taskSourceEnum("source").notNull().default("human"), // ai/human
  assignedTo: integer("assignedTo").references(() => users.id, { onDelete: "set null" }), // [FK] 分配给谁（NULL = 未分配或分配给创建者）
  
  // 完成逻辑
  completedBy: integer("completedBy").references(() => users.id, { onDelete: "set null" }), // [FK] 记录是谁完成的
  completedAt: timestamp("completedAt"),
  
  // 辅助字段
  dueDate: timestamp("dueDate"), // 截止时间
  isAiCreated: boolean("isAiCreated").notNull().default(false), // 是否由 Agent 创建
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

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

// 消息类型枚举
export const messageTypeEnum = pgEnum("message_type", ["text", "task_summary", "question"]);

// 消息角色枚举
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

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
  assignedTasks: many(tasks, { relationName: "assignedTo" }),
  completedTasks: many(tasks, { relationName: "completedBy" }),
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

export const tasksRelations = relations(tasks, ({ one }) => ({
  group: one(groups, {
    fields: [tasks.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTo",
  }),
  completer: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
    relationName: "completedBy",
  }),
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
