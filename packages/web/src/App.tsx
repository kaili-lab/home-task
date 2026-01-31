import { AppProvider, useApp } from "@/contexts/AppContext";
import { AppRoutes } from "@/routes";
import { CreateTaskModal } from "@/features/task/CreateTaskModal";
import { CreateGroupModal } from "@/features/group/CreateGroupModal";
import { useTaskList } from "@/hooks/useTaskList";

function AppContent() {
  const { createTaskModal, createGroupModal, groups, setGroups } = useApp();
  const { createTask } = useTaskList();

  const handleCreateTask = (data: any) => {
    createTask(data);
  };

  const handleCreateGroup = (data: { name: string; icon: string }) => {
    const newGroup = {
      id: Date.now(),
      name: data.name,
      icon: data.icon,
      isDefault: false,
      memberCount: 1,
      inviteCode: Math.random().toString(36).substr(2, 4).toUpperCase(),
    };
    setGroups((prev) => [...prev, newGroup]);
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
