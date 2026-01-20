# Shared 项目搭建指南

## 1. 项目背景

### 1.1 为什么需要 Shared 项目？

- **前后端分离架构**：使用 HTTP API 而非 tRPC/HonoRPC
- **类型共享需求**：前后端需要共享 API 接口的类型定义
- **技术栈**：
  - Server: Hono + Cloudflare Workers
  - Web: React 19 + Vite
  - Mobile: React Native

### 1.2 技术选型说明

**选择方案：源码直接引用（不编译）**

- ✅ **简单**：不需要构建步骤，开发体验好
- ✅ **兼容性**：Wrangler、Vite、Metro 都支持直接处理 TypeScript 源码
- ✅ **即时生效**：修改类型定义后立即生效，无需 rebuild

**不启用 TypeScript Project References**

- 各项目都有自己的构建工具（Wrangler/Vite/Metro）
- 不会直接使用 `tsc` 命令构建
- 避免增加不必要的复杂度

---

## 2. 搭建步骤

### 2.1 创建目录结构

```bash
mkdir -p packages/shared/src
```

### 2.2 初始化 package.json

在 `packages/shared` 目录下运行：

```bash
cd packages/shared
pnpm init
```

### 2.3 配置 package.json

编辑 `packages/shared/package.json`，内容如下：

```json
{
  "name": "shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "private": true
}
```

**配置说明：**
- `name`: 包名，其他项目通过此名称导入
- `type: "module"`: 使用 ESM 模块系统
- `exports`: 指向源码文件（不编译）
- `private: true`: 防止意外发布到 npm

### 2.4 配置 TypeScript

创建 `packages/shared/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["ESNext"]
  },
  "include": ["src"]
}
```

**配置说明：**
- `moduleResolution: "Bundler"`: 与 server 项目保持一致，兼容现代构建工具
- `strict: true`: 启用严格模式，保证类型安全
- `isolatedModules: true`: 确保每个文件可以独立编译（bundler 要求）

### 2.5 创建类型定义文件

创建 `packages/shared/src/index.ts`，在这里统一定义类型：


### 2.6 在 Server 项目中添加依赖

编辑 `packages/server/package.json`，在 `dependencies` 中添加：

```json
{
  "dependencies": {
    "hono": "^4.11.4",
    "shared": "workspace:*"
  }
}
```

**说明：**
- `workspace:*`: pnpm workspace 协议，表示使用本地 workspace 中的包
- 不需要指定版本号，pnpm 会自动链接

### 2.7 安装依赖

在**项目根目录**运行：

```bash
pnpm install
```

**重要：**
- ✅ 必须在**根目录**运行，不能在 `packages/shared` 目录下运行
- ✅ pnpm 会扫描所有 workspace 包，建立依赖关系
- ✅ 会在 `packages/server/node_modules/` 下创建指向 `packages/shared` 的符号链接


## 3. 使用方式

### 3.1 在 Server 中使用

```typescript
import type { Task, CreateTaskRequest, TasksResponse } from "shared";

// 使用类型定义
app.post("/groups/:groupId/tasks", async (c) => {
  const body: CreateTaskRequest = await c.req.json();
  // ... 处理逻辑
  return c.json({ id: "task-id" });
});
```
---

## 4. 目录结构

```
home-task/
├── pnpm-workspace.yaml          # 已存在，配置了 packages/*
├── packages/
│   ├── shared/                  # 共享类型包
│   │   ├── package.json         # 包配置
│   │   ├── tsconfig.json        # TypeScript 配置
│   │   └── src/
│   │       └── index.ts         # 类型定义入口
│   ├── server/                  # 后端项目
│   │   ├── package.json         # 已添加 shared 依赖
│   │   └── src/
│   ├── web/                     # 前端项目
│   └── mobile/                  # 移动端项目
```
---

## 6. 常见问题

### Q1: shared 项目需要单独运行 `pnpm install` 吗？

**A:** 不需要。shared 项目没有依赖，只需要在根目录运行 `pnpm install` 来建立 workspace 依赖关系。

### Q2: 为什么使用 `workspace:*` 而不是具体版本？

**A:** `workspace:*` 是 pnpm 的 workspace 协议，表示使用本地 workspace 中的包，pnpm 会自动创建符号链接。

### Q3: 修改 shared 的类型后需要重新构建吗？

**A:** 不需要。因为是源码直接引用，修改后立即生效。但可能需要重启开发服务器（如 `wrangler dev`）来重新加载类型。

### Q4: 为什么 `exports` 指向 `.ts` 文件而不是 `.js`？

**A:** 因为我们使用源码直接引用方案，不编译。各项目的构建工具（Wrangler/Vite/Metro）会直接处理 TypeScript 源码。

### Q5: 如果 IDE 提示找不到 `shared` 模块怎么办？

**A:** 
1. 确保在根目录运行了 `pnpm install`
2. 检查 `packages/server/package.json` 中是否有 `"shared": "workspace:*"`
3. 重启 IDE 或 TypeScript 服务器
4. 检查 `packages/server/node_modules/shared` 是否存在（应该是符号链接）

---

## 7. 后续扩展

### 7.1 添加更多类型

在 `packages/shared/src/index.ts` 中继续添加类型定义，例如：

```typescript
// 用户相关类型
export interface User {
  id: string;
  name: string;
  email: string;
}

// 更多 API 类型...
```

### 7.2 按模块拆分（可选）

如果类型很多，可以按模块拆分：

```
packages/shared/src/
├── index.ts          # 统一导出
├── api/
│   ├── group.ts
│   ├── task.ts
│   └── device.ts
└── types/
    └── common.ts
```

然后在 `index.ts` 中统一导出：

```typescript
export * from './api/group';
export * from './api/task';
export * from './api/device';
export * from './types/common';
```

---

## 8. 总结

通过以上步骤，我们成功创建了一个共享类型包，实现了：

- ✅ 前后端类型共享
- ✅ 简单的配置，无需构建步骤
- ✅ 良好的开发体验（修改立即生效）
- ✅ 兼容所有技术栈（Hono/Wrangler、React/Vite、React Native/Metro）

**核心原则：**
- 使用源码直接引用，不编译
- 通过 pnpm workspace 协议管理依赖
- 保持配置简单，避免过度设计
