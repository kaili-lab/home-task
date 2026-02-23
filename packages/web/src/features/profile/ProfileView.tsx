import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { changeCurrentUserPassword } from "@/services/users.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { Camera, Mail, User, Calendar } from "lucide-react";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 20;

function mapChangePasswordError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "修改密码失败，请稍后重试";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("invalid password") ||
    message.includes("invalid_password") ||
    message.includes("password is invalid")
  ) {
    return "当前密码不正确";
  }

  if (message.includes("password too short") || message.includes("password_too_short")) {
    return "新密码至少需要 8 位";
  }

  if (message.includes("password too long") || message.includes("password_too_long")) {
    return "新密码最多 20 位";
  }

  if (message.includes("session") && message.includes("fresh")) {
    return "登录状态已过期，请重新登录后再试";
  }

  return error.message || "修改密码失败，请稍后重试";
}

export function ProfileView() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentUser } = useCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role || "");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSave = () => {
    // TODO: API 调用保存
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(currentUser.name);
    setEmail(currentUser.email);
    setRole(currentUser.role || "");
    setIsEditing(false);
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const closePasswordDialog = () => {
    if (isChangingPassword) return;
    setIsPasswordDialogOpen(false);
    resetPasswordForm();
  };

  const passwordMatch = newPassword === confirmPassword;
  const passwordLengthValid =
    newPassword.length >= PASSWORD_MIN_LENGTH && newPassword.length <= PASSWORD_MAX_LENGTH;
  const passwordChanged = newPassword.length > 0 && currentPassword !== newPassword;
  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    passwordMatch &&
    passwordLengthValid &&
    passwordChanged;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword) return;

    setIsChangingPassword(true);
    let changedOnServer = false;

    try {
      await changeCurrentUserPassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      changedOnServer = true;

      // 密码更新后立刻登出，避免当前页面继续使用旧会话状态
      await signOut();
      showToastSuccess("密码修改成功，请使用新密码重新登录");
      setIsPasswordDialogOpen(false);
      resetPasswordForm();
      navigate("/login", { replace: true });
    } catch (error) {
      if (changedOnServer) {
        console.error("密码已修改，但自动登出失败:", error);
        showToastSuccess("密码已修改，请重新登录");
        navigate("/login", { replace: true });
        return;
      }
      showToastError(mapChangePasswordError(error));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">个人资料</h2>
        <p className="text-gray-500 text-sm mt-1">管理你的个人信息和偏好设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card - Avatar & Basic Info */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarFallback
                  className={cn("bg-linear-to-br text-white text-3xl", currentUser.color)}
                >
                  {currentUser.initials}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8 bg-orange-500 hover:bg-orange-600"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            <h3 className="font-bold text-lg text-gray-800 mt-4">{currentUser.name}</h3>
            <p className="text-sm text-gray-500">{currentUser.email}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>加入于 2026年1月</span>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">完成任务数</span>
              <span className="font-medium text-gray-800">128</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">创建任务数</span>
              <span className="font-medium text-gray-800">256</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">所属群组</span>
              <span className="font-medium text-gray-800">2 个</span>
            </div>
          </div>
        </Card>

        {/* Right Card - Profile Form */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-gray-800">基本信息</h3>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                编辑资料
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleCancel} variant="outline" size="sm">
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  保存
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                昵称
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                邮箱地址
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            {/* <div>
              <Label htmlFor="role" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                职业/角色
              </Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={!isEditing}
                placeholder="例如：软件工程师"
                className="mt-1"
              />
            </div> */}
          </div>

          <Separator className="my-6" />

          <div>
            <h4 className="font-medium text-gray-800 mb-4">账号安全</h4>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsPasswordDialogOpen(true)}
              >
                🔐 修改密码
              </Button>
              {/* <Button variant="outline" className="w-full justify-start">
                📱 绑定手机号
              </Button>
              <Button variant="outline" className="w-full justify-start">
                🔗 第三方账号绑定
              </Button> */}
            </div>
          </div>

          {/* <Separator className="my-6" />

          <div>
            <h4 className="font-medium text-gray-800 mb-4">偏好设置</h4>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                🌙 深色模式
              </Button>
              <Button variant="outline" className="w-full justify-start">
                🔔 通知设置
              </Button>
              <Button variant="outline" className="w-full justify-start">
                🌐 语言设置
              </Button>
            </div>
          </div>*/}
        </Card>
      </div>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePasswordDialog();
            return;
          }
          setIsPasswordDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              为了账号安全，修改后将自动使其他设备的登录失效。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="current-password">当前密码</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                autoComplete="current-password"
                className="mt-1"
                disabled={isChangingPassword}
                required
              />
            </div>

            <div>
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8-20位字符"
                autoComplete="new-password"
                className="mt-1"
                disabled={isChangingPassword}
                required
              />
              {newPassword.length > 0 && !passwordLengthValid && (
                <p className="text-xs text-red-500 mt-1">新密码长度需要在 8 到 20 位之间</p>
              )}
              {newPassword.length > 0 && currentPassword === newPassword && (
                <p className="text-xs text-red-500 mt-1">新密码不能与当前密码相同</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                autoComplete="new-password"
                className="mt-1"
                disabled={isChangingPassword}
                required
              />
              {confirmPassword.length > 0 && !passwordMatch && (
                <p className="text-xs text-red-500 mt-1">两次输入的新密码不一致</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closePasswordDialog}
                disabled={isChangingPassword}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600"
                disabled={!canSubmitPassword || isChangingPassword}
              >
                {isChangingPassword ? "修改中..." : "确认修改"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
