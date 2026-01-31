import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { showToastError } from "@/utils/toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);

    try {
      const result = await authClient.signIn.username({
        username,
        password,
      });

      if (result.error) {
        // 改进错误提示
        const errorMessage = result.error.message || "登录失败";
        if (errorMessage.includes("password") || errorMessage.includes("密码")) {
          showToastError("用户名或密码错误");
        } else if (errorMessage.includes("not found") || errorMessage.includes("不存在")) {
          showToastError("用户不存在");
        } else {
          showToastError(errorMessage);
        }
        console.error("登录错误:", result.error);
        return;
      }

      // 登录成功，手动触发 session 更新以确保状态同步
      // 这是为了解决 better-auth useSession hook 更新延迟的问题
      const from =
        location.state?.from || new URLSearchParams(location.search).get("from") || "/today";

      try {
        // 手动获取 session 以确保状态已更新
        const sessionResult = await authClient.getSession();
        if (sessionResult?.data?.user) {
          // Session 已更新，可以安全导航
          navigate(from, { replace: true });
        } else {
          // Session 未获取到，等待一下再重试（给服务端一点时间设置 cookie）
          await new Promise((resolve) => setTimeout(resolve, 100));
          const retrySession = await authClient.getSession();
          if (retrySession?.data?.user) {
            navigate(from, { replace: true });
          } else {
            showToastError("登录成功，但无法获取会话信息，请刷新页面");
          }
        }
      } catch (sessionError) {
        console.error("获取 session 失败:", sessionError);
        // 即使获取 session 失败，也尝试导航（可能 session cookie 已设置）
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("登录异常:", error);
      showToastError("登录失败，请检查网络连接后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = username && password;

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-3">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">欢迎回来</h1>
          <p className="text-gray-500 text-sm mt-1">登录你的家庭助手账号</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              className="mt-1"
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="mt-1"
              required
            />
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="link"
              type="button"
              onClick={() => navigate("/forget-password")}
              className="text-sm text-orange-500 p-0"
            >
              忘记密码？
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "登录中..." : "登录"}
          </Button>
        </form>

        {/* Register Link */}
        <div className="text-center mt-6">
          <span className="text-sm text-gray-600">还没有账号？</span>
          <Button
            variant="link"
            onClick={() => navigate("/register")}
            className="text-sm text-orange-500 p-0 ml-1"
          >
            立即注册
          </Button>
        </div>
      </Card>
    </div>
  );
}
