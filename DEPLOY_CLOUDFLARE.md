# HomeTask Cloudflare 全自动部署手册（2026 版）

> 最后校验时间：2026-02-23（美国时区）
> 适用仓库：`home-task`
> 部署目标：
> - 后端 API：Cloudflare Workers（当前名称：`home-task-api`）
> - 前端 Web：Cloudflare Pages（Direct Upload）
> - CI/CD：GitHub Actions 单工作流自动发布

---

## 0. 先回答你刚问的 5 个问题

### 0.1 一个账户多个 Worker/Pages 是否只用一个 Account ID？

是。**同一个 Cloudflare 账户**下，不管有多少 Worker 和 Pages 项目，都使用同一个 `CLOUDFLARE_ACCOUNT_ID`。

### 0.2 `wrangler pages project create` 这步当前项目怎么做？

当前项目建议直接执行：

```bash
pnpm -C packages/server exec wrangler login
pnpm -C packages/server exec wrangler pages project create <你的-pages-项目名>
```

创建后建议把 `<你的-pages-项目名>` 写入 GitHub Secret：`CLOUDFLARE_PAGES_PROJECT`（推荐，但不是绝对必填，见 6.1）。

### 0.3 Worker 名称是否要改？

你已改好，当前仓库为：`packages/server/wrangler.jsonc` 中 `name = "home-task-api"`。这个名称会作为 Worker 的部署名。

### 0.4 Workers / Pages Token 是否必须重新创建？

不一定必须重建。

- 若你已有 Token 且满足权限、未失效、同账户：可复用。
- 最佳实践仍是两个独立 Token：
  - `CLOUDFLARE_API_TOKEN_WORKERS`
  - `CLOUDFLARE_API_TOKEN_PAGES`

如果你暂时只想用一个高权限 Token，也可把**同一个值**分别填到这两个 Secret（能跑，但不建议长期这样做）。

### 0.5 文档需要更细步骤

本手册已按“可直接执行”的粒度重写：包含准备、创建资源、Secrets、首次部署、域名回填、问题排查、回滚/停费。

---

## 1. 当前项目部署形态与限制（和你项目强相关）

### 1.1 项目结构

- 后端：`packages/server`（Hono + Wrangler + LangChain/LangGraph）
- 前端：`packages/web`（React + Vite）
- 自动化工作流：`.github/workflows/deploy-cloudflare.yml`

### 1.2 包体与计划选择

当前后端 dry-run 输出（本仓库实测）：

- `Total Upload: 7545.29 KiB / gzip: 1556.77 KiB`

Cloudflare Workers 限制（2026-02）：

- Free：3 MB（压缩后）
- Paid / Standard：10 MB（压缩后）

结论：

- 该项目**不适合 Workers Free**（体积超限）
- 建议直接用 **Workers Paid（Standard）**

---

## 2. Cloudflare Paid（2026 最新口径）

### 2.1 Workers Paid（Standard）价格

- 订阅费：`$5/月`
- 含额度：`10M requests/月` + `30M CPU ms/月`
- 超额：
  - 请求：`$0.30 / 1M`
  - CPU：`$0.02 / 1M CPU ms`

### 2.2 支付方式

Cloudflare 当前文档列出的支付方式（按地区/账户可能有差异）：

- Visa / Mastercard / American Express / Discover / UnionPay
- PayPal
- Link
- Enterprise 可用 ACH / Wire

### 2.3 能否随时停止

可以随时取消订阅，但规则是：

- 通常在当前计费周期结束时生效（不是即时）
- 一般不按比例退款
- 取消后到周期结束前通常仍可继续使用服务

---

## 3. 这次采用的自动化方案（单工作流）

工作流文件：`.github/workflows/deploy-cloudflare.yml`

触发：

- `push main`
- 手动 `workflow_dispatch`

流程：

1. `ci`
   - `pnpm install --frozen-lockfile`
   - `CI=1 pnpm -C packages/server test:ci`
   - `pnpm -C packages/web build`
2. `deploy_api`
   - 校验后端必需 Secrets
   - 自动同步 Worker Secrets（`wrangler secret put`）
   - `pnpm -C packages/server run deploy`
3. `deploy_web`
   - 下载前端构建产物
   - `wrangler pages deploy`

发布策略：

- `deploy_web` 依赖 `deploy_api` 成功，避免前后端版本错位。
- 同分支并发互斥（后提交会取消前一条正在跑的发布）。

---

## 4. Cloudflare 端一次性准备（详细步骤）

## 4.1 获取 Account ID（一个账户只要一个）

1. 打开 Cloudflare Dashboard
2. 进入 `Workers & Pages` -> `Overview`
3. 右侧复制 `Account ID`
4. 之后写入 GitHub Secret：`CLOUDFLARE_ACCOUNT_ID`

## 4.2 开通 Workers Paid

1. Dashboard -> `Workers & Pages` -> `Plans`（或 Billing 中对应入口）
2. 订阅 Workers Paid（Standard）
3. 确认 Billing 中该订阅状态为 Active

## 4.3 创建 Pages 项目（必须提前创建）

> Pages Direct Upload 模式下，建议先创建项目，再由 CI 持续上传。

在仓库根目录执行：

```bash
pnpm -C packages/server exec wrangler login
pnpm -C packages/server exec wrangler pages project create <你的-pages-项目名>
```

执行时会让你输入：

- Project name：例如 `home-task-web`
- Production branch：填 `main`

创建成功后：

- 记下项目名（就是你刚输入的）
- 建议写入 GitHub Secret：`CLOUDFLARE_PAGES_PROJECT`
- 默认域名一般是：`https://<项目名>.pages.dev`

## 4.4 Worker 是否要提前在 Dashboard 创建？

不用。当前项目 Worker 名已在 `packages/server/wrangler.jsonc` 定义为 `home-task-api`，首次 `wrangler deploy` 会自动创建同名 Worker。

---

## 5. API Token 创建（详细）

入口：Dashboard 右上角头像 -> `My Profile` -> `API Tokens`

建议创建两个 Token（最小权限原则）：

## 5.1 Token A：部署 Workers

1. `Create Token`
2. 使用模板：`Edit Cloudflare Workers`
3. 账号范围选你的目标账户
4. 创建后复制 Token
5. 填入 GitHub Secret：`CLOUDFLARE_API_TOKEN_WORKERS`

## 5.2 Token B：部署 Pages

1. `Create Token`
2. `Create Custom Token`
3. Permissions 添加：`Account` -> `Cloudflare Pages` -> `Edit`
4. 账号范围选你的目标账户
5. 创建后复制 Token
6. 填入 GitHub Secret：`CLOUDFLARE_API_TOKEN_PAGES`

---

## 6. GitHub Secrets 配置清单（按当前工作流逐项对应）

入口：GitHub 仓库 -> `Settings` -> `Secrets and variables` -> `Actions`

### 6.1 平台级 Secrets（Cloudflare）

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN_WORKERS`
- `CLOUDFLARE_API_TOKEN_PAGES`
- `CLOUDFLARE_PAGES_PROJECT`（可选，推荐）

关于 `CLOUDFLARE_PAGES_PROJECT` 是否必填：

- 如果你不填，当前工作流会自动查询当前 Cloudflare 账户的 Pages 项目：
  - 只有 1 个项目：自动使用并继续部署；
  - 有多个项目：工作流会失败并提示你填写该 Secret；
  - 没有项目：工作流会失败并提示先创建 Pages 项目。

### 6.2 后端运行时 Secrets（会自动同步到 Worker）

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `FRONTEND_URL`
- `RESEND_API_KEY`
- `OPENAI_API_KEY` 或 `AIHUBMIX_API_KEY`（至少一个）
- `AIHUBMIX_BASE_URL`（可选）
- `AIHUBMIX_MODEL_NAME`（可选）

URL 规则（工作流里有校验）：

- 必须以 `https://` 开头
- 不能有尾部 `/`
- `BETTER_AUTH_URL` 与 `FRONTEND_URL` 不能为空（首次可先填 `workers.dev` / `pages.dev` 临时地址，后续再回填正式域名）

### 6.3 前端构建 Secrets

- `VITE_API_BASE_URL`
- `VITE_AUTH_BASE_URL`

通常二者都填 API 完整地址，如：`https://api.yourdomain.com`。
也可以先留空：工作流会跳过 URL 校验，前端按同域模式构建（适合首次尚未确定 API 域名时）。

---

## 7. 首次部署（一步一步）

### 7.1 先处理“首次 URL 不完整”问题

首次部署常见问题：还没绑定域名，不知道最终 URL。

可先用临时值：

- `FRONTEND_URL`：先填 `https://<pages项目名>.pages.dev`
- `BETTER_AUTH_URL`：先填 `https://home-task-api.<你的-workers-subdomain>.workers.dev`
- `VITE_API_BASE_URL`：同上
- `VITE_AUTH_BASE_URL`：同上

`workers-subdomain` 可在 Dashboard 的 Workers 概览里查看。

### 7.2 触发第一次自动部署

```bash
git push origin main
```

然后到 GitHub Actions 查看 `ci-cd-cloudflare`：

- `ci` 成功
- `deploy_api` 成功
- `deploy_web` 成功

### 7.3 首次部署后检查项

- 前端页面能打开
- 登录/注册不报 CORS
- 任务 API 能通
- AI 对话能返回
- 邮件发送可用（若配置了 Resend）

---

## 8. 绑定自定义域名并回填（推荐）

## 8.1 给 Worker 绑定域名

1. Dashboard -> `Workers & Pages` -> `home-task-api`
2. `Settings` -> `Domains & Routes`
3. `Add Custom Domain`
4. 例如填 `api.yourdomain.com`
5. 等证书签发生效

## 8.2 给 Pages 绑定域名

1. Dashboard -> `Workers & Pages` -> 你的 Pages 项目
2. `Custom domains`
3. 添加 `app.yourdomain.com`
4. 等证书签发生效

## 8.3 回填 Secrets（必须）

把以下值改成正式域名：

- `BETTER_AUTH_URL=https://api.yourdomain.com`
- `FRONTEND_URL=https://app.yourdomain.com`
- `VITE_API_BASE_URL=https://api.yourdomain.com`
- `VITE_AUTH_BASE_URL=https://api.yourdomain.com`

然后重新触发部署（push 或手动 workflow_dispatch）。

---

## 9. LangChain / LangGraph 在 Cloudflare 的高频问题与解法

### 9.1 包体超限

现象：`Worker size limit exceeded`。

建议：

- 用 Paid（你当前体积已适配 Paid 10 MB）
- 控制依赖面，减少不必要 provider
- 需要时拆分为多 Worker（服务绑定调用）

### 9.2 CPU 时间不足 / 长链路超时

现象：多步图编排时请求失败或被中断。

建议：

- Paid 下在 `wrangler` 配置 `limits.cpu_ms`
- 限制图步数、限制每步工具调用数量
- LLM 调用配置超时 + 指数退避 + 降级模型

### 9.3 Subrequest 上限触发

现象：工具调用太多时报配额相关错误。

建议：

- 减少重复外部请求
- 把稳定数据做缓存（KV/Cache/API层）
- 合并可合并的下游请求

### 9.4 Node 兼容性差异

现象：Node-only 依赖在 Worker 中行为异常。

建议：

- 保持 `nodejs_compat`
- 避免必须原生 TCP 的客户端库
- 数据库优先 HTTP 驱动（当前 Neon HTTP 方案正确）

### 9.5 认证回调和 CORS 错配

现象：登录失败、401/403、跨域报错。

建议：

- URL 全部用完整 `https://` 且去尾斜杠
- `BETTER_AUTH_URL`、`FRONTEND_URL`、`VITE_*` 保持一致
- 改完 Secret 必须重跑部署

---

## 10. 常见故障排查（按报错定位）

### 10.1 `project not found`（Pages 部署）

- 显式配置了 `CLOUDFLARE_PAGES_PROJECT`，但名称和实际 Pages 项目名不一致。
- 先去 Dashboard 复制真实项目名，再更新 Secret。
- 若你没配置该 Secret 且账户下有多个 Pages 项目，工作流会要求你补这个 Secret。

### 10.2 `Authentication error` / `Permission denied`

- 对应 Token 失效、权限不足或账户范围选错。
- 检查是否把 Workers Token 填到了 Pages Secret（或反之）。
- 如果报错里有 `code: 10000`，通常是「Token 权限不足」或「Token 所属账户与 `CLOUDFLARE_ACCOUNT_ID` 不一致」。
- Pages 部署至少需要 `Account -> Cloudflare Pages -> Edit` 权限。

### 10.3 `Invalid base URL` / CORS 报错

- URL 缺 `https://` 或有尾 `/`。
- 前后端域名不匹配。

### 10.4 `Worker size` 超限

- Free 计划会直接失败；确认是否已开 Paid。
- 用 `wrangler deploy --dry-run` 看压缩后体积。

### 10.5 修改了 Secrets 但线上没变化

- 改 Secrets 不会自动触发部署。
- 需要重新 `push main` 或手动 `Run workflow`。

### 10.6 `ERR_PNPM_NOTHING_TO_DEPLOY`

- 触发原因：把 `pnpm -C packages/server deploy` 当成脚本执行，但 pnpm 会优先匹配内置 `deploy` 子命令。
- 正确做法：必须显式执行脚本 `pnpm -C packages/server run deploy`。

### 10.7 `Pages now has wrangler.json support` 警告

- 该警告通常是 `wrangler pages deploy` 在错误目录发现了不适配 Pages 的 `wrangler.json(c)`。
- 当前工作流已通过 `wrangler --cwd ../.. pages deploy ...` 避开这个问题。
- 这是警告，不是失败主因；真正失败通常在后面的权限或项目名错误。

### 10.8 日志里还是旧命令/旧逻辑

- 如果日志还出现 `--project-name \"$CLOUDFLARE_PAGES_PROJECT\"` 等旧写法，说明跑的不是最新 workflow。
- 处理：确认已把最新 `.github/workflows/deploy-cloudflare.yml` 提交到触发分支（通常是 `main`）。

---

## 11. 回滚、暂停、停费

### 11.1 回滚

- Worker：`Workers & Pages -> home-task-api -> Deployments` 回滚到上一个版本
- Pages：`Pages Project -> Deployments` 把上一版设为 active

### 11.2 暂停自动部署

- GitHub 仓库里禁用 `.github/workflows/deploy-cloudflare.yml`

### 11.3 停止计费

- Billing -> Subscriptions 取消 Workers Paid
- 取消通常到当前计费周期末生效
- 建议同时下线自定义域名路由，避免误访问

---

## 12. 参考（官方一手，2026-02 已校验）

- Workers Pricing: <https://developers.cloudflare.com/workers/platform/pricing/>
- Workers Limits: <https://developers.cloudflare.com/workers/platform/limits/>
- Billing Policy: <https://developers.cloudflare.com/billing/billing-policy/>
- Cancel Subscription: <https://developers.cloudflare.com/billing/cancel-subscription/>
- Create Billing Profile: <https://developers.cloudflare.com/billing/create-billing-profile/>
- Pages Direct Upload: <https://developers.cloudflare.com/pages/get-started/direct-upload/>
- Pages CI/CD Direct Upload: <https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/>
- Workers + GitHub Actions: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
- Wrangler Secret Commands: <https://developers.cloudflare.com/workers/wrangler/commands/#secret>
- Hono on Workers: <https://hono.dev/docs/getting-started/cloudflare-workers>
- LangChain on Cloudflare: <https://js.langchain.com/docs/integrations/platforms/cloudflare/>

---

## 13. 本次实操问题总结（可直接对照）

- `VITE_API_BASE_URL 必须以 https:// 开头`：首次可留空，先跑通后再回填正式 API 域名。
- `BETTER_AUTH_URL 必须以 https:// 开头`：不能为空，首次先填 Worker 临时域名。
- `ERR_PNPM_NOTHING_TO_DEPLOY`：把 `deploy` 当成 pnpm 子命令了，改为 `pnpm ... run deploy`。
- `缺少必需 Secret: CLOUDFLARE_PAGES_PROJECT`：现已改为可选；仅在账户下多个 Pages 项目时才需要显式指定。
- `Authentication error code: 10000`：Pages Token 缺 `Account -> Cloudflare Pages -> Edit` 权限，或 Token 与 Account ID 不匹配。
