import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ForgetPasswordView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);

    try {
      // 构建前端重置密码页面的完整 URL
      const frontendUrl = window.location.origin;
      const redirectTo = `${frontendUrl}/reset-password`;

      const result = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });

      if (result.error) {
        const errorMessage = result.error.message || "发送失败";
        if (errorMessage.includes("not found") || errorMessage.includes("不存在")) {
          // 为了安全，不显示用户不存在的信息
          showToastError("如果该邮箱已注册，我们将发送密码重置链接");
        } else {
          showToastError(errorMessage);
        }
        console.error("忘记密码错误:", result.error);
        return;
      }

      setEmailSent(true);
      showToastSuccess("密码重置邮件已发送，请检查您的邮箱");
    } catch (error) {
      console.error("忘记密码异常:", error);
      showToastError("发送失败，请检查网络连接后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-3">
            <span className="text-4xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">忘记密码</h1>
          <p className="text-gray-500 text-sm mt-1">输入您的邮箱地址，我们将发送密码重置链接</p>
        </div>

        {emailSent ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>📧 邮件已发送</strong>
              </p>
              <p className="text-sm text-blue-700 mt-2">
                我们已向 <strong>{email}</strong>{" "}
                发送了密码重置链接，请检查您的邮箱并点击链接重置密码。
              </p>
              <p className="text-sm text-blue-600 mt-2">链接将在 1 小时后失效。</p>
            </div>

            <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
              返回登录
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入您的注册邮箱"
                className="mt-1"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">我们将向此邮箱发送密码重置链接</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={!email || isLoading}
            >
              {isLoading ? "发送中..." : "发送重置链接"}
            </Button>
          </form>
        )}

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
