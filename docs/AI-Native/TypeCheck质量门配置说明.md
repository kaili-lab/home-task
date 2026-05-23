# TypeCheck 质量门配置说明

> 适用范围：TypeScript 全栈项目（Hono + Cloudflare Workers 后端 / React + Vite 前端 / 共享类型包）。  
> 本文档的决策和建议基于该技术栈，其他语言或运行时不适用。

## 核心原则

TypeCheck（`tsc --noEmit`）是质量门禁中**类型安全**这一层的唯一权威。ESLint 管代码规范，测试管行为正确性，TypeCheck 管"类型契约是否被遵守"。三者不可互相替代。

TypeCheck 不输出编译产物（`noEmit: true`），只做静态分析。实际构建由 Vite（前端）和 Wrangler（后端）各自处理。这意味着 TypeCheck 可以独立于构建流程运行，适合作为 CI 门禁。

## TypeCheck 与 ESLint 的分工

| 职责 | TypeCheck (`tsc`) | ESLint |
|------|-------------------|--------|
| 类型不匹配（参数传错、返回值不符） | ✓ | ✗ |
| 属性不存在、接口契约违反 | ✓ | ✗ |
| 未使用变量/参数 | ✓（`noUnusedLocals` / `noUnusedParameters`） | ✓（`no-unused-vars`） |
| 代码反模式（死代码、可疑赋值） | ✗ | ✓ |
| import 存在性 | ✓ | ✗ |
| 格式/风格 | ✗ | ✗（交给 Prettier） |

未使用变量/参数两边都能检查，保留两边是因为 ESLint 支持 `_` 前缀豁免模式（`argsIgnorePattern: "^_"`），而 `tsc` 不支持。两者互补而非冲突。

## 等级参照

TypeScript 没有像 ESLint 那样的预设包，而是通过 `compilerOptions` 中的开关逐个叠加。严格度分三档：

| 等级 | 做法 | 特点 |
|------|------|------|
| 基础 | `strict: true` | 一次性开启 `strictNullChecks`、`noImplicitAny`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`、`useUnknownInCatchVariables` 等检查。这是社区公认的最低线，几乎所有现代 TS 项目都应开启 |
| 收紧 | 基础 + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` | 多数成熟项目的选择。拦截未使用代码和 switch 穿透，改动量小，收益明确 |
| 极严 | 收紧 + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` 等 | 大型团队或库作者使用。`noUncheckedIndexedAccess` 会让所有数组/对象索引访问的结果变为 `T | undefined`，对现有代码改动量大；`exactOptionalPropertyTypes` 区分 `undefined` 和"属性不存在"，需要大量类型调整 |

**选择建议：**

- 个人项目 / 快速迭代阶段：收紧级（`strict` + 三个额外开关），性价比最高。
- 团队项目 / 稳定维护阶段：同上，按需加入 `noUncheckedIndexedAccess`。
- 库作者 / 基础设施项目：极严级，确保导出类型的精确性。
- 任何项目都不应低于基础级（`strict: true`）。不开 `strict` 的 TypeScript 项目等于放弃了 TypeScript 的核心价值。

**本项目选择收紧级。** 理由见下方"当前项目的 tsconfig 决策"。

## 当前项目的 tsconfig 决策

### 严格度选项（三个包统一）

| 选项 | 值 | 作用 |
|------|-----|------|
| `strict` | `true` | 一次性启用 `strictNullChecks`、`noImplicitAny`、`strictFunctionTypes` 等 7-8 个严格检查 |
| `noEmit` | `true` | 只检查不输出，构建交给 Vite/Wrangler |
| `noUnusedLocals` | `true` | 未使用局部变量报错 |
| `noUnusedParameters` | `true` | 未使用参数报错 |
| `noFallthroughCasesInSwitch` | `true` | switch 语句漏写 break/return 报错 |

这五个选项是三个包（server / web / shared）的统一基线。

### 模块/环境选项（按包不同）

这些选项决定"代码运行在什么环境"，不影响检查强度，按包的实际运行时配置：

| 选项 | server | web (app) | web (node) | shared |
|------|--------|-----------|------------|--------|
| `target` | ESNext | ES2022 | ES2023 | ESNext |
| `module` | ESNext | ESNext | ESNext | ESNext |
| `moduleResolution` | Bundler | Bundler | Bundler | Bundler |
| `lib` | ESNext | ES2022, DOM, DOM.Iterable | ES2023 | ESNext |

### 不启用的选项

| 选项 | 原因 |
|------|------|
| `erasableSyntaxOnly` | 实验性，server 使用 enum 会冲突 |
| `verbatimModuleSyntax` | server 端加入需要大量改写 import 语句，收益不大 |
| `noUncheckedSideEffectImports` | 主要面向前端打包场景，server 端用处不大 |

## typecheck 脚本

三个包都配置了独立的 typecheck 脚本：

| 包 | 脚本 | 说明 |
|---|------|------|
| `packages/web` | `tsc --noEmit --project tsconfig.app.json` | 只检查应用代码，不检查 vite.config.ts |
| `packages/server` | `tsc --noEmit` | 检查 `src/` 下所有代码 |
| `packages/shared` | `tsc --noEmit` | 检查 `src/` 下所有类型定义 |

运行方式：`pnpm -C packages/<pkg> typecheck`

## 与 ESLint typed linting 的关系

本项目**不启用 ESLint 的 typed linting**（不配置 `parserOptions.projectService`）。类型安全完全由 `tsc` 负责，ESLint 只负责代码质量和基础规范。

这样做的理由：

1. typed linting 需要 ESLint 启动 TypeScript 编译器服务，速度慢 5-30 倍。
2. typed linting 提供的规则（如 `no-floating-promises`、`no-misused-promises`）与 `tsc` 的 `strict` 模式有大量重叠。
3. Hono 官方仓库也采用相同策略：虽然 `@hono/eslint-config` 底层引入了 `strictTypeChecked`，但逐条关闭了所有 type-checked 规则。

详见 [ESLint 质量门配置说明](./ESLint质量门配置说明.md)。

## CI 门禁建议

TypeCheck 应与 lint、test 一起作为 PR 合入前的自动检查：

```
pnpm -C packages/shared typecheck
pnpm -C packages/server typecheck
pnpm -C packages/web typecheck
```

执行顺序建议 shared → server → web，因为 server 和 web 依赖 shared 的类型导出。

## 参考资料

- TypeScript tsconfig 参考：https://www.typescriptlang.org/tsconfig/
- TypeScript strict 模式包含的选项：https://www.typescriptlang.org/tsconfig/#strict
