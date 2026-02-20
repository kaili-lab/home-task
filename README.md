# HomeTask

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat&logo=langchain&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)

> Group task manager where you describe what needs doing in plain language — a multi-agent AI system handles the rest, and a shared e-ink display shows pending tasks 24/7 without opening an app.

[中文文档](./README_CN.md)

---

<!-- TODO: Replace with a GIF showing: type a sentence → AI creates task → task appears in list (5–10s) -->
<!-- ![Demo GIF](./docs/screenshots/demo.gif) -->

---

## ✨ Highlights

**Multi-agent AI orchestration (LangGraph)** — A Supervisor routes requests across four specialized agents: Task, Calendar, Weather, and Notification. One input like *"Pick up kids Saturday morning"* simultaneously creates a task, checks the weather forecast, and schedules a reminder.

**Group-first task coordination** — Tasks are scoped to groups, not just individuals. Public tasks sync to all members in real time. Groups are joined by a 4-digit invite code — no account linking required.

**Physical e-ink display** *(planned)* — An ESP32 polls the API every 2 minutes and renders the group's pending tasks on a 7.5" e-ink screen. No app, no notifications — tasks are just always visible.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router v7, TanStack Query v5 |
| UI | Tailwind CSS v4, shadcn/ui |
| Backend | Hono.js (Node.js) |
| Database | Neon (Serverless PostgreSQL), Drizzle ORM |
| Auth | Better Auth — email/password + Google OAuth |
| AI | OpenAI GPT-4o / DeepSeek (via AIHubMix), Whisper STT |
| AI Orchestration | LangGraph — Supervisor + multi-agent |
| Hardware | ESP32, GxEPD2 e-ink driver |

---

## Features

### Group Management
- Create groups with auto-generated invite codes
- Join by 4-digit code — no account linking required
- Role-based permissions: `owner` / `member`

### Task Management
- Personal (private) and group (shared) tasks in a unified feed
- Priority levels, due dates, fuzzy time segments (morning / afternoon / evening / all-day)
- Recurring tasks: daily, weekly, monthly, yearly with custom rules
- Task assignment within a group

### AI Assistant
- Natural language input — describe tasks in plain language
- Multi-agent system built with LangGraph:

  | Agent | Responsibility |
  |-------|---------------|
  | **Supervisor** | Routes intent to the right agent(s) |
  | **Task Agent** | Create, query, modify, complete, delete |
  | **Calendar Agent** | View day schedule, find free time slots |
  | **Weather Agent** | Context-aware info for outdoor/travel tasks |
  | **Notification Agent** | Schedules reminders based on task time + weather |

### E-ink Display *(planned)*
- ESP32 polls `/api/devices/{id}/tasks` every 2 minutes
- Renders group tasks on a 7.5" e-ink screen (800×480, GxEPD2)
- Deep sleep between refreshes

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client Layer                    │
│  React Web (Vite)          Mobile App (planned)   │
└──────────────────┬───────────────────────────────┘
                   │ HTTP
┌──────────────────▼───────────────────────────────┐
│             Hono.js API (Node.js)                 │
│                                                   │
│  ┌───────────────────────────────────────────┐    │
│  │          Multi-Agent System               │    │
│  │  Supervisor ──► Task Agent                │    │
│  │             ──► Calendar Agent            │    │
│  │             ──► Weather Agent             │    │
│  │             ──► Notification Agent        │    │
│  └───────────────────────────────────────────┘    │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Neon PostgreSQL   │
         └────────────────────┘

┌──────────────────────────────────────────────────┐
│             Hardware Layer (planned)              │
│  ESP32 ──► HTTP GET /api/devices/{id}/tasks       │
│        ──► 7.5" e-ink display (GxEPD2)           │
└──────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+, pnpm
- [Neon](https://neon.tech) PostgreSQL database (free tier works)
- OpenAI API key **or** [AIHubMix](https://aihubmix.com) key (supports DeepSeek, recommended for CN users)

### Environment Variables

**`packages/server/.dev.vars`**
```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=any-random-string
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=re_...

# Pick one:
OPENAI_API_KEY=sk-...
# or
AIHUBMIX_API_KEY=...
AIHUBMIX_BASE_URL=https://aihubmix.com/v1
AIHUBMIX_MODEL_NAME=deepseek-v3.2   # optional, this is the default

# Optional
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**`packages/web/.env`**
```env
VITE_API_BASE_URL=http://localhost:3000
```

### Run

```bash
pnpm install
pnpm -C packages/server db-push
pnpm -C packages/server dev    # backend → localhost:3000
pnpm -C packages/web dev       # frontend (new terminal)
```

### Test

```bash
pnpm -C packages/server test
```

---

## Roadmap

- [ ] Voice input — Whisper STT (server pipeline complete, frontend UI pending)
- [ ] Mobile app — Expo / React Native
- [ ] ESP32 e-ink display
- [ ] Push / SMS notifications
- [ ] Production deployment

---

## License

MIT
