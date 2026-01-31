import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useApp, userGroupToGroup } from "@/contexts/AppContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InviteCodeDisplay } from "@/features/group/InviteCodeDisplay";
import { GroupMemberList } from "@/features/group/GroupMemberList";
import { leaveGroup, deleteGroup, joinGroup, getGroups } from "@/services/groups.api";
import { showToastError, showToastSuccess } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function MyJoinedGroupsView() {
  const { groups, setGroups } = useApp();
  const { currentUser } = useCurrentUser();
  const joinedGroups = groups.filter((g) => g.role === "member");
  const [loading, setLoading] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "leave" | "delete";
    groupId: number;
    groupName: string;
  } | null>(null);

  // 加入群组
  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      showToastError("请输入邀请码");
      return;
    }

    setJoining(true);
    try {
      await joinGroup(inviteCode.trim());
      // 刷新群组列表
      const userGroups = await getGroups();
      const convertedGroups = userGroups.map(userGroupToGroup);
      setGroups(convertedGroups);
      setInviteCode("");
      showToastSuccess("成功加入群组！");
    } catch (error) {
      console.error("加入群组失败:", error);
      showToastError(error instanceof Error ? error.message : "加入群组失败，请稍后重试");
    } finally {
      setJoining(false);
    }
  };

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
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-800">我加入的群组 ➕</h2>
        <p className="text-gray-500 text-sm mt-1">查看你加入的家庭群组</p>
      </div>

      {/* 群组列表 */}
      {joinedGroups.length === 0 ? (
        <Card className="p-12 text-center max-w-2xl mx-auto mt-24">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-400 mb-4">还没有加入的群组</p>
          <p className="text-sm text-gray-500 mb-6">输入邀请码加入群组</p>
          {/* 输入邀请码区域 */}
          <div className="flex items-center gap-3 max-w-md mx-auto">
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="输入邀请码"
              className="flex-1"
              onKeyPress={(e) => {
                if (e.key === "Enter" && !joining && inviteCode.trim()) {
                  handleJoinGroup();
                }
              }}
            />
            <Button
              onClick={handleJoinGroup}
              disabled={!inviteCode.trim() || joining}
              className="bg-orange-500 hover:bg-orange-600 whitespace-nowrap"
            >
              {joining ? "加入中..." : "加入群组"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {joinedGroups.map((group) => (
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
              <GroupMemberList groupId={group.id} isOwner={group.role === "owner"} memberCount={group.memberCount} />
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
        title={confirmDialog?.type === "leave" ? "确认退出群组" : "确认解散群组"}
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
