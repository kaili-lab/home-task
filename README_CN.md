# HomeTask

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat&logo=langchain&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)

> 以群组为核心的任务管理器——用自然语言描述需要做的事，多 Agent AI 系统自动处理，实体墨水屏 24 小时展示待办任务，无需打开手机。

[English](./README.md)

---

<!-- TODO: 替换为 GIF，内容：输入一句话 → AI 创建任务 → 任务出现在列表（5-10 秒） -->
<!-- ![演示 GIF](./docs/screenshots/demo.gif) -->

---

## ✨ 亮点

**LangGraph 多 Agent 编排** — Supervisor 将请求分发给四个专责 Agent：任务、日历、天气、通知。一句话"周六早上去机场接人"，可以同时触发创建任务、查询天气、安排提醒三个 Agent 协同完成。

**群组优先的任务协作** — 任务以群组为单位组织，不只是个人 todo。公开任务实时同步给所有成员，用 4 位邀请码加入群组，无需账号关联。

**实体墨水屏展示** *(计划中)* — ESP32 每 2 分钟轮询 API，将群组待办任务渲染到 7.5 寸墨水屏上。不需要 App，不需要通知，任务始终可见。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite、React Router v7、TanStack Query v5 |
| UI | Tailwind CSS v4、shadcn/ui |
| 后端 | Hono.js（Node.js）|
| 数据库 | Neon（Serverless PostgreSQL）、Drizzle ORM |
| 认证 | Better Auth —— 邮箱密码 + Google OAuth |
| AI | OpenAI GPT-4o / DeepSeek（经由 AIHubMix）、Whisper STT |
| AI 编排 | LangGraph —— Supervisor + 多 Agent |
| 硬件 | ESP32、GxEPD2 墨水屏驱动 |

---

## 功能

### 群组管理
- 创建群组，自动生成唯一邀请码
- 凭 4 位邀请码加入，无需账号关联
- 角色权限：`群主` / `成员`

### 任务管理
- 个人（私有）与群组（共享）任务合并展示
- 优先级、截止时间、模糊时间段（上午 / 下午 / 晚上 / 全天）
- 重复任务：按天、周、月、年自定义规则
- 群组内任务分配

### AI 助手
- 自然语言输入，直接用中文描述
- 基于 LangGraph 的多 Agent 系统：

  | Agent | 职责 |
  |-------|------|
  | **Supervisor** | 理解意图，分发给对应 Agent |
  | **Task Agent** | 创建、查询、修改、完成、删除 |
  | **Calendar Agent** | 查看日程、查找空闲时间段 |
  | **Weather Agent** | 户外/出行任务的天气上下文 |
  | **Notification Agent** | 根据任务时间和天气安排提醒 |

### 墨水屏展示 *(计划中)*
- ESP32 每 2 分钟轮询 `/api/devices/{id}/tasks`
- 渲染到 7.5 寸墨水屏（800×480，GxEPD2 驱动）
- 两次刷新之间 Deep Sleep 省电

---

## 架构

```
┌──────────────────────────────────────────────────┐
│                    客户端                         │
│  React Web（Vite）        移动端（计划中）          │
└──────────────────┬───────────────────────────────┘
                   │ HTTP
┌──────────────────▼───────────────────────────────┐
│             Hono.js API（Node.js）                │
│                                                   │
│  ┌───────────────────────────────────────────┐    │
│  │            多 Agent 系统                  │    │
│  │  Supervisor ──► Task Agent（任务）         │    │
│  │             ──► Calendar Agent（日历）     │    │
│  │             ──► Weather Agent（天气）      │    │
│  │             ──► Notification Agent（提醒） │    │
│  └───────────────────────────────────────────┘    │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Neon PostgreSQL   │
         └────────────────────┘

┌──────────────────────────────────────────────────┐
│                硬件层（计划中）                    │
│  ESP32 ──► HTTP GET /api/devices/{id}/tasks       │
│        ──► 7.5 寸墨水屏（GxEPD2）                │
└──────────────────────────────────────────────────┘
```

---

## 本地运行

### 前置条件
- Node.js 18+、pnpm
- [Neon](https://neon.tech) PostgreSQL 数据库（免费套餐够用）
- OpenAI API Key **或** [AIHubMix](https://aihubmix.com) Key（支持 DeepSeek，国内推荐）

### 环境变量

**`packages/server/.dev.vars`**
```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=随机字符串
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=re_...

# 二选一：
OPENAI_API_KEY=sk-...
# 或
AIHUBMIX_API_KEY=...
AIHUBMIX_BASE_URL=https://aihubmix.com/v1
AIHUBMIX_MODEL_NAME=deepseek-v3.2   # 可选，默认值

# 可选
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**`packages/web/.env`**
```env
VITE_API_BASE_URL=http://localhost:3000
```

### 启动

```bash
pnpm install
pnpm -C packages/server db-push
pnpm -C packages/server dev    # 后端 → localhost:3000
pnpm -C packages/web dev       # 前端（新终端）
```

### 测试

```bash
pnpm -C packages/server test
```

---

## Roadmap

- [ ] 语音输入 —— Whisper STT（服务端管道已完成，前端 UI 待接入）
- [ ] 移动端 —— Expo / React Native
- [ ] ESP32 墨水屏集成
- [ ] 推送 / 短信通知
- [ ] 生产环境部署

---

## License

MIT
