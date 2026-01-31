import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { showToastError } from "@/utils/toast";
import App from "./App.tsx";
import "./index.css";
import React from "react";

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (error: unknown) => {
        // 处理401/403错误
        if (error && typeof error === "object" && "status" in error) {
          const status = error.status as number;
          if (status === 401) {
            // 401: 清除缓存并跳转到登录页
            queryClient.clear();
            const currentPath = window.location.pathname;
            if (currentPath !== "/login" && currentPath !== "/register") {
              window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
            }
          } else if (status === 403) {
            // 403: 显示错误提示并跳转到首页
            showToastError("无权限访问");
            if (window.location.pathname !== "/today") {
              window.location.href = "/today";
            }
          }
        }
      },
    },
    mutations: {
      retry: 0,
      onError: (error: unknown) => {
        // 处理401/403错误
        if (error && typeof error === "object" && "status" in error) {
          const status = error.status as number;
          if (status === 401) {
            queryClient.clear();
            const currentPath = window.location.pathname;
            if (currentPath !== "/login" && currentPath !== "/register") {
              window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
            }
          } else if (status === 403) {
            showToastError("无权限访问");
          }
        }
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-center" richColors />
          {/* 开发环境显示 React Query Devtools */}
          {/* DEV是Vite 内置提供的环境变量，它不需要在 .env 文件中定义 */}
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
