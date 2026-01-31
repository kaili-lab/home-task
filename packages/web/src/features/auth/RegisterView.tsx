import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function RegisterView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const passwordMatch = password === confirmPassword;
  const canSubmit =
    email && username && nickname && password && confirmPassword && passwordMatch && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);

    try {
      // Better Auth的username插件会自动处理username字段
      // name字段存储用户昵称（显示名称），username字段存储用户名（用于登录）
      const result = await authClient.signUp.email({
        email, // 使用真实邮箱
        password,
        name: nickname, // name字段存储用户昵称（显示名称）
        username, // username字段存储用户名（用于登录，Better Auth插件需要）
      });

      if (result.error) {
        // 改进错误提示
        const errorMessage = result.error.message || "注册失败";
        if (errorMessage.includes("already exists") || errorMessage.includes("已存在")) {
          showToastError("用户名或邮箱已存在，请选择其他用户名或邮箱");
        } else if (errorMessage.includes("username") && errorMessage.includes("invalid")) {
          showToastError("用户名格式不正确");
        } else if (errorMessage.includes("email") && errorMessage.includes("invalid")) {
          showToastError("邮箱格式不正确");
        } else {
          showToastError(errorMessage);
        }
        console.error("注册错误:", result.error);
        return;
      }

      // 检查用户是否需要验证邮箱
      if (result.data?.user && !result.data.user.emailVerified) {
        setNeedsVerification(true);
        showToastSuccess("注册成功！请检查您的邮箱并点击验证链接");
      } else {
        showToastSuccess("注册成功！正在登录...");
        // 注册成功后自动登录，跳转到首页
        navigate("/today", { replace: true });
      }
    } catch (error) {
      console.error("注册异常:", error);
      showToastError("注册失败，请检查网络连接后重试");
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
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">创建账号</h1>
          <p className="text-gray-500 text-sm mt-1">加入家庭助手，开始管理你的家庭任务</p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {needsVerification && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>📧 邮箱验证</strong>
              </p>
              <p className="text-sm text-blue-700 mt-1">
                我们已向您的邮箱发送了验证链接，请检查邮箱并点击链接完成验证。
              </p>
              <p className="text-sm text-blue-600 mt-2">验证后即可正常使用所有功能。</p>
            </div>
          )}

          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入您的邮箱地址"
              className="mt-1"
              required
              autoFocus
              disabled={needsVerification}
            />
            <p className="text-xs text-gray-500 mt-1">邮箱将用于接收验证邮件和找回密码</p>
          </div>

          <div>
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名（用于登录）"
              className="mt-1"
              required
              disabled={needsVerification}
            />
            <p className="text-xs text-gray-500 mt-1">用户名将用于登录，请妥善保管</p>
          </div>

          <div>
            <Label htmlFor="nickname">昵称</Label>
            <Input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="你的昵称"
              className="mt-1"
              required
              disabled={needsVerification}
            />
            <p className="text-xs text-gray-500 mt-1">昵称将显示在应用中</p>
          </div>

          <div>
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8位字符"
              className="mt-1"
              required
              disabled={needsVerification}
            />
            {password && password.length < 8 && (
              <p className="text-xs text-red-500 mt-1">密码至少需要8位字符</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className="mt-1"
              required
              disabled={needsVerification}
            />
            {confirmPassword && !passwordMatch && (
              <p className="text-xs text-red-500 mt-1">两次密码输入不一致</p>
            )}
          </div>

          <div>
            <Label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-600">
                我已阅读并同意
                <Button variant="link" className="text-orange-500 p-0 h-auto mx-1">
                  服务条款
                </Button>
                和
                <Button variant="link" className="text-orange-500 p-0 h-auto mx-1">
                  隐私政策
                </Button>
              </span>
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={(!canSubmit || isLoading) && !needsVerification}
          >
            {isLoading ? "注册中..." : needsVerification ? "等待邮箱验证" : "注册"}
          </Button>
        </form>

        {/* Login Link */}
        <div className="text-center mt-6">
          {needsVerification ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">验证完成后，请</p>
              <Button
                variant="link"
                onClick={() => navigate("/login")}
                className="text-sm text-orange-500 p-0"
              >
                前往登录
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm text-gray-600">已有账号？</span>
              <Button
                variant="link"
                onClick={() => navigate("/login")}
                className="text-sm text-orange-500 p-0 ml-1"
              >
                立即登录
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
