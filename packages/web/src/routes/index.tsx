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
import { GroupView } from "@/features/group/GroupView";
import { ProfileView } from "@/features/profile/ProfileView";
import { useApp } from "@/contexts/AppContext";

/**
 * 根路径重定向组件
 * 根据认证状态重定向到相应页面
 */
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/today" : "/login"} replace />;
}

/**
 * 受保护的路由布局
 * 包裹AppLayout和所有需要登录的路由
 */
function ProtectedLayout() {
  const { createGroupModal, groups } = useApp();

  return (
    <ProtectedRoute>
      <AppLayout onCreateGroup={createGroupModal.open} groups={groups} />
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
        <Route path="/group" element={<GroupView />} />
        <Route path="/profile" element={<ProfileView />} />
      </Route>

      {/* 404 重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
