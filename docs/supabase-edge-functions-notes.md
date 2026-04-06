# Supabase & Edge Functions 笔记

## Supabase 是什么

Firebase 的开源替代品，定位是 BaaS（Backend as a Service）。
底层存储是 PostgreSQL，在上面封装了一整套服务：

| 服务 | 说明 |
|---|---|
| Database | PostgreSQL，支持直接 CRUD |
| Auth | 用户认证（邮箱、OAuth 等） |
| Storage | 文件存储 |
| Realtime | 基于 PostgreSQL CDC 的实时推送 |
| Edge Functions | 自定义无服务器函数 |

## 三层使用模型

复杂度从低到高：

```
前端 + Supabase client
        ↓ 业务逻辑变复杂
+ Supabase Edge Functions
        ↓ 业务逻辑非常复杂 / 需要完全自定义
独立后端（如 Hono + Cloudflare Workers）
```

### 第一层：前端 + Supabase client（纯 CRUD）

```ts
const { data } = await supabase.from('tasks').select('*')
```

- 链路：前端 → PostgREST → PostgreSQL
- PostgREST 是 Supabase 内置服务，自动把 PG 包装成 REST API
- 权限由 **RLS（Row Level Security）** 在数据库层控制
- **不需要部署任何东西**，Supabase 托管，引入 SDK 即用

### 第二层：+ Supabase Edge Functions（自定义逻辑）

- 链路：前端 → Edge Functions（你写的代码）→ 数据库 / 第三方服务
- 运行时是 **Deno**（不是 Node.js），部署在边缘节点
- 需要通过 `supabase functions deploy` 部署

**适合用 Edge Functions 的场景：**
- 需要隐藏密钥（调 OpenAI、Stripe、SendGrid 等）
- 复杂业务逻辑不适合放在 RLS 里
- 接收外部 Webhook
- 需要原生 WebSocket 自定义双向通信

**不需要用 Edge Functions 的场景：**
- 普通 CRUD，用 client + RLS 直接搞定更简单

## 两个 Key 的区别

Supabase 项目有两个 key，搞清楚这个是生产使用的基本常识：

| | anon key（公钥） | service role key（私钥） |
|---|---|---|
| 能否暴露在前端 | **可以** | **绝对不行** |
| 权限 | 受 RLS 约束 | 绕过所有 RLS，完整数据库权限 |
| 典型用途 | Supabase client 初始化 | Edge Functions、服务端脚本 |

**重要**：anon key 放前端是安全的，**前提是 RLS 必须正确配置**。
如果忘记开 RLS，anon key 实际上可以读写所有数据，非常危险。

```ts
// 前端：用 anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Edge Function 里：用 service role key 绕过 RLS 做管理员操作
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
```

## Supabase client 的 Realtime 和 Edge Functions WebSocket 的区别

两者都涉及 WebSocket，但定位不同：

| | Supabase Realtime（client） | Edge Functions WebSocket |
|---|---|---|
| 用途 | 监听数据库变更推送 | 自定义双向通信逻辑 |
| 你写什么 | 订阅配置 | 完整 WebSocket 处理代码 |
| 典型场景 | 数据实时同步到前端 | 自定义聊天、游戏等 |

## 和 Hono + Cloudflare Workers 的对比

本质定位相同，都是边缘无服务器函数：

| | Hono + Cloudflare Workers | Supabase Edge Functions |
|---|---|---|
| 运行时 | V8（Cloudflare） | Deno |
| 数据库 | 自选（D1、PG 等） | 绑定 Supabase PostgreSQL |
| 适合场景 | 完全自定义后端 | 轻量自定义逻辑 + 重度依赖 Supabase |

## 生产环境注意点

这些是真正用过才会踩到的坑，面试时提到会加分：

### 安全类
- **RLS 是必须的**，不是可选的。每张表都要明确开启并编写策略，默认不开 RLS 等于裸奔
- **service role key 不能出现在前端代码或 git 仓库里**，应通过环境变量注入
- anon key 虽然可以放前端，但也不要硬编码，用环境变量管理（`VITE_SUPABASE_ANON_KEY`）

### RLS 策略类
- RLS 策略写错是常见问题，比如忘记区分 `SELECT` 和 `INSERT` 策略，导致能查不能写或反过来
- 用 Supabase Dashboard 的 RLS 测试工具验证策略，不要只靠代码测
- 涉及用户隔离的表（如用户数据），策略通常是 `auth.uid() = user_id`，要确保每条记录都有 `user_id` 字段

### Edge Functions 类
- Edge Functions 是无状态的，不能在函数内存里存共享状态，需要状态就用数据库或 Redis
- 冷启动延迟存在，对延迟敏感的接口要注意（首次调用比后续慢）
- 本地开发用 `supabase functions serve` 热重载，但行为和生产环境的 Deno 版本可能有细微差异，上线前要测
- Edge Functions 的环境变量通过 `supabase secrets set` 管理，和普通环境变量分开

### 性能类
- Realtime 订阅会建立持久 WebSocket 连接，组件卸载时必须手动取消订阅，否则连接泄漏
- 大量并发 Realtime 订阅会消耗连接数配额，免费套餐有上限
- 复杂查询通过 PostgREST 做有局限，必要时用 PostgreSQL 的 `rpc`（存储过程）来执行复杂 SQL

### 其他
- Supabase 免费套餐项目**闲置 7 天会暂停**，生产项目要升级付费套餐
- 数据库迁移用 Supabase CLI 管理（`supabase migration`），不要直接在 Dashboard 改表结构，否则无法追踪变更历史

## 选型思路

- 业务简单，主要是 CRUD → **Supabase client + RLS**，几乎不需要写后端
- 有少量自定义逻辑或第三方调用 → **+ Edge Functions**
- 业务复杂，需要完全控制 → **独立后端**（Hono 等）

## 一句话总结

> Supabase 的设计意图是：让大部分场景不需要写后端。Edge Functions 是处理"例外情况"的安全阀，不是用来替代完整后端框架的。anon key 安全与否完全取决于 RLS 是否配置正确。
