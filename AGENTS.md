# Claude Code Project Memory

## Testing

- When running tests, use `pnpm` commands (e.g., `pnpm test`) instead of directly invoking `vitest` or other test runners.

## Environment

- Before executing any bash command, check whether the current machine is running Windows, Linux, or macOS, and use the appropriate command syntax accordingly.
- When reading environment variables, first check whether the project's build environment is traditional Node.js or something else (e.g., Cloudflare Workers), as the method for accessing environment variables may differ.

## 项目特定记忆（效率优先）

- 技术栈边界：仅 Node/TypeScript；前端 React 19 + Vite；后端 Hono + Cloudflare Workers；共享类型在 packages/shared。
- 工作目录：默认仓库根；涉及子包时用 pnpm -C packages/<pkg> <script> 运行。
- 命令优先级：先 pnpm 脚本；脚本无对应项再直调工具（vite/wrangler/vitest/tsc/eslint/prettier/drizzle-kit）。
- 禁用非栈工具：python/pip/conda/poetry/pipx 等，除非用户明确要求。
- 依赖管理：只用 pnpm；不使用 npm/yarn/系统包管理器；不做全局安装。
- 诊断/排查：优先 rg 且排除 node_modules；避免全库扫描锁文件；不写临时脚本。
- 测试执行：必须通过 pnpm 脚本（与 CLAUDE.md 一致），不直接跑 vitest。
- 平台约束：仅使用 Windows/PowerShell 语法，不使用 bash 语法。
- 修改范围：不改 node_modules/生成物；涉及网络下载、外部路径或非白名单命令先确认。