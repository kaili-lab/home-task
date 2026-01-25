## 目录
+ 1. 项目概述
+ 2. 产品需求
+ 3. 系统架构
+ 4. 技术栈选型
+ 5. 数据库设计
+ 6. 核心功能设计
+ 9. API 设计
+ 10. 部署方案

---

## 1. 项目概述
### 1.1 背景
现代群组成员之间的任务协作往往依赖于口头沟通或零散的聊天记录，缺乏统一的任务管理工具。本项目旨在构建一个**以群组(群组)为单位**的任务助手系统，支持：

+ 📱 **移动端**：通过文字、AI+语音实现实现完整的 CRUD 任务交互；
+ 🖥️ **Web 管理界面**：PC端完整的任务CRUD功能，同样支持文字和 AI+语音实现，以及 admin 功能、设备管理功能；
+ 📊 **独立显示屏公共看板**：显示绑定的群组所有公开任务，同时可以展示天气（暂不实现）；

### 1.2 核心价值
| 用户痛点 | 解决方案 |
| --- | --- |
| 成员之间口头告知任务容易忘记 | 创建并保存任务 |
| 需要打开APP才能查看任务 | 公共显示屏 24 小时滚动展示 |
| 手动输入任务繁琐 | AI 语音识别，精准自动创建 |
| 群组成员缺少共享看板 | 公开任务自动同步到显示屏 |


### 1.3 目标用户
当前主要是个人演示项目，以家庭成员为主要用户，也可以在多人团队中使用；

---

## 3. 系统架构
### 3.1 整体架构图
```plain
┌─────────────────────────────────────────────────────────────────┐
│                          用户端                                  │
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │   React Web      │   http       │   Hono API       │         │
│  │  (Cloudflare     │◄────────────►│ (Cloudflare      │         │
│  │   Pages)         │              │  Workers)        │         │
│  └──────────────────┘              └─────────┬────────┘         │
│                                              │                   │
│  ┌──────────────────┐                        │                   │
│  │  移动端 Expo      │  HTTP                  │                   │
│  │  							  │◄────────────────────►  │                   │
│  └──────────────────┘                        │                   │
│                                              │                   │
│                                    ┌─────────▼─────────┐         │
│                                    │   Neon DB         │         │
│                                    │  (PostgreSQL)     │         │
│                                    └─────────┬─────────┘         │
└────────────────────────────────────────────┼─────────────────────┘
                                             │
                                             │ HTTP GET
                                  ┌──────────▼───────────┐
                                  │                      │
┌─────────────────────────────────┼──────────────────────┼─────────┐
│                          硬件端  │                      │         │
│                      ┌───────────▼─────────┐           │         │
│                      │      ESP32          │           │         │
│                      │  • WiFi模块         │           │         │
│                      │  • HTTP客户端       │           │         │
│                      │  • Deep Sleep       │           │         │
│                      └───────────┬─────────┘           │         │
│                                  │                      │        │
│                      ┌───────────▼─────────┐           │         │
│                      │  7.5" 墨水屏         │           │         │
│                      │  (800x480分辨率)    │           │         │
│                      │  (GxEPD2驱动)       │           │         │
│                      └─────────────────────┘           │         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       外部服务                                   │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │ OpenAI API  │    │  阿里云短信  │    │ MCP服务      │        │
│  │ • Whisper   │    │ (验证码)    │    │              │        │
│  │ • GPT-4o    │    │             │    │              │        │
│  └─────────────┘    └─────────────┘    └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流设计
#### 3.2.1 任务创建流程（Web端）
```plain
用户在React界面填写表单
    ↓
Hono后端验证JWT
    ↓
写入Neon DB (status: pending)
    ↓
返回成功响应 + 任务ID
    ↓
前端更新UI（乐观更新）
```

#### 3.2.2 移动端
```plain
用户在RN应用点击「新建任务」按钮
    ↓
打开任务表单页面
    ↓
用户填写表单字段：
    ↓
前端Zod验证
    ↓
验证通过 → 用户点击「保存」
    ↓
显示加载状态（按钮变为Loading，禁用表单）
    ↓
请求通过Hono路由
    ↓
后端返回成功响应：
    ↓
RN前端接收响应
    ↓
更新本地状态
    ↓
触发UI更新：
```

#### 3.2.3 移动端 AI 交互流程
```plain
用户切换到「AI助手」Tab
    ↓
打开AI对话界面（AIChatScreen）
    ↓
用户长按麦克风按钮 🎤
    ↓
前端开始录音：
  - 显示录音动画（音波波形）
  - 实时显示录音时长（00:05 / 01:00）
    ↓
用户松开按钮（或达到最大60秒）
    ↓
前端停止录音：
  - 获取音频文件URI（.m4a格式）
    ↓
前端UI更新：
  - 添加用户消息气泡（灰色）
  - 显示音频播放按钮 ▶️
  - 显示"正在识别..." 加载动画
    ↓
上传音频到后端：
    ↓
Hono后端接收音频文件
    ↓
验证JWT → 获取userId
    ↓
调用Whisper API转文字：
    ↓
Whisper返回转写文本："明天下午三点提醒我开家长会"
    ↓
后端将转写文本和原始音频URL一起返回：
    ↓
RN前端接收转写结果
    ↓
更新UI：在用户消息气泡下显示转写文本（小字灰色）
    ↓
立即发送转写文本给Agent：
    ↓
后端Agent处理流程开始
    ↓
加载对话历史（ConversationManager.getContext）
  - 从数据库读取最近10条消息
  - 应用token窗口限制
  - 注入用户长期记忆（家庭成员、偏好）
    ↓
构建消息数组发送给OpenAI：
    ↓
调用OpenAI GPT-4o：
    ↓
GPT-4o分析用户意图：
  - 意图：创建任务
  - 标题：开家长会
  - 时间：明天 15:00（解析相对时间）
  - 分配给谁：你（解析用户意图，如未指定则默认为创建者）
  - 信息完整度：✓ 充足
    ↓
GPT-4o决定调用工具：
    ↓
后端ToolExecutor执行工具：
  1. 解析工具参数（Zod验证）
  2. 检查权限（用户是否有创建任务权限）
  3. 调用TaskService.createTask()
    ↓
写入数据库（与传统方式相同）
    ↓
将工具结果反馈给GPT-4o：
    ↓
再次调用GPT-4o，让它生成用户友好的回复
    ↓
GPT-4o生成最终回复：
"好的，我为你创建了以下任务：

【开家长会】
📅 明天 15:00
👤 分配给：你
🔔 提醒功能（暂不实现）

任务已添加到列表中。"
    ↓
后端保存完整对话到数据库：
    ↓
后端返回响应给RN前端（可选：使用Server-Sent Events流式返回）
    ↓
RN前端接收Agent回复
    ↓
更新UI：
  1. 隐藏"正在思考..."动画
  2. 添加Agent消息气泡（蓝色）
  3. 渲染任务预览卡片：
  4. 卡片可点击 → 跳转到任务详情页
    ↓
（并行）刷新任务列表：
    ↓
用户可以继续对话或切换Tab查看任务列表
```

#### 3.2.4 墨水屏刷新流程
```plain
ESP32从Deep Sleep唤醒（每2分钟）
    ↓
连接WiFi（2-3秒）
    ↓
HTTP GET /api/devices/{deviceId}/tasks（演示用，仅供参考）
注意：天气展示功能暂不实现
    ↓
Hono查询该设备对应群组的公开任务
    ↓
返回JSON（任务列表）
    ↓
ESP32解析JSON
    ↓
判断：内容是否变化？
    │
    ├─ 是 → 刷新墨水屏（5秒）
    │
    └─ 否 → 跳过刷新
    ↓
断开WiFi → 进入Deep Sleep
```

### 3.3 状态机设计
#### 3.3.1 任务状态
```plain
┌──────────┐
│  pending │  新创建的任务
└─────┬────┘
      │
      ├─────► ┌───────────┐
      │       │in_progress│  进行中（可选状态）
      │       └─────┬─────┘
      │             │
      ▼             ▼
┌──────────┐
│completed │  已完成
└──────────┘
      │
      ▼
┌──────────┐
│cancelled │  已取消
└──────────┘
```

---

## 4. 技术栈选型
### 4.1 技术栈总览
| 层级 | 技术选型 | 理由 |
| :---: | --- | --- |
| **前端** | React 19 + Vite | 现代化开发体验，快速HMR |
| **路由** | React Router v7 | 支持嵌套路由、Loader |
| **UI库** | Tailwind CSS + shadcn/ui | 快速构建，组件化 |
| **状态管理** | Tanstack Query v5 |  |
| **后端框架** | Hono.js | 轻量、快速、Edge兼容 |
| **API协议** | HTTP | 成熟可靠 |
| **数据库** | Neon (Serverless PostgreSQL) | 免费、自动扩缩容 |
| **ORM** | Drizzle ORM | TypeScript优先，性能好 |
| **认证** | 邮箱密码 + Google OAuth | 简单、安全 |
| **AI服务** | OpenAI (Whisper + GPT-4o) | 成熟稳定 |
| **部署** | Cloudflare Workers + Pages | 全球CDN、免费额度大 |


## 5. 数据库设计
```plain
// 1. users（用户表）
// 核心逻辑：defaultGroupId 用于语音交互时快速确定上下文
{
  id: UUID PRIMARY KEY,
  phone: VARCHAR(20) UNIQUE,
  email: VARCHAR(50) UNIQUE,
  nickname: VARCHAR(50),
  avatar: TEXT,
  role: VARCHAR(20),       // admin / user
  defaultGroupId: UUID,    // [FK] 外键 -> groups.id，语音创建任务时的默认归属
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}

// 2. groups（群组表）
// 核心逻辑：inviteCode 实现精确查找，无需搜索
{
  id: UUID PRIMARY KEY,
  name: VARCHAR(100),
  inviteCode: VARCHAR(20) UNIQUE, // [新增] 全局唯一邀请码 (如 "8859")
  avatar: TEXT,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}

// 3. group_users（群组成员关联表）
// 核心逻辑：控制成员状态和角色
{
  id: UUID PRIMARY KEY,
  groupId: UUID,           // [FK] 外键 -> groups.id
  userId: UUID,            // [FK] 外键 -> users.id
  role: VARCHAR(20),       // owner (群主) / member (成员)
  status: VARCHAR(20),     // active (已加入) / pending (邀请中)
  joinedAt: TIMESTAMP,
  
  // 索引约束：(groupId, userId) 必须唯一，防止重复加群
  UNIQUE KEY (groupId, userId)
}

// 4. tasks（任务表）
// 核心逻辑：通过 groupId 区分个人/群组任务，支持 AI 字段
{
  id: UUID PRIMARY KEY,
  title: VARCHAR(200),     // 任务内容
  description: TEXT,       // 任务详情
  status: VARCHAR(20),     // pending / completed / cancelled
  
  // 归属逻辑
  groupId: UUID,           // [FK] NULL = 个人私有任务; 有值 = 群组公开任务
  createdBy: UUID,         // [FK] 创建人
  source: VARCHAR(10)			 // ai/human
  assignedTo: UUID,         // [FK] 外键 -> users.id，分配给谁（NULL = 未分配或分配给创建者）
  
  // 完成逻辑
  completedBy: UUID,       // [FK] 记录是谁完成的
  completedAt: TIMESTAMP,
  
  // 辅助字段
  dueDate: TIMESTAMP,      // 截止时间
  isAiCreated: BOOLEAN,    // 是否由 Agent 创建
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

<font style="color:rgba(0, 0, 0, 0.96);">硬件与 AI 交互表</font>

```plain
// 5. devices（设备表）
// 核心逻辑：设备绑定人或群，决定屏幕显示什么维度的任务
{
  id: UUID PRIMARY KEY,
  deviceId: VARCHAR(100) UNIQUE, // 硬件唯一标识
  name: VARCHAR(50),
  
  // 互斥绑定逻辑 (业务层控制二选一)
  userId: UUID,            // [FK] 绑定个人 -> 显示: 个人私有 + 该人所在所有群组
  groupId: UUID,           // [FK] 绑定群组 -> 显示: 仅该群组公开任务
  
  status: VARCHAR(20),     // active / inactive
  createdAt: TIMESTAMP
}

// 6. messages（消息表）
// 核心逻辑：存储 AI 对话历史，支持 Generative UI
{
  id: UUID PRIMARY KEY,
  userId: UUID,            // [FK] 属于哪个用户
  
  role: VARCHAR(20),       // user / assistant / system
  content: TEXT,           // 文本内容 (用于搜索和降级展示)
  
  // UI 渲染核心
  type: VARCHAR(20),       // text (普通对话) / task_summary (任务卡片) / question (追问)
  payload: JSONB,          // 结构化数据，用于 RN 渲染组件 (如任务详情、确认按钮等)
  
  createdAt: TIMESTAMP
}
```

---

### <font style="color:rgba(0, 0, 0, 0.96);">6. 核心功能设计</font>
**<font style="color:rgba(0, 0, 0, 0.96);">6.1 用户登录注册</font>**

+ <font style="color:rgba(0, 0, 0, 0.96);">6.1.1 用户名密码登录注册</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.1.2 OAuth 登录注册</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.1.3 profile 管理用户信息</font>

**<font style="color:rgba(0, 0, 0, 0.96);">6.2 群组管理</font>**

+ <font style="color:rgba(0, 0, 0, 0.96);">6.2.1 创建群组 (系统自动生成唯一邀请码)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.2.2 查询“我的群组”列表</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.2.3</font><font style="color:rgba(0, 0, 0, 0.96);"> </font>**<font style="color:rgba(0, 0, 0, 0.96);">通过邀请码加入群组</font>**<font style="color:rgba(0, 0, 0, 0.96);"> </font><font style="color:rgba(0, 0, 0, 0.96);">(替代原有的邀请/添加机制)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.2.4 编辑群组信息（名称）</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.2.5 退出/解散群组</font>

**<font style="color:rgba(0, 0, 0, 0.96);">6.3 任务管理</font>**

+ <font style="color:rgba(0, 0, 0, 0.96);">6.3.1 创建任务 (支持 AI 语音输入或手动输入)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.3.2 </font>**<font style="color:rgba(0, 0, 0, 0.96);">查询混合任务流</font>**<font style="color:rgba(0, 0, 0, 0.96);"> (查询逻辑：个人任务 + 所有群任务)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.3.3 编辑任务内容</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.3.4 变更任务状态 (完成/取消/重启)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.3.5 删除任务</font>

**<font style="color:rgba(0, 0, 0, 0.96);">6.4 AI 智能助手 (新增)</font>**

+ <font style="color:rgba(0, 0, 0, 0.96);">6.4.1</font><font style="color:rgba(0, 0, 0, 0.96);"> </font>**<font style="color:rgba(0, 0, 0, 0.96);">发送指令</font>**<font style="color:rgba(0, 0, 0, 0.96);"> </font><font style="color:rgba(0, 0, 0, 0.96);">(处理语音/文本 -> 意图识别 -> 工具调用)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.4.2 获取对话历史 (用于 UI 回显)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.4.3 任务卡片交互 (确认/修改 AI 创建的任务)</font>

**<font style="color:rgba(0, 0, 0, 0.96);">6.5 设备互联 (新增)</font>**

+ <font style="color:rgba(0, 0, 0, 0.96);">6.5.1</font><font style="color:rgba(0, 0, 0, 0.96);"> </font>**<font style="color:rgba(0, 0, 0, 0.96);">设备绑定</font>**<font style="color:rgba(0, 0, 0, 0.96);"> </font><font style="color:rgba(0, 0, 0, 0.96);">(绑定到用户 或 绑定到群组)</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.5.2 设备解绑</font>
+ <font style="color:rgba(0, 0, 0, 0.96);">6.5.3 设备初始化同步 (冷启动拉取数据)</font>

## 9. API 设计

### 9.1 API 设计优先级

API开发将按以下优先级分阶段实现：

**第一阶段：核心 CRUD（优先级最高）**
- 用户认证相关 API
- 用户信息管理 API
- 群组管理 API（创建、查询、加入、编辑、退出）
- 任务管理 API（创建、查询、编辑、状态变更、删除）

**第二阶段：AI 功能**
- 语音转文字 API（Whisper）
- AI 对话 API（GPT-4o）
- 对话历史 API

**第三阶段：设备互联**
- 设备绑定/解绑 API
- 设备任务同步 API（硬件端调用）

### 9.2 认证相关 API

本项目使用 **Better Auth** 框架，自动提供以下认证端点：

**Better Auth 自动提供的端点：**
- `POST /api/auth/signup` - 邮箱密码注册
- `POST /api/auth/signin/email` - 邮箱密码登录
- `POST /api/auth/signout` - 登出
- `POST /api/auth/forget-password` - 忘记密码（发送重置邮件）
- `POST /api/auth/reset-password` - 重置密码
- `GET /api/auth/session` - 获取当前会话信息

**OAuth 登录（Google）：**
- `GET /api/auth/signin/google` - 发起 Google OAuth 登录
- `GET /api/auth/callback/google` - Google OAuth 回调

**认证机制说明：**
- Better Auth 使用基于 Session 的认证（存储在数据库中）
- 前端通过 Cookie 自动携带认证信息
- 所有需要认证的 API 通过 `authMiddleware` 中间件验证会话

### 9.3 用户相关 API

#### GET /api/users/me
获取当前登录用户信息

**请求头：**
- Cookie: session cookie（自动携带）

**响应：**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nickname": "用户名",
  "avatar": "https://...",
  "role": "user",
  "defaultGroupId": "uuid" | null
}
```

#### PATCH /api/users/me
更新当前用户信息

**请求体：**
```json
{
  "nickname": "新昵称",
  "avatar": "https://...",
  "defaultGroupId": "uuid" | null
}
```

#### GET /api/users/me/groups
获取当前用户所在的所有群组列表

**响应：**
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "群组名称",
      "inviteCode": "8859",
      "avatar": "https://...",
      "role": "owner" | "member",
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 9.4 群组相关 API

#### POST /api/groups
创建群组

**请求体：**
```json
{
  "name": "群组名称",
  "avatar": "https://..." // 可选
}
```

**响应：**
```json
{
  "id": "uuid",
  "name": "群组名称",
  "inviteCode": "8859", // 系统自动生成
  "avatar": "https://...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/groups
获取当前用户的群组列表（与 `/api/users/me/groups` 相同）

#### GET /api/groups/:id
获取群组详情

**路径参数：**
- `id`: 群组 UUID

**响应：**
```json
{
  "id": "uuid",
  "name": "群组名称",
  "inviteCode": "8859",
  "avatar": "https://...",
  "members": [
    {
      "userId": "uuid",
      "nickname": "成员昵称",
      "role": "owner" | "member",
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### PATCH /api/groups/:id
更新群组信息（仅群主）

**请求体：**
```json
{
  "name": "新群组名称",
  "avatar": "https://..." // 可选
}
```

#### POST /api/groups/join
通过邀请码加入群组

**请求体：**
```json
{
  "inviteCode": "8859"
}
```

**响应：**
```json
{
  "groupId": "uuid",
  "groupName": "群组名称",
  "role": "member"
}
```

#### DELETE /api/groups/:id/members/:userId
退出群组或移除成员

**路径参数：**
- `id`: 群组 UUID
- `userId`: 用户 UUID（移除成员时）或当前用户ID（退出群组时）

**权限：**
- 成员可以退出自己
- 群主可以移除任何成员

#### DELETE /api/groups/:id
解散群组（仅群主）

**路径参数：**
- `id`: 群组 UUID

### 9.5 任务相关 API

#### POST /api/tasks
创建任务

**请求体：**
```json
{
  "title": "任务标题",
  "description": "任务详情", // 可选
  "groupId": "uuid" | null, // null = 个人任务，有值 = 群组任务
  "assignedTo": "uuid" | null, // 分配给谁（可选，默认分配给创建者）
  "dueDate": "2024-01-01T15:00:00Z" // 可选，截止时间
}
```

**响应：**
```json
{
  "id": "uuid",
  "title": "任务标题",
  "description": "任务详情",
  "status": "pending",
  "groupId": "uuid" | null,
  "createdBy": "uuid",
  "assignedTo": "uuid" | null,
  "dueDate": "2024-01-01T15:00:00Z" | null,
  "source": "human",
  "isAiCreated": false,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/tasks
获取混合任务流（个人任务 + 所有群组任务）

**查询参数：**
- `status`: `pending` | `completed` | `cancelled`（可选，筛选状态）
- `groupId`: `uuid`（可选，筛选特定群组）
- `assignedTo`: `uuid` | `me`（可选，筛选分配给谁的任务）
- `page`: `number`（可选，分页，默认1）
- `limit`: `number`（可选，每页数量，默认20）

**响应：**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "任务标题",
      "description": "任务详情",
      "status": "pending",
      "groupId": "uuid" | null,
      "groupName": "群组名称" | null, // 如果是群组任务
      "createdBy": "uuid",
      "createdByName": "创建者昵称",
      "assignedTo": "uuid" | null,
      "assignedToName": "被分配者昵称" | null,
      "dueDate": "2024-01-01T15:00:00Z" | null,
      "source": "ai" | "human",
      "isAiCreated": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### GET /api/tasks/:id
获取任务详情

**路径参数：**
- `id`: 任务 UUID

**响应：**
```json
{
  "id": "uuid",
  "title": "任务标题",
  "description": "任务详情",
  "status": "pending",
  "groupId": "uuid" | null,
  "groupName": "群组名称" | null,
  "createdBy": "uuid",
  "createdByName": "创建者昵称",
  "assignedTo": "uuid" | null,
  "assignedToName": "被分配者昵称" | null,
  "completedBy": "uuid" | null,
  "completedByName": "完成者昵称" | null,
  "completedAt": "2024-01-01T00:00:00Z" | null,
  "dueDate": "2024-01-01T15:00:00Z" | null,
  "source": "ai" | "human",
  "isAiCreated": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PATCH /api/tasks/:id
更新任务内容

**请求体：**
```json
{
  "title": "新标题", // 可选
  "description": "新详情", // 可选
  "assignedTo": "uuid" | null, // 可选，重新分配
  "dueDate": "2024-01-01T15:00:00Z" | null // 可选
}
```

#### PATCH /api/tasks/:id/status
更新任务状态

**请求体：**
```json
{
  "status": "completed" | "cancelled" | "pending"
}
```

**说明：**
- 设置为 `completed` 时，自动记录 `completedBy` 和 `completedAt`
- 设置为 `pending` 时，清除 `completedBy` 和 `completedAt`

#### DELETE /api/tasks/:id
删除任务

**路径参数：**
- `id`: 任务 UUID

**权限：**
- 仅创建者可以删除任务

### 9.6 AI 助手相关 API

#### POST /api/ai/transcribe
语音转文字（Whisper）

**请求：**
- Content-Type: `multipart/form-data`
- Body: `file` (音频文件，支持 .m4a, .mp3, .wav 等格式)

**响应：**
```json
{
  "text": "明天下午三点提醒我开家长会",
  "audioUrl": "https://..." // 可选，音频存储URL
}
```

#### POST /api/ai/chat
发送消息给 AI 助手

**请求体：**
```json
{
  "message": "明天下午三点提醒我开家长会",
  "audioUrl": "https://..." // 可选，原始音频URL
}
```

**响应（流式返回，使用 Server-Sent Events）：**
```
data: {"type": "thinking", "content": "正在思考..."}

data: {"type": "tool_call", "tool": "create_task", "params": {...}}

data: {"type": "message", "content": "好的，我为你创建了以下任务：\n\n【开家长会】\n📅 明天 15:00\n👤 分配给：你\n🔔 提醒功能（暂不实现）\n\n任务已添加到列表中。", "payload": {"taskId": "uuid", "task": {...}}}

data: {"type": "done"}
```

**说明：**
- 如果使用流式返回，前端需要处理 SSE 事件
- 如果不支持流式，可以添加 `?stream=false` 查询参数，返回完整响应

#### GET /api/ai/messages
获取对话历史

**查询参数：**
- `limit`: `number`（可选，默认20，最多100）

**响应：**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user" | "assistant" | "system",
      "content": "消息内容",
      "type": "text" | "task_summary" | "question",
      "payload": {
        "taskId": "uuid", // type为task_summary时存在
        "task": {...} // type为task_summary时存在
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/ai/tasks/:id/confirm
确认 AI 创建的任务

**路径参数：**
- `id`: 任务 UUID

**请求体：**
```json
{
  "confirmed": true // 确认任务创建
}
```

**说明：**
- 用于用户确认 AI 创建的任务，可以触发后续操作（如发送通知等，暂不实现）

### 9.7 设备相关 API

#### POST /api/devices
绑定设备

**请求体：**
```json
{
  "deviceId": "ESP32_001", // 硬件唯一标识
  "name": "客厅显示屏", // 设备名称
  "userId": "uuid" | null, // 绑定到用户（与groupId二选一）
  "groupId": "uuid" | null // 绑定到群组（与userId二选一）
}
```

**响应：**
```json
{
  "id": "uuid",
  "deviceId": "ESP32_001",
  "name": "客厅显示屏",
  "userId": "uuid" | null,
  "groupId": "uuid" | null,
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/devices
获取当前用户的设备列表

**响应：**
```json
{
  "devices": [
    {
      "id": "uuid",
      "deviceId": "ESP32_001",
      "name": "客厅显示屏",
      "userId": "uuid" | null,
      "groupId": "uuid" | null,
      "groupName": "群组名称" | null,
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET /api/devices/:deviceId/tasks
获取设备显示的任务列表（硬件端调用）

**路径参数：**
- `deviceId`: 设备唯一标识（如 "ESP32_001"）

**认证：**
- 使用设备密钥认证（待实现）或公开端点（仅限演示）

**响应：**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "任务标题",
      "status": "pending",
      "dueDate": "2024-01-01T15:00:00Z" | null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

**说明：**
- 根据设备绑定关系返回相应任务：
  - 绑定到用户：返回该用户的个人任务 + 该用户所在所有群组的公开任务
  - 绑定到群组：仅返回该群组的公开任务

#### DELETE /api/devices/:id
解绑设备

**路径参数：**
- `id`: 设备 UUID

### 9.8 认证中间件

本项目使用 **Better Auth** 框架的认证机制：

**认证流程：**
1. 用户通过 `/api/auth/signin/email` 或 OAuth 登录
2. Better Auth 创建会话并存储在数据库中
3. 会话信息通过 Cookie 自动发送给客户端
4. 后续请求通过 `authMiddleware` 中间件验证 Cookie 中的会话
5. 验证通过后，将用户信息注入到 Hono 的 `context` 中

**中间件使用：**
```typescript
// 需要认证的路由
app.use("/api/*", authMiddleware);
app.use("/api/tasks/*", requireAuthMiddleware);

// 在路由处理函数中获取用户信息
app.get("/api/tasks", async (c) => {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  const userId = session?.user?.id;
  // ...
});
```

### 9.9 输入验证

**使用 Zod 进行运行时验证：**

所有 API 的输入参数必须定义 Zod schema，例如：

```typescript
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  groupId: z.string().uuid().nullable(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().optional(),
});

// 在路由中使用
app.post("/api/tasks", async (c) => {
  const body = await c.req.json();
  const validated = createTaskSchema.parse(body); // 自动类型推断
  // ...
});
```

**验证失败响应：**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "输入验证失败",
  "details": [
    {
      "field": "title",
      "message": "标题不能为空"
    }
  ]
}
```

### 9.10 错误处理

**统一错误格式：**

所有 API 错误响应遵循以下格式：

```json
{
  "error": "ERROR_CODE",
  "message": "错误描述",
  "details": {} // 可选，详细错误信息
}
```

**错误码：**
- `UNAUTHORIZED`：未登录或会话无效
- `FORBIDDEN`：无权限操作（如非群主尝试解散群组）
- `NOT_FOUND`：资源不存在（如任务ID不存在）
- `CONFLICT`：资源冲突（如重复加入群组）
- `VALIDATION_ERROR`：输入验证失败
- `TOO_MANY_REQUESTS`：速率限制
- `INTERNAL_ERROR`：服务器内部错误



---

### 10.3 部署流程（待定）
#### 10.3.1 前端部署（Cloudflare Pages）
1. 连接GitHub仓库
2. Cloudflare自动检测到代码变更
3. 执行构建命令：`npm run build`
4. 部署到全球CDN
5. 自动分配域名：`https://family-task-assistant.pages.dev`

#### 10.3.2 后端部署（Cloudflare Workers）
1. 安装Wrangler CLI：`npm install -g wrangler`
2. 登录：`wrangler login`
3. 部署：`wrangler deploy`
4. 自动部署到：`https://family-task-assistant-api.workers.dev`

#### 10.3.3 数据库迁移
1. 生成迁移文件：`npx drizzle-kit generate:pg`
2. 执行迁移：`npx drizzle-kit push:pg`
3. 查看数据库：`npx drizzle-kit studio`

### 10.4 CI/CD Pipeline
**使用GitHub Actions**：

1. 提交代码到main分支
2. 自动触发工作流
3. 运行测试
4. 构建项目
5. 部署到Cloudflare
6. 发送通知









