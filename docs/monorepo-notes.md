# Monorepo 笔记

## 起源

Monorepo 不是新概念，Google、Facebook 几十年前就把整个公司的代码放在一个仓库里管理。
前端/全栈社区后来借鉴了这个思想，缩小范围用在"一个项目内的多个包"上。

## 解决了什么问题

传统多仓库（Polyrepo）在多个包需要协作时会遇到：

- **版本对齐问题**：A 包改了接口，B 包要手动升级依赖、重新发布，容易出现版本不一致
- **跨仓库联动改动繁琐**：改一个功能要跨多个仓库各开一个 PR，还要协调合并顺序
- **工具链重复维护**：每个仓库各自管 eslint / tsconfig / prettier，配置容易漂移

Monorepo 用"物理集中"换取"逻辑一致性"。

## Java 类比

Java 的 Maven 多模块项目（parent pom + 多个 module）本质上就是 Monorepo。
如果用过 Maven 多模块，已经理解了 Monorepo 的核心思想，只是换了工具。

## 核心价值

### 1. 编译时类型共享
共享包（如 `packages/shared`）直接被前后端 import，TypeScript 编译器跨包做静态检查。
后端改了接口类型，前端立刻报错，不需要等到运行时才发现。

### 2. 原子提交
一个跨前端、后端、共享包的功能改动，可以在一个 commit 里完成，变更上下文完整清晰。

### 3. 统一工具链
单一 `pnpm-workspace.yaml`，所有包共享 eslint / tsconfig / prettier 配置，强制规范一致。

### 4. 本地联调零成本
包之间直接引用，不需要发布 npm 包或使用 `npm link`。

## 以本项目为例：React + Hono 全栈

本项目结构：

```
packages/
  web/      ← React 前端（Vite）
  server/   ← Hono 后端（Cloudflare Workers）
  shared/   ← 共享类型定义
  mobile/   ← 移动端
```

### 没有 Monorepo 会怎样？

假设前后端是独立仓库，`shared` 需要发布成 npm 包：

```
后端改了 Task 类型
  → 发布 shared@1.1.0 到 npm
  → 前端手动升级依赖：pnpm add shared@1.1.0
  → 前端才能发现类型不匹配
```

这个流程慢、容易遗漏，而且中间有一段时间前后端类型是不一致的。

### 用了 Monorepo 之后

```
后端改了 Task 类型
  → TypeScript 编译器立刻在前端报错
  → 一个 commit 同时修复前后端
```

`packages/shared` 里定义一次类型，前后端同时享受编译时保障：

```ts
// packages/shared/src/types.ts
export type Task = {
  id: string
  title: string
  status: 'pending' | 'done'
}

// packages/server —— 直接 import，不需要发包
import type { Task } from 'shared'

// packages/web —— 同一份类型
import type { Task } from 'shared'
```

接口契约由编译器保证，不是靠文档或口头约定。

## 适用场景

**适合 Monorepo：**
- 多个包之间有编译时依赖（共享类型、共享工具函数）
- TS 全栈项目、gRPC 项目（共享 `.proto` 生成代码）
- 小到中型团队，包的数量可控

**不适合 Monorepo（用 Polyrepo 更好）：**
- 微服务架构，服务之间只通过 HTTP/消息队列通信，没有编译时依赖
- 团队规模大，不同子系统需要独立的权限管控
- 仓库体积增长到影响 CI 效率

## 代价

- 仓库体积大，首次 clone 慢
- CI 需要做增量构建，否则每次全量跑很慢
- 权限管控粒度粗，无法针对单个包设置访问权限

## 工具生态与竞品

### 包管理器层（工作区管理）

| 工具 | 说明 |
|---|---|
| **pnpm workspaces** | 本项目使用，性能好，磁盘占用小（硬链接共享 node_modules） |
| npm workspaces | npm 7+ 内置，功能基础 |
| Yarn workspaces | 较早支持 workspace，生态成熟 |

### 构建编排层（增量构建 / 任务缓存）

包管理器只管依赖，大型 Monorepo 还需要构建编排工具来解决"只重新构建受影响的包"：

| 工具 | 特点 |
|---|---|
| **Turborepo** | Vercel 出品，配置简单，本地 + 远程缓存，目前最流行 |
| **Nx** | 功能更全，适合大型团队，有代码生成、依赖图可视化等 |
| Lerna | 最早的 Monorepo 工具，现在已被 Nx 接管，逐渐式微 |
| Rush | 微软出品，适合超大型仓库，配置复杂 |

### 发展趋势

1. **pnpm + Turborepo 成为主流组合**：轻量、够用、上手快，中小项目首选
2. **Nx 在企业级场景增长**：有更完整的插件体系和团队协作功能
3. **构建缓存越来越重要**：远程缓存（CI 共享缓存）让大仓库的构建时间从分钟级降到秒级
4. **边界模糊化**：越来越多的框架（如 Next.js、Remix）原生支持 Monorepo 结构，工具链负担在降低

本项目规模下，pnpm workspaces 已经够用，如果包数量增加、CI 变慢，下一步引入 Turborepo 是自然的升级路径。

## 一句话总结

> Monorepo 的本质是：用物理上的集中，换取编译时的一致性。适合有跨包共享需求的项目，不适合以协议解耦为主的微服务架构。
