import { AppProvider, useApp, userGroupToGroup } from "@/contexts/AppContext";
import { AppRoutes } from "@/routes";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { CreateGroupModal } from "@/features/group/CreateGroupModal";
import { useTaskList } from "@/hooks/useTaskList";
import { createGroup, getGroups } from "@/services/groups.api";
import { showToastSuccess, showToastError } from "@/utils/toast";

function AppContent() {
  const { createTaskModal, createGroupModal, groups, setGroups } = useApp();
  const { createTask } = useTaskList();

  const handleCreateTask = (data: any) => {
    createTask(data);
  };

  const handleCreateGroup = async (data: { name: string; icon: string }) => {
    try {
      // 调用API创建群组
      await createGroup({
        name: data.name,
        avatar: data.icon, // 将icon作为avatar发送给后端
      });

      // 创建成功后刷新群组列表
      const userGroups = await getGroups();
      const convertedGroups = userGroups.map(userGroupToGroup);
      setGroups(convertedGroups);

      showToastSuccess("群组创建成功！");
    } catch (error) {
      console.error("创建群组失败:", error);
      showToastError(error instanceof Error ? error.message : "创建群组失败，请稍后重试");
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
