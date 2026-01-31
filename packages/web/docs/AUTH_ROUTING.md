# 认证与路由架构文档

本文档说明项目的认证和路由架构，供AI助手参考。

## 架构概览

- **认证库**: Better Auth (React SDK)
- **路由库**: React Router v7
- **状态管理**: React Query + Context API
- **认证方式**: Cookie-based (HTTP-only)

## 核心文件结构

```
src/
├── lib/
│   └── auth-client.ts          # Better Auth客户端实例
├── contexts/
│   ├── AuthContext.tsx         # 认证状态Context
│   └── AppContext.tsx           # 应用状态Context（Modal、Groups等）
├── hooks/
│   ├── useAuth.ts              # 认证Hook（便捷访问）
│   └── useCurrentUser.ts       # 当前用户Hook（兼容旧代码）
├── components/
│   └── auth/
│       └── ProtectedRoute.tsx  # 路由保护组件
└── routes/
    └── index.tsx                # 路由配置
```

## 认证流程

### 1. 初始化

- `main.tsx`: 包裹 `AuthProvider` 和 `AppProvider`
- `AuthContext`: 使用 `useSession` 获取session，使用React Query查询 `/api/users/me`

### 2. 登录/注册

- `LoginView`: 调用 `authClient.signIn.email()`
- `RegisterView`: 调用 `authClient.signUp.email()`
- 成功后自动跳转（登录跳回原URL或`/today`，注册跳转`/today`）

### 3. 登出

- `Sidebar`: 调用 `authClient.signOut()` → `queryClient.clear()` → `navigate('/login')`

### 4. 路由保护

- `ProtectedRoute`: 检查 `isAuthenticated`，未登录重定向到 `/login`（保存原URL）

## 路由结构

```
/                    → 重定向（已登录→/today，未登录→/login）
/login               → LoginView（公开）
/register            → RegisterView（公开）
/today               → TodayView（受保护）
/week                → WeekView（受保护）
/ai                  → AIView（受保护）
/group               → GroupView（受保护）
/profile             → ProfileView（受保护）
```

## 权限控制

### 当前实现

- **路由级**: `ProtectedRoute` 检查登录状态
- **组件级**: 通过 `useAuth().user.role` 判断（如 `user.role === "admin"`）
- **API级**: 后端返回401/403，前端统一处理

### 401/403处理

- **401**: `queryClient.clear()` → 跳转 `/login`（保存原URL）
- **403**: `showToastError()` → 跳转 `/today`
- 处理位置: `main.tsx` 的 React Query `onError`

## 开发模式

### 添加新路由

1. 在 `routes/index.tsx` 添加 `<Route path="/xxx" element={<XxxView />} />`
2. 如需保护，包裹在 `<ProtectedRoute>` 中
3. 如需admin权限，在组件内检查 `user.role === "admin"`

### 获取用户信息

```tsx
import { useAuth } from "@/hooks/useAuth";
const { user, isAuthenticated } = useAuth();
```

### 导航

```tsx
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();
navigate("/today");
```

### 检查当前路径

```tsx
import { useLocation } from "react-router-dom";
const location = useLocation();
location.pathname === "/today"; // true/false
```

## 注意事项

1. **用户名登录**: 暂不支持，UI已预留但后端未实现
2. **Admin路由**: 暂不实现，组件内通过role判断即可
3. **状态管理**: Modal和Groups状态在 `AppContext` 中管理
4. **错误处理**: 401/403在React Query全局onError中统一处理
