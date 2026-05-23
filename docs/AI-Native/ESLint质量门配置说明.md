# ESLint质量门配置说明

> 适用范围：TypeScript 全栈项目（Hono + Cloudflare Workers 后端 / React + Vite 前端 / shared 契约包）。  
> 本文档的决策和建议基于该技术栈，其他技术栈（Go、Python、Java 等）不适用。

## 核心原则

ESLint 是工程质量门禁的一部分，不是质量本身。它适合拦截静态可发现的问题，例如未使用变量、明显错误代码、Promise 未处理、React Hooks 误用等；但它不能替代 TypeScript typecheck、测试、代码审查和 Agent eval。

框架提供的 ESLint 配置只应作为参考，不应无条件全盘照搬。真实项目要根据运行环境、代码成熟度、历史类型债务和团队当前目标决定规则强度。接手已有项目时，第一阶段更重要的是建立一个可信、可运行、可解释的质量基线，而不是一次性把所有严格规则打开。

## 等级参照

typescript-eslint 提供了多个预设，严格度逐级递增。选择时需要权衡检查深度与配置/性能成本。

| 等级 | 预设 | 需要 typed linting | 特点 |
|------|------|-------------------|------|
| 基础 | `recommended` | 否 | 只拦明确的代码错误（未使用变量、重复声明等），不涉及类型信息，速度快 |
| 类型感知 | `recommendedTypeChecked` | 是 | 在基础上加入需要类型信息的规则（`no-floating-promises`、`no-misused-promises` 等），需配置 `parserOptions.projectService`，ESLint 速度慢 5-30 倍 |
| 严格 | `strict` | 否 | 在 `recommended` 上加入更多主观性规则（禁止 non-null assertion、禁止空函数等），semver 不稳定，可能跨版本新增规则 |
| 严格 + 类型感知 | `strictTypeChecked` | 是 | `strict` + `recommendedTypeChecked` 的合集，最严格的代码质量检查 |
| 风格 | `stylistic` / `stylisticTypeChecked` | 否 / 是 | 纯风格规则（`array-type`、`consistent-type-definitions` 等），不影响正确性，按团队偏好决定 |

**选择建议：**

- 个人项目 / 快速迭代阶段：`recommended`，类型安全交给 `tsc`。
- 团队项目 / 稳定维护阶段：`recommendedTypeChecked`，愿意承受速度代价换取更强的自动检查。
- 库作者 / 基础设施项目：`strictTypeChecked`，对代码质量要求最高。
- Hono / NestJS 等框架官方仓库的实际做法：即使声称用了 `strictTypeChecked`，也会大量关闭具体规则，实际严格度接近 `recommended`。

**本项目选择 `recommended`（不启用 typed linting）。** 理由见下方"当前项目的后端决策"。

## 当前项目的后端决策

后端是 Hono + TypeScript，主要部署目标是 Cloudflare Workers，同时保留 `src/node.ts` 作为传统 Node.js 启动入口。因此 ESLint 配置需要区分 Worker 环境和 Node 环境：

- 业务代码默认按 Worker/Web 标准 API 处理，使用 `globals.serviceworker`。
- `src/node.ts` 单独加入 Node globals。
- 测试文件单独加入 Node globals，因为 Vitest 当前运行在 Node 环境。
- 使用 ESLint v9 flat config。
- 使用 `@eslint/js` recommended 和 `typescript-eslint` recommended 作为基础质量门。
- 使用 `eslint-config-prettier` 关闭格式类冲突，把格式交给 Prettier。
- **不启用 typed linting**（不配置 `parserOptions.projectService` / `parserOptions.project`）。类型安全由 `tsc --noEmit` 独立保证，ESLint 只负责代码质量和基础规范检查。这与 Hono 官方仓库的做法一致：即使 `@hono/eslint-config` 底层引入了 `strictTypeChecked`，Hono 自身也逐条关闭了所有 type-checked 规则。
- 将 `@typescript-eslint/no-explicit-any` 暂设为 warning，暴露类型债务，但不让当前阶段被大量历史 `any` 阻塞。

本阶段不启用 `no-floating-promises`（交给 `tsc`）、import 排序、强制大括号风格、array-type 等偏风格规则，也不使用 `strictTypeChecked` / `stylisticTypeChecked` 作为阻塞门禁。原因是当前目标是先建立稳定质量门，后续再逐步收紧。

## Hono/Worker 后端的建议描述

给 AI 或新项目描述后端 ESLint 配置时，可以这样写：

> 这是 Hono + TypeScript 后端，主运行环境是 Cloudflare Workers。请使用 ESLint v9 flat config，基础规则采用 `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`。不启用 typed linting（不配置 `parserOptions.projectService`），类型安全由独立的 `tsc --noEmit` 保证。业务代码按 Worker/Web API 配置 globals，不要默认加入完整 Node globals；只有 Node 启动文件和 Vitest 测试文件可以加入 Node globals。不要加入 import 排序、强风格规则或庞大 overrides。已有项目中 `no-explicit-any` 可以先作为 warning，等类型债务清理后再升级为 error。

## React/Vite 前端的建议描述

给 AI 或新项目描述前端 ESLint 配置时，可以这样写：

> 这是 React + Vite + TypeScript 前端。请使用 ESLint v9 flat config，基础规则采用 `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` + `eslint-config-prettier`。前端 globals 使用 browser。ESLint 负责代码质量门，TypeScript 类型检查用独立 `typecheck` 脚本执行，不要把格式化、复杂 import 排序或团队偏好风格混入第一阶段质量门。

## Shared 契约包的建议描述

shared 包虽然通常只包含类型、API payload、schema 和少量工具，但它是前后端共同依赖的契约层，因此也应该配置 ESLint。shared 的规则不需要重，目标是尽早发现未使用代码、错误导出、明显不安全写法和类型债务。

shared 包不应该绑定具体运行环境：

- 不默认加入 browser globals。
- 不默认加入 Node globals。
- 不默认加入 Worker globals。
- 不启用 React、Hono、Vitest 等业务包专用插件。

给 AI 或新项目描述 shared ESLint 配置时，可以这样写：

> 这是 TypeScript shared 契约包，被前端和后端共同依赖。请使用 ESLint v9 flat config，基础规则采用 `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`。只检查 `src/**/*.ts`，不配置 browser/node/worker globals，不启用 React、Hono、测试框架或 import 排序规则。类型安全由独立 `typecheck` 脚本保证，已有项目中 `no-explicit-any` 可以先作为 warning。

## 后续收紧顺序

1. 先保持 `lint`、`typecheck`、测试在 CI 中稳定通过。
2. 逐步清理 `no-explicit-any` warning，优先处理生产代码，其次处理测试 mock。
3. 当 warning 数量可控后，将生产代码的 `no-explicit-any` 升级为 error，测试文件可以继续保留更宽松策略。
4. 如果团队确实需要统一 import 顺序或其他风格，再单独引入，并作为独立变更讨论。

## 参考资料

- TypeScript ESLint typed linting: https://typescript-eslint.io/getting-started/typed-linting/
- TypeScript ESLint shared configs: https://typescript-eslint.io/users/configs/
- ESLint flat config: https://eslint.org/docs/latest/use/configure/configuration-files
- Cloudflare Workers best practices: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
