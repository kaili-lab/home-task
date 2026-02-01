import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getGroupById } from "@/services/groups.api";
import { useAuth } from "@/hooks/useAuth";
import type { GroupDetail } from "shared";

interface TaskFormAssigneesProps {
  selected: number[];
  onChange: (ids: number[]) => void;
  groupId: number | null; // null 表示个人任务
  currentUserId: number;
}

// 获取用户头像首字母
function getUserInitials(name: string | null): string {
  if (name) {
    return name.charAt(0).toUpperCase();
  }
  return "?";
}

// 获取用户头像颜色（简单哈希）
function getUserColor(userId: number): string {
  const colors = [
    "from-orange-400 to-orange-500",
    "from-blue-400 to-blue-500",
    "from-green-400 to-green-500",
    "from-purple-400 to-purple-500",
    "from-pink-400 to-pink-500",
    "from-red-400 to-red-500",
    "from-yellow-400 to-yellow-500",
    "from-indigo-400 to-indigo-500",
  ];
  return colors[userId % colors.length];
}

export function TaskFormAssignees({
  selected,
  onChange,
  groupId,
  currentUserId,
}: TaskFormAssigneesProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupDetail["members"]>([]);
  const [loading, setLoading] = useState(false);

  // 根据 groupId 加载成员列表
  useEffect(() => {
    const fetchMembers = async () => {
      if (groupId === null) {
        // 个人任务模式：只显示当前用户
        setMembers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const groupDetail = await getGroupById(groupId);
        setMembers(groupDetail.members || []);
      } catch (err) {
        console.error("获取群组成员失败:", err);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [groupId]);

  // 个人任务模式：默认选中当前用户
  useEffect(() => {
    if (groupId === null && selected.length === 0) {
      onChange([currentUserId]);
    }
  }, [groupId, currentUserId, selected.length, onChange]);

  const toggleUser = (userId: number) => {
    const updated = selected.includes(userId)
      ? selected.filter((id) => id !== userId)
      : [...selected, userId];
    onChange(updated);
  };

  // 个人任务模式：只显示当前用户
  if (groupId === null) {
    const currentUserName = user?.name || user?.email?.split("@")[0] || "我";
    const currentUserInitials = getUserInitials(user?.name || user?.email || null);
    return (
      <div>
        <Label>分配给</Label>
        <div className="space-y-2 p-3 border border-gray-200 rounded-lg max-h-32 overflow-y-auto mt-2">
          <Label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
            <Checkbox checked={selected.includes(currentUserId)} onCheckedChange={() => {}} disabled />
            <Avatar className="w-6 h-6">
              <AvatarFallback
                className={cn("bg-linear-to-br text-white text-xs", getUserColor(currentUserId))}
              >
                {currentUserInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-700">我</span>
          </Label>
        </div>
      </div>
    );
  }

  // 群组任务模式：显示群组所有成员
  return (
    <div>
      <Label>分配给（可多选）</Label>
      <div className="space-y-2 p-3 border border-gray-200 rounded-lg max-h-32 overflow-y-auto mt-2">
        {loading ? (
          <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">暂无成员</div>
        ) : (
          members.map((member) => (
            <Label
              key={member.userId}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <Checkbox
                checked={selected.includes(member.userId)}
                onCheckedChange={() => toggleUser(member.userId)}
              />
              <Avatar className="w-6 h-6">
                <AvatarFallback
                  className={cn("bg-linear-to-br text-white text-xs", getUserColor(member.userId))}
                >
                  {getUserInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700">
                {member.name || `用户 ${member.userId}`}
                {member.userId === currentUserId && "（我）"}
              </span>
            </Label>
          ))
        )}
      </div>
    </div>
  );
}
