import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InviteCodeDisplay } from "@/features/group/InviteCodeDisplay";
import { GroupMemberList } from "@/features/group/GroupMemberList";
import { leaveGroup, deleteGroup } from "@/services/groups.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function GroupView() {
  const { groups, setGroups, createGroupModal } = useApp();
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "leave" | "delete";
    groupId: number;
    groupName: string;
  } | null>(null);

  // 打开退出群组确认对话框
  const handleLeaveGroup = (groupId: number, groupName: string) => {
    setConfirmDialog({
      open: true,
      type: "leave",
      groupId,
      groupName,
    });
  };

  // 执行退出群组
  const executeLeaveGroup = async (groupId: number) => {
    setLoading(groupId);
    try {
      await leaveGroup(groupId, currentUser.id);
      // 从列表中移除该群组
      setGroups(groups.filter((g) => g.id !== groupId));
      showToastSuccess("已成功退出群组");
    } catch (error) {
      console.error("退出群组失败:", error);
      showToastError(error instanceof Error ? error.message : "退出群组失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  };

  // 打开解散群组确认对话框
  const handleDeleteGroup = (groupId: number, groupName: string) => {
    setConfirmDialog({
      open: true,
      type: "delete",
      groupId,
      groupName,
    });
  };

  // 执行解散群组
  const executeDeleteGroup = async (groupId: number) => {
    setLoading(groupId);
    try {
      await deleteGroup(groupId);
      // 从列表中移除该群组
      setGroups(groups.filter((g) => g.id !== groupId));
      showToastSuccess("群组已成功解散");
    } catch (error) {
      console.error("解散群组失败:", error);
      showToastError(error instanceof Error ? error.message : "解散群组失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">家庭群组管理 👥</h2>
          <p className="text-gray-500 text-sm mt-1">管理你的家庭群组和成员</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            输入邀请码
          </Button>
          <Button onClick={createGroupModal.open} className="bg-orange-500 hover:bg-orange-600">
            <span className="mr-2">➕</span>
            创建群组
          </Button>
        </div>
      </div>

      {/* 群组列表 */}
      {groups.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-400 mb-4">还没有群组</p>
          <Button onClick={createGroupModal.open} className="bg-orange-500 hover:bg-orange-600">
            创建第一个群组
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {groups.map((group) => (
            <Card key={group.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                    {group.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-gray-800">{group.name}</h3>
                      {group.role === "owner" && (
                        <Badge className="bg-yellow-100 text-yellow-700">⭐ 群主</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{group.memberCount} 位成员</p>
                  </div>
                </div>
                {(group.role === "member" || group.role === "owner") && (
                  <div className="flex gap-2 shrink-0">
                    {group.role === "member" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 border-red-300 whitespace-nowrap"
                        onClick={() => handleLeaveGroup(group.id, group.name)}
                        disabled={loading === group.id}
                      >
                        {loading === group.id ? "退出中..." : "退出群组"}
                      </Button>
                    )}
                    {group.role === "owner" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 border-red-300 whitespace-nowrap"
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        disabled={loading === group.id}
                      >
                        {loading === group.id ? "解散中..." : "解散群组"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 邀请码 */}
              <InviteCodeDisplay inviteCode={group.inviteCode || ""} />

              {/* 成员列表 */}
              <GroupMemberList groupId={group.id} isOwner={group.role === "owner"} />
            </Card>
          ))}
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
        onConfirm={() => {
          if (confirmDialog?.type === "leave") {
            executeLeaveGroup(confirmDialog.groupId);
          } else if (confirmDialog?.type === "delete") {
            executeDeleteGroup(confirmDialog.groupId);
          }
          setConfirmDialog(null);
        }}
        title={
          confirmDialog?.type === "leave"
            ? "确认退出群组"
            : "确认解散群组"
        }
        description={
          confirmDialog?.type === "leave"
            ? `确定要退出群组"${confirmDialog.groupName}"吗？\n\n退出后，您将无法查看该群组的任务和信息。`
            : `⚠️ 警告：确定要解散群组"${confirmDialog?.groupName}"吗？\n\n解散后：\n• 所有成员将被移除\n• 群组相关任务将被删除\n• 此操作无法撤销\n\n请谨慎操作！`
        }
        confirmText={confirmDialog?.type === "leave" ? "退出" : "解散"}
        cancelText="取消"
        variant="destructive"
      />
    </section>
  );
}
