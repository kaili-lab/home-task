import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppProvider, useApp, userGroupToGroup } from "@/contexts/AppContext";
import { AppRoutes } from "@/routes";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { CreateGroupModal } from "@/features/group/CreateGroupModal";
import { useAuth } from "@/hooks/useAuth";
import { createGroup, getGroups } from "@/services/groups.api";
import { createTask } from "@/services/tasks.api";
import { updateCurrentUser } from "@/services/users.api";
import { showToastSuccess, showToastError } from "@/utils/toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function AppContent() {
  const { createTaskModal, createGroupModal, groups, setGroups } = useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    newGroupId: number;
  } | null>(null);

  const handleCreateTask = async (data: any) => {
    try {
      await createTask(data);
      showToastSuccess("任务创建成功！");
      // 刷新任务列表
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // 跳转到 /today
      navigate("/today");
    } catch (error) {
      console.error("创建任务失败:", error);
      showToastError(error instanceof Error ? error.message : "创建任务失败，请稍后重试");
    }
  };

  const handleCreateGroup = async (data: {
    name: string;
    icon: string;
    isDefault: boolean;
  }) => {
    try {
      // 调用API创建群组
      const newGroup = await createGroup({
        name: data.name,
        avatar: data.icon, // 将icon作为avatar发送给后端
      });

      // 创建成功后刷新群组列表
      const userGroups = await getGroups();
      const convertedGroups = userGroups.map(userGroupToGroup);
      setGroups(convertedGroups);

      // 如果用户选择了设为默认群组
      if (data.isDefault) {
        // 检查用户是否已有默认群组
        if (user?.defaultGroupId) {
          // 先显示创建成功提示
          showToastSuccess("群组创建成功！");
          // 显示确认对话框
          setConfirmDialog({
            open: true,
            newGroupId: newGroup.id,
          });
        } else {
          // 直接设置为默认群组
          try {
            await updateCurrentUser({ defaultGroupId: newGroup.id });
            // 刷新用户信息
            await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
            showToastSuccess("群组创建成功！已设为默认群组");
          } catch (error) {
            console.error("设置默认群组失败:", error);
            showToastSuccess("群组创建成功！");
            showToastError("设置默认群组失败，请稍后重试");
          }
        }
      } else {
        showToastSuccess("群组创建成功！");
      }
    } catch (error) {
      console.error("创建群组失败:", error);
      showToastError(error instanceof Error ? error.message : "创建群组失败，请稍后重试");
    }
  };

  const handleConfirmUpdateDefault = async () => {
    if (!confirmDialog) return;

    try {
      await updateCurrentUser({ defaultGroupId: confirmDialog.newGroupId });
      // 刷新用户信息
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setConfirmDialog(null);
      showToastSuccess("默认群组已更新");
    } catch (error) {
      console.error("更新默认群组失败:", error);
      showToastError(error instanceof Error ? error.message : "更新默认群组失败，请稍后重试");
    }
  };

  return (
    <>
      <AppRoutes />

      <CreateTaskModal
        isOpen={createTaskModal.isOpen}
        onClose={createTaskModal.close}
        onSubmit={handleCreateTask}
      />

      <CreateGroupModal
        isOpen={createGroupModal.isOpen}
        onClose={createGroupModal.close}
        onCreate={handleCreateGroup}
      />

      {/* 确认更新默认群组对话框 */}
      <ConfirmDialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
        onConfirm={handleConfirmUpdateDefault}
        title="更新默认群组"
        description={`您已经有一个默认群组，确定要将新创建的群组设为默认群组吗？\n\n设置后，新创建的群组将成为您的默认群组，用于语音创建任务时的默认归属。`}
        confirmText="更新"
        cancelText="取消"
      />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
