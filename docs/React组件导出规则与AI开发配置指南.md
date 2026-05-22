# React 组件导出规则与 AI 开发配置指南

## 适用范围

本文用于 Vite + React + TypeScript 项目，说明 `react-refresh/only-export-components` 的来源、配置方式，以及在 Cursor、Claude Code、Codex 等 AI coding 工作流里如何避免反复生成不合规代码。

核心规则：

> 含 JSX 的组件文件只导出 React 组件；hook、工具函数、CVA variants、Context 对象拆到独立文件。

## 这是谁的规则

这不是 Vite 构建器自己的语法规则，而是 ESLint 规则：

```text
react-refresh/only-export-components
```

来源是 `eslint-plugin-react-refresh`。它用于保护 React Fast Refresh 的热更新边界。

Vite 的 React 插件使用 React Fast Refresh 来实现开发环境热更新。Fast Refresh 需要能稳定判断“这个模块是不是一个组件模块”。如果同一个 `.tsx` 文件里同时导出组件、hook、工具函数、Context、CVA variants 等非组件运行时值，热更新边界会变得不稳定，常见结果是状态丢失、整页刷新，或 HMR 行为不一致。

所以关系是：

| 项目 | 角色 |
| --- | --- |
| Vite | 提供开发服务器和 HMR |
| `@vitejs/plugin-react` | 接入 React Fast Refresh |
| `eslint-plugin-react-refresh` | 用 ESLint 提前发现不适合 Fast Refresh 的导出 |
| `react-refresh/only-export-components` | 具体 lint 规则 |

关闭这条规则通常不影响生产构建，但会降低开发环境热更新的可靠性。不建议用关闭规则来解决报错。

## 推荐 ESLint 配置

新项目安装依赖：

```powershell
pnpm add -D eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier
```

`eslint.config.js` 示例：

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
```

`reactRefresh.configs.vite` 会启用适合 Vite 的配置，通常等价于允许简单常量导出：

```js
"react-refresh/only-export-components": ["error", { allowConstantExport: true }]
```

注意：`allowConstantExport` 只适合简单常量。不要把它理解为允许在组件文件里导出 hook、Context、复杂对象、CVA variants 或工具函数。

## 推荐文件拆分

### UI 组件

组件文件只导出组件：

```tsx
// components/ui/button.tsx
import { buttonVariants } from "./button-variants";

export function Button() {
  return <button className={buttonVariants()}>保存</button>;
}
```

不要在同一文件导出 variants：

```tsx
// 不推荐
export const buttonVariants = cva(...);

export function Button() {
  return <button />;
}
```

拆到独立文件：

```ts
// components/ui/button-variants.ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(...);
```

### Hook

hook 放在 `hooks/` 或独立 `*.hook.ts`：

```tsx
// 不推荐
export function TaskList() {
  return <div />;
}

export function useTaskList() {
  return {};
}
```

```ts
// hooks/use-task-list.ts
export function useTaskList() {
  return {};
}
```

### Context

Context 对象是运行时值，不要和组件一起导出：

```tsx
// 不推荐
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}
```

推荐拆分：

```ts
// contexts/auth-context.ts
import { createContext } from "react";

export const AuthContext = createContext(null);
```

```tsx
// contexts/auth-provider.tsx
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}
```

```ts
// hooks/use-auth.ts
import { useContext } from "react";
import { AuthContext } from "../contexts/auth-context";

export function useAuth() {
  return useContext(AuthContext);
}
```

### 工具函数和映射表

纯函数、映射表、格式化函数放到 `lib/`、`utils/` 或同目录 `*.utils.ts`：

```ts
// lib/task-status.ts
export function formatTaskStatus(status: string) {
  return status;
}
```

### TypeScript 类型

`export type` 是类型导出，编译后不存在运行时值，一般不会破坏 Fast Refresh。为了降低 AI 误判和文件职责混乱，复杂类型仍建议放到 `*.types.ts`。

```ts
// components/task-card.types.ts
export type TaskCardProps = {
  title: string;
};
```

## AI coding 的推荐工作流

不要只依赖 AI 自觉，也不要只依赖最后 lint。推荐三层防线：

| 层级 | 作用 | 推荐做法 |
| --- | --- | --- |
| 项目规则 | 让 AI 写代码前知道边界 | 写入 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules` |
| ESLint | 作为最终事实来源 | 启用 `reactRefresh.configs.vite` |
| CI / hooks | 防止问题进入主分支 | PR 前运行 `pnpm lint`、`pnpm typecheck` |

### 放进 AGENTS.md 的规则

```md
## React Fast Refresh

- `.tsx/.jsx` 组件文件只导出 React 组件。
- hooks 放到 `hooks/` 或 `*.hook.ts`。
- Context 对象放到 `*.context.ts`，Provider 组件可放到 `.tsx`。
- CVA variants 放到 `*.variants.ts`。
- 工具函数放到 `*.utils.ts`、`utils/` 或 `lib/`。
- 不要通过禁用 `react-refresh/only-export-components` 解决问题；优先拆文件。
- 前端改动完成后运行 `pnpm lint` 和 `pnpm typecheck`。
```

### 放进 Cursor Rules 的规则

`.cursor/rules/react-fast-refresh-exports.mdc` 示例：

```md
---
description: React 组件文件导出规范，兼容 Vite Fast Refresh
globs: src/**/*.{ts,tsx}
alwaysApply: false
---

# React 文件导出

含 JSX 的组件文件只导出 React 组件。

- hook 拆到 `hooks/` 或 `*.hook.ts`
- Context 对象拆到 `*.context.ts`
- Provider 组件可以留在 `.tsx`，但只导出 Provider 组件
- CVA variants 拆到 `*.variants.ts`
- 工具函数拆到 `*.utils.ts`、`utils/` 或 `lib/`
- 不要关闭 `react-refresh/only-export-components`
```

### 放进 Claude Code 的规则

如果项目同时维护 `AGENTS.md`，可以在 `CLAUDE.md` 里引用同一份规则，避免重复维护：

```md
请遵守根目录 AGENTS.md 中的 React Fast Refresh 文件导出规范。
```

也可以直接复制 AGENTS.md 中的短规则。

### Codex 的规则

Codex 会读取项目里的 `AGENTS.md`。这类稳定、项目级、每次前端开发都要遵守的规则，优先放在 `AGENTS.md`，不要做成临时 prompt。

## hooks、skills、lint 应该怎么分工

### 不推荐

只在 hooks 里跑 ESLint，然后等 AI 出错后再修。

问题是反馈太晚，AI 会先生成一批不合规结构，再被迫拆文件，容易引入额外 diff。

### 推荐

1. 项目规则提前约束 AI。
2. ESLint 保留硬性检查。
3. 完成一轮前运行 lint 和 typecheck。
4. CI 再做最终兜底。

### hooks 的合适位置

hooks 适合做自动验证，不适合代替项目规则。

建议：

```text
AI 完成一次任务前 -> pnpm lint -> pnpm typecheck
PR / CI -> pnpm lint -> pnpm typecheck -> pnpm test
```

如果项目很大，可以在本地 hook 里只检查 changed files，但 CI 保留全量检查。

### skills 的合适位置

skills 适合成套、重复、跨文件的工作流。例如：

- 生成一个完整业务模块
- 生成一套设计系统组件
- 生成页面、hook、schema、test、story 的固定结构

单条 React Fast Refresh 导出规则不需要单独做 skill。它更适合放在 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules` 这类项目规则里。

## shadcn/ui 和 CVA variants

很多 UI 模板会把组件和 `xxxVariants` 放在同一个 `.tsx` 文件里：

```tsx
export const badgeVariants = cva(...);

export function Badge() {
  return <div />;
}
```

在启用 `react-refresh/only-export-components` 后，这类文件可能触发 lint。

推荐固定处理方式：

```text
components/ui/badge.tsx
components/ui/badge-variants.ts
```

`badge.tsx` 只导出 `Badge` 组件，`badge-variants.ts` 导出 `badgeVariants`。

## 新项目落地清单

1. 安装 `eslint-plugin-react-refresh`。
2. 在 `eslint.config.js` 使用 `reactRefresh.configs.vite`。
3. 在 `package.json` 添加脚本：

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

4. 在 `AGENTS.md` 写入 React Fast Refresh 文件导出规则。
5. 如果使用 Cursor，添加 `.cursor/rules/react-fast-refresh-exports.mdc`。
6. 如果使用 Claude Code，确保 `CLAUDE.md` 引用或复制同一规则。
7. 在 CI 中运行：

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

8. 生成或修改组件后，先拆分 hook、Context、variants、utils，再提交。

## 判断标准

看到一个 `.tsx` 文件时，可以用这个问题快速判断：

> 这个文件的运行时导出，是否全部是 React 组件？

如果答案是否定的，就拆文件。

常见拆分目标：

| 当前导出 | 应放位置 |
| --- | --- |
| `useXxx` | `hooks/use-xxx.ts` |
| `XxxContext` | `contexts/xxx-context.ts` |
| `xxxVariants` | `components/.../xxx-variants.ts` |
| `formatXxx` | `utils/`、`lib/` 或 `*.utils.ts` |
| `XxxProvider` | 可以留在 `.tsx`，但该文件只导出 Provider 组件 |

## 参考链接

- `eslint-plugin-react-refresh`: https://github.com/ArnaudBarre/eslint-plugin-react-refresh
- Vite React plugin Fast Refresh 说明: https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#consistent-components-exports
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex Skills: https://developers.openai.com/codex/skills
- Codex hooks: https://developers.openai.com/codex/hooks
- Cursor Rules: https://docs.cursor.com/en/context/rules
