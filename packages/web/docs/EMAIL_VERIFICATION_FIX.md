# 邮箱验证问题修复文档

## 问题概述

在使用 Better Auth 进行邮箱验证时，遇到了两个问题：
1. 验证成功后重定向到错误的地址（服务器地址而非前端地址）
2. 验证成功后前端显示错误信息（实际验证已成功）

## 问题1：重定向到错误地址

### 问题描述
用户点击邮件中的验证链接后，浏览器地址栏变成了 `http://localhost:3000/`（服务器地址），而不是 `http://localhost:5173/verify-email`（前端地址）。

### 根本原因
Better Auth 在生成验证邮件 URL 时，可能已经包含了 `callbackURL` 参数，但值为相对路径 `/`（URL 编码为 `%2F`）。

在 `packages/server/src/auth/auth.ts` 的 `sendVerificationEmail` 函数中：
- 代码只检查 URL 中是否包含 `callbackURL` 字符串
- 如果包含就不修改，即使值是相对路径
- 当 `callbackURL` 是相对路径时，Better Auth 会重定向到 `baseURL + callbackURL` = `http://localhost:3000/`

### 解决方案
修改 `sendVerificationEmail` 函数，解析 URL 并检查 `callbackURL` 是否为完整 URL：
- 使用 `new URL()` 解析传入的 URL
- 使用 `urlObj.searchParams.get("callbackURL")` 获取现有的 callbackURL 值
- 检查 callbackURL 是否为完整 URL（以 `http://` 或 `https://` 开头）
- 如果不是完整 URL（是相对路径），则替换为完整的前端 URL

**关键代码：**
```typescript
const urlObj = new URL(url);
const existingCallbackURL = urlObj.searchParams.get("callbackURL");
if (!existingCallbackURL || (!existingCallbackURL.startsWith("http://") && !existingCallbackURL.startsWith("https://"))) {
  urlObj.searchParams.set("callbackURL", targetCallbackURL);
}
```

## 问题2：验证成功后显示错误信息

### 问题描述
验证成功后，用户被正确重定向到前端页面 `http://localhost:5173/verify-email`，但页面显示"验证失败"的错误信息。实际上验证已经成功（数据库中的 `emailVerified` 字段已变为 `true`，用户可以正常登录）。

### 根本原因
Better Auth 验证成功后重定向到 `callbackURL` 时，**不携带任何参数**（包括 `success` 参数）。验证失败时会携带 `error` 参数（如 `?error=invalid_token`）。

前端代码逻辑：
```typescript
if (!token && !success) {
  setStatus("error"); // 误判为错误
}
```

当验证成功后：
- token 已被消费，不会出现在重定向 URL 中
- Better Auth 不添加 `success` 参数
- 前端误判为错误

### 解决方案

#### 方案1：服务器端添加 success 参数（已采用）
在 `sendVerificationEmail` 函数中，修改 `callbackURL` 时添加 `success=true` 参数：

```typescript
const callbackUrlObj = new URL(targetCallbackURL);
callbackUrlObj.searchParams.set("success", "true");
targetCallbackURL = callbackUrlObj.toString();
```

#### 方案2：前端逻辑优化
修改前端判断逻辑：
- 如果有 `error` 参数，显示错误
- 如果有 `success` 参数，显示成功
- 如果有 `token` 参数，显示加载状态（正在验证）
- 如果都没有，可能是直接访问页面，显示错误提示

**关键代码：**
```typescript
if (success === "true") {
  setStatus("success");
  return;
}
if (token) {
  setStatus("loading");
  return;
}
setStatus("error");
```

## 技术细节

### Better Auth 行为
- **验证成功**：重定向到 `callbackURL`（不携带参数）
- **验证失败**：重定向到 `callbackURL?error=invalid_token`

### 配置说明
- `BETTER_AUTH_URL`: 服务器地址（如 `http://localhost:3000`）
- `FRONTEND_URL`: 前端地址（如 `http://localhost:5173`）
- `callbackURL`: 验证成功后的重定向地址（应指向前端 `/verify-email` 页面）

### 文件位置
- 服务器端：`packages/server/src/auth/auth.ts`
- 前端：`packages/web/src/features/auth/VerifyEmailView.tsx`

## 验证流程

1. 用户注册 → Better Auth 发送验证邮件
2. 邮件链接：`http://localhost:3000/api/auth/verify-email?token=xxx&callbackURL=http://localhost:5173/verify-email?success=true`
3. 用户点击链接 → Better Auth 验证 token
4. 验证成功 → 重定向到 `http://localhost:5173/verify-email?success=true`
5. 前端检测到 `success=true` → 显示成功信息 → 跳转到登录页

## 注意事项

1. 确保 `FRONTEND_URL` 环境变量正确配置
2. `callbackURL` 必须是完整 URL（包含协议和域名）
3. 验证成功后，token 会被消费，不会出现在重定向 URL 中
4. 直接访问 `/verify-email` 页面（无参数）会显示错误提示
