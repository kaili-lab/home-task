import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGroupById, removeMember } from "@/services/groups.api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showToastSuccess, showToastError } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MemberListSkeleton } from "@/features/group/MemberListSkeleton";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { GroupDetail } from "shared";

interface GroupMemberListProps {
  groupId: number;
  isOwner?: boolean; // 当前用户是否是群主
  memberCount?: number; // 群组成员总数（用于未展开时显示）
}

export function GroupMemberList({ groupId, isOwner = false, memberCount }: GroupMemberListProps) {
  const { currentUser } = useCurrentUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [members, setMembers] = useState<GroupDetail["members"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: number;
    userName: string;
  } | null>(null);

  // 从API获取群组详情和成员列表
  useEffect(() => {
    const fetchMembers = async () => {
      if (!isExpanded) return; // 只在展开时获取数据

      setLoading(true);
      setError(null);
      try {
        const groupDetail = await getGroupById(groupId);
        setMembers(groupDetail.members || []);
      } catch (err) {
        console.error("获取群组成员失败:", err);
        setError(err instanceof Error ? err.message : "获取群组成员失败");
        showToastError(err instanceof Error ? err.message : "获取群组成员失败");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [groupId, isExpanded]);

  // 打开移除成员确认对话框
  const handleRemoveMember = (userId: number, userName: string | null) => {
    setConfirmDialog({
      open: true,
      userId,
      userName: userName || "该成员",
    });
  };

  // 执行移除成员
  const executeRemoveMember = async (userId: number) => {
    setRemovingUserId(userId);
    try {
      await removeMember(groupId, userId);
      // 从列表中移除该成员
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      showToastSuccess("成员已成功移除");
    } catch (err) {
      console.error("移除成员失败:", err);
      showToastError(err instanceof Error ? err.message : "移除成员失败，请稍后重试");
    } finally {
      setRemovingUserId(null);
    }
  };

  // 获取用户头像首字母
  const getUserInitials = (name: string | null): string => {
    if (name) {
      return name.charAt(0).toUpperCase();
    }
    return "?";
  };

  // 获取用户头像颜色（简单哈希）
  const getUserColor = (userId: number): string => {
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
  };

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 hover:text-gray-900 transition-colors"
      >
        <span>群组成员 ({isExpanded ? members.length : (memberCount ?? 0)}人)</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {loading ? (
            <MemberListSkeleton count={3} showRemoveButton={isOwner} />
          ) : error ? (
            <div className="text-center py-4 text-red-400 text-sm">{error}</div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">暂无成员</div>
          ) : (
            members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback
                      className={cn("bg-linear-to-br text-white", getUserColor(member.userId))}
                    >
                      {getUserInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {member.name || "未命名用户"}
                      </span>
                      {member.userId === currentUser.id && (
                        <Badge variant="secondary" className="text-xs">
                          我
                        </Badge>
                      )}
                      {member.role === "owner" && (
                        <Badge className="bg-orange-500 text-white text-xs">群主</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {member.joinedAt instanceof Date
                        ? `加入于 ${member.joinedAt.toLocaleDateString()}`
                        : "成员"}
                    </span>
                  </div>
                </div>
                {isOwner && member.userId !== currentUser.id && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveMember(member.userId, member.name)}
                    disabled={removingUserId === member.userId}
                  >
                    {removingUserId === member.userId ? "移除中..." : "移除"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 移除成员确认对话框 */}
      <ConfirmDialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
        onConfirm={() => {
          if (confirmDialog) {
            executeRemoveMember(confirmDialog.userId);
            setConfirmDialog(null);
          }
        }}
        title="确认移除成员"
        description={`确定要移除成员"${confirmDialog?.userName}"吗？\n\n移除后，该成员将无法查看该群组的任务和信息。`}
        confirmText="移除"
        cancelText="取消"
        variant="destructive"
      />
    </div>
  );
}
