import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";

export function ResetPasswordView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      showToastError("无效的重置链接");
      navigate("/forget-password");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams, navigate]);

  const passwordMatch = password === confirmPassword;
  const canSubmit = password && confirmPassword && passwordMatch && token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token) return;

    setIsLoading(true);

    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: password,
      });

      if (result.error) {
        const errorMessage = result.error.message || "重置失败";
        if (errorMessage.includes("expired") || errorMessage.includes("过期")) {
          showToastError("重置链接已过期，请重新申请");
          navigate("/forget-password");
        } else if (errorMessage.includes("invalid") || errorMessage.includes("无效")) {
          showToastError("无效的重置链接");
          navigate("/forget-password");
        } else {
          showToastError(errorMessage);
        }
        console.error("重置密码错误:", result.error);
        return;
      }

      showToastSuccess("密码重置成功！请使用新密码登录");
      navigate("/login");
    } catch (error) {
      console.error("重置密码异常:", error);
      showToastError("重置失败，请检查网络连接后重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <PageLoader message="加载中..." />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-3">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">重置密码</h1>
          <p className="text-gray-500 text-sm mt-1">请输入您的新密码</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">新密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位字符"
              className="mt-1"
              required
              autoFocus
            />
            {password && password.length < 6 && (
              <p className="text-xs text-red-500 mt-1">密码至少需要6位字符</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="mt-1"
              required
            />
            {confirmPassword && !passwordMatch && (
              <p className="text-xs text-red-500 mt-1">两次密码输入不一致</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "重置中..." : "重置密码"}
          </Button>
        </form>

        {/* Back to Login Link */}
        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-sm text-gray-600 p-0"
          >
            ← 返回登录
          </Button>
        </div>
      </Card>
    </div>
  );
}
