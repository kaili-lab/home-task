import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VerifyEmailView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Better Auth 验证流程：
    // 1. 用户点击邮件中的链接：{BETTER_AUTH_URL}/api/auth/verify-email?token=xxx&callbackURL=xxx
    // 2. Better Auth 后端处理验证，验证成功后重定向到 callbackURL
    // 3. 前端页面（这个组件）接收重定向，显示验证结果

    // 检查 URL 参数
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const success = searchParams.get("success");

    // 如果有错误参数，显示错误
    if (error) {
      setStatus("error");
      setErrorMessage(decodeURIComponent(error));
      return;
    }

    // 如果 URL 中没有 token，可能是直接访问页面
    if (!token && !success) {
      setStatus("error");
      setErrorMessage("无效的验证链接");
      return;
    }

    // 如果有 success 参数或没有错误，表示验证成功
    // Better Auth 验证成功后可能会重定向到 callbackURL，并可能包含 success 参数
    if (success === "true" || (!error && token)) {
      setStatus("success");
      showToastSuccess("邮箱验证成功！");

      // 延迟跳转到登录页
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } else {
      // 其他情况，显示加载状态
      setStatus("loading");
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="text-center">
          {status === "loading" && (
            <>
              <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-3">
                <span className="text-4xl">⏳</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">验证中...</h1>
              <p className="text-gray-500 text-sm">正在验证您的邮箱地址</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="inline-block p-3 bg-green-100 rounded-2xl mb-3">
                <span className="text-4xl">✅</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">验证成功！</h1>
              <p className="text-gray-500 text-sm mb-6">
                您的邮箱已验证成功，现在可以使用所有功能了。
              </p>
              <p className="text-sm text-gray-400 mb-4">正在跳转到登录页面...</p>
              <Button
                onClick={() => navigate("/login", { replace: true })}
                className="bg-orange-500 hover:bg-orange-600"
              >
                立即登录
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="inline-block p-3 bg-red-100 rounded-2xl mb-3">
                <span className="text-4xl">❌</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">验证失败</h1>
              <p className="text-gray-500 text-sm mb-6">{errorMessage || "验证链接无效或已过期"}</p>
              <div className="space-y-2">
                <Button
                  onClick={() => navigate("/login", { replace: true })}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  返回登录
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/register", { replace: true })}
                  className="w-full"
                >
                  重新注册
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
