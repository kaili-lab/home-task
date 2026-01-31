import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginView } from "@/features/auth/LoginView";
import { RegisterView } from "@/features/auth/RegisterView";
import { ForgetPasswordView } from "@/features/auth/ForgetPasswordView";
import { ResetPasswordView } from "@/features/auth/ResetPasswordView";
import { VerifyEmailView } from "@/features/auth/VerifyEmailView";
import { TodayView } from "@/features/today/TodayView";
import { WeekView } from "@/features/week/WeekView";
import { AIView } from "@/features/ai/AIView";
import { MyCreatedGroupsView } from "@/features/group/MyCreatedGroupsView";
import { MyJoinedGroupsView } from "@/features/group/MyJoinedGroupsView";
import { ProfileView } from "@/features/profile/ProfileView";
import { useApp } from "@/contexts/AppContext";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * 根路径重定向组件
 * 根据认证状态重定向到相应页面
 */
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return <Navigate to={isAuthenticated ? "/today" : "/login"} replace />;
}

/**
 * 受保护的路由布局
 * 包裹AppLayout和所有需要登录的路由
 */
function ProtectedLayout() {
  const { createGroupModal } = useApp();

  return (
    <ProtectedRoute>
      <AppLayout onCreateGroup={createGroupModal.open} />
    </ProtectedRoute>
  );
}

/**
 * 应用路由配置
 */
export function AppRoutes() {
  const { createTaskModal } = useApp();

  return (
    <Routes>
      {/* 根路径重定向 */}
      <Route path="/" element={<RootRedirect />} />

      {/* 公开路由 */}
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route path="/forget-password" element={<ForgetPasswordView />} />
      <Route path="/reset-password" element={<ResetPasswordView />} />
      <Route path="/verify-email" element={<VerifyEmailView />} />

      {/* 受保护的路由（使用嵌套路由） */}
      <Route element={<ProtectedLayout />}>
        <Route path="/today" element={<TodayView onCreateTask={createTaskModal.open} />} />
        <Route path="/week" element={<WeekView onCreateTask={createTaskModal.open} />} />
        <Route path="/ai" element={<AIView />} />
        <Route path="/my-groups/created" element={<MyCreatedGroupsView />} />
        <Route path="/my-groups/joined" element={<MyJoinedGroupsView />} />
        <Route path="/profile" element={<ProfileView />} />
      </Route>

      {/* 404 重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
