import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Camera, Mail, User, Calendar } from "lucide-react";

export function ProfileView() {
  const { currentUser } = useCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role || "");

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
              <Button variant="outline" className="w-full justify-start">
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
    </section>
  );
}
